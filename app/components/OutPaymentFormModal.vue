<script setup lang="ts">
import { z } from 'zod'
import type { PaymentDto, OutPaymentCreateRequest, OutPaymentUpdateRequest } from '~/types/payments'
import { BANK_ACCOUNT_TYPE_OPTIONS } from '~/types/payments'
import type { CatalogItem } from '~/types/catalogs'
import type { PromoterDto } from '~/types/promoters'

const props = defineProps<{ open: boolean, payment?: PaymentDto | null }>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  'saved': [payment: PaymentDto]
}>()

const { t } = useI18n()
const { formatCurrency, formatDate } = useFormatters()
const payments = usePayments()
const promoters = usePromoters()
const categoriesApi = useCatalog('/v1/admin/payment-categories')
const methodsApi = useCatalog('/v1/admin/payment-methods')
const banksApi = useCatalog('/v1/admin/banks')
const currenciesApi = useCatalog('/v1/admin/currencies')
const exchangeRates = useExchangeRates()
const { organization, ensureLoaded: ensureOrganizationLoaded } = useOrganization()
const toast = useToast()
const { can } = usePermissions()
const canViewMethods = computed(() => can('PAYMENT_METHOD_VIEW_ALL'))
const canViewBanks = computed(() => can('BANK_VIEW_ALL'))
const canViewCurrencies = computed(() => can('CURRENCY_VIEW_ALL'))

function openCatalog(to: string) {
  window.open(to, '_blank', 'noopener')
}

const isOpen = computed({ get: () => props.open, set: value => emit('update:open', value) })
const editing = computed(() => Boolean(props.payment))
const submitting = ref(false)
const loadingOptions = ref(false)
const promoterOptions = ref<{ label: string, value: string, personUuid?: string }[]>([])
const categoryOptions = ref<{ label: string, value: string }[]>([])
const currencyOptions = ref<{ label: string, value: string }[]>([])
const loadingCurrencies = ref(false)

// The person picker shows the promoter's display name (matches the person's
// own name in practice) while `state.personUuid` — sent to the backend —
// stays the real UUID.
const personDisplayName = computed(() => {
  const promoter = promoterOptions.value.find(option => option.value === state.promoterUuid)
  return promoter?.label ?? ''
})

interface FormState {
  promoterUuid: string
  personUuid: string
  paymentCategoryUuid: string
  amount: string
  currency: string
  paymentMethodUuid: string
  bankUuid: string
  identification: string
  bankAccountType: string
  bankAccountCode: string
  bankAccountIdentifier: string
  phone: string
  email: string
  referenceNumber: string
  paymentDate: string
  adminNotes: string
}

const state = reactive<FormState>({
  promoterUuid: '',
  personUuid: '',
  paymentCategoryUuid: '',
  amount: '',
  currency: 'USD',
  paymentMethodUuid: '',
  bankUuid: '',
  identification: '',
  bankAccountType: '',
  bankAccountCode: '',
  bankAccountIdentifier: '',
  phone: '',
  email: '',
  referenceNumber: '',
  paymentDate: new Date().toISOString().slice(0, 16),
  adminNotes: '',
})

const methodOptions = ref<{ label: string, value: string }[]>([])
const bankOptions = ref<{ label: string, value: string }[]>([])
const banksByUuid = ref<Record<string, CatalogItem>>({})
const selectedMethod = ref<CatalogItem | null>(null)
const supportFile = ref<File | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

function clearFile() {
  supportFile.value = null
  if (fileInput.value) fileInput.value.value = ''
}

// Byte size with universal units (not localized).
function formatSize(bytes?: number | null): string {
  if (bytes === null || bytes === undefined) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isoToDatetimeLocal(iso: string): string {
  const date = new Date(iso)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function datetimeLocalToIso(value: string): string {
  return new Date(value).toISOString()
}
const schema = computed(() => z.object({
  promoterUuid: z.string().min(1, t('validation.required')),
  personUuid: z.string().min(1, t('validation.required')),
  paymentCategoryUuid: z.string().min(1, t('validation.required')),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, t('validation.invalidAmount')),
  currency: z.string().min(1, t('validation.required')),
  paymentMethodUuid: z.string().min(1, t('validation.required')),
  bankUuid: selectedMethod.value?.mandatoryBank ? z.string().min(1, t('validation.required')) : z.string().optional(),
  identification: selectedMethod.value?.mandatoryIdentification ? z.string().min(1, t('validation.required')) : z.string().optional(),
  bankAccountType: selectedMethod.value?.mandatoryAccountType ? z.string().min(1, t('validation.required')) : z.string().optional(),
  bankAccountCode: selectedMethod.value?.mandatoryAccountCode ? z.string().min(1, t('validation.required')) : z.string().optional(),
  bankAccountIdentifier: selectedMethod.value?.mandatoryBankAccount ? z.string().min(1, t('validation.required')) : z.string().optional(),
  phone: selectedMethod.value?.mandatoryPhone ? z.string().min(1, t('validation.required')) : z.string().optional(),
  email: selectedMethod.value?.mandatoryEmail ? z.string().email(t('validation.emailInvalid')) : z.string().optional(),
  referenceNumber: selectedMethod.value?.mandatoryReferenceNumber ? z.string().min(1, t('validation.required')) : z.string().max(80).optional(),
  paymentDate: z.string().min(1, t('validation.required')),
  adminNotes: z.string().max(1000).optional(),
}))

// Currency dropdown label uses the real `symbol` from the master (ADR 0015)
// — "USD ($)" — not a hardcoded code -> symbol map. `value` sent to the
// backend stays the ISO `code`, same contract as before.
async function loadCurrencies() {
  loadingCurrencies.value = true
  try {
    const currencies = await currenciesApi.listAll()
    currencyOptions.value = currencies
      .filter((currency: CatalogItem) => currency.active)
      .map((currency: CatalogItem) => ({ label: `${currency.code} (${currency.symbol})`, value: currency.code! }))
  }
  catch {
    currencyOptions.value = []
  }
  finally {
    loadingCurrencies.value = false
  }
}

async function loadOptions() {
  loadingOptions.value = true
  try {
    const [promoterPage, categories, methods, banks] = await Promise.all([
      promoters.list({ size: 200, sort: ['displayName,asc'] }),
      categoriesApi.listAll({ filter: 'direction==OUT' }),
      methodsApi.listAll(),
      banksApi.listAll(),
    ])
    promoterOptions.value = (promoterPage.content ?? [])
      .filter((promoter: PromoterDto) => promoter.active)
      .map((promoter: PromoterDto) => ({ label: promoter.displayName, value: promoter.uuid, personUuid: promoter.person_Uuid ?? undefined }))
    categoryOptions.value = categories
      .filter((category: CatalogItem) => category.active && category.direction === 'OUT')
      .map((category: CatalogItem) => ({ label: category.name, value: category.uuid }))
    methodOptions.value = methods
      .filter((method: CatalogItem) => method.active)
      .map((method: CatalogItem) => ({ label: method.name, value: method.uuid }))
    const activeBanks = banks.filter((bank: CatalogItem) => bank.active)
    bankOptions.value = activeBanks
      .map((bank: CatalogItem) => ({ label: bank.code ? `${bank.code} — ${bank.name}` : bank.name, value: bank.uuid }))
    banksByUuid.value = Object.fromEntries(activeBanks.map((bank: CatalogItem) => [bank.uuid, bank]))
  }
  catch {
    promoterOptions.value = []
    categoryOptions.value = []
    methodOptions.value = []
    bankOptions.value = []
  }
  finally {
    loadingOptions.value = false
  }
}

function reset() {
  state.promoterUuid = props.payment?.promoter_Uuid ?? ''
  state.personUuid = props.payment?.person_Uuid ?? ''
  state.paymentCategoryUuid = props.payment?.paymentType_Uuid ?? ''
  state.amount = props.payment ? String(props.payment.amount) : ''
  state.currency = props.payment?.currency_Code ?? props.payment?.currency ?? 'USD'
  state.paymentMethodUuid = (props.payment as PaymentDto & { paymentMethod_Uuid?: string })?.paymentMethod_Uuid ?? ''
  state.bankUuid = props.payment?.bank_Uuid ?? ''
  state.referenceNumber = props.payment?.referenceNumber ?? ''
  state.paymentDate = props.payment?.paymentDate ? isoToDatetimeLocal(props.payment.paymentDate) : isoToDatetimeLocal(new Date().toISOString())
  state.adminNotes = props.payment?.adminNotes ?? ''
  clearFile()
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  supportFile.value = input.files?.[0] ?? null
}

watch(() => state.paymentMethodUuid, async (uuid) => {
  selectedMethod.value = uuid ? await useApi<CatalogItem>(`/v1/admin/payment-methods/${uuid}`) : null
})

watch(() => state.promoterUuid, (uuid) => {
  const promoter = promoterOptions.value.find(option => option.value === uuid)
  if (promoter?.personUuid) state.personUuid = promoter.personUuid
})

// When a bank is picked and the method requires an account code, prefix
// bankAccountCode with the bank's SUDEBAN code so the user only fills in
// the rest of the account number.
watch(() => state.bankUuid, (uuid) => {
  const bank = uuid ? banksByUuid.value[uuid] : null
  if (!bank?.code || !selectedMethod.value?.mandatoryAccountCode) return
  const prefix = `${bank.code}-`
  if (!state.bankAccountCode.startsWith(prefix)) state.bankAccountCode = prefix
})

watch(() => props.open, open => {
  if (open) {
    reset()
    loadOptions()
    loadCurrencies()
    ensureOrganizationLoaded()
  }
})

// ---- Live exchange-rate preview (ADR 0015 §7 Caso B) ----
// A payout has no membership to convert against (unlike PaymentFormModal),
// so it previews against the organization's own reference currency —
// informational only, and silently skipped on any error; never blocks
// registering the payment.
interface RatePreview { convertedAmount: number, convertedCurrencyCode: string, rateDate: string | null }
const ratePreview = ref<RatePreview | null>(null)
let previewTimer: ReturnType<typeof setTimeout> | undefined

watch([() => state.amount, () => state.currency, () => state.paymentDate], () => {
  clearTimeout(previewTimer)
  ratePreview.value = null
  const targetCurrency = organization.value?.referenceCurrency_Code
  const amount = state.amount.trim()
  if (!targetCurrency || !/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) return
  if (targetCurrency === state.currency) return
  const asOfDate = state.paymentDate ? state.paymentDate.slice(0, 10) : undefined
  previewTimer = setTimeout(async () => {
    try {
      const rate = await exchangeRates.current(state.currency, targetCurrency, asOfDate)
      if (!rate.available || rate.rate === null) return
      ratePreview.value = {
        convertedAmount: Number(amount) * Number(rate.rate),
        convertedCurrencyCode: targetCurrency,
        rateDate: rate.rateDate,
      }
    }
    catch {
      ratePreview.value = null
    }
  }, 500)
})

async function onSubmit() {
  submitting.value = true
  try {
    const payload = {
      paymentCategoryUuid: state.paymentCategoryUuid,
      promoterUuid: state.promoterUuid,
      personUuid: state.personUuid,
      amount: state.amount,
      currency: state.currency,
      paymentMethodUuid: state.paymentMethodUuid,
      bankUuid: state.bankUuid || undefined,
      identification: state.identification || undefined,
      bankAccountType: state.bankAccountType || undefined,
      bankAccountCode: state.bankAccountCode || undefined,
      bankAccountIdentifier: state.bankAccountIdentifier || undefined,
      phone: state.phone || undefined,
      email: state.email || undefined,
      referenceNumber: state.referenceNumber || undefined,
      paymentDate: datetimeLocalToIso(state.paymentDate),
      adminNotes: state.adminNotes || undefined,
    }

    const saved = editing.value
      ? await payments.updateOut(props.payment!.uuid, payload as OutPaymentUpdateRequest)
      : await payments.registerOut(payload as OutPaymentCreateRequest, supportFile.value)
    toast.add({ title: editing.value ? t('payments.payouts.updatedToast') : t('payments.payouts.createdToast'), color: 'success', icon: 'i-lucide-check-circle' })
    emit('saved', saved)
    isOpen.value = false
  }
  catch {
    // useApi already reports the API error.
  }
  finally {
    submitting.value = false
  }
}

function submitForm() {
  document.querySelector<HTMLFormElement>('[data-out-payment-form]')?.requestSubmit()
}
</script>

<template>
  <UModal v-model:open="isOpen" :title="editing ? t('payments.payouts.editTitle') : t('payments.payouts.createTitle')" :description="t('payments.payouts.description')" :ui="{ content: 'max-w-3xl' }">
    <template #body>
      <UForm data-out-payment-form :schema="schema" :state="state" class="space-y-5" @submit="onSubmit">
        <div class="rounded-xl border border-prohealth-100 bg-prohealth-50/40 p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <UFormField :label="t('payments.payouts.fields.promoter')" name="promoterUuid" required>
          <USelectMenu class="w-full" v-model="state.promoterUuid" :items="promoterOptions" label-key="label" value-key="value" :loading="loadingOptions" :placeholder="t('payments.payouts.promoterPlaceholder')" />
        </UFormField>
        <UFormField :label="t('payments.payouts.fields.person')" name="personUuid" required>
          <UInput class="w-full" :model-value="personDisplayName" readonly :placeholder="t('payments.payouts.personPlaceholder')" />
        </UFormField>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <UFormField class="sm:col-span-1" :label="t('payments.columns.date')" name="paymentDate" required><UInput class="w-full" v-model="state.paymentDate" type="datetime-local" /></UFormField>
        <UFormField class="sm:col-span-1" :label="t('payments.columns.amount')" name="amount" required><UInput class="w-full text-right" v-model="state.amount" inputmode="decimal" :placeholder="t('payments.form.placeholders.amount')" /></UFormField>
        <UFormField class="sm:col-span-1" :label="t('payments.payouts.fields.currency')" name="currency" required>
          <div class="flex items-center gap-1">
            <USelectMenu class="w-full" v-model="state.currency" :items="currencyOptions" label-key="label" value-key="value" :loading="loadingCurrencies" :placeholder="t('payments.form.placeholders.currency')" />
            <CommonEntityQuickLinkButton :to="'/dashboard/catalogs/currencies'" :can="canViewCurrencies" @navigate="openCatalog" />
          </div>
        </UFormField>
        </div>
        <p v-if="ratePreview" class="text-xs text-prohealth-500 -mt-2">
          {{ ratePreview.rateDate
            ? t('payments.payouts.exchangeRatePreview', {
              amount: formatCurrency(ratePreview.convertedAmount, ratePreview.convertedCurrencyCode),
              rateDate: formatDate(ratePreview.rateDate, 'short'),
            })
            : t('payments.payouts.exchangeRatePreviewNoDate', {
              amount: formatCurrency(ratePreview.convertedAmount, ratePreview.convertedCurrencyCode),
            }) }}
        </p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <UFormField :label="t('payments.payouts.fields.reference')" name="referenceNumber" :help="t('payments.form.fields.referenceHelp')" :required="Boolean(selectedMethod?.mandatoryReferenceNumber)">
          <UInput class="w-full" v-model="state.referenceNumber" :placeholder="t('payments.form.placeholders.reference')" />
        </UFormField>
        <UFormField :label="t('payments.payouts.columns.method')" name="paymentMethodUuid" required>
          <div class="flex items-center gap-1">
            <USelectMenu class="w-full" v-model="state.paymentMethodUuid" :items="methodOptions" label-key="label" value-key="value" :placeholder="t('payments.form.placeholders.method')" />
            <CommonEntityQuickLinkButton :to="'/dashboard/catalogs/payment-methods'" :can="canViewMethods" @navigate="openCatalog" />
          </div>
        </UFormField>
        </div>
        <div v-if="selectedMethod?.mandatoryIdentification || selectedMethod?.mandatoryBank || selectedMethod?.mandatoryBankAccount || selectedMethod?.mandatoryAccountType || selectedMethod?.mandatoryAccountCode || selectedMethod?.mandatoryPhone || selectedMethod?.mandatoryEmail" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <UFormField v-if="selectedMethod?.mandatoryIdentification" :label="t('payments.payouts.fields.identification')" name="identification" required><UInput class="w-full" v-model="state.identification" /></UFormField>
        <UFormField v-if="selectedMethod?.mandatoryBank" :label="t('payments.payouts.fields.bank')" name="bankUuid" required>
          <div class="flex items-center gap-1">
            <USelectMenu class="w-full" v-model="state.bankUuid" :items="bankOptions" label-key="label" value-key="value" :placeholder="t('common.select')" />
            <CommonEntityQuickLinkButton :to="'/dashboard/catalogs/banks'" :can="canViewBanks" @navigate="openCatalog" />
          </div>
        </UFormField>
        <UFormField v-if="selectedMethod?.mandatoryBankAccount" :label="t('payments.payouts.fields.accountIdentifier')" name="bankAccountIdentifier" required><UInput class="w-full" v-model="state.bankAccountIdentifier" /></UFormField>
        <UFormField v-if="selectedMethod?.mandatoryAccountType" :label="t('payments.payouts.fields.accountType')" name="bankAccountType" required><USelectMenu class="w-full" v-model="state.bankAccountType" :items="BANK_ACCOUNT_TYPE_OPTIONS" label-key="label" value-key="value" :placeholder="t('common.select')" /></UFormField>
        <UFormField v-if="selectedMethod?.mandatoryAccountCode" :label="t('payments.payouts.fields.accountCode')" name="bankAccountCode" required><UInput class="w-full" v-model="state.bankAccountCode" /></UFormField>
        <UFormField v-if="selectedMethod?.mandatoryPhone" :label="t('payments.payouts.fields.phone')" name="phone" required><UInput class="w-full" v-model="state.phone" /></UFormField>
        <UFormField v-if="selectedMethod?.mandatoryEmail" :label="t('payments.payouts.fields.email')" name="email" required><UInput class="w-full" v-model="state.email" type="email" /></UFormField>
        </div>
        <UFormField class="sm:col-span-2" :label="t('payments.payouts.fields.notes')" name="adminNotes">
          <UTextarea class="w-full" v-model="state.adminNotes" :rows="2" :placeholder="t('payments.form.placeholders.adminNotes')" />
        </UFormField>
        <UFormField class="sm:col-span-2" :label="t('payments.payouts.fields.support')" name="support">
          <div class="flex flex-wrap items-center gap-3">
            <input ref="fileInput" type="file" accept="image/*,.pdf" class="block w-full max-w-xs text-sm text-prohealth-600 file:mr-3 file:rounded-lg file:border-0 file:bg-prohealth-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-prohealth-700 hover:file:bg-prohealth-100" @change="onFileChange">
            <div v-if="supportFile" class="flex items-center gap-2 text-xs text-prohealth-600">
              <UIcon name="i-lucide-paperclip" class="w-4 h-4" />
              <span class="font-medium">{{ supportFile.name }}</span>
              <span class="text-prohealth-400">({{ formatSize(supportFile.size) }})</span>
              <UButton color="neutral" variant="ghost" icon="i-lucide-x" size="xs" @click="clearFile" />
            </div>
          </div>
          <p class="text-xs text-prohealth-500 mt-1">{{ t('payments.payouts.fields.supportHint') }}</p>
        </UFormField>
        <UFormField :label="t('payments.payouts.fields.category')" name="paymentCategoryUuid" required><USelectMenu class="w-full" v-model="state.paymentCategoryUuid" :items="categoryOptions" label-key="label" value-key="value" :loading="loadingOptions" :placeholder="t('payments.payouts.categoryPlaceholder')" /></UFormField>
        <button type="submit" class="hidden" />
      </UForm>
    </template>
    <template #footer>
      <div class="w-full space-y-2">
        <p class="text-xs text-prohealth-500">{{ t('common.requiredFieldsHint') }}</p>
        <div class="flex items-center justify-end gap-3">
          <UButton color="neutral" variant="ghost" :disabled="submitting" @click="isOpen = false">
            {{ t('common.cancel') }}
          </UButton>
          <UButton color="primary" variant="outline" :loading="submitting" icon="i-lucide-save" @click="submitForm">
            {{ editing ? t('common.save') : t('common.saveNew') }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
