<script setup lang="ts">
import type { CompanyBankAccountDto } from '~/types/payments'
import { fromCompanyAccount } from '~/utils/companyAccountCopy'

// Picks one of the company's bank accounts (V201) for a payment: where the payer deposited (destination of a
// collection) or where a commission payout leaves from (origin). The list is filtered to the selected payment
// method (V217: an account accepts several), so Pago Móvil shows the Pago Móvil accounts, a transfer the
// transfer ones. The selected account is shown with copy buttons (AccountCopyCard); for Pago Móvil the copied
// text carries the amount in bolívares when it can be known. Loads the active list once, on mount.
const props = withDefaults(defineProps<{
  /** Selected payment method; the list only shows accounts of that method. Empty = every active account. */
  methodUuid?: string | null
  /** Amount of the payment being registered (decimal string or number); optional. */
  amount?: string | number | null
  /** ISO currency of that amount; defaults to USD like the rest of the app (ADR 0015). */
  currency?: string | null
  /** Payment date (`yyyy-MM-dd` or ISO datetime) the exchange rate is taken at; empty = now. */
  date?: string | null
  label?: string
  help?: string
}>(), {
  methodUuid: null,
  amount: null,
  currency: null,
  date: null,
  label: undefined,
  help: undefined,
})

const model = defineModel<string>({ default: '' })

const { t } = useI18n()
const { can } = usePermissions()
const canViewAccounts = computed(() => can('COMPANY_BANK_ACCOUNT_VIEW'))

const accounts = ref<CompanyBankAccountDto[]>([])
const loading = ref(false)

const forMethod = computed(() => props.methodUuid
  ? accounts.value.filter(a => a.paymentMethods.some(m => m.uuid === props.methodUuid))
  : accounts.value)

function optionLabel(a: CompanyBankAccountDto): string {
  const where = a.accountNumber || a.phone || a.email || ''
  const bank = [a.bankCode ?? a.bank_Code, a.bank_Display].filter(Boolean).join(' ')
  return [bank, where].filter(Boolean).join(' · ') + ` (${a.currency_Code})`
}

const options = computed(() => forMethod.value.map(a => ({ label: optionLabel(a), value: a.uuid })))
const selected = computed(() => forMethod.value.find(a => a.uuid === model.value) ?? null)
// The code of the selected payment method, so the card shows and copies only that method's fields.
const selectedMethodCode = computed(() => selected.value?.paymentMethods.find(m => m.uuid === props.methodUuid)?.code ?? null)

// A different method makes the previous pick meaningless; a method with a single account preselects it.
watch([() => props.methodUuid, accounts, loading], () => {
  if (loading.value) return
  if (model.value && !forMethod.value.some(a => a.uuid === model.value)) model.value = ''
  if (!model.value && props.methodUuid && forMethod.value.length === 1) model.value = forMethod.value[0]!.uuid
})

// ---- Amount in bolívares for the Pago Móvil text ----
// Used as is when the form amount is already VES; otherwise the app's converter gives the VES value at the
// payment date. No rate (or no amount) simply leaves the amount line out.
const sourceCurrency = computed(() => (props.currency || 'USD').toUpperCase())
const amountNumber = computed(() => {
  const n = Number(props.amount)
  return Number.isFinite(n) && n > 0 ? n : null
})
const { result: conversion } = useCurrencyConverter(
  () => (sourceCurrency.value === 'VES' ? null : amountNumber.value),
  () => sourceCurrency.value,
  () => props.date,
)
const amountVes = computed<number | null>(() => {
  if (amountNumber.value === null) return null
  if (sourceCurrency.value === 'VES') return amountNumber.value
  const r = conversion.value
  return r.state === 'ok' && r.targetCurrency === 'VES' && r.convertedAmount ? r.convertedAmount : null
})

function openAdmin(to: string) {
  window.open(to, '_blank', 'noopener')
}

onMounted(async () => {
  loading.value = true
  try {
    accounts.value = (await useCompanyBankAccounts().forPayers()) ?? []
  }
  catch {
    accounts.value = []
  }
  finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="space-y-2">
    <UFormField :label="label ?? t('payments.companyAccounts.pickerLabel')" :help="help ?? t('payments.companyAccounts.pickerHelp')">
      <div class="flex items-center gap-1">
        <USelectMenu
          v-if="loading || forMethod.length > 0"
          v-model="model"
          clear
          :items="options"
          label-key="label"
          value-key="value"
          :loading="loading"
          :placeholder="t('common.select')"
          class="w-full"
        />
        <p v-else class="w-full text-xs text-prohealth-500">{{ methodUuid ? t('payments.companyAccounts.noneForMethod') : t('payments.companyAccounts.noneAtAll') }}</p>
        <CommonEntityQuickLinkButton to="/dashboard/company-bank-accounts" :can="canViewAccounts" @navigate="openAdmin" />
      </div>
    </UFormField>
    <AccountCopyCard v-if="selected" :account="fromCompanyAccount(selected, selectedMethodCode)" :amount-ves="amountVes" />
  </div>
</template>
