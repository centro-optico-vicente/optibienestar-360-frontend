<script setup lang="ts">
import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'
import type { MyAffiliationRequestDto } from '~/types/affiliationRequests'
import type { PublicPlan, PublicTerms, StepExit } from '~/types/registration'
import { TERM_TYPES } from '~/types/terms'

// Wizard step "Plan y contrato" (affiliate). The contract is accepted here because only now does its text
// have all the data (hub ADR 0037 §2): it is re-rendered with the request's data (public preview endpoint,
// debounced) and, if that fails, the plain public text is shown. A change in the plan or in a datum of the
// contract makes the previous acceptance void, so it is asked again before sending.
const props = defineProps<{
  request: MyAffiliationRequestDto
  plans: PublicPlan[]
  essential: boolean
  /** ?plan=<uuid> of the registration link. */
  preselectedPlan?: string
}>()
const emit = defineEmits<{ done: [request: MyAffiliationRequestDto | null, mode: StepExit] }>()

const { t } = useI18n()
const notifyApiError = useNotifyApiError()
const toast = useToast()
const { formatCurrency } = useFormatters()
const api = useMemberRegistrationApi()

const planUuid = ref<string>(props.request.plan_Uuid ?? '')
if (!planUuid.value) {
  if (props.preselectedPlan && props.plans.some(p => p.uuid === props.preselectedPlan)) planUuid.value = props.preselectedPlan
  else if (props.plans.length === 1) planUuid.value = props.plans[0]!.uuid
}

function money(value: number | string | null | undefined, currency?: string | null): string {
  return formatCurrency(Number(value), currency || 'USD')
}

const planItems = computed(() => props.plans.map((p) => {
  const parts = [p.name]
  if (p.inscriptionFee != null) parts.push(`${t('affiliationRequest.inscription')} ${money(p.inscriptionFee, p.currency_Code)}`)
  if (p.monthlyFee != null) parts.push(`${money(p.monthlyFee, p.currency_Code)} / ${t('affiliationRequest.month')}`)
  return { value: p.uuid, label: parts.join(' · ') }
}))
const selectedPlan = computed(() => props.plans.find(p => p.uuid === planUuid.value) ?? null)

// ---- Contract ----
const md = new MarkdownIt({ html: false, linkify: true, breaks: true })
const terms = ref<PublicTerms | null>(null)
const termsUnavailable = ref(false)
const termsOpen = ref(false)
const previewMarkdown = ref<string | null>(null)
const termsHtml = computed(() => DOMPurify.sanitize(md.render(previewMarkdown.value ?? terms.value?.contentMarkdown ?? '')))

// Accepted before for this very plan and contract version, and nothing in the contract changed since.
const termsAccepted = ref<boolean>(false)

async function loadTerms(): Promise<void> {
  try {
    terms.value = await useApi<PublicTerms>(`/v1/public/terms/${TERM_TYPES.MEMBER}`, { skipAuth: true, silent: true })
    termsUnavailable.value = false
    termsAccepted.value = Boolean(
      props.request.contractAccepted
      && props.request.termsVersionUuid === terms.value.uuid
      && props.request.plan_Uuid === planUuid.value,
    )
    void refreshPreview()
  }
  catch {
    terms.value = null
    termsUnavailable.value = true
  }
}

let previewSeq = 0
async function refreshPreview(): Promise<void> {
  if (!terms.value) return
  const seq = ++previewSeq
  try {
    const res = await useApi<PublicTerms>(`/v1/public/terms/${TERM_TYPES.MEMBER}/preview`, {
      method: 'POST',
      skipAuth: true,
      silent: true,
      body: {
        firstName: props.request.firstName || undefined,
        lastName: props.request.lastName || undefined,
        documentType: props.request.documentType || undefined,
        documentNumber: props.request.documentNumber || undefined,
        birthDate: props.request.birthDate || undefined,
        planUuid: planUuid.value || undefined,
        referralCode: props.request.referralCode || undefined,
      },
    })
    if (seq !== previewSeq) return
    if (terms.value && res.uuid !== terms.value.uuid) {
      // A new version went live while the wizard was open: read and accept the current one.
      await loadTerms()
      termsAccepted.value = false
      toast.add({ title: t('affiliationRequest.termsUpdated'), color: 'warning' })
      return
    }
    previewMarkdown.value = res.contentMarkdown
  }
  catch {
    if (seq === previewSeq) previewMarkdown.value = null
  }
}
const debouncedPreview = useSearchDebounce(refreshPreview)

// Changing the plan changes the contract: the acceptance no longer applies.
watch(planUuid, () => {
  if (planUuid.value !== props.request.plan_Uuid) termsAccepted.value = false
  debouncedPreview()
})
onMounted(loadTerms)

const saving = ref(false)

function invalid(): string | null {
  if (!planUuid.value) return t('registration.plan.choosePlan')
  if (!terms.value) return t('affiliationRequest.termsUnavailable')
  if (!termsAccepted.value) return t('affiliationRequest.termsRequired')
  return null
}

async function finish(mode: StepExit) {
  if (mode === 'back') return emit('done', null, mode)
  const error = invalid()
  if (error) {
    if (mode === 'later') return emit('done', null, mode)
    toast.add({ title: error, color: 'error' })
    return
  }
  saving.value = true
  try {
    const saved = await api.savePlan(planUuid.value, terms.value!.uuid)
    emit('done', saved, mode)
  }
  catch (err) {
    // useApi does not toast 400 / 404; a newer contract published meanwhile is rejected: reload it.
    notifyApiError(err)
    await loadTerms()
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <UFormField :label="t('affiliationRequest.plan')" required>
      <USelect v-model="planUuid" :items="planItems" :placeholder="t('affiliationRequest.planPlaceholder')" class="w-full" />
    </UFormField>
    <div v-if="selectedPlan && (selectedPlan.inscriptionFee != null || selectedPlan.monthlyFee != null)" class="flex flex-wrap gap-x-6 gap-y-1 text-sm text-prohealth-700">
      <CurrencyConverterDisplay v-if="selectedPlan.inscriptionFee != null" :amount="selectedPlan.inscriptionFee" :currency="selectedPlan.currency_Code || 'USD'" v-slot="{ result }">
        <span class="inline-flex items-center gap-1">
          {{ t('affiliationRequest.inscription') }}: <strong>{{ money(selectedPlan.inscriptionFee, selectedPlan.currency_Code) }}</strong>
          <CurrencyConverterTrigger :result="result" />
        </span>
      </CurrencyConverterDisplay>
      <CurrencyConverterDisplay v-if="selectedPlan.monthlyFee != null" :amount="selectedPlan.monthlyFee" :currency="selectedPlan.currency_Code || 'USD'" v-slot="{ result }">
        <span class="inline-flex items-center gap-1">
          <strong>{{ money(selectedPlan.monthlyFee, selectedPlan.currency_Code) }}</strong> / {{ t('affiliationRequest.month') }}
          <CurrencyConverterTrigger :result="result" />
        </span>
      </CurrencyConverterDisplay>
    </div>

    <div class="rounded-xl border border-prohealth-100 p-4 space-y-3">
      <p class="text-sm font-semibold text-prohealth-900">{{ t('affiliationRequest.termsTitle') }}</p>
      <p v-if="termsUnavailable" class="text-sm text-red-600">{{ t('affiliationRequest.termsUnavailable') }}</p>
      <template v-else-if="terms">
        <UButton
          variant="link"
          color="primary"
          size="xs"
          :icon="termsOpen ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
          class="px-0"
          @click="termsOpen = !termsOpen"
        >
          {{ termsOpen ? t('affiliationRequest.termsHide') : t('affiliationRequest.termsShow') }}
        </UButton>
        <p v-if="termsOpen" class="text-xs text-prohealth-500">{{ t('registration.plan.termsLiveNote') }}</p>
        <div
          v-if="termsOpen"
          class="terms-content max-h-72 overflow-y-auto rounded-lg border border-prohealth-100 bg-prohealth-50/40 p-4 text-sm text-prohealth-800"
          v-html="termsHtml"
        />
        <UCheckbox v-model="termsAccepted" :label="t('affiliationRequest.termsAccept', { title: terms.title })" />
        <p v-if="request.plan_Uuid && !termsAccepted" class="text-xs text-amber-700">{{ t('registration.plan.termsChanged') }}</p>
      </template>
    </div>

    <RegistrationStepActions :saving="saving" :essential="essential" can-go-back @back="finish('back')" @next="finish('next')" @later="finish('later')" @skip="finish('skip')" />
  </div>
</template>

<style scoped>
.terms-content :deep(h1) { font-size: 1.2rem; font-weight: 800; margin: 0.6em 0 0.4em; }
.terms-content :deep(h2) { font-size: 1.05rem; font-weight: 700; margin: 0.6em 0 0.4em; }
.terms-content :deep(p) { margin: 0.5em 0; line-height: 1.6; }
.terms-content :deep(ul), .terms-content :deep(ol) { margin: 0.4em 0 0.4em 1.3em; }
.terms-content :deep(li) { margin: 0.2em 0; }
.terms-content :deep(strong) { font-weight: 700; }
</style>
