<script setup lang="ts">
import type { MyAllyProfileDto } from '~/types/allies'
import {
  ALLY_WIZARD_STEPS,
  DEFAULT_ESSENTIAL_STEPS,
  type RegistrationProgressDto,
  type StepExit,
} from '~/types/registration'

// Wizard of the advisor's "Captar aliado" (hub ADR 0037 §5): the same step components as the ally's own
// `/completar-registro` (location, tax or professional data, profile, review), bound to one ally draft the advisor
// captured. The steps save through the ally's profile endpoints, which accept the capturing advisor while the draft
// is open; "Guardar y seguir después" leaves and the advisor resumes it later from the list of drafts. The review
// step sends it with POST /v1/me/advisor/ally-requests/drafts/{uuid}/submit.
const props = defineProps<{ draftUuid: string }>()
const emit = defineEmits<{ later: [], submitted: [email: string | null], failed: [] }>()

const { t } = useI18n()
const myAllies = useMyAllies()
const drafts = useAdvisorAllyDrafts()

const stepKeys = ALLY_WIZARD_STEPS as readonly string[]
const loading = ref(true)
const loadFailed = ref(false)
const profile = ref<MyAllyProfileDto | null>(null)
const current = ref(0)
const currentKey = computed(() => stepKeys[current.value] ?? 'submit')

// The review step lists what is still missing from this progress, derived from the draft itself.
const progress = computed<RegistrationProgressDto | null>(() => {
  const p = profile.value
  if (!p) return null
  const fiscal = Boolean(p.allyType_Uuid)
    && (p.segment === 'B2B' ? Boolean(p.taxDocumentNumber) : Boolean(p.profession_Uuid))
  const done: Record<string, boolean> = {
    location: Boolean(p.city_Uuid),
    fiscal,
    profile: (p.completeness?.missing ?? []).length === 0,
  }
  return {
    kind: 'ALLY',
    steps: Object.entries(done).map(([key, isDone]) => ({ key, done: isDone, essential: DEFAULT_ESSENTIAL_STEPS[key] ?? false })),
    percent: 0,
    submitted: p.submitted === true,
    confirmedByOperator: false,
    showCompletionPortal: false,
  }
})

const stepLabel = (key: string): string => t(`registration.steps.${key}`)
const essentialOf = (key: string): boolean => DEFAULT_ESSENTIAL_STEPS[key] ?? true

/** First essential step still not done (the review step when everything else is). */
function firstOpenStep(): number {
  const steps = progress.value?.steps ?? []
  const idx = stepKeys.findIndex(key => key !== 'submit' && steps.some(s => s.key === key && !s.done && s.essential))
  return idx === -1 ? stepKeys.length - 1 : idx
}

async function load() {
  loading.value = true
  loadFailed.value = false
  try {
    profile.value = await myAllies.getProfile(props.draftUuid)
    current.value = firstOpenStep()
  }
  catch {
    // useApi already toasted the reason (a draft of another advisor is refused).
    loadFailed.value = true
    emit('failed')
  }
  finally {
    loading.value = false
  }
}
onMounted(load)

function onDone(saved: MyAllyProfileDto | null, mode: StepExit) {
  if (saved) profile.value = saved
  if (mode === 'later') return emit('later')
  if (mode === 'back') current.value = Math.max(0, current.value - 1)
  else current.value = Math.min(stepKeys.length - 1, current.value + 1)
}

/** Jumps to the step that holds something the submit said was missing (hub ADR 0037). */
function goToStep(step: string) {
  const idx = stepKeys.indexOf(step)
  if (idx !== -1) current.value = idx
}
</script>

<template>
  <div class="space-y-5">
    <div v-if="loading" class="space-y-3">
      <USkeleton class="h-4 w-full rounded" />
      <USkeleton class="h-48 w-full rounded-2xl" />
    </div>

    <UAlert v-else-if="loadFailed" color="error" variant="subtle" icon="i-lucide-circle-alert" :title="t('assistedAlly.loadFailed')" :actions="[{ label: t('registration.wizard.retry'), color: 'neutral', onClick: load }]" />

    <template v-else-if="profile">
      <p class="text-sm text-prohealth-700">{{ t('assistedAlly.draftFor', { name: profile.name }) }}</p>
      <RegistrationProgressBar :current="current + 1" :total="stepKeys.length" :label="stepLabel(currentKey)" />

      <div class="bg-white rounded-2xl border border-prohealth-100 p-6 space-y-4">
        <h2 class="font-bold text-prohealth-900">{{ stepLabel(currentKey) }}</h2>
        <RegistrationAllyLocationStep v-if="currentKey === 'location'" :key="'location'" :ally-uuid="draftUuid" :profile="profile" :essential="essentialOf('location')" @done="onDone" />
        <RegistrationAllyLegalStep v-else-if="currentKey === 'fiscal'" :key="'fiscal'" :ally-uuid="draftUuid" :profile="profile" :essential="essentialOf('fiscal')" @done="onDone" />
        <RegistrationAllyProfileStep v-else-if="currentKey === 'profile'" :key="'profile'" :ally-uuid="draftUuid" :profile="profile" :essential="essentialOf('profile')" assisted @saved="profile = $event" @done="onDone" />
        <RegistrationAllySubmitStep v-else :ally-uuid="draftUuid" :profile="profile" :progress="progress" :submit-url="drafts.submitUrl(draftUuid)" @submitted="emit('submitted', profile?.email ?? null)" @goto="goToStep" @back="onDone(null, 'back')" @later="onDone(null, 'later')" />
      </div>
    </template>
  </div>
</template>
