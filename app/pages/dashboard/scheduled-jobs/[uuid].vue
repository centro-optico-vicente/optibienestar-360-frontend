<script setup lang="ts">
import type { ApiError } from '~/types/auth'
import type { JobRunOutcome, JobTriggerSource, ScheduledJobDto, ScheduledJobRunDto } from '~/types/scheduling'
import { JOB_RUN_OUTCOME_OPTIONS } from '~/types/scheduling'
import type { SortDirection } from '~/composables/useTableSort'
import { buildPageSizeItems, DEFAULT_PAGE_SIZE, UNPAGED_PAGE_SIZE } from '~/utils/pagination'
import { defaultTodayRange } from '~/utils/date'

definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'JOB_VIEW_ALL',
})

const { t } = useI18n()
const { formatDate } = useFormatters()

useSeoMeta({ title: () => t('common.seoTitle', { page: t('nav.items.scheduledJobs.label') }) })

const route = useRoute()
const jobUuid = route.params.uuid as string

const jobs = useScheduledJobs()
const { can } = usePermissions()
const toast = useToast()

const canUpdate = computed(() => can('JOB_UPDATE'))
const canDelete = computed(() => can('JOB_DELETE'))
const canViewAuditChanges = computed(() => can('AUDIT_VIEW_ALL'))
const canViewAuditReports = computed(() => can('REPORT_AUDIT_VIEW_ALL'))
const canViewAudit = computed(() => canViewAuditChanges.value || canViewAuditReports.value)
const auditOpen = ref(false)
const canRun = computed(() => can('JOB_RUN_NOW'))

// ---- Job load ----
const job = ref<ScheduledJobDto | null>(null)
const loading = ref(true)
const notFound = ref(false)

async function loadJob() {
  try {
    job.value = await jobs.get(jobUuid)
  }
  catch (err) {
    if ((err as ApiError).status === 404) notFound.value = true
    job.value = null
  }
  finally {
    loading.value = false
  }
}

// ---- Runs history ----
const runs = ref<ScheduledJobRunDto[]>([])
const runsTotal = ref(0)
const runsLoading = ref(false)
const runsPage = ref(1) // UPagination es 1-based; la API es 0-based
const runsSize = ref(DEFAULT_PAGE_SIZE)
const runsPageSizeItems = buildPageSizeItems(t)
// Empty by default: no `sort=` is sent until the user clicks a column, so
// the backend's own default-sort fallback (entity_config → system_configs
// → startedAt DESC) applies.
const runsSort = useTableSort([])
const runsHasActiveSort = computed(() => runsSort.hasActiveSort.value)
const runsIsMultiSort = computed(() => runsSort.orders.value.length > 1)
// Guards the appliedSort-sync assignment below from re-triggering the
// `watch(runsSort.orders, ...)` reload (would otherwise loop forever).
const runsResetting = ref(false)

const RUN_OUTCOME_OPTIONS = JOB_RUN_OUTCOME_OPTIONS.map(o => ({ label: t(`scheduledJobs.outcome.${o.value}`, o.label), value: o.value }))
const RUN_TRIGGER_OPTIONS: { label: string, value: JobTriggerSource }[] = [
  { label: t('scheduledJobs.trigger.SCHEDULED'), value: 'SCHEDULED' },
  { label: t('scheduledJobs.trigger.MANUAL'), value: 'MANUAL' },
  { label: t('scheduledJobs.trigger.STARTUP'), value: 'STARTUP' },
]
const runsOutcomeFilter = ref<JobRunOutcome | undefined>(undefined)
const runsTriggerFilter = ref<JobTriggerSource | undefined>(undefined)
const runsDateRange = ref(defaultTodayRange())

async function loadRuns() {
  runsLoading.value = true
  try {
    const res = await jobs.listRuns(jobUuid, {
      page: runsPage.value - 1,
      size: runsSize.value,
      sort: runsSort.sortParam.value,
      outcome: runsOutcomeFilter.value,
      triggeredBy: runsTriggerFilter.value,
      from: runsDateRange.value.from,
      to: runsDateRange.value.to,
    })
    runs.value = res.content ?? []
    runsTotal.value = res.totalElements ?? 0
    // No column clicked yet → reflect the server's own default in the header arrows.
    if (runsSort.orders.value.length === 0 && res.appliedSort?.length) {
      runsResetting.value = true
      runsSort.seedServerDefault(res.appliedSort.map(o => ({ field: o.field, direction: o.direction.toLowerCase() as SortDirection })))
      await nextTick()
      runsResetting.value = false
    }
  }
  catch {
    // useApi already shows the error toast
    runs.value = []
    runsTotal.value = 0
  }
  finally {
    runsLoading.value = false
  }
}
watch(runsSort.orders, () => { if (!runsResetting.value) loadRuns() }, { deep: true })
watch(runsSize, () => { if (!runsResetting.value) runsPage.value = 1 })
watch([runsPage, runsSize], () => { if (!runsResetting.value) loadRuns() })
watch([runsOutcomeFilter, runsTriggerFilter, runsDateRange], () => {
  if (!runsResetting.value) { runsPage.value = 1; loadRuns() }
}, { deep: true })

function resetRunFilters() {
  runsResetting.value = true
  runsOutcomeFilter.value = undefined
  runsTriggerFilter.value = undefined
  runsDateRange.value = defaultTodayRange()
  runsSize.value = DEFAULT_PAGE_SIZE
  runsPage.value = 1
  runsResetting.value = false
  loadRuns()
}

onMounted(async () => {
  await Promise.all([loadJob(), loadRuns()])
})

// Header "Refrescar": re-fetch the job record and its runs history at once.
const refreshing = ref(false)
async function refreshAll() {
  refreshing.value = true
  try {
    await Promise.all([loadJob(), loadRuns()])
  }
  finally {
    refreshing.value = false
  }
}

// ---- Presentation helpers ----
function outcomeColor(status?: string | null): 'success' | 'error' | 'info' | 'neutral' {
  switch (status) {
    case 'SUCCESS': return 'success'
    case 'FAILED':
    case 'TIMEOUT': return 'error'
    case 'RUNNING': return 'info'
    default: return 'neutral'
  }
}

function outcomeLabel(status?: string | null): string {
  if (!status) return t('common.empty')
  const opt = JOB_RUN_OUTCOME_OPTIONS.find(o => o.value === status)
  return t(`scheduledJobs.outcome.${status}`, opt?.label ?? status)
}

function triggerLabel(src?: string | null): string {
  if (!src) return t('common.empty')
  return t(`scheduledJobs.trigger.${src}`, src)
}

// Duration in ms, promoted to seconds once it crosses a second. Empty → '—'.
function formatDuration(ms?: number | null): string {
  if (ms === null || ms === undefined) return t('common.empty')
  if (ms < 1000) return `${ms} ms`
  return `${(ms / 1000).toFixed(1)} s`
}

// ---- Edit (shared modal) ----
const formOpen = ref(false)

async function onSaved(updated: ScheduledJobDto) {
  job.value = updated
}

// ---- Cron legible ----
const cronDescriptionText = computed(() => job.value ? describeCron(job.value.cronExpression) : null)

// ---- Parámetros de tarea/ejecución (edición in-place, independiente del resto de la ficha) ----
const params = useJsonKeyValueEditor()
watch(job, (j) => { if (j) params.load(j.parameters) }, { immediate: true })
const savingParams = ref(false)

async function saveParams() {
  if (!job.value) return
  const parameters = params.resolve()
  if (parameters === null) {
    toast.add({ title: t('scheduledJobs.form.parameters.invalidJson'), color: 'error', icon: 'i-lucide-alert-triangle' })
    return
  }
  savingParams.value = true
  try {
    job.value = await jobs.update(job.value.uuid, { parameters })
    toast.add({ title: t('scheduledJobs.detail.parametersSavedToast'), color: 'success', icon: 'i-lucide-check-circle' })
  }
  catch {
    // toast handled by useApi
  }
  finally {
    savingParams.value = false
  }
}

// ---- Restore (reverses a soft-deactivation) ----
const restoring = ref(false)

async function restoreJob() {
  if (!job.value) return
  restoring.value = true
  try {
    job.value = await jobs.update(job.value.uuid, { active: true })
    toast.add({ title: t('scheduledJobs.restoredToast'), color: 'success', icon: 'i-lucide-check-circle' })
  }
  catch {
    // toast handled by useApi
  }
  finally {
    restoring.value = false
  }
}

// ---- Run now + polling (hybrid: sync outcome or async RUNNING) ----
const running = ref(false)
const polling = ref(false)
let pollTimer: ReturnType<typeof setInterval> | undefined
let pollTries = 0

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = undefined
  }
  polling.value = false
  pollTries = 0
}

// Poll a manual async run every 2s, up to 15 tries, until it leaves RUNNING.
function startPolling(runUuid: string) {
  stopPolling()
  polling.value = true
  pollTimer = setInterval(async () => {
    pollTries += 1
    try {
      const run = await jobs.getRun(jobUuid, runUuid)
      if (run.outcome !== 'RUNNING') {
        stopPolling()
        await Promise.all([loadJob(), loadRuns()])
        return
      }
    }
    catch {
      // ignore transient errors while polling
    }
    if (pollTries >= 15) {
      stopPolling()
      await Promise.all([loadJob(), loadRuns()])
    }
  }, 2000)
}

async function runNow() {
  if (!job.value) return
  running.value = true
  try {
    const res = await jobs.runNow(job.value.uuid)
    if (res.outcome === 'RUNNING') {
      toast.add({ title: t('scheduledJobs.runNow.runningToast'), color: 'info', icon: 'i-lucide-loader-circle' })
      await loadRuns()
      if (res.runUuid) startPolling(res.runUuid)
    }
    else if (res.outcome === 'SUCCESS') {
      toast.add({ title: t('scheduledJobs.runNow.successToast'), color: 'success', icon: 'i-lucide-check-circle' })
      await Promise.all([loadJob(), loadRuns()])
    }
    else {
      toast.add({ title: t('scheduledJobs.runNow.failedToast'), color: 'error', icon: 'i-lucide-alert-triangle' })
      await Promise.all([loadJob(), loadRuns()])
    }
  }
  catch {
    // toast handled by useApi
  }
  finally {
    running.value = false
  }
}

onBeforeUnmount(stopPolling)
</script>

<template>
  <div class="space-y-5">
    <!-- Back -->
    <UButton
      color="neutral"
      variant="ghost"
      icon="i-lucide-arrow-left"
      to="/dashboard/scheduled-jobs"
      size="sm"
    >
      {{ t('scheduledJobs.title') }}
    </UButton>

    <!-- Loading -->
    <div v-if="loading" class="bg-white rounded-2xl border border-prohealth-100 p-6 space-y-3">
      <USkeleton class="h-7 w-64 rounded" />
      <USkeleton class="h-4 w-40 rounded" />
      <USkeleton class="h-4 w-full max-w-lg rounded" />
    </div>

    <!-- Not found -->
    <div v-else-if="notFound || !job" class="bg-white rounded-2xl border border-prohealth-100 p-12 text-center">
      <UIcon name="i-lucide-search-x" class="w-10 h-10 mx-auto mb-3 text-prohealth-300" />
      <p class="text-prohealth-700 font-semibold">{{ t('scheduledJobs.detail.notFoundTitle') }}</p>
      <p class="text-sm text-prohealth-500 mt-1">{{ t('scheduledJobs.detail.notFoundBody') }}</p>
    </div>

    <template v-else>
      <!-- Header + actions -->
      <div class="bg-white rounded-2xl border border-prohealth-100 p-6">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div class="flex items-center gap-3 flex-wrap">
              <h1 class="text-2xl font-extrabold text-prohealth-900">{{ job.displayName }}</h1>
              <UBadge :color="job.enabled ? 'success' : 'neutral'" variant="subtle">
                {{ job.enabled_Display ?? (job.enabled ? t('scheduledJobs.form.fields.enabled') : t('common.no')) }}
              </UBadge>
              <UBadge v-if="job.lastRunStatus" :color="outcomeColor(job.lastRunStatus)" variant="subtle">
                {{ job.lastRunStatus_Display ?? outcomeLabel(job.lastRunStatus) }}
              </UBadge>
              <UBadge v-if="job.lockHeld" color="warning" variant="subtle">
                {{ t('scheduledJobs.detail.lockHeld') }}
              </UBadge>
            </div>
            <p class="text-sm text-prohealth-500 mt-1 font-mono">{{ job.code }}</p>
          </div>

          <div class="flex items-center gap-2">
            <RefreshButton
              size="md"
              variant="ghost"
              :icon-only="false"
              :loading="refreshing"
              :title="t('common.refreshRecord')"
              @refresh="refreshAll"
            />
            <ReportPrintButton :record-uuid="jobUuid" variant="ghost" />
            <UTooltip :text="canRun ? t('scheduledJobs.runNow.button') : t('scheduledJobs.noPermissionRun')">
              <UButton
                color="primary"
                variant="soft"
                icon="i-lucide-play"
                :loading="running || polling"
                :disabled="!canRun"
                @click="runNow"
              >
                {{ t('scheduledJobs.runNow.button') }}
              </UButton>
            </UTooltip>
            <UTooltip :text="canUpdate ? t('common.edit') : t('scheduledJobs.noPermissionEdit')">
              <UButton
                color="info"
                variant="ghost"
                icon="i-lucide-pencil"
                :disabled="!canUpdate"
                @click="formOpen = true"
              >
                {{ t('common.edit') }}
              </UButton>
            </UTooltip>
            <RestoreButton
              v-if="job.active === false"
              :active="job.active"
              :allowed="canDelete"
              :loading="restoring"
              class="ms-2"
              @restore="restoreJob"
            />
            <UTooltip v-if="canViewAudit" :text="t('audit.trigger')">
              <UButton color="neutral" variant="ghost" icon="i-lucide-history" @click="auditOpen = true" />
            </UTooltip>
          </div>
        </div>

        <p v-if="job.description" class="text-sm text-prohealth-700 mt-4 max-w-3xl">
          {{ job.description }}
        </p>
        <p v-if="polling" class="text-xs text-prohealth-500 mt-3 flex items-center gap-1.5">
          <UIcon name="i-lucide-loader-circle" class="w-3.5 h-3.5 animate-spin" />
          {{ t('scheduledJobs.runNow.polling') }}
        </p>
      </div>

      <!-- Schedule -->
      <div class="bg-white rounded-2xl border border-prohealth-100 p-6">
        <h2 class="font-bold text-prohealth-900 mb-4">{{ t('scheduledJobs.detail.schedule') }}</h2>
        <dl class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4 text-sm">
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('scheduledJobs.form.fields.cronExpression') }}</dt>
            <dd class="text-prohealth-900 mt-0.5 font-mono flex items-center gap-1.5">
              {{ job.cronExpression }}
              <UTooltip v-if="cronDescriptionText" :text="cronDescriptionText">
                <UIcon name="i-lucide-info" class="w-3.5 h-3.5 text-prohealth-400" />
              </UTooltip>
            </dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('scheduledJobs.form.fields.timezone') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ job.timezone }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('scheduledJobs.form.fields.enabled') }}</dt>
            <dd class="mt-0.5">
              <UBadge :color="job.enabled ? 'success' : 'neutral'" variant="subtle" size="sm">
                {{ job.enabled_Display ?? (job.enabled ? t('common.yes') : t('common.no')) }}
              </UBadge>
            </dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('scheduledJobs.detail.nextRun') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ job.nextRunAt ? (job.nextRunAt_Display ?? formatDate(job.nextRunAt, 'datetime')) : t('common.empty') }}</dd>
          </div>
        </dl>
      </div>

      <!-- Execution policy -->
      <div class="bg-white rounded-2xl border border-prohealth-100 p-6">
        <h2 class="font-bold text-prohealth-900 mb-4">{{ t('scheduledJobs.detail.policy') }}</h2>
        <dl class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 text-sm">
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('scheduledJobs.form.fields.allowConcurrent') }}</dt>
            <dd class="mt-0.5">
              <UBadge :color="job.allowConcurrent ? 'primary' : 'neutral'" variant="subtle" size="sm">
                {{ job.allowConcurrent ? t('common.yes') : t('common.no') }}
              </UBadge>
            </dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('scheduledJobs.form.fields.maxSyncSeconds') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ job.maxSyncSeconds }} s</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('scheduledJobs.detail.lockHeld') }}</dt>
            <dd class="mt-0.5">
              <UBadge :color="job.lockHeld ? 'warning' : 'neutral'" variant="subtle" size="sm">
                {{ job.lockHeld ? t('common.yes') : t('common.no') }}
              </UBadge>
            </dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('scheduledJobs.form.fields.maxRetryAttempts') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ job.maxRetryAttempts }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('scheduledJobs.form.fields.retryDelaySeconds') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ job.retryDelaySeconds }} s</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('scheduledJobs.detail.policyFields.runner') }}</dt>
            <dd class="mt-0.5">
              <code v-if="job.runnerRegistered" class="font-mono text-xs bg-prohealth-100 rounded px-1 py-0.5">{{ job.runnerClass }}</code>
              <UBadge v-else color="warning" variant="subtle" size="sm">{{ t('scheduledJobs.detail.policyFields.noRunner') }}</UBadge>
            </dd>
          </div>
        </dl>
      </div>

      <!-- Task/execution parameters -->
      <div class="bg-white rounded-2xl border border-prohealth-100 p-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="font-bold text-prohealth-900">{{ t('scheduledJobs.detail.parametersTitle') }}</h2>
          <UButtonGroup size="xs">
            <UButton
              :color="params.mode.value === 'kv' ? 'primary' : 'neutral'"
              :variant="params.mode.value === 'kv' ? 'solid' : 'outline'"
              @click="params.switchMode('kv')"
            >
              {{ t('scheduledJobs.form.parameters.kvTab') }}
            </UButton>
            <UButton
              :color="params.mode.value === 'json' ? 'primary' : 'neutral'"
              :variant="params.mode.value === 'json' ? 'solid' : 'outline'"
              @click="params.switchMode('json')"
            >
              {{ t('scheduledJobs.form.parameters.jsonTab') }}
            </UButton>
          </UButtonGroup>
        </div>

        <div v-if="params.mode.value === 'kv'" class="space-y-2">
          <div v-for="(row, index) in params.pairs.value" :key="index" class="flex flex-wrap items-center gap-2">
            <UInput
              v-model="row.key"
              :disabled="!canUpdate"
              :placeholder="t('scheduledJobs.form.parameters.keyPlaceholder')"
              :aria-label="t('scheduledJobs.form.parameters.keyPlaceholder')"
              class="w-full sm:w-48 font-mono"
            />
            <UInput
              v-model="row.value"
              :disabled="!canUpdate"
              :placeholder="t('scheduledJobs.form.parameters.valuePlaceholder')"
              :aria-label="t('scheduledJobs.form.parameters.valuePlaceholder')"
              class="w-full sm:flex-1"
            />
            <UButton
              v-if="canUpdate"
              color="error"
              variant="ghost"
              icon="i-lucide-trash-2"
              size="sm"
              :aria-label="t('common.delete')"
              @click="params.removeRow(index)"
            />
          </div>
          <p v-if="params.pairs.value.length === 0" class="text-sm text-prohealth-400">{{ t('common.empty') }}</p>
          <UButton v-if="canUpdate" color="primary" variant="outline" icon="i-lucide-plus" size="sm" @click="params.addRow()">
            {{ t('scheduledJobs.form.parameters.addRow') }}
          </UButton>
        </div>
        <div v-else>
          <UTextarea v-model="params.json.value" :disabled="!canUpdate" :rows="6" class="w-full font-mono text-xs" />
        </div>

        <div v-if="canUpdate" class="flex justify-end mt-3">
          <UButton color="info" variant="outline" icon="i-lucide-save" :loading="savingParams" @click="saveParams">
            {{ t('common.saveChanges') }}
          </UButton>
        </div>
      </div>

      <!-- Last run + metadata -->
      <div class="bg-white rounded-2xl border border-prohealth-100 p-6">
        <h2 class="font-bold text-prohealth-900 mb-4">{{ t('scheduledJobs.detail.lastRun') }}</h2>
        <dl class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4 text-sm">
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('scheduledJobs.detail.lastRun') }}</dt>
            <dd class="mt-0.5">
              <UBadge v-if="job.lastRunStatus" :color="outcomeColor(job.lastRunStatus)" variant="subtle" size="sm">
                {{ job.lastRunStatus_Display ?? outcomeLabel(job.lastRunStatus) }}
              </UBadge>
              <span v-else class="text-prohealth-300">{{ t('common.empty') }}</span>
            </dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('scheduledJobs.detail.lastRunAt') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ job.lastRunAt_Display ?? formatDate(job.lastRunAt, 'datetime') }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('scheduledJobs.detail.created') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ job.createdAt_Display ?? formatDate(job.createdAt, 'datetime') }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('scheduledJobs.detail.updated') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ job.updatedAt_Display ?? formatDate(job.updatedAt, 'datetime') }}</dd>
          </div>
          <div class="sm:col-span-2 lg:col-span-4">
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('scheduledJobs.detail.uuid') }}</dt>
            <dd class="text-prohealth-800 mt-0.5 font-mono text-xs break-all">{{ job.uuid }}</dd>
          </div>
        </dl>
      </div>

      <!-- Runs history -->
      <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden">
        <div class="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-prohealth-100">
          <h2 class="font-bold text-prohealth-900">{{ t('scheduledJobs.detail.runsTitle') }}</h2>
          <div class="flex flex-wrap items-center gap-2">
            <USelectMenu
              v-model="runsOutcomeFilter"
              :items="RUN_OUTCOME_OPTIONS"
              label-key="label"
              value-key="value"
              clear
              :placeholder="t('scheduledJobs.detail.runFilters.outcome')"
              class="w-44"
            />
            <USelectMenu
              v-model="runsTriggerFilter"
              :items="RUN_TRIGGER_OPTIONS"
              label-key="label"
              value-key="value"
              clear
              :placeholder="t('scheduledJobs.detail.runFilters.trigger')"
              class="w-44"
            />
            <AuditDateRangePicker v-model="runsDateRange" />
            <UButton
              v-if="runsHasActiveSort"
              variant="link"
              color="neutral"
              size="sm"
              icon="i-lucide-list-restart"
              :title="t('common.clearSortHint')"
              @click="runsSort.reset()"
            >
              {{ t('common.clearSort') }}
            </UButton>
            <UButton
              variant="ghost"
              color="neutral"
              size="sm"
              icon="i-lucide-filter-x"
              :title="t('common.clearFilters')"
              @click="resetRunFilters"
            />
            <RefreshButton
              :loading="runsLoading"
              :title="t('common.refreshSection')"
              @refresh="loadRuns"
            />
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
                <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="runsSort.toggle('outcome')">
                  {{ t('scheduledJobs.detail.runColumns.outcome') }}
                  <SortIndicator :state="runsSort.stateOf('outcome')" :multi-active="runsIsMultiSort" @clear="runsSort.remove('outcome')" />
                </th>
                <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="runsSort.toggle('triggeredBy')">
                  {{ t('scheduledJobs.detail.runColumns.trigger') }}
                  <SortIndicator :state="runsSort.stateOf('triggeredBy')" :multi-active="runsIsMultiSort" @clear="runsSort.remove('triggeredBy')" />
                </th>
                <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="runsSort.toggle('startedAt')">
                  {{ t('scheduledJobs.detail.runColumns.started') }}
                  <SortIndicator :state="runsSort.stateOf('startedAt')" :multi-active="runsIsMultiSort" @clear="runsSort.remove('startedAt')" />
                </th>
                <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="runsSort.toggle('durationMs')">
                  {{ t('scheduledJobs.detail.runColumns.duration') }}
                  <SortIndicator :state="runsSort.stateOf('durationMs')" :multi-active="runsIsMultiSort" @clear="runsSort.remove('durationMs')" />
                </th>
                <th class="px-5 py-3 font-semibold">{{ t('scheduledJobs.detail.runColumns.error') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-prohealth-100">
              <TableSkeleton v-if="runsLoading" :rows="5" :cols="5" />
              <tr v-else-if="runs.length === 0">
                <td colspan="5" class="px-5 py-12 text-center text-prohealth-500">
                  <UIcon name="i-lucide-history" class="w-8 h-8 mx-auto mb-2 text-prohealth-300" />
                  {{ t('scheduledJobs.detail.runsEmpty') }}
                </td>
              </tr>
              <tr v-for="r in runs" v-else :key="r.uuid" class="hover:bg-prohealth-50/50">
                <td class="px-5 py-3">
                  <UBadge :color="outcomeColor(r.outcome)" variant="subtle" size="sm">
                    {{ r.outcome_Display ?? outcomeLabel(r.outcome) }}
                  </UBadge>
                </td>
                <td class="px-5 py-3 text-prohealth-700">{{ triggerLabel(r.triggeredBy) }}</td>
                <td class="px-5 py-3 text-prohealth-600">{{ r.startedAt_Display ?? formatDate(r.startedAt, 'datetime') }}</td>
                <td class="px-5 py-3 text-prohealth-700 font-mono">{{ formatDuration(r.durationMs) }}</td>
                <td class="px-5 py-3 text-prohealth-600 max-w-xs">
                  <span v-if="r.errorMessage" :title="r.errorMessage" class="block truncate text-red-600">{{ r.errorMessage }}</span>
                  <span v-else class="text-prohealth-300">{{ t('common.empty') }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Paginación -->
        <div class="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t border-prohealth-100">
          <p class="text-xs text-prohealth-500">
            {{ t('scheduledJobs.paginationSummary', { shown: runs.length, total: runsTotal }) }}
          </p>
          <div class="flex items-center gap-3">
            <UPagination
              v-if="runsSize !== UNPAGED_PAGE_SIZE"
              v-model:page="runsPage"
              :total="runsTotal"
              :items-per-page="runsSize"
            />
            <UTooltip :text="t('catalogs.pageSizeLabel')">
              <USelectMenu
                v-model="runsSize"
                :items="runsPageSizeItems"
                label-key="label"
                value-key="value"
                icon="i-lucide-list"
                :search-input="false"
                :aria-label="t('catalogs.pageSizeLabel')"
                class="w-40"
              />
            </UTooltip>
          </div>
        </div>
      </div>
    </template>

    <!-- Edit modal (shared with the list) -->
    <ScheduledJobFormModal v-model:open="formOpen" :job="job" @saved="onSaved" />

    <!-- Audit modal -->
    <AuditModal
      v-if="job"
      v-model:open="auditOpen"
      entity-key="scheduled_job"
      :entity-uuid="job.uuid"
      :entity-label="job.displayName"
      :entity-code="job.code"
      :can-view-changes="canViewAuditChanges"
      :can-view-reports="canViewAuditReports"
    />
  </div>
</template>
