<script setup lang="ts">
import type { AllySegment } from '~/types/allies'
import type { AllyRequestListItemDto } from '~/types/allyRequests'

// "Captar aliado" (hub ADR 0037 §5): the advisor registers a business or professional on its behalf. Without
// `?draft=` it shows the form that starts one (the minimum: who the ally is and the contact person) and the
// advisor's own drafts to resume; with `?draft=<uuid>` it shows the wizard, which reuses the ally step components of
// `/completar-registro`. The contact person has no login until the advisor submits: then they get the
// "create your password" email. Not blocked by the self-registration switch.
definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'ALLY_CREATE_ASSISTED',
})

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const { can } = usePermissions()
const { formatDate } = useFormatters()
const api = useAdvisorAllyDrafts()

useSeoMeta({ title: () => t('common.seoTitle', { page: t('assistedAlly.title') }) })

const draftUuid = computed(() => typeof route.query.draft === 'string' ? route.query.draft : '')
const done = ref<{ email: string | null } | null>(null)

// ---- Start a new draft ----
const segments = computed(() => [
  { value: 'B2B', label: t('allyRequestForm.segmentB2B'), hint: t('allyRequestForm.segmentB2BHint') },
  { value: 'B2P', label: t('allyRequestForm.segmentB2P'), hint: t('allyRequestForm.segmentB2PHint') },
])
const emptyState = () => ({
  segment: 'B2B' as AllySegment,
  name: '',
  firstName: '',
  lastName: '',
  documentType: 'V',
  documentNumber: '',
  mobile: '',
  email: '',
  benefitNote: '',
})
const state = reactive(emptyState())
const starting = ref(false)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function invalid(): string | null {
  const missing = !state.firstName.trim() || !state.lastName.trim() || !state.documentNumber.trim()
    || !state.mobile.trim() || !state.email.trim() || (state.segment === 'B2B' && !state.name.trim())
  if (missing) return t('allyRequestForm.required')
  if (!/^\d{1,9}$/.test(state.documentNumber.trim())) return t('allyRequestForm.badDocument')
  if (!EMAIL_RE.test(state.email.trim())) return t('allyRequestForm.badEmail')
  return null
}

async function startDraft() {
  const error = invalid()
  if (error) {
    toast.add({ title: error, color: 'error' })
    return
  }
  starting.value = true
  try {
    const created = await api.start({
      segment: state.segment,
      name: state.segment === 'B2B' ? state.name.trim() : undefined,
      firstName: state.firstName.trim(),
      lastName: state.lastName.trim(),
      documentType: state.documentType,
      documentNumber: state.documentNumber.trim(),
      mobile: state.mobile.trim(),
      email: state.email.trim(),
      benefitNote: state.benefitNote.trim() || undefined,
    })
    Object.assign(state, emptyState())
    await router.push({ query: { draft: created.allyUuid } })
  }
  catch {
    // useApi already showed the backend's reason (email or national ID already registered, …).
  }
  finally {
    starting.value = false
  }
}

// ---- The advisor's own drafts ----
const drafts = ref<AllyRequestListItemDto[]>([])
const draftsLoading = ref(false)

async function loadDrafts() {
  draftsLoading.value = true
  try {
    drafts.value = (await api.list({ size: 50 })).content ?? []
  }
  catch {
    drafts.value = []
  }
  finally {
    draftsLoading.value = false
  }
}
onMounted(loadDrafts)
// Back from the wizard: the list changed.
watch(draftUuid, (uuid) => {
  if (!uuid) void loadDrafts()
})

function resume(uuid: string) {
  void router.push({ query: { draft: uuid } })
}

function onLater() {
  toast.add({ title: t('assistedAlly.savedLater'), description: t('assistedAlly.savedLaterBody'), color: 'success', icon: 'i-lucide-check-circle' })
  void router.push({ query: {} })
}

function onSubmitted(email: string | null) {
  done.value = { email }
  void router.push({ query: {} })
}

function another() {
  done.value = null
}

// ---- Keep record (ALLY_DRAFT_RETAIN_ADVISOR): the cleanup job skips the marked registrations ----
const canKeep = computed(() => can('ALLY_DRAFT_RETAIN_ADVISOR'))
const pool = ref<AllyRequestListItemDto[]>([])
const poolLoading = ref(false)
const openDraft = ref<{ retained: boolean, note: string | null } | null>(null)
const keepTarget = ref<{ uuid: string, retained: boolean, note: string | null } | null>(null)
const keepOpen = computed({ get: () => keepTarget.value !== null, set: (v: boolean) => { if (!v) keepTarget.value = null } })
const keeping = ref(false)

async function loadPool() {
  if (!canKeep.value) return
  poolLoading.value = true
  try {
    // Captured drafts are listed above: here only the self-registered ones in progress.
    pool.value = ((await api.inProgress({ size: 50 })).content ?? []).filter(r => r.registrationChannel !== 'ADVISOR')
  }
  catch {
    pool.value = []
  }
  finally {
    poolLoading.value = false
  }
}

// State of the open draft, for its keep-record button (taken from the same in-progress list).
async function loadOpenDraft(uuid: string) {
  openDraft.value = null
  if (!uuid || !canKeep.value) return
  try {
    const found = ((await api.inProgress({ size: 200 })).content ?? []).find(r => r.uuid === uuid)
    openDraft.value = found ? { retained: !!found.retainFromCleanup, note: found.retainNote ?? null } : null
  }
  catch {
    openDraft.value = null
  }
}

function askKeep(r: { uuid: string, retainFromCleanup?: boolean, retainNote?: string | null }) {
  keepTarget.value = { uuid: r.uuid, retained: !!r.retainFromCleanup, note: r.retainNote ?? null }
}

async function saveKeep(payload: { retain: boolean, note: string }) {
  if (!keepTarget.value) return
  keeping.value = true
  try {
    const uuid = keepTarget.value.uuid
    await api.retain(uuid, payload.retain, payload.note)
    toast.add({ title: payload.retain ? t('keepRecord.kept') : t('keepRecord.released'), color: 'success', icon: 'i-lucide-check-circle' })
    keepTarget.value = null
    if (uuid === draftUuid.value) await loadOpenDraft(uuid)
    else await Promise.all([loadDrafts(), loadPool()])
  }
  catch {
    // useApi toasted the reason (e.g. it was already sent to review).
  }
  finally {
    keeping.value = false
  }
}
onMounted(loadPool)
watch(draftUuid, (uuid) => {
  void loadOpenDraft(uuid)
  if (!uuid) void loadPool()
}, { immediate: true })

// ---- Discard a draft (ALLY_DRAFT_DISCARD_ASSISTED) ----
const canDiscard = computed(() => can('ALLY_DRAFT_DISCARD_ASSISTED'))
const discardTarget = ref<string | null>(null)
const discardOpen = computed({ get: () => discardTarget.value !== null, set: (v: boolean) => { if (!v) discardTarget.value = null } })
const discarding = ref(false)

async function discardDraft() {
  if (!discardTarget.value) return
  discarding.value = true
  try {
    await api.discard(discardTarget.value)
    toast.add({ title: t('registration.discard.done'), color: 'success', icon: 'i-lucide-check-circle' })
    const wasOpen = discardTarget.value === draftUuid.value
    discardTarget.value = null
    if (wasOpen) await router.push({ query: {} })
    else await loadDrafts()
  }
  catch {
    // useApi toasted the reason (e.g. it was already sent to review).
  }
  finally {
    discarding.value = false
  }
}
</script>

<template>
  <div class="space-y-5 max-w-2xl">
    <div>
      <h1 class="text-2xl font-extrabold text-prohealth-900">{{ t('assistedAlly.title') }}</h1>
      <p class="text-sm text-prohealth-700/70 mt-1">{{ t('assistedAlly.subtitle') }}</p>
    </div>

    <!-- Sent -->
    <div v-if="done" class="bg-white rounded-2xl border border-prohealth-100 p-6 text-center space-y-3">
      <UIcon name="i-lucide-circle-check" class="w-12 h-12 mx-auto text-green-500" />
      <h2 class="text-xl font-extrabold text-prohealth-900">{{ t('assistedAlly.doneTitle') }}</h2>
      <p class="text-sm text-prohealth-600">{{ done.email ? t('assistedAlly.doneBody', { email: done.email }) : t('assistedAlly.doneBodyNoEmail') }}</p>
      <div class="flex flex-wrap justify-center gap-2">
        <UButton color="primary" icon="i-lucide-handshake" @click="another">{{ t('assistedAlly.another') }}</UButton>
        <UButton to="/advisors/allies" color="neutral" variant="outline" icon="i-lucide-list">{{ t('assistedAlly.seeAllies') }}</UButton>
      </div>
    </div>

    <!-- Wizard of one draft -->
    <template v-else-if="draftUuid">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <UButton color="neutral" variant="ghost" icon="i-lucide-arrow-left" size="sm" @click="router.push({ query: {} })">{{ t('assistedAlly.backToDrafts') }}</UButton>
        <div class="flex items-center gap-2">
          <UBadge v-if="openDraft?.retained" color="info" variant="subtle" size="sm" icon="i-lucide-bookmark-check">{{ t('keepRecord.badge') }}</UBadge>
          <UButton v-if="canKeep && openDraft" color="neutral" variant="outline" size="sm" icon="i-lucide-bookmark" @click="askKeep({ uuid: draftUuid, retainFromCleanup: openDraft.retained, retainNote: openDraft.note })">{{ t('keepRecord.action') }}</UButton>
          <UButton v-if="canDiscard" color="error" variant="link" size="sm" icon="i-lucide-trash-2" @click="discardTarget = draftUuid">{{ t('registration.discard.action') }}</UButton>
        </div>
      </div>
      <AdvisorAllyWizard :key="draftUuid" :draft-uuid="draftUuid" @later="onLater" @submitted="onSubmitted" @failed="router.replace({ query: {} })" />
    </template>

    <!-- Start + drafts to resume -->
    <template v-else>
      <form class="bg-white rounded-2xl border border-prohealth-100 p-6 grid grid-cols-1 sm:grid-cols-2 gap-4" novalidate @submit.prevent="startDraft">
        <div class="sm:col-span-2">
          <h2 class="font-bold text-prohealth-900">{{ t('assistedAlly.startTitle') }}</h2>
          <p class="text-xs text-prohealth-500 mt-1">{{ t('assistedAlly.startHint') }}</p>
        </div>
        <UFormField :label="t('allyRequestForm.segmentLabel')" class="sm:col-span-2" required>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              v-for="s in segments"
              :key="s.value"
              type="button"
              class="text-left rounded-xl border p-3 transition"
              :class="state.segment === s.value ? 'border-prohealth-500 bg-prohealth-50' : 'border-prohealth-100 hover:border-prohealth-300'"
              @click="state.segment = s.value as AllySegment"
            >
              <p class="font-semibold text-prohealth-900">{{ s.label }}</p>
              <p class="text-xs text-prohealth-500">{{ s.hint }}</p>
            </button>
          </div>
        </UFormField>
        <UFormField v-if="state.segment === 'B2B'" :label="t('allyRequestForm.fields.name')" class="sm:col-span-2" required>
          <UInput v-model="state.name" class="w-full" maxlength="200" />
        </UFormField>
        <p class="sm:col-span-2 text-sm font-semibold text-prohealth-800">{{ state.segment === 'B2B' ? t('allyRequestForm.sections.contactB2B') : t('assistedAlly.contactB2P') }}</p>
        <UFormField :label="t('allyRequestForm.fields.firstName')" required>
          <UInput v-model="state.firstName" class="w-full" maxlength="50" />
        </UFormField>
        <UFormField :label="t('allyRequestForm.fields.lastName')" required>
          <UInput v-model="state.lastName" class="w-full" maxlength="50" />
        </UFormField>
        <UFormField :label="t('allyRequestForm.fields.document')" required>
          <div class="flex gap-2">
            <DocumentTypePrefixSelect v-model="state.documentType" class="w-20" />
            <UInput v-model="state.documentNumber" class="flex-1" maxlength="9" inputmode="numeric" placeholder="12345678" />
          </div>
        </UFormField>
        <UFormField :label="t('allyRequestForm.fields.mobile')" required>
          <UInput v-model="state.mobile" class="w-full" maxlength="30" />
        </UFormField>
        <UFormField :label="t('allyRequestForm.fields.email')" :help="t('assistedAlly.emailHelp')" class="sm:col-span-2" required>
          <UInput v-model="state.email" type="email" class="w-full" maxlength="255" />
        </UFormField>
        <UFormField :label="t('allyRequestForm.fields.benefitNote')" :help="t('allyRequestForm.fields.benefitNoteHelp')" class="sm:col-span-2">
          <UTextarea v-model="state.benefitNote" :rows="2" :maxlength="1000" class="w-full" />
        </UFormField>
        <UButton type="submit" block color="primary" :loading="starting" icon="i-lucide-handshake" class="sm:col-span-2">
          {{ t('assistedAlly.startSubmit') }}
        </UButton>
      </form>

      <section class="bg-white rounded-2xl border border-prohealth-100 p-6 space-y-3">
        <div>
          <h2 class="font-bold text-prohealth-900">{{ t('assistedAlly.draftsTitle') }}</h2>
          <p class="text-xs text-prohealth-500 mt-1">{{ t('assistedAlly.draftsHint') }}</p>
        </div>
        <div v-if="draftsLoading" class="space-y-2">
          <USkeleton class="h-12 w-full rounded-xl" />
          <USkeleton class="h-12 w-full rounded-xl" />
        </div>
        <p v-else-if="drafts.length === 0" class="text-sm text-prohealth-500 py-4 text-center">{{ t('assistedAlly.draftsEmpty') }}</p>
        <ul v-else class="divide-y divide-prohealth-100">
          <li v-for="d in drafts" :key="d.uuid" class="flex items-center justify-between gap-3 py-3">
            <div class="min-w-0">
              <p class="font-medium text-prohealth-900 truncate">
                {{ d.name }}
                <UBadge v-if="d.retainFromCleanup" color="info" variant="subtle" size="sm" class="ml-1 align-middle">{{ t('keepRecord.badge') }}</UBadge>
              </p>
              <p class="text-xs text-prohealth-500 truncate">
                {{ d.segment_Display ?? t(`allies.segments.${d.segment}`, d.segment) }} · {{ d.contactName ?? t('common.empty') }} · {{ d.createdAt_Display ?? formatDate(d.createdAt, 'datetime') }}
              </p>
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <UTooltip v-if="canKeep" :text="t('keepRecord.action')">
                <UButton color="neutral" variant="ghost" size="sm" :icon="d.retainFromCleanup ? 'i-lucide-bookmark-check' : 'i-lucide-bookmark'" :aria-label="t('keepRecord.action')" @click="askKeep(d)" />
              </UTooltip>
              <UButton v-if="canDiscard" color="error" variant="ghost" size="sm" icon="i-lucide-trash-2" :aria-label="t('registration.discard.action')" @click="discardTarget = d.uuid" />
              <UButton color="primary" variant="soft" size="sm" trailing-icon="i-lucide-arrow-right" @click="resume(d.uuid)">{{ t('assistedAlly.resume') }}</UButton>
            </div>
          </li>
        </ul>
      </section>

      <!-- Self-registered registrations in progress: the advisor can keep one they are working on -->
      <section v-if="canKeep" class="bg-white rounded-2xl border border-prohealth-100 p-6 space-y-3">
        <div>
          <h2 class="font-bold text-prohealth-900">{{ t('keepRecord.poolTitle') }}</h2>
          <p class="text-xs text-prohealth-500 mt-1">{{ t('keepRecord.poolHintAlly') }}</p>
        </div>
        <div v-if="poolLoading" class="space-y-2">
          <USkeleton class="h-12 w-full rounded-xl" />
        </div>
        <p v-else-if="pool.length === 0" class="text-sm text-prohealth-500 py-4 text-center">{{ t('keepRecord.poolEmpty') }}</p>
        <ul v-else class="divide-y divide-prohealth-100">
          <li v-for="r in pool" :key="r.uuid" class="flex items-center justify-between gap-3 py-3">
            <div class="min-w-0">
              <p class="font-medium text-prohealth-900 truncate">
                {{ r.name }}
                <UBadge v-if="r.retainFromCleanup" color="info" variant="subtle" size="sm" class="ml-1 align-middle">{{ t('keepRecord.badge') }}</UBadge>
              </p>
              <p class="text-xs text-prohealth-500 truncate">
                {{ r.segment_Display ?? t(`allies.segments.${r.segment}`, r.segment) }} · {{ r.contactName ?? t('common.empty') }} · {{ r.createdAt_Display ?? formatDate(r.createdAt, 'datetime') }}
              </p>
              <p v-if="r.retainNote" class="text-xs text-prohealth-600 truncate">{{ r.retainNote }}</p>
            </div>
            <UButton color="neutral" variant="outline" size="sm" :icon="r.retainFromCleanup ? 'i-lucide-bookmark-check' : 'i-lucide-bookmark'" @click="askKeep(r)">{{ t('keepRecord.action') }}</UButton>
          </li>
        </ul>
      </section>
    </template>

    <KeepRecordModal v-model:open="keepOpen" :retained="keepTarget?.retained ?? false" :note="keepTarget?.note" :loading="keeping" @confirm="saveKeep" />
    <DiscardDraftModal v-model:open="discardOpen" :description="t('assistedAlly.discardBody')" :loading="discarding" @confirm="discardDraft" />
  </div>
</template>
