<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { DownlinePaymentCreateRequest, PaymentDto } from '~/types/payments'
import { BANK_ACCOUNT_TYPE_OPTIONS } from '~/types/payments'
import type { CatalogItem } from '~/types/catalogs'

// Promoter self-service registration on behalf of a downline affiliate
// (POST /v1/promoter/me/payments, multipart, PAYMENT_CREATE_DOWNLINE). The
// member picker is the caller's own portfolio (GET /v1/promoter/me) rather
// than a global member search — a promoter only ever registers for their
// own downline, and the backend re-verifies that ownership regardless.
const props = defineProps<{ open: boolean }>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'saved': [payment: PaymentDto]
}>()

const { t } = useI18n()
const payments = usePayments()
const promoters = usePromoters()
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
// (PAYMENT_METHOD_VIEW_ALL/BANK_VIEW_ALL are admin-only — a promoter has
// neither, so this doesn't hit /v1/admin/*). Full items kept (not just
// {label,value}) so `selectedMethod` can be derived locally without a
// per-uuid admin lookup.
const methodItems = ref<CatalogItem[]>([])
const bankItems = ref<CatalogItem[]>([])
const methodOptions = computed(() => methodItems.value.map(m => ({ label: m.name, value: m.uuid })))
const bankOptions = computed(() => bankItems.value.map(b => ({ label: b.code ? `${b.code} — ${b.name}` : b.name, value: b.uuid })))
const selectedMethod = computed(() => methodItems.value.find(m => m.uuid === state.paymentMethodUuid) ?? null)
const selectedBank = computed(() => bankItems.value.find(b => b.uuid === state.bankUuid) ?? null)
const loadingMethods = ref(false)

// ---- Additional payment lines (V117 lines feature) — see usePaymentLinesEditor.
// The form's own fields above stay the flat "first line"; this editor only
// manages the EXTRA lines stacked on top of it.
const linesEditor = usePaymentLinesEditor()

function methodForLine(uuid: string): CatalogItem | null {
  return uuid ? (methodItems.value.find(m => m.uuid === uuid) ?? null) : null
}

// "Monto" above stays the DECLARED HEADER TOTAL when extra lines exist; the
// primary method/amount block becomes the first line and absorbs whatever
// the extra lines don't cover — see PaymentFormModal for the full rationale.
const firstLineAmount = computed(() => {
  const declared = Number(state.amount) || 0
  return Math.round((declared - linesEditor.totalFromLines.value) * 100) / 100
})
const linesExceedDeclaredAmount = computed(() =>
  state.amount.trim() !== '' && linesEditor.lines.value.length > 0 && firstLineAmount.value < 0.01
)
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

// ---- Own portfolio (member picker) ----
const memberOptions = ref<{ label: string, value: string }[]>([])
const loadingMembers = ref(false)

async function loadPortfolio() {
  loadingMembers.value = true
  try {
    const dashboard = await promoters.me()
    // Only affiliates with an active membership can receive a collection —
    // the backend rejects the rest with membership.active.not_found.
    memberOptions.value = dashboard.portfolio
      .filter(row => row.membershipStatus !== null)
      .map(row => ({ label: row.memberName, value: row.memberUuid }))
  }
  catch {
    memberOptions.value = []
  }
  finally {
    loadingMembers.value = false
  }
}

interface FormState {
  memberUuid: string
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
  coverageThroughPeriod: string
  adminNotes: string
}

const state = reactive<FormState>({
  memberUuid: '',
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
  coverageThroughPeriod: '',
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
  memberUuid: z.string({ message: t('validation.required') }).min(1, t('payments.form.validation.member')),
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
  coverageThroughPeriod: z.string().optional()
    .refine(v => !v || !state.appliedPeriod || v >= state.appliedPeriod, t('payments.form.validation.coverageThroughPeriodBeforeApplied')),
  adminNotes: z.string().optional(),
}))

function resetForm() {
  state.memberUuid = ''
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
  state.coverageThroughPeriod = ''
  state.adminNotes = ''
  linesEditor.reset()
  clearFile()
}

watch(() => props.open, (open) => {
  if (open) {
    resetForm()
    loadPortfolio()
    loadMethodsAndBanks()
    loadCurrencies()
  }
})

async function onSubmit(_event: FormSubmitEvent<Record<string, unknown>>) {
  if (linesExceedDeclaredAmount.value) {
    toast.add({
      title: t('payments.form.fields.linesTotalExceedsAmount', {
        sum: linesEditor.totalFromLines.value.toFixed(2),
        amount: state.amount,
      }),
      color: 'error',
      icon: 'i-lucide-circle-alert',
    })
    return
  }
  isSubmitting.value = true
  try {
    const payload: DownlinePaymentCreateRequest = {
      memberUuid: state.memberUuid,
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
      coverageThroughPeriod: state.inscription
        ? undefined
        : (state.coverageThroughPeriod ? `${state.coverageThroughPeriod}-01` : undefined),
      adminNotes: state.adminNotes.trim() || undefined,
    }
    if (linesEditor.lines.value.length > 0) {
      payload.lines = [
        {
          paymentMethodUuid: payload.paymentMethodUuid,
          bankUuid: payload.bankUuid,
          amount: firstLineAmount.value.toFixed(2),
          identification: payload.identification,
          bankAccountType: payload.bankAccountType,
          bankAccountCode: payload.bankAccountCode,
          bankAccountIdentifier: payload.bankAccountIdentifier,
          phone: payload.phone,
          email: payload.email,
          referenceNumber: payload.referenceNumber,
        },
        ...linesEditor.toRequests(),
      ]
    }
    const result = await payments.registerForDownline(payload, supportFile.value)
    toast.add({ title: t('payments.form.registeredToast'), description: t('payments.form.registeredToastDescription'), color: 'success', icon: 'i-lucide-check-circle' })
    emit('saved', result)
    isOpen.value = false
  }
  catch {
    // useApi already notified the error (404 not in portfolio, 422 rules)
  }
  finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="isOpen"
    :title="t('promoterSelf.collections.form.title')"
    :description="t('promoterSelf.collections.form.description')"
    :ui="{ content: 'max-w-3xl' }"
  >
    <template #body>
      <UForm ref="formRef" :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
        <UFormField :label="t('payments.form.fields.member')" name="memberUuid" required>
          <USelectMenu
            clear
            v-model="state.memberUuid"
            :items="memberOptions"
            label-key="label"
            value-key="value"
            :loading="loadingMembers"
            :placeholder="t('payments.form.memberPlaceholderSearch')"
            class="w-full"
          />
        </UFormField>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <UFormField class="sm:col-span-1" :label="t('payments.form.fields.paymentDate')" name="paymentDate" required>
            <AppDateTimePicker v-model="state.paymentDate" />
          </UFormField>
          <UFormField class="sm:col-span-1" :label="t('payments.form.fields.amount')" name="amount" required>
            <UInput v-model="state.amount" placeholder="10.00" class="w-full text-right">
              <template #leading>
                <span class="text-prohealth-400 text-sm">$</span>
              </template>
            </UInput>
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

        <!-- Additional payment lines (V117 lines feature) — split this payment across
             several methods. The block above stays the first line; each row here is
             one more method/amount split, sharing the same mandatory-field logic. -->
        <div class="rounded-xl border border-prohealth-100 p-4 space-y-3">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-semibold text-prohealth-800">{{ t('payments.form.fields.additionalLines') }}</p>
              <p class="text-xs text-prohealth-500">{{ t('payments.form.fields.additionalLinesHelp') }}</p>
            </div>
            <UButton color="neutral" variant="soft" size="xs" icon="i-lucide-plus" @click="linesEditor.addLine()">
              {{ t('payments.form.fields.addLine') }}
            </UButton>
          </div>

          <div v-for="(line, index) in linesEditor.lines.value" :key="index" class="rounded-lg bg-prohealth-50/60 p-3 space-y-3">
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <UFormField class="sm:col-span-1" :label="t('payments.form.fields.lineMethod')">
                <USelectMenu clear v-model="line.paymentMethodUuid" :items="methodOptions" label-key="label" value-key="value" :placeholder="t('common.select')" class="w-full" />
              </UFormField>
              <UFormField class="sm:col-span-1" :label="t('payments.form.fields.lineAmount')">
                <UInput v-model="line.amount" placeholder="10.00" class="w-full text-right" />
              </UFormField>
              <div class="sm:col-span-1 flex justify-end">
                <UButton color="error" variant="ghost" icon="i-lucide-trash-2" size="xs" @click="linesEditor.removeLine(index)">
                  {{ t('payments.form.fields.removeLine') }}
                </UButton>
              </div>
            </div>
            <div v-if="methodForLine(line.paymentMethodUuid)?.mandatoryIdentification || methodForLine(line.paymentMethodUuid)?.mandatoryBank || methodForLine(line.paymentMethodUuid)?.mandatoryBankAccount || methodForLine(line.paymentMethodUuid)?.mandatoryAccountType || methodForLine(line.paymentMethodUuid)?.mandatoryAccountCode || methodForLine(line.paymentMethodUuid)?.mandatoryPhone || methodForLine(line.paymentMethodUuid)?.mandatoryEmail || methodForLine(line.paymentMethodUuid)?.mandatoryReferenceNumber" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <UFormField v-if="methodForLine(line.paymentMethodUuid)?.mandatoryReferenceNumber" :label="t('payments.form.fields.reference')"><UInput class="w-full" v-model="line.referenceNumber" /></UFormField>
              <UFormField v-if="methodForLine(line.paymentMethodUuid)?.mandatoryIdentification" :label="t('payments.payouts.fields.identification')"><UInput class="w-full" v-model="line.identification" /></UFormField>
              <UFormField v-if="methodForLine(line.paymentMethodUuid)?.mandatoryBank" :label="t('payments.payouts.fields.bank')">
                <USelectMenu class="w-full" v-model="line.bankUuid" :items="bankOptions" label-key="label" value-key="value" :placeholder="t('common.select')" />
              </UFormField>
              <UFormField v-if="methodForLine(line.paymentMethodUuid)?.mandatoryBankAccount" :label="t('payments.payouts.fields.accountIdentifier')"><UInput class="w-full" v-model="line.bankAccountIdentifier" /></UFormField>
              <UFormField v-if="methodForLine(line.paymentMethodUuid)?.mandatoryAccountType" :label="t('payments.payouts.fields.accountType')"><USelectMenu class="w-full" v-model="line.bankAccountType" :items="BANK_ACCOUNT_TYPE_OPTIONS" label-key="label" value-key="value" :placeholder="t('common.select')" /></UFormField>
              <UFormField v-if="methodForLine(line.paymentMethodUuid)?.mandatoryAccountCode" :label="t('payments.payouts.fields.accountCode')"><UInput class="w-full" v-model="line.bankAccountCode" /></UFormField>
              <UFormField v-if="methodForLine(line.paymentMethodUuid)?.mandatoryPhone" :label="t('payments.payouts.fields.phone')"><UInput class="w-full" v-model="line.phone" /></UFormField>
              <UFormField v-if="methodForLine(line.paymentMethodUuid)?.mandatoryEmail" :label="t('payments.payouts.fields.email')"><UInput class="w-full" v-model="line.email" type="email" /></UFormField>
            </div>
          </div>

          <p v-if="linesEditor.lines.value.length > 0" class="text-xs" :class="linesExceedDeclaredAmount ? 'text-red-600 font-medium' : 'text-prohealth-500'">
            {{ t('payments.form.fields.linesTotal') }}: {{ linesEditor.totalFromLines.value.toFixed(2) }}
            <template v-if="linesExceedDeclaredAmount">
              — {{ t('payments.form.fields.linesTotalExceedsAmount', { sum: linesEditor.totalFromLines.value.toFixed(2), amount: state.amount }) }}
            </template>
          </p>
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
          <UFormField
            v-if="!state.inscription"
            :label="t('payments.form.fields.coverageThroughPeriod')"
            name="coverageThroughPeriod"
            :help="t('payments.form.fields.coverageThroughPeriodHelp')"
          >
            <UInput v-model="state.coverageThroughPeriod" type="month" class="w-full" />
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
