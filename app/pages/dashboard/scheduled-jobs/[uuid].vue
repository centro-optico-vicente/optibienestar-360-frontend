<script setup lang="ts">
import type { ApiError } from '~/types/auth'
import type { ScheduledJobDto, ScheduledJobRunDto } from '~/types/scheduling'
import { JOB_RUN_OUTCOME_OPTIONS } from '~/types/scheduling'

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
const runsLoading = ref(false)

async function loadRuns() {
  runsLoading.value = true
  try {
    const res = await jobs.listRuns(jobUuid, { size: 20 })
    runs.value = res.content ?? []
  }
  catch {
    // useApi already shows the error toast
    runs.value = []
  }
  finally {
    runsLoading.value = false
  }
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
            <dd class="text-prohealth-900 mt-0.5 font-mono">{{ job.cronExpression }}</dd>
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
        </dl>
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
        <div class="flex items-center justify-between px-5 py-4 border-b border-prohealth-100">
          <h2 class="font-bold text-prohealth-900">{{ t('scheduledJobs.detail.runsTitle') }}</h2>
          <RefreshButton
            :loading="runsLoading"
            :title="t('common.refreshSection')"
            @refresh="loadRuns"
          />
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
                <th class="px-5 py-3 font-semibold">{{ t('scheduledJobs.detail.runColumns.outcome') }}</th>
                <th class="px-5 py-3 font-semibold">{{ t('scheduledJobs.detail.runColumns.trigger') }}</th>
                <th class="px-5 py-3 font-semibold">{{ t('scheduledJobs.detail.runColumns.started') }}</th>
                <th class="px-5 py-3 font-semibold">{{ t('scheduledJobs.detail.runColumns.duration') }}</th>
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
