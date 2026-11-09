<script setup lang="ts">
import type { MyAllyDto, MyAllyProfileDto } from '~/types/allies'
import type { MyAffiliationRequestDto } from '~/types/affiliationRequests'
import { PLAN_TYPES } from '~/types/plans'
import {
  ALLY_WIZARD_STEPS,
  DEFAULT_ESSENTIAL_STEPS,
  MEMBER_WIZARD_STEPS,
  type PublicPlan,
  type StepExit,
} from '~/types/registration'

// "Completar registro" (hub ADR 0037 §2-3): the wizard that follows the public step 1. Two variants, chosen by
// `kind` of GET /v1/me/registration-progress: affiliate (personal, plan + contract, inscription payment, family,
// send) and ally (location, fiscal/professional data, profile, send). Each "Siguiente" saves on the server, so the
// person can leave and come back from another device. The route exists only while `showCompletionPortal` is true
// (middleware registration-portal).
definePageMeta({
  layout: 'dashboard',
  alias: ['/complete-registration'],
  middleware: 'registration-portal',
})

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const { refreshSession, logout } = useAuth()
const registration = useRegistrationProgress()
const memberApi = useMyAffiliationRequest()
const myAllies = useMyAllies()

useSeoMeta({ title: () => t('registration.wizard.seoTitle') })

const loading = ref(true)
const loadFailed = ref(false)
const isAlly = computed(() => registration.isAlly.value)
const stepKeys = computed<readonly string[]>(() => isAlly.value ? ALLY_WIZARD_STEPS : MEMBER_WIZARD_STEPS)
const current = ref(0)
const currentKey = computed(() => stepKeys.value[current.value] ?? 'submit')

// Member data.
const request = ref<MyAffiliationRequestDto | null>(null)
const plans = ref<PublicPlan[]>([])
// Ally data.
const ally = ref<MyAllyDto | null>(null)
const profile = ref<MyAllyProfileDto | null>(null)

const submittedResult = ref<'APPROVED' | 'PENDING' | null>(null)

const essentialOf = (key: string): boolean =>
  registration.progress.value?.steps.find(s => s.key === key)?.essential ?? DEFAULT_ESSENTIAL_STEPS[key] ?? true

const stepLabel = (key: string): string => t(`registration.steps.${key}`)

function isSelfServicePlan(p: PublicPlan): boolean {
  return p.type !== PLAN_TYPES.CORPORATE && (p.minMembers == null || p.minMembers <= 1)
}

/** First step still not done (the review step when everything else is). */
function firstOpenStep(): number {
  const steps = registration.progress.value?.steps ?? []
  const idx = stepKeys.value.findIndex(key => key !== 'submit' && steps.some(s => s.key === key && !s.done))
  return idx === -1 ? stepKeys.value.length - 1 : idx
}

async function loadAll() {
  loading.value = true
  loadFailed.value = false
  try {
    await registration.load(true)
    if (isAlly.value) {
      ally.value = (await myAllies.list())[0] ?? null
      if (ally.value) profile.value = await myAllies.getProfile(ally.value.uuid)
      loadFailed.value = !ally.value
    }
    else {
      request.value = await memberApi.get()
      const res = await useApi<PublicPlan[] | { content: PublicPlan[] }>('/v1/public/plans', { skipAuth: true, silent: true })
      plans.value = (Array.isArray(res) ? res : res.content ?? []).filter(isSelfServicePlan)
    }
    current.value = firstOpenStep()
  }
  catch {
    loadFailed.value = true
  }
  finally {
    loading.value = false
  }
}
onMounted(loadAll)

async function leaveForLater() {
  toast.add({ title: t('registration.wizard.savedLater'), description: t('registration.wizard.savedLaterBody'), color: 'success', icon: 'i-lucide-check-circle' })
  // A pending member has no other portal: back to the sign-in screen, where the link or password resumes it.
  if (isAlly.value) await router.push('/allies')
  else await logout()
}

async function onDone(saved: MyAffiliationRequestDto | MyAllyProfileDto | null, mode: StepExit) {
  if (saved) {
    if (isAlly.value) profile.value = saved as MyAllyProfileDto
    else request.value = saved as MyAffiliationRequestDto
  }
  if (mode === 'later') return leaveForLater()
  await registration.load(true)
  if (mode === 'back') current.value = Math.max(0, current.value - 1)
  else current.value = Math.min(stepKeys.value.length - 1, current.value + 1)
}

/** After sending: the role may have changed (approved on the spot), so renew the tokens and the profile. */
async function onSubmitted(sent?: MyAffiliationRequestDto) {
  if (sent) request.value = sent
  await refreshSession()
  await registration.load(true)
  submittedResult.value = sent?.status === 'APPROVED' ? 'APPROVED' : 'PENDING'
  toast.add({ title: t('registration.wizard.submittedToast'), color: 'success', icon: 'i-lucide-check-circle' })
}

const alreadySubmitted = computed(() => registration.progress.value?.submitted === true && submittedResult.value === null)

function goHome() {
  void router.push(isAlly.value ? '/allies' : '/members')
}
</script>

<template>
  <div class="max-w-2xl space-y-5">
    <div>
      <h1 class="text-2xl font-extrabold text-prohealth-900">{{ isAlly ? t('registration.wizard.titleAlly') : t('registration.wizard.titleMember') }}</h1>
      <p class="text-sm text-prohealth-700/70 mt-1">{{ t('registration.wizard.subtitle') }}</p>
    </div>

    <div v-if="loading" class="space-y-3">
      <USkeleton class="h-4 w-full rounded" />
      <USkeleton class="h-48 w-full rounded-2xl" />
    </div>

    <UAlert v-else-if="loadFailed" color="error" variant="subtle" icon="i-lucide-circle-alert" :title="t('registration.wizard.loadFailed')" :actions="[{ label: t('registration.wizard.retry'), color: 'neutral', onClick: loadAll }]" />

    <!-- Sent -->
    <div v-else-if="submittedResult" class="bg-white rounded-2xl border border-prohealth-100 p-6 text-center space-y-3">
      <UIcon name="i-lucide-circle-check" class="w-12 h-12 mx-auto text-green-500" />
      <h2 class="text-xl font-extrabold text-prohealth-900">{{ t('registration.wizard.submittedTitle') }}</h2>
      <p class="text-sm text-prohealth-600">
        {{ submittedResult === 'APPROVED' ? t('registration.wizard.submittedApproved') : t('registration.wizard.submittedPending') }}
      </p>
      <UButton color="primary" icon="i-lucide-arrow-right" @click="goHome">{{ t('registration.wizard.continue') }}</UButton>
    </div>

    <UAlert v-else-if="alreadySubmitted && !isAlly" color="info" variant="subtle" icon="i-lucide-hourglass" :title="t('registration.wizard.alreadySubmittedTitle')" :description="t('registration.wizard.alreadySubmittedBody')" />

    <template v-else>
      <UAlert v-if="alreadySubmitted" color="info" variant="subtle" icon="i-lucide-hourglass" :title="t('registration.wizard.alreadySubmittedTitle')" :description="t('registration.wizard.alreadySubmittedBody')" />
      <RegistrationProgressBar :current="current + 1" :total="stepKeys.length + 1" :label="stepLabel(currentKey)" />

      <div class="bg-white rounded-2xl border border-prohealth-100 p-6 space-y-4">
        <h2 class="font-bold text-prohealth-900">{{ stepLabel(currentKey) }}</h2>

        <template v-if="!isAlly && request">
          <RegistrationMemberPersonalStep v-if="currentKey === 'personal'" :key="'personal'" :request="request" :essential="essentialOf('personal')" @done="onDone" />
          <RegistrationMemberPlanStep v-else-if="currentKey === 'plan'" :key="'plan'" :request="request" :plans="plans" :essential="essentialOf('plan')" :preselected-plan="typeof route.query.plan === 'string' ? route.query.plan : undefined" @done="onDone" />
          <RegistrationMemberPaymentStep v-else-if="currentKey === 'payment'" :key="'payment'" :request="request" :plans="plans" :essential="essentialOf('payment')" @done="onDone" />
          <RegistrationMemberFamilyStep v-else-if="currentKey === 'family'" :key="'family'" :request="request" :essential="essentialOf('family')" @done="onDone" />
          <RegistrationMemberSubmitStep v-else :request="request" :plans="plans" :progress="registration.progress.value" @submitted="onSubmitted" @back="onDone(null, 'back')" @later="onDone(null, 'later')" />
        </template>

        <template v-else-if="isAlly && ally && profile">
          <RegistrationAllyLocationStep v-if="currentKey === 'location'" :key="'location'" :ally-uuid="ally.uuid" :profile="profile" :essential="essentialOf('location')" @done="onDone" />
          <RegistrationAllyLegalStep v-else-if="currentKey === 'legal'" :key="'legal'" :ally-uuid="ally.uuid" :profile="profile" :essential="essentialOf('legal')" @done="onDone" />
          <RegistrationAllyProfileStep v-else-if="currentKey === 'profile'" :key="'profile'" :ally-uuid="ally.uuid" :profile="profile" :essential="essentialOf('profile')" @saved="profile = $event" @done="onDone" />
          <RegistrationAllySubmitStep v-else :ally-uuid="ally.uuid" :profile="profile" :progress="registration.progress.value" @submitted="onSubmitted()" @back="onDone(null, 'back')" @later="onDone(null, 'later')" />
        </template>
      </div>
    </template>
  </div>
</template>
