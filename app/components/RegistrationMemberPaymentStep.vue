<script setup lang="ts">
import type { AffiliationRequestPaymentRequest, MyAffiliationRequestDto } from '~/types/affiliationRequests'
import type { CatalogItem } from '~/types/catalogs'
import type { PublicPlan, StepExit } from '~/types/registration'
import { BANK_ACCOUNT_TYPE_OPTIONS } from '~/types/payments'

// Wizard step "Pago de inscripción" (affiliate, not essential). The payer is prefilled from the request and the
// company account is shown with copy buttons (CompanyBankAccountPicker), hub ADR 0037 §2 / ADR 0030. The
// method-dependent fields follow the method's mandatory* flags, as in MyPaymentFormModal.
const props = defineProps<{ request: MyAffiliationRequestDto, plans: PublicPlan[], essential: boolean }>()
const emit = defineEmits<{ done: [request: MyAffiliationRequestDto | null, mode: StepExit] }>()

const { t } = useI18n()
const toast = useToast()
const { formatCurrency } = useFormatters()
const api = useMyAffiliationRequest()

const plan = computed(() => props.plans.find(p => p.uuid === props.request.plan_Uuid) ?? null)
const inscriptionDue = computed(() => Number(plan.value?.inscriptionFee ?? 0) > 0)
const alreadyReported = computed(() => Boolean(props.request.payment))

const methodItems = ref<CatalogItem[]>([])
const bankItems = ref<CatalogItem[]>([])
const loadingMethods = ref(false)
const methodOptions = computed(() => methodItems.value.map(m => ({ label: m.name, value: m.uuid })))
const bankOptions = computed(() => bankItems.value.map(b => ({ label: b.code ? `${b.code} — ${b.name}` : b.name, value: b.uuid })))

onMounted(async () => {
  loadingMethods.value = true
  try {
    const [methods, banks] = await Promise.all([
      useApi<CatalogItem[]>('/v1/public/payment-methods', { skipAuth: true, silent: true }),
      useApi<CatalogItem[]>('/v1/public/banks', { skipAuth: true, silent: true }),
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
})

function localToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const today = localToday()

// Payer prefilled with the applicant's own data.
const payment = reactive({
  reported: true,
  paymentMethodUuid: '', bankUuid: '',
  identification: `${props.request.documentType}${props.request.documentNumber}`,
  bankAccountType: '', bankAccountCode: '', bankAccountIdentifier: '',
  phone: props.request.phone ?? '', email: props.request.email ?? '',
  referenceNumber: '', paymentDate: today, companyBankAccountUuid: '',
})
const selectedMethod = computed(() => methodItems.value.find(m => m.uuid === payment.paymentMethodUuid) ?? null)
const selectedBank = computed(() => bankItems.value.find(b => b.uuid === payment.bankUuid) ?? null)
const methodsAvailable = computed(() => !loadingMethods.value && methodItems.value.length > 0)

watch(() => payment.bankUuid, (uuid) => {
  const bank = uuid ? selectedBank.value : null
  if (!bank?.code || !selectedMethod.value?.mandatoryAccountCode) return
  const prefix = `${bank.code}-`
  if (!payment.bankAccountCode.startsWith(prefix)) payment.bankAccountCode = prefix
})

const supportFile = ref<File | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
function onFileChange(e: Event) {
  supportFile.value = (e.target as HTMLInputElement).files?.[0] ?? null
}
function clearFile() {
  supportFile.value = null
  if (fileInput.value) fileInput.value.value = ''
}

function paymentInvalid(): string | null {
  const m = selectedMethod.value
  if (!m) return t('affiliationRequest.payment.errorMethod')
  const required: [boolean | undefined, string, string][] = [
    [m.mandatoryIdentification, payment.identification, 'identification'],
    [m.mandatoryBank, payment.bankUuid, 'bank'],
    [m.mandatoryBankAccount, payment.bankAccountIdentifier, 'accountIdentifier'],
    [m.mandatoryAccountType, payment.bankAccountType, 'accountType'],
    [m.mandatoryAccountCode, payment.bankAccountCode, 'accountCode'],
    [m.mandatoryPhone, payment.phone, 'phone'],
    [m.mandatoryEmail, payment.email, 'email'],
    [m.mandatoryReferenceNumber, payment.referenceNumber, 'reference'],
  ]
  for (const [mandatory, value, key] of required) {
    if (mandatory && !value.trim()) return t('affiliationRequest.payment.errorField', { field: t(`affiliationRequest.payment.${key}`) })
  }
  if (m.mandatoryEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payment.email.trim())) return t('affiliationRequest.payment.errorEmail')
  if (!payment.paymentDate) return t('affiliationRequest.payment.errorDate')
  if (payment.paymentDate > today) return t('affiliationRequest.payment.errorDateFuture')
  return null
}

function paymentDateIso(date: string): string {
  return date === today ? new Date().toISOString() : new Date(`${date}T12:00:00`).toISOString()
}

function buildPayment(): AffiliationRequestPaymentRequest {
  const m = selectedMethod.value
  const pick = (flag: boolean | undefined, value: string) => (flag && value.trim()) || undefined
  return {
    paymentMethodUuid: payment.paymentMethodUuid,
    bankUuid: pick(m?.mandatoryBank, payment.bankUuid),
    identification: pick(m?.mandatoryIdentification, payment.identification),
    bankAccountType: pick(m?.mandatoryAccountType, payment.bankAccountType),
    bankAccountCode: pick(m?.mandatoryAccountCode, payment.bankAccountCode),
    bankAccountIdentifier: pick(m?.mandatoryBankAccount, payment.bankAccountIdentifier),
    phone: pick(m?.mandatoryPhone, payment.phone),
    email: pick(m?.mandatoryEmail, payment.email),
    referenceNumber: payment.referenceNumber.trim() || undefined,
    paymentDate: paymentDateIso(payment.paymentDate),
  }
}

const saving = ref(false)
const sends = computed(() => inscriptionDue.value && methodsAvailable.value && payment.reported && !alreadyReported.value)

async function finish(mode: StepExit) {
  if (mode === 'back') return emit('done', null, mode)
  // Nothing to report (no fee, already reported, "pay later"): leave the step as it is.
  if (mode === 'skip' || !sends.value) return emit('done', null, mode)
  const error = paymentInvalid()
  if (error) {
    if (mode === 'later') return emit('done', null, mode)
    toast.add({ title: error, color: 'error' })
    return
  }
  saving.value = true
  try {
    emit('done', await api.savePayment(buildPayment(), supportFile.value), mode)
  }
  catch {
    // useApi toasted the reason.
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <p v-if="!plan" class="text-sm text-prohealth-500">{{ t('affiliationRequest.payment.choosePlanFirst') }}</p>
    <p v-else-if="!inscriptionDue" class="text-sm text-prohealth-500">{{ t('affiliationRequest.payment.noFee') }}</p>
    <UAlert v-else-if="alreadyReported" color="success" variant="subtle" icon="i-lucide-circle-check" :title="t('registration.payment.reported')" />
    <p v-else-if="!loadingMethods && !methodItems.length" class="text-sm text-prohealth-500">{{ t('affiliationRequest.payment.methodsUnavailable') }}</p>
    <template v-else>
      <div class="rounded-xl bg-prohealth-50/60 border border-prohealth-100 p-3 text-sm text-prohealth-800">
        {{ t('registration.payment.amountDue', { amount: formatCurrency(Number(plan.inscriptionFee), plan.currency_Code || 'USD') }) }}
      </div>
      <USwitch v-model="payment.reported" :label="t('affiliationRequest.payment.paidSwitch')" />
      <p v-if="!payment.reported" class="text-xs text-prohealth-500">{{ t('affiliationRequest.payment.laterNote') }}</p>
      <div v-else class="space-y-4">
        <!-- Where to pay: the company account, with copy buttons. -->
        <CompanyBankAccountPicker
          v-model="payment.companyBankAccountUuid"
          :method-uuid="payment.paymentMethodUuid"
          :amount="plan.inscriptionFee"
          :currency="plan.currency_Code || 'USD'"
          :label="t('payments.companyAccounts.destinationLabel')"
          :help="t('payments.companyAccounts.destinationHelp')"
        />
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('affiliationRequest.payment.method')" required>
            <USelectMenu v-model="payment.paymentMethodUuid" :items="methodOptions" label-key="label" value-key="value" :loading="loadingMethods" :placeholder="t('affiliationRequest.payment.methodPlaceholder')" class="w-full" />
          </UFormField>
          <UFormField :label="t('affiliationRequest.payment.date')" required>
            <UInput v-model="payment.paymentDate" type="date" :max="today" class="w-full" />
          </UFormField>
          <UFormField v-if="selectedMethod?.mandatoryIdentification" :label="t('affiliationRequest.payment.identification')" required>
            <UInput v-model="payment.identification" class="w-full" maxlength="30" />
          </UFormField>
          <UFormField v-if="selectedMethod?.mandatoryBank" :label="t('affiliationRequest.payment.bank')" required>
            <USelectMenu v-model="payment.bankUuid" :items="bankOptions" label-key="label" value-key="value" :placeholder="t('affiliationRequest.payment.bankPlaceholder')" class="w-full" />
          </UFormField>
          <UFormField v-if="selectedMethod?.mandatoryBankAccount" :label="t('affiliationRequest.payment.accountIdentifier')" required>
            <UInput v-model="payment.bankAccountIdentifier" class="w-full" />
          </UFormField>
          <UFormField v-if="selectedMethod?.mandatoryAccountType" :label="t('affiliationRequest.payment.accountType')" required>
            <USelectMenu v-model="payment.bankAccountType" :items="BANK_ACCOUNT_TYPE_OPTIONS" label-key="label" value-key="value" :placeholder="t('affiliationRequest.payment.accountTypePlaceholder')" class="w-full" />
          </UFormField>
          <UFormField v-if="selectedMethod?.mandatoryAccountCode" :label="t('affiliationRequest.payment.accountCode')" required>
            <UInput v-model="payment.bankAccountCode" class="w-full" />
          </UFormField>
          <UFormField v-if="selectedMethod?.mandatoryPhone" :label="t('affiliationRequest.payment.phone')" required>
            <UInput v-model="payment.phone" class="w-full" maxlength="30" />
          </UFormField>
          <UFormField v-if="selectedMethod?.mandatoryEmail" :label="t('affiliationRequest.payment.email')" required>
            <UInput v-model="payment.email" type="email" class="w-full" maxlength="254" />
          </UFormField>
          <UFormField :label="t('affiliationRequest.payment.reference')" :help="t('affiliationRequest.payment.referenceHelp')" :required="Boolean(selectedMethod?.mandatoryReferenceNumber)" class="sm:col-span-2">
            <UInput v-model="payment.referenceNumber" class="w-full" maxlength="80" placeholder="0012345678" />
          </UFormField>
          <UFormField :label="t('affiliationRequest.payment.proof')" class="sm:col-span-2">
            <div class="flex flex-wrap items-center gap-3">
              <input
                ref="fileInput"
                type="file"
                accept="image/*,application/pdf"
                class="block w-full max-w-xs text-sm text-prohealth-600 file:mr-3 file:rounded-lg file:border-0 file:bg-prohealth-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-prohealth-700 hover:file:bg-prohealth-100"
                @change="onFileChange"
              >
              <UButton v-if="supportFile" type="button" color="neutral" variant="ghost" icon="i-lucide-x" size="xs" :aria-label="t('affiliationRequest.payment.removeProof')" @click="clearFile">
                {{ supportFile.name }}
              </UButton>
            </div>
            <p class="text-xs text-prohealth-500 mt-1">{{ t('affiliationRequest.payment.proofHelp') }}</p>
          </UFormField>
        </div>
      </div>
    </template>
    <RegistrationStepActions :saving="saving" :essential="essential" can-go-back @back="finish('back')" @next="finish('next')" @later="finish('later')" @skip="finish('skip')" />
  </div>
</template>
