<script setup lang="ts">
import { MEMBER_REGISTRATION_API } from '~/composables/useMemberRegistrationApi'
import type { MyAffiliationRequestDto } from '~/types/affiliationRequests'
import { PLAN_TYPES } from '~/types/plans'
import {
  DEFAULT_ESSENTIAL_STEPS,
  MEMBER_WIZARD_STEPS,
  type PublicPlan,
  type RegistrationProgressDto,
  type StepExit,
} from '~/types/registration'

// Wizard of the advisor's "Afiliar persona" (hub ADR 0037 §5): the same step components as `/completar-registro`
// (personal, plan + contract, payment, family, review), bound to one assisted DRAFT of the advisor. Each "Siguiente"
// saves on the server (PATCH /v1/me/advisor/affiliation-requests/drafts/{uuid}/{step}), so the advisor can leave
// with "Guardar y seguir después" and resume later from the list of drafts.
const props = defineProps<{ draftUuid: string }>()
const emit = defineEmits<{ later: [], submitted: [request: MyAffiliationRequestDto], failed: [] }>()

const { t } = useI18n()
const drafts = useAdvisorAffiliationDrafts()

// The shared steps call this api instead of the person's own registration.
provide(MEMBER_REGISTRATION_API, drafts.forDraft(props.draftUuid))

const stepKeys = MEMBER_WIZARD_STEPS as readonly string[]
const loading = ref(true)
const loadFailed = ref(false)
const request = ref<MyAffiliationRequestDto | null>(null)
const plans = ref<PublicPlan[]>([])
const current = ref(0)
const currentKey = computed(() => stepKeys[current.value] ?? 'submit')

// The review step lists what is still missing from this progress, derived from the draft itself.
const progress = computed<RegistrationProgressDto | null>(() => {
  const r = request.value
  if (!r) return null
  const done: Record<string, boolean> = {
    personal: Boolean(r.birthDate),
    plan: Boolean(r.plan_Uuid) && r.contractAccepted === true,
    payment: Boolean(r.payment),
    family: (r.family?.length ?? 0) > 0,
  }
  return {
    kind: 'MEMBER',
    steps: Object.entries(done).map(([key, isDone]) => ({ key, done: isDone, essential: DEFAULT_ESSENTIAL_STEPS[key] ?? false })),
    percent: 0,
    submitted: r.status !== 'DRAFT',
    confirmedByOperator: false,
    showCompletionPortal: false,
  }
})

const stepLabel = (key: string): string => t(`registration.steps.${key}`)

function isSelfServicePlan(p: PublicPlan): boolean {
  return p.type !== PLAN_TYPES.CORPORATE && (p.minMembers == null || p.minMembers <= 1)
}

/** First step still not done (the review step when everything else is). */
function firstOpenStep(): number {
  const steps = progress.value?.steps ?? []
  const idx = stepKeys.findIndex(key => key !== 'submit' && steps.some(s => s.key === key && !s.done && s.essential))
  return idx === -1 ? stepKeys.length - 1 : idx
}

async function load() {
  loading.value = true
  loadFailed.value = false
  try {
    request.value = await drafts.get(props.draftUuid)
    const res = await useApi<PublicPlan[] | { content: PublicPlan[] }>('/v1/public/plans', { skipAuth: true, silent: true })
    plans.value = (Array.isArray(res) ? res : res.content ?? []).filter(isSelfServicePlan)
    current.value = firstOpenStep()
  }
  catch {
    // useApi already toasted the reason (a draft of another advisor is a 404).
    loadFailed.value = true
    emit('failed')
  }
  finally {
    loading.value = false
  }
}
onMounted(load)

function onDone(saved: MyAffiliationRequestDto | null, mode: StepExit) {
  if (saved) request.value = saved
  if (mode === 'later') return emit('later')
  if (mode === 'back') current.value = Math.max(0, current.value - 1)
  else current.value = Math.min(stepKeys.length - 1, current.value + 1)
}
</script>

<template>
  <div class="space-y-5">
    <div v-if="loading" class="space-y-3">
      <USkeleton class="h-4 w-full rounded" />
      <USkeleton class="h-48 w-full rounded-2xl" />
    </div>

    <UAlert v-else-if="loadFailed" color="error" variant="subtle" icon="i-lucide-circle-alert" :title="t('assistedAffiliation.loadFailed')" :actions="[{ label: t('registration.wizard.retry'), color: 'neutral', onClick: load }]" />

    <template v-else-if="request">
      <p class="text-sm text-prohealth-700">
        {{ t('assistedAffiliation.draftFor', { name: `${request.firstName} ${request.lastName}`, document: `${request.documentType}${request.documentNumber}` }) }}
      </p>
      <RegistrationProgressBar :current="current + 1" :total="stepKeys.length" :label="stepLabel(currentKey)" />

      <div class="bg-white rounded-2xl border border-prohealth-100 p-6 space-y-4">
        <h2 class="font-bold text-prohealth-900">{{ stepLabel(currentKey) }}</h2>
        <RegistrationMemberPersonalStep v-if="currentKey === 'personal'" :key="'personal'" :request="request" :essential="DEFAULT_ESSENTIAL_STEPS.personal ?? true" @done="onDone" />
        <RegistrationMemberPlanStep v-else-if="currentKey === 'plan'" :key="'plan'" :request="request" :plans="plans" :essential="DEFAULT_ESSENTIAL_STEPS.plan ?? true" @done="onDone" />
        <RegistrationMemberPaymentStep v-else-if="currentKey === 'payment'" :key="'payment'" :request="request" :plans="plans" :essential="DEFAULT_ESSENTIAL_STEPS.payment ?? false" @done="onDone" />
        <RegistrationMemberFamilyStep v-else-if="currentKey === 'family'" :key="'family'" :request="request" :essential="DEFAULT_ESSENTIAL_STEPS.family ?? false" @done="onDone" />
        <RegistrationMemberSubmitStep v-else :request="request" :plans="plans" :progress="progress" @submitted="emit('submitted', $event)" @back="onDone(null, 'back')" @later="onDone(null, 'later')" />
      </div>
    </template>
  </div>
</template>
