<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import { memberOptionLabel } from '~/types/members'
import type { MembershipDto } from '~/types/memberships'
import type { SelectItem } from '~/types/options'
import type { PaymentCreateRequest, PaymentDto, PaymentMethod } from '~/types/payments'
import { PAYMENT_CURRENCY_OPTIONS, PAYMENT_METHOD_OPTIONS } from '~/types/payments'

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
const { formatCurrency, formatDate } = useFormatters()
const payments = usePayments()
const members = useMembers()
const memberships = useMemberships()
const exchangeRates = useExchangeRates()
const toast = useToast()
const { can } = usePermissions()
const canViewMember = computed(() => can('MEMBER_VIEW_ALL'))

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

// Payment method options localized at the consumption point (labelKey → i18n).
const methodOptions = computed(() => PAYMENT_METHOD_OPTIONS.map(o => ({ label: t(o.labelKey), value: o.value })))
const currencyOptions = PAYMENT_CURRENCY_OPTIONS

// ---- Member search (server-side, debounced) ----
// Search box lives inside the USelectMenu itself (search-term) so typing and
// picking a result happen in the same field instead of two separate widgets.
const memberSearchTerm = ref('')
const memberOptions = ref<SelectItem[]>([])
const searchingMembers = ref(false)

let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(memberSearchTerm, (q) => {
  clearTimeout(searchTimer)
  const term = q.trim()
  // Don't clear memberOptions here: USelectMenu resets search-term to '' right after a
  // pick (resetSearchTermOnSelect/Blur), and wiping the list at that point would drop
  // the just-selected item, making the trigger fall back to showing the raw uuid
  // instead of its label.
  if (term.length < 2) return
  searchTimer = setTimeout(async () => {
    searchingMembers.value = true
    try {
      const res = await members.options({ q: term, limit: 10 })
      memberOptions.value = res.map(o => ({ label: memberOptionLabel(o), value: o.uuid }))
    }
    catch {
      memberOptions.value = []
    }
    finally {
      searchingMembers.value = false
    }
  }, 400)
})

// ---- Form state ----
interface FormState {
  memberUuid: string
  membershipUuid: string
  amount: string
  currency: string
  paymentMethod: PaymentMethod | undefined
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
  paymentMethod: undefined,
  referenceNumber: '',
  paymentDate: '',
  inscription: false,
  appliedPeriod: '',
  adminNotes: '',
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

// ---- Live exchange-rate preview (ADR 0015 §7 Caso B) ----
// What the amount/currency entered so far would convert to in the selected
// membership's own currency, at the rate vigente right now — informational
// only, debounced, and silently skipped on any error (bad amount format
// mid-typing, no rate available, etc.): it must never block registering
// the payment. Uses the generic /v1/exchange-rates/current lookup (not
// payment-specific — the same one commissions/ally-services previews would
// use) and multiplies client-side; the backend only resolves the rate
// itself (bidirectional-pair fallback included).
interface RatePreview { convertedAmount: number, convertedCurrencyCode: string, rateDate: string | null }
const ratePreview = ref<RatePreview | null>(null)
let previewTimer: ReturnType<typeof setTimeout> | undefined

watch([() => state.membershipUuid, () => state.amount, () => state.currency, () => state.paymentDate], () => {
  clearTimeout(previewTimer)
  ratePreview.value = null
  const membership = selectedMembership.value
  const amount = state.amount.trim()
  if (!membership || !membership.currency_Code || !/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) return
  // Same currency as the plan: nothing to preview, the amount already reads in that currency.
  if (membership.currency_Code === state.currency) return
  const targetCurrency = membership.currency_Code
  // `paymentDate` may still be empty while the admin is filling the form —
  // undefined falls back to "now" on the backend, same as before this date
  // was wired in.
  const asOfDate = state.paymentDate || undefined
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
  paymentMethod: z.string({ message: t('validation.required') }).min(1, t('validation.required')),
  referenceNumber: z.string().max(80, t('validation.maxChars', { n: 80 })).optional(),
  paymentDate: z.string().min(1, t('validation.required')).refine(notFuture, t('payments.form.validation.dateFuture')),
  appliedPeriod: z.string().optional(),
  adminNotes: z.string().optional(),
}))

function resetForm() {
  state.memberUuid = ''
  state.membershipUuid = ''
  state.amount = ''
  state.currency = 'USD'
  state.paymentMethod = undefined
  state.referenceNumber = ''
  state.paymentDate = ''
  state.inscription = false
  state.appliedPeriod = ''
  state.adminNotes = ''
  memberSearchTerm.value = ''
  memberOptions.value = []
  membershipOptions.value = []
  clearFile()
}

// Reset the form every time it opens (always creation mode).
watch(() => props.open, (open) => {
  if (open) resetForm()
})

async function onSubmit(_event: FormSubmitEvent<Record<string, unknown>>) {
  isSubmitting.value = true
  try {
    const payload: PaymentCreateRequest = {
      membershipUuid: state.membershipUuid,
      amount: state.amount.trim(),
      currency: state.currency.trim() ? state.currency.trim().toUpperCase() : undefined,
      paymentMethod: state.paymentMethod!,
      referenceNumber: state.referenceNumber.trim() || undefined,
      paymentDate: state.paymentDate,
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
    :ui="{ content: 'max-w-2xl' }"
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
              <div class="flex items-center gap-2">
                <USelectMenu
                  v-model="state.memberUuid"
                  v-model:search-term="memberSearchTerm"
                  :items="memberOptions"
                  label-key="label"
                  value-key="value"
                  ignore-filter
                  icon="i-lucide-search"
                  :loading="searchingMembers"
                  :placeholder="t('payments.form.memberPlaceholderSearch')"
                  :search-input="{ placeholder: t('payments.form.memberSearchPlaceholder'), icon: 'i-lucide-search' }"
                  class="w-full"
                />
                <CommonEntityQuickLinkButton
                  :to="state.memberUuid ? `/dashboard/members/${state.memberUuid}` : null"
                  :can="canViewMember"
                  @navigate="goToMember"
                />
              </div>
            </UFormField>
            <UFormField :label="t('payments.form.fields.membership')" name="membershipUuid" required>
              <USelectMenu
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

        <!-- Amount + method -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <UFormField :label="t('payments.form.fields.amount')" name="amount" required class="sm:col-span-1">
            <UInput v-model="state.amount" placeholder="10.00" class="w-full">
              <template #leading>
                <span class="text-prohealth-400 text-sm">$</span>
              </template>
            </UInput>
          </UFormField>
          <UFormField :label="t('payments.form.fields.currency')" name="currency" required :help="t('payments.form.fields.currencyHelp')">
            <USelectMenu
              v-model="state.currency"
              :items="currencyOptions"
              label-key="label"
              value-key="value"
              class="w-full font-mono"
            />
          </UFormField>
          <UFormField :label="t('payments.form.fields.method')" name="paymentMethod" required>
            <USelectMenu
              v-model="state.paymentMethod"
              :items="methodOptions"
              label-key="label"
              value-key="value"
              :placeholder="t('common.select')"
              class="w-full"
            />
          </UFormField>
        </div>
        <p v-if="ratePreview" class="text-xs text-prohealth-500 -mt-2">
          {{ ratePreview.rateDate
            ? t('payments.form.exchangeRatePreview', {
              amount: formatCurrency(ratePreview.convertedAmount, ratePreview.convertedCurrencyCode),
              rateDate: formatDate(ratePreview.rateDate, 'short'),
            })
            : t('payments.form.exchangeRatePreviewNoDate', {
              amount: formatCurrency(ratePreview.convertedAmount, ratePreview.convertedCurrencyCode),
            }) }}
        </p>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('payments.form.fields.reference')" name="referenceNumber" :help="t('payments.form.fields.referenceHelp')">
            <UInput v-model="state.referenceNumber" :placeholder="t('payments.form.placeholders.reference')" class="w-full" />
          </UFormField>
          <UFormField :label="t('payments.form.fields.paymentDate')" name="paymentDate" required :help="t('payments.form.fields.paymentDateHelp')">
            <UInput v-model="state.paymentDate" type="date" class="w-full" />
          </UFormField>
        </div>

        <!-- Allocation -->
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

        <UFormField :label="t('payments.form.fields.adminNotes')" name="adminNotes">
          <UTextarea v-model="state.adminNotes" :rows="2" class="w-full" :placeholder="t('payments.form.placeholders.adminNotes')" />
        </UFormField>

        <!-- Proof of payment -->
        <UFormField :label="t('payments.form.fields.proof')" :help="t('payments.form.fields.proofHelp')">
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
        </UFormField>

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
