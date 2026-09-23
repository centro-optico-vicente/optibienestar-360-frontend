<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { MyPaymentCreateRequest, PaymentDto } from '~/types/payments'
import { BANK_ACCOUNT_TYPE_OPTIONS } from '~/types/payments'
import type { CatalogItem } from '~/types/catalogs'

// Self-service registration (POST /v1/me/payments, multipart, PAYMENT_CREATE_OWN)
// — the affiliate's own membership, resolved server-side. Same fields as
// PaymentFormModal minus the member/membership picker.
const props = defineProps<{ open: boolean }>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'saved': [payment: PaymentDto]
}>()

const { t } = useI18n()
const payments = usePayments()
const toast = useToast()
const { can } = usePermissions()
const canViewMethods = computed(() => can('PAYMENT_METHOD_VIEW_ALL'))
const canViewBanks = computed(() => can('BANK_VIEW_ALL'))
const canViewCurrencies = computed(() => can('CURRENCY_VIEW_ALL'))

function openCatalog(to: string) {
  window.open(to, '_blank', 'noopener')
}

const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})
const isSubmitting = ref(false)
const formRef = ref<{ submit: () => Promise<void> } | null>(null)

// Payment method + bank catalogs, self-service read-only endpoints
// (PAYMENT_METHOD_VIEW_ALL/BANK_VIEW_ALL are admin-only — an ordinary
// affiliate has neither, so this doesn't hit /v1/admin/*). Full items kept
// (not just {label,value}) so `selectedMethod` can be derived locally
// without a per-uuid admin lookup.
const methodItems = ref<CatalogItem[]>([])
const bankItems = ref<CatalogItem[]>([])
const methodOptions = computed(() => methodItems.value.map(m => ({ label: m.name, value: m.uuid })))
const bankOptions = computed(() => bankItems.value.map(b => ({ label: b.code ? `${b.code} — ${b.name}` : b.name, value: b.uuid })))
const selectedMethod = computed(() => methodItems.value.find(m => m.uuid === state.paymentMethodUuid) ?? null)
const selectedBank = computed(() => bankItems.value.find(b => b.uuid === state.bankUuid) ?? null)
const loadingMethods = ref(false)
const currencyItems = ref<CatalogItem[]>([])
const currencyOptions = computed(() => currencyItems.value.map(c => ({ label: `${c.code} (${c.symbol})`, value: c.code! })))
const loadingCurrencies = ref(false)

async function loadMethodsAndBanks() {
  loadingMethods.value = true
  try {
    const [methods, banks] = await Promise.all([
      useApi<CatalogItem[]>('/v1/me/payment-methods'),
      useApi<CatalogItem[]>('/v1/me/banks'),
    ])
    methodItems.value = (methods ?? []).filter(m => m.active)
    bankItems.value = (banks ?? []).filter(b => b.active)
  }
  catch {
    methodItems.value = []
    bankItems.value = []
  }
  finally {
    loadingMethods.value = false
  }
}

// Currency dropdown label uses the real `symbol` from the master (ADR 0015)
// — "USD ($)" — not a hardcoded code -> symbol map. `value` sent to the
// backend stays the ISO `code`, same contract as before.
async function loadCurrencies() {
  loadingCurrencies.value = true
  try {
    const currencies = await useApi<CatalogItem[]>('/v1/me/currencies')
    currencyItems.value = (currencies ?? []).filter(c => c.active)
  }
  catch {
    currencyItems.value = []
  }
  finally {
    loadingCurrencies.value = false
  }
}

interface FormState {
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
  inscription: boolean
  appliedPeriod: string
  adminNotes: string
}

const state = reactive<FormState>({
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
  paymentDate: '',
  inscription: false,
  appliedPeriod: '',
  adminNotes: '',
})

function datetimeLocalToIso(value: string): string {
  return new Date(value).toISOString()
}

// When a bank is picked and the method requires an account code, prefix
// bankAccountCode with the bank's SUDEBAN code so the user only fills in
// the rest of the account number.
watch(() => state.bankUuid, (uuid) => {
  const bank = uuid ? selectedBank.value : null
  if (!bank?.code || !selectedMethod.value?.mandatoryAccountCode) return
  const prefix = `${bank.code}-`
  if (!state.bankAccountCode.startsWith(prefix)) state.bankAccountCode = prefix
})

// ---- Proof of payment (optional) ----
const supportFile = ref<File | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  supportFile.value = input.files?.[0] ?? null
}

function clearFile() {
  supportFile.value = null
  if (fileInput.value) fileInput.value.value = ''
}

function formatSize(bytes?: number | null): string {
  if (bytes === null || bytes === undefined) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function notFuture(v: string): boolean {
  if (!v) return true
  const today = new Date()
  today.setHours(23, 59, 59, 999)
  return new Date(v) <= today
}

const schema = computed(() => z.object({
  amount: z.string()
    .regex(/^\d+(\.\d{1,2})?$/, t('payments.form.validation.amountInvalid'))
    .refine(v => Number(v) >= 0.01, t('payments.form.validation.amountMin')),
  currency: z.string().min(1, t('validation.required')),
  paymentMethodUuid: z.string({ message: t('validation.required') }).min(1, t('validation.required')),
  bankUuid: selectedMethod.value?.mandatoryBank ? z.string().min(1, t('validation.required')) : z.string().optional(),
  identification: selectedMethod.value?.mandatoryIdentification ? z.string().min(1, t('validation.required')) : z.string().optional(),
  bankAccountType: selectedMethod.value?.mandatoryAccountType ? z.string().min(1, t('validation.required')) : z.string().optional(),
  bankAccountCode: selectedMethod.value?.mandatoryAccountCode ? z.string().min(1, t('validation.required')) : z.string().optional(),
  bankAccountIdentifier: selectedMethod.value?.mandatoryBankAccount ? z.string().min(1, t('validation.required')) : z.string().optional(),
  phone: selectedMethod.value?.mandatoryPhone ? z.string().min(1, t('validation.required')) : z.string().optional(),
  email: selectedMethod.value?.mandatoryEmail ? z.string().email(t('validation.emailInvalid')) : z.string().optional(),
  referenceNumber: selectedMethod.value?.mandatoryReferenceNumber
    ? z.string().min(1, t('validation.required'))
    : z.string().max(80, t('validation.maxChars', { n: 80 })).optional(),
  paymentDate: z.string().min(1, t('validation.required')).refine(notFuture, t('payments.form.validation.dateFuture')),
  appliedPeriod: z.string().optional(),
  adminNotes: z.string().optional(),
}))

function resetForm() {
  state.amount = ''
  state.currency = 'USD'
  state.paymentMethodUuid = ''
  state.bankUuid = ''
  state.identification = ''
  state.bankAccountType = ''
  state.bankAccountCode = ''
  state.bankAccountIdentifier = ''
  state.phone = ''
  state.email = ''
  state.referenceNumber = ''
  state.paymentDate = ''
  state.inscription = false
  state.appliedPeriod = ''
  state.adminNotes = ''
  clearFile()
}

watch(() => props.open, (open) => {
  if (open) {
    resetForm()
    loadMethodsAndBanks()
    loadCurrencies()
  }
})

async function onSubmit(_event: FormSubmitEvent<Record<string, unknown>>) {
  isSubmitting.value = true
  try {
    const payload: MyPaymentCreateRequest = {
      amount: state.amount.trim(),
      currency: state.currency.trim() ? state.currency.trim().toUpperCase() : undefined,
      paymentMethodUuid: state.paymentMethodUuid,
      bankUuid: state.bankUuid || undefined,
      identification: state.identification || undefined,
      bankAccountType: state.bankAccountType || undefined,
      bankAccountCode: state.bankAccountCode || undefined,
      bankAccountIdentifier: state.bankAccountIdentifier || undefined,
      phone: state.phone || undefined,
      email: state.email || undefined,
      referenceNumber: state.referenceNumber.trim() || undefined,
      paymentDate: datetimeLocalToIso(state.paymentDate),
      inscription: state.inscription,
      appliedPeriod: state.inscription
        ? undefined
        : (state.appliedPeriod ? `${state.appliedPeriod}-01` : undefined),
      adminNotes: state.adminNotes.trim() || undefined,
    }
    const result = await payments.registerOwn(payload, supportFile.value)
    toast.add({ title: t('payments.form.registeredToast'), description: t('payments.form.registeredToastDescription'), color: 'success', icon: 'i-lucide-check-circle' })
    emit('saved', result)
    isOpen.value = false
  }
  catch {
    // useApi already notified the error (422 rules, validations)
  }
  finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="isOpen"
    :title="t('payments.mine.form.title')"
    :description="t('payments.mine.form.description')"
    :ui="{ content: 'max-w-3xl' }"
  >
    <template #body>
      <UForm ref="formRef" :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <UFormField class="sm:col-span-1" :label="t('payments.form.fields.paymentDate')" name="paymentDate" required>
            <AppDateTimePicker v-model="state.paymentDate" />
          </UFormField>
          <UFormField class="sm:col-span-1" :label="t('payments.form.fields.amount')" name="amount" required>
            <CurrencyConverterDisplay :amount="state.amount" :currency="state.currency" :date="state.paymentDate" v-slot="{ result }">
              <UInput v-model="state.amount" placeholder="10.00" class="w-full text-right">
                <template #leading>
                  <span class="text-prohealth-400 text-sm">$</span>
                </template>
                <template #trailing>
                  <CurrencyConverterTrigger :result="result" />
                </template>
              </UInput>
            </CurrencyConverterDisplay>
          </UFormField>
          <UFormField class="sm:col-span-1" :label="t('payments.form.fields.currency')" name="currency" required>
            <div class="flex items-center gap-1">
              <USelectMenu
                clear
                v-model="state.currency"
                :items="currencyOptions"
                label-key="label"
                value-key="value"
                :loading="loadingCurrencies"
                class="w-full font-mono"
              />
              <CommonEntityQuickLinkButton :to="'/dashboard/catalogs/currencies'" :can="canViewCurrencies" @navigate="openCatalog" />
            </div>
          </UFormField>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('payments.form.fields.reference')" name="referenceNumber" :help="t('payments.form.fields.referenceHelp')" :required="Boolean(selectedMethod?.mandatoryReferenceNumber)">
            <UInput v-model="state.referenceNumber" :placeholder="t('payments.form.placeholders.reference')" class="w-full" />
          </UFormField>
          <UFormField :label="t('payments.form.fields.method')" name="paymentMethodUuid" required>
            <div class="flex items-center gap-1">
              <USelectMenu
                clear
                v-model="state.paymentMethodUuid"
                :items="methodOptions"
                label-key="label"
                value-key="value"
                :loading="loadingMethods"
                :placeholder="t('common.select')"
                class="w-full"
              />
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

        <UFormField :label="t('payments.form.fields.adminNotes')" name="adminNotes">
          <UTextarea v-model="state.adminNotes" :rows="2" class="w-full" :placeholder="t('payments.form.placeholders.adminNotes')" />
        </UFormField>

        <UFormField :label="t('payments.form.fields.proof')">
          <div class="flex flex-wrap items-center gap-3">
            <input
              ref="fileInput"
              type="file"
              accept="image/*,application/pdf"
              class="block w-full max-w-xs text-sm text-prohealth-600 file:mr-3 file:rounded-lg file:border-0 file:bg-prohealth-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-prohealth-700 hover:file:bg-prohealth-100"
              @change="onFileChange"
            >
            <div v-if="supportFile" class="flex items-center gap-2 text-xs text-prohealth-600">
              <UIcon name="i-lucide-paperclip" class="w-4 h-4" />
              <span class="font-medium">{{ supportFile.name }}</span>
              <span class="text-prohealth-400">({{ formatSize(supportFile.size) }})</span>
              <UButton color="neutral" variant="ghost" icon="i-lucide-x" size="xs" @click="clearFile" />
            </div>
          </div>
          <p class="text-xs text-prohealth-500 mt-1">{{ t('payments.form.fields.proofHelp') }}</p>
        </UFormField>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
          <UFormField :label="t('payments.form.fields.inscription')" name="inscription" :help="t('payments.form.fields.inscriptionHelp')">
            <USwitch v-model="state.inscription" />
          </UFormField>
          <UFormField
            v-if="!state.inscription"
            :label="t('payments.form.fields.coveredMonth')"
            name="appliedPeriod"
            :help="t('payments.form.fields.coveredMonthHelp')"
          >
            <UInput v-model="state.appliedPeriod" type="month" class="w-full" />
          </UFormField>
        </div>
      </UForm>
    </template>

    <template #footer>
      <div class="w-full space-y-2">
        <p class="text-xs text-prohealth-500">{{ t('common.requiredFieldsHint') }}</p>
        <div class="flex items-center justify-end gap-3">
          <UButton color="neutral" variant="ghost" :disabled="isSubmitting" @click="isOpen = false">
            {{ t('common.cancel') }}
          </UButton>
          <UButton color="primary" variant="outline" :loading="isSubmitting" icon="i-lucide-save" @click="formRef?.submit()">
            {{ t('common.saveNew') }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
