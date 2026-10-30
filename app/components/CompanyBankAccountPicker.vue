<script setup lang="ts">
import type { CompanyBankAccountDto } from '~/types/payments'

// Lets a payer say which of the company's bank accounts they paid into (V201), and shows that
// account's details so they know where to deposit. Loads the payer-facing list once, on mount.
const model = defineModel<string>({ default: '' })

const { t } = useI18n()
const accounts = ref<CompanyBankAccountDto[]>([])
const loading = ref(false)

const options = computed(() => accounts.value.map(a => ({
  label: `${a.bank_Display ?? a.bank_Code ?? ''} · ${a.accountNumber} (${a.currency_Code})`,
  value: a.uuid,
})))
const selected = computed(() => accounts.value.find(a => a.uuid === model.value) ?? null)

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
  <div v-if="loading || accounts.length > 0" class="space-y-2">
    <UFormField :label="t('payments.companyAccounts.pickerLabel')" :help="t('payments.companyAccounts.pickerHelp')">
      <USelectMenu
        v-model="model"
        clear
        :items="options"
        label-key="label"
        value-key="value"
        :loading="loading"
        :placeholder="t('common.select')"
        class="w-full"
      />
    </UFormField>
    <dl v-if="selected" class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 rounded-lg bg-prohealth-50/60 p-3 text-xs text-prohealth-700">
      <div><dt class="inline font-semibold">{{ t('payments.companyAccounts.fields.bank') }}: </dt><dd class="inline">{{ selected.bank_Display ?? selected.bank_Code }}</dd></div>
      <div><dt class="inline font-semibold">{{ t('payments.companyAccounts.fields.accountType') }}: </dt><dd class="inline">{{ selected.accountType }}</dd></div>
      <div><dt class="inline font-semibold">{{ t('payments.companyAccounts.fields.accountNumber') }}: </dt><dd class="inline font-mono">{{ selected.accountNumber }}</dd></div>
      <div><dt class="inline font-semibold">{{ t('payments.companyAccounts.fields.holderName') }}: </dt><dd class="inline">{{ selected.holderName }}</dd></div>
      <div><dt class="inline font-semibold">{{ t('payments.companyAccounts.fields.holderDocument') }}: </dt><dd class="inline">{{ selected.holderDocument }}</dd></div>
      <div v-if="selected.notes"><dt class="inline font-semibold">{{ t('payments.companyAccounts.fields.notes') }}: </dt><dd class="inline">{{ selected.notes }}</dd></div>
    </dl>
  </div>
</template>
