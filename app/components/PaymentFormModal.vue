<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import { memberOptionLabel } from '~/types/members'
import type { MembershipDto } from '~/types/memberships'
import type { SelectItem } from '~/types/options'
import type { PaymentCreateRequest, PaymentDto } from '~/types/payments'
import { BANK_ACCOUNT_TYPE_OPTIONS } from '~/types/payments'
import type { CatalogItem } from '~/types/catalogs'

// Register a manual payment (POST /v1/admin/payments, multipart). There is no edit:
// a payment is registered and then approved/rejected. The flow is a cascade —
// search member -> pick one of their memberships -> capture the payment + proof.
// The parent controls opening (v-model:open) and gates PAYMENT_CREATE on the button.
const props = defineProps<{ open: boolean }>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'saved': [payment: PaymentDto]
}>()

const { t } = useI18n()
const payments = usePayments()
const members = useMembers()
const memberships = useMemberships()
const methodsApi = useCatalog('/v1/admin/payment-methods')
const banksApi = useCatalog('/v1/admin/banks')
const currenciesApi = useCatalog('/v1/admin/currencies')
const toast = useToast()
const { can } = usePermissions()

// Quick-link buttons next to Método/Banco/Moneda, same resolver used by
// CommonEntityReferenceSelect — opens the catalog's admin screen in a new
// tab so the form in progress isn't lost.
const canViewMethods = computed(() => can('PAYMENT_METHOD_VIEW_ALL'))
const canViewBanks = computed(() => can('BANK_VIEW_ALL'))
const canViewCurrencies = computed(() => can('CURRENCY_VIEW_ALL'))

function openCatalog(to: string) {
  window.open(to, '_blank', 'noopener')
}

function goToMember(to: string) {
  isOpen.value = false
  navigateTo(to)
}

const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})
const isSubmitting = ref(false)
// Save button lives in the modal's #footer slot, outside the <UForm> element,
// so it can't use type="submit"; it triggers validation via this instead.
const formRef = ref<{ submit: () => Promise<void> } | null>(null)

// Payment method + bank catalogs (same dynamic `payment-methods`/`banks`
// catalogs OutPaymentFormModal uses — UUID + `mandatory*` flags per method).
const methodOptions = ref<{ label: string, value: string }[]>([])
const bankOptions = ref<{ label: string, value: string }[]>([])
const banksByUuid = ref<Record<string, CatalogItem>>({})
const selectedMethod = ref<CatalogItem | null>(null)
const loadingMethods = ref(false)
const currencyOptions = ref<{ label: string, value: string }[]>([])
const loadingCurrencies = ref(false)

async function loadMethodsAndBanks() {
  loadingMethods.value = true
  try {
    const [methods, banks] = await Promise.all([methodsApi.listAll(), banksApi.listAll()])
    methodOptions.value = methods
      .filter((method: CatalogItem) => method.active)
      .map((method: CatalogItem) => ({ label: method.name, value: method.uuid }))
    const activeBanks = banks.filter((bank: CatalogItem) => bank.active)
    bankOptions.value = activeBanks
      .map((bank: CatalogItem) => ({ label: bank.code ? `${bank.code} — ${bank.name}` : bank.name, value: bank.uuid }))
    banksByUuid.value = Object.fromEntries(activeBanks.map((bank: CatalogItem) => [bank.uuid, bank]))
  }
  catch {
    methodOptions.value = []
    bankOptions.value = []
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

function datetimeLocalToIso(value: string): string {
  return new Date(value).toISOString()
}

// ---- Member search (server-side, debounced via CommonEntityReferenceSelect) ----
async function searchMembers(q: string) {
  const res = await members.options({ q, limit: 10 })
  return res.map(o => ({ label: memberOptionLabel(o), value: o.uuid }))
}

// ---- Form state ----
interface FormState {
  memberUuid: string
  membershipUuid: string
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
  memberUuid: '',
  membershipUuid: '',
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

watch(() => state.paymentMethodUuid, async (uuid) => {
  selectedMethod.value = uuid ? await useApi<CatalogItem>(`/v1/admin/payment-methods/${uuid}`) : null
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

// ---- Selected member's memberships ----
const membershipOptions = ref<SelectItem[]>([])
const loadingMemberships = ref(false)
// Keeps the loaded membership's own currency/fee around for the "adeudado
// según el plan" reference line — the list call already returns it, no need
// for a second request.
const membershipsByUuid = ref<Record<string, MembershipDto>>({})

function membershipLabel(ms: MembershipDto): string {
  const plan = ms.planName || ms.planCode || t('payments.form.planFallback')
  return `${ms.planCode ? `${ms.planCode} — ` : ''}${plan} (${ms.status})`
}

watch(() => state.memberUuid, async (memberUuid) => {
  membershipOptions.value = []
  membershipsByUuid.value = {}
  state.membershipUuid = ''
  if (!memberUuid) return
  loadingMemberships.value = true
  try {
    const list = await memberships.listForMember(memberUuid)
    membershipOptions.value = list.map(ms => ({ label: membershipLabel(ms), value: ms.uuid }))
    membershipsByUuid.value = Object.fromEntries(list.map(ms => [ms.uuid, ms]))
    // Shortcut: if the member has a single membership, select it.
    if (membershipOptions.value.length === 1) state.membershipUuid = membershipOptions.value[0]!.value
  }
  catch {
    membershipOptions.value = []
  }
  finally {
    loadingMemberships.value = false
  }
})

const selectedMembership = computed(() => membershipsByUuid.value[state.membershipUuid])

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

// Byte size with universal units (not localized).
function formatSize(bytes?: number | null): string {
  if (bytes === null || bytes === undefined) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ---- Validation ----
function notFuture(v: string): boolean {
  if (!v) return true
  const today = new Date()
  today.setHours(23, 59, 59, 999)
  return new Date(v) <= today
}

// Locale-reactive schema so validation messages follow the UI locale.
const schema = computed(() => z.object({
  memberUuid: z.string({ message: t('validation.required') }).min(1, t('payments.form.validation.member')),
  membershipUuid: z.string({ message: t('validation.required') }).min(1, t('payments.form.validation.membership')),
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
  state.memberUuid = ''
  state.membershipUuid = ''
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
  selectedMethod.value = null
  membershipOptions.value = []
  clearFile()
}

// Reset the form every time it opens (always creation mode).
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
    const payload: PaymentCreateRequest = {
      membershipUuid: state.membershipUuid,
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
      // inscription = one-time -> no period; recurring -> first day of the covered month.
      appliedPeriod: state.inscription
        ? undefined
        : (state.appliedPeriod ? `${state.appliedPeriod}-01` : undefined),
      adminNotes: state.adminNotes.trim() || undefined,
    }
    const result = await payments.register(payload, supportFile.value)
    toast.add({ title: t('payments.form.registeredToast'), description: t('payments.form.registeredToastDescription'), color: 'success', icon: 'i-lucide-check-circle' })
    emit('saved', result)
    isOpen.value = false
  }
  catch {
    // useApi already notified the error (404 membership, 422 rules, validations)
  }
  finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="isOpen"
    :title="t('payments.form.title')"
    :description="t('payments.form.description')"
    :ui="{ content: 'max-w-3xl' }"
  >
    <template #body>
      <UForm ref="formRef" :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
        <!-- Member + membership -->
        <div class="rounded-xl border border-prohealth-100 p-4 space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField
              :label="t('payments.form.fields.member')"
              name="memberUuid"
              required
              :help="t('payments.form.fields.searchMemberHelp')"
            >
              <CommonEntityReferenceSelect
                v-model="state.memberUuid"
                :search="searchMembers"
                entity="member"
                icon="i-lucide-search"
                :placeholder="t('payments.form.memberPlaceholderSearch')"
                :search-placeholder="t('payments.form.memberSearchPlaceholder')"
                @navigate="goToMember"
              />
            </UFormField>
            <UFormField :label="t('payments.form.fields.membership')" name="membershipUuid" required>
              <USelectMenu
                clear
                v-model="state.membershipUuid"
                :items="membershipOptions"
                label-key="label"
                value-key="value"
                :loading="loadingMemberships"
                :disabled="!state.memberUuid"
                :placeholder="state.memberUuid ? t('payments.form.membershipPlaceholder') : t('payments.form.membershipPlaceholderMember')"
                class="w-full"
              />
            </UFormField>
          </div>
          <p v-if="state.memberUuid && !loadingMemberships && membershipOptions.length === 0" class="text-xs text-amber-600">
            {{ t('payments.form.noMemberships') }}
          </p>
        </div>

        <!-- Date + amount + currency, in that order, same line -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <UFormField class="sm:col-span-1" :label="t('payments.form.fields.paymentDate')" name="paymentDate" required>
            <UInput v-model="state.paymentDate" type="datetime-local" class="w-full" />
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
        <!-- Reference + method -->
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

        <!-- Proof of payment -->
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

        <!-- Allocation (motivo-equivalent fields for a collection) -->
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
