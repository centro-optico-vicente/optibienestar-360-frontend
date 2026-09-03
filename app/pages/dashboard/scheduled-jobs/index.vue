<script setup lang="ts">
import { buildPageSizeItems, DEFAULT_PAGE_SIZE, UNPAGED_PAGE_SIZE } from '~/utils/pagination'
import type { ScheduledJobDto } from '~/types/scheduling'
import { JOB_RUN_OUTCOME_OPTIONS } from '~/types/scheduling'
import type { SortDirection } from '~/composables/useTableSort'

definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'JOB_VIEW_ALL',
})

const { t } = useI18n()
const { formatDate } = useFormatters()

useSeoMeta({ title: () => t('common.seoTitle', { page: t('nav.items.scheduledJobs.label') }) })

const jobs = useScheduledJobs()
const { can } = usePermissions()
const toast = useToast()

const canCreate = computed(() => can('JOB_CREATE'))
const canUpdate = computed(() => can('JOB_UPDATE'))
const canDelete = computed(() => can('JOB_DELETE'))
// No hay dominio de permisos granular para "scheduled_job" (V66/V72 cubren 10 dominios de
// negocio; los trabajos programados son un recurso de sistema) — solo el genérico aplica.
const canViewAuditChanges = computed(() => can('AUDIT_VIEW_ALL'))
const canViewAuditReports = computed(() => can('REPORT_AUDIT_VIEW_ALL'))
const canViewAudit = computed(() => canViewAuditChanges.value || canViewAuditReports.value)

const auditOpen = ref(false)
const auditTarget = ref<ScheduledJobDto | null>(null)

function openAudit(j: ScheduledJobDto) {
  auditTarget.value = j
  auditOpen.value = true
}
const canRun = computed(() => can('JOB_RUN_NOW'))

// ---- List + pagination + search ----
const data = ref<ScheduledJobDto[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1) // UPagination is 1-based; the API is 0-based
const size = ref(DEFAULT_PAGE_SIZE)
const pageSizeItems = buildPageSizeItems(t)
const search = ref('')
const includeInactive = ref(false)
// Empty by default: no `sort=` is sent until the user clicks a column, so
// the backend's own default-sort fallback (entity_config → system_configs
// → code ASC) applies.
const sort = useTableSort([])
const hasActiveSort = computed(() => sort.orders.value.length > 0)
const isMultiSort = computed(() => sort.orders.value.length > 1)

async function load() {
  loading.value = true
  try {
    const res = await jobs.list({
      page: page.value - 1,
      size: size.value,
      sort: sort.sortParam.value,
      q: search.value.trim() || undefined,
      includeInactive: includeInactive.value,
    })
    data.value = res.content ?? []
    total.value = res.totalElements ?? 0
    // No column clicked yet → reflect the server's own default in the header arrows.
    if (sort.orders.value.length === 0 && res.appliedSort?.length) {
      resetting.value = true
      sort.seedServerDefault(res.appliedSort.map(o => ({ field: o.field, direction: o.direction.toLowerCase() as SortDirection })))
      await nextTick()
      resetting.value = false
    }
  }
  catch {
    // useApi already shows the error toast
    data.value = []
    total.value = 0
  }
  finally {
    loading.value = false
  }
}

// Guards the filter watchers so "clear filters and refresh" fires a single reload.
const resetting = ref(false)

watch(size, () => { if (!resetting.value) page.value = 1 })
watch([page, size], () => { if (!resetting.value) load() })
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, () => {
  if (resetting.value) return
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    load()
  }, 400)
})
watch(includeInactive, () => { if (!resetting.value) { page.value = 1; load() } })
watch(sort.orders, () => { if (!resetting.value) load() }, { deep: true })

async function resetFilters() {
  resetting.value = true
  search.value = ''
  includeInactive.value = false
  sort.reset()
  size.value = DEFAULT_PAGE_SIZE
  page.value = 1
  await nextTick()
  resetting.value = false
  load()
}

onMounted(load)

// ---- Presentation helpers ----
// Last-run outcome → badge color (SUCCESS=success, FAILED/TIMEOUT=error,
// RUNNING=info, SKIPPED_CONCURRENT/CANCELED=neutral).
function outcomeColor(status?: string | null): 'success' | 'error' | 'info' | 'neutral' {
  switch (status) {
    case 'SUCCESS': return 'success'
    case 'FAILED':
    case 'TIMEOUT': return 'error'
    case 'RUNNING': return 'info'
    default: return 'neutral'
  }
}

// Outcome label; falls back to the option's Spanish label, then the raw value.
function outcomeLabel(status?: string | null): string {
  if (!status) return t('common.empty')
  const opt = JOB_RUN_OUTCOME_OPTIONS.find(o => o.value === status)
  return t(`scheduledJobs.outcome.${status}`, opt?.label ?? status)
}

// ---- Enable/disable toggle (single-field PATCH, gated by JOB_UPDATE) ----
const togglingUuid = ref<string | null>(null)

async function toggleEnabled(row: ScheduledJobDto, value: boolean) {
  togglingUuid.value = row.uuid
  try {
    await jobs.update(row.uuid, { enabled: value })
    toast.add({
      title: value ? t('scheduledJobs.toggle.enabledToast') : t('scheduledJobs.toggle.disabledToast'),
      color: 'success',
      icon: 'i-lucide-check-circle',
    })
    await load()
  }
  catch {
    // toast handled by useApi; reload to reconcile the switch with the server
    await load()
  }
  finally {
    togglingUuid.value = null
  }
}

// ---- Run now (hybrid: sync outcome or async RUNNING) ----
const runningUuid = ref<string | null>(null)

async function runNow(row: ScheduledJobDto) {
  runningUuid.value = row.uuid
  try {
    const res = await jobs.runNow(row.uuid)
    if (res.outcome === 'RUNNING') {
      toast.add({ title: t('scheduledJobs.runNow.runningToast'), color: 'info', icon: 'i-lucide-loader-circle' })
    }
    else if (res.outcome === 'SUCCESS') {
      toast.add({ title: t('scheduledJobs.runNow.successToast'), color: 'success', icon: 'i-lucide-check-circle' })
    }
    else {
      toast.add({ title: t('scheduledJobs.runNow.failedToast'), color: 'error', icon: 'i-lucide-alert-triangle' })
    }
    await load()
  }
  catch {
    // toast handled by useApi
  }
  finally {
    runningUuid.value = null
  }
}

// ---- Create/edit (shared modal) ----
const formOpen = ref(false)
const editingJob = ref<ScheduledJobDto | null>(null)

function openCreate() {
  editingJob.value = null
  formOpen.value = true
}

function openEdit(j: ScheduledJobDto) {
  editingJob.value = j
  formOpen.value = true
}

async function onSaved() {
  await load()
}

// ---- Delete ----
const deleteOpen = ref(false)
const deleting = ref(false)
const target = ref<ScheduledJobDto | null>(null)
const usageChecking = ref(false)
const usageInfo = ref<{ inUse: boolean, count: number } | null>(null)

async function openDelete(j: ScheduledJobDto) {
  target.value = j
  deleteOpen.value = true
  usageChecking.value = true
  usageInfo.value = null
  try {
    usageInfo.value = await jobs.usage(j.uuid)
  }
  catch {
    // Fallback: treat as "in use" for safety (soft-deactivate instead of physical delete).
    usageInfo.value = null
  }
  finally {
    usageChecking.value = false
  }
}

async function confirmDelete() {
  if (!target.value) return
  deleting.value = true
  const wasPhysical = usageInfo.value?.inUse === false
  try {
    await jobs.remove(target.value.uuid, wasPhysical)
    toast.add({
      title: wasPhysical
        ? t('scheduledJobs.deletedPermanentToast')
        : t('scheduledJobs.deactivatedToast'),
      color: wasPhysical ? 'success' : 'info',
      icon: wasPhysical ? 'i-lucide-check-circle' : 'i-lucide-info',
    })
    deleteOpen.value = false
    // If the page is left empty after deleting, step back one.
    if (data.value.length === 1 && page.value > 1) page.value -= 1
    else await load()
  }
  catch {
    // toast handled by useApi
  }
  finally {
    deleting.value = false
  }
}
</script>

<template>
  <div class="space-y-5">
    <!-- Header -->
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-extrabold text-prohealth-900">{{ t('scheduledJobs.title') }}</h1>
        <p class="text-sm text-prohealth-700/70 mt-1">
          {{ t('scheduledJobs.subtitle') }}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <ListRefreshMenu :loading="loading" variant="ghost" @refresh="load" @reset="resetFilters" />
        <ReportPrintButton variant="ghost" />
        <UTooltip :text="canCreate ? t('scheduledJobs.new') : t('scheduledJobs.noPermissionCreate')">
          <UButton
            color="primary"
            variant="outline"
            icon="i-lucide-plus"
            :disabled="!canCreate"
            @click="openCreate"
          >
            {{ t('common.new') }}
          </UButton>
        </UTooltip>
      </div>
    </div>

    <!-- Search -->
    <div class="bg-white rounded-2xl border border-prohealth-100 p-4 flex flex-wrap items-center gap-3">
      <UInput
        v-model="search"
        :placeholder="t('scheduledJobs.searchPlaceholder')"
        icon="i-lucide-search"
        size="lg"
        class="w-full max-w-md"
      />
      <UCheckbox v-model="includeInactive" :label="$t('catalogs.includeInactive')" class="self-center" />
      <UButton
        v-if="hasActiveSort"
        variant="link"
        color="neutral"
        size="sm"
        icon="i-lucide-list-restart"
        :title="t('common.clearSortHint')"
        @click="sort.reset()"
      >
        {{ t('common.clearSort') }}
      </UButton>
    </div>

    <!-- Table -->
    <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden flex flex-col h-[calc(100vh-19rem)] min-h-[24rem]">
      <div class="overflow-auto flex-1">
        <table class="w-full text-sm">
          <thead class="sticky top-0 bg-white z-10">
            <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('displayName')">
                {{ t('scheduledJobs.columns.job') }}
                <SortIndicator :state="sort.stateOf('displayName')" :multi-active="isMultiSort" @clear="sort.remove('displayName')" />
              </th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('cronExpression')">
                {{ t('scheduledJobs.columns.schedule') }}
                <SortIndicator :state="sort.stateOf('cronExpression')" :multi-active="isMultiSort" @clear="sort.remove('cronExpression')" />
              </th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('enabled')">
                {{ t('scheduledJobs.columns.enabled') }}
                <SortIndicator :state="sort.stateOf('enabled')" :multi-active="isMultiSort" @clear="sort.remove('enabled')" />
              </th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('lastRunAt')">
                {{ t('scheduledJobs.columns.lastRun') }}
                <SortIndicator :state="sort.stateOf('lastRunAt')" :multi-active="isMultiSort" @clear="sort.remove('lastRunAt')" />
              </th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('nextRunAt')">
                {{ t('scheduledJobs.columns.nextRun') }}
                <SortIndicator :state="sort.stateOf('nextRunAt')" :multi-active="isMultiSort" @clear="sort.remove('nextRunAt')" />
              </th>
              <th class="px-5 py-3 font-semibold text-right">{{ t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-prohealth-100">
            <TableSkeleton v-if="loading" :rows="8" :cols="6" />
            <tr v-else-if="data.length === 0">
              <td colspan="6" class="px-5 py-12 text-center text-prohealth-500">
                <UIcon name="i-lucide-alarm-clock" class="w-8 h-8 mx-auto mb-2 text-prohealth-300" />
                {{ t('scheduledJobs.empty') }}
              </td>
            </tr>
            <tr
              v-for="j in data"
              v-else
              :key="j.uuid"
              class="hover:bg-prohealth-50/50 cursor-pointer"
              :class="{ 'opacity-60': !j.active }"
              @click="navigateTo(`/dashboard/scheduled-jobs/${j.uuid}`)"
            >
              <td class="px-5 py-3">
                <div class="font-semibold text-prohealth-900">{{ j.displayName }}</div>
                <div class="text-xs text-prohealth-500 font-mono">{{ j.code }}</div>
              </td>
              <td class="px-5 py-3">
                <div class="font-mono text-prohealth-800">{{ j.cronExpression }}</div>
                <div class="text-xs text-prohealth-400">{{ j.timezone }}</div>
              </td>
              <td class="px-5 py-3" @click.stop>
                <UTooltip :text="canUpdate ? t('scheduledJobs.columns.enabled') : t('scheduledJobs.noPermissionEdit')">
                  <USwitch
                    :model-value="j.enabled"
                    :disabled="!canUpdate || togglingUuid === j.uuid"
                    @update:model-value="(v: boolean) => toggleEnabled(j, v)"
                  />
                </UTooltip>
              </td>
              <td class="px-5 py-3">
                <div class="flex flex-col gap-1">
                  <UBadge
                    v-if="j.lastRunStatus"
                    :color="outcomeColor(j.lastRunStatus)"
                    variant="subtle"
                    size="sm"
                    class="w-fit"
                  >
                    {{ j.lastRunStatus_Display ?? outcomeLabel(j.lastRunStatus) }}
                  </UBadge>
                  <span v-else class="text-prohealth-300">{{ t('common.empty') }}</span>
                  <span class="text-xs text-prohealth-400">{{ j.lastRunAt_Display ?? formatDate(j.lastRunAt, 'datetime') }}</span>
                </div>
              </td>
              <td class="px-5 py-3 text-prohealth-700">{{ j.nextRunAt ? (j.nextRunAt_Display ?? formatDate(j.nextRunAt, 'datetime')) : t('common.empty') }}</td>
              <td class="px-5 py-3" @click.stop>
                <div class="flex items-center justify-end gap-1">
                  <UTooltip :text="canRun ? t('scheduledJobs.runNow.button') : t('scheduledJobs.noPermissionRun')">
                    <UButton
                      color="primary"
                      variant="ghost"
                      icon="i-lucide-play"
                      size="sm"
                      :loading="runningUuid === j.uuid"
                      :disabled="!canRun"
                      @click="runNow(j)"
                    />
                  </UTooltip>
                  <UTooltip :text="t('scheduledJobs.viewDetailTooltip')">
                    <UButton
                      color="neutral"
                      variant="ghost"
                      icon="i-lucide-eye"
                      size="sm"
                      :to="`/dashboard/scheduled-jobs/${j.uuid}`"
                    />
                  </UTooltip>
                  <UTooltip :text="canUpdate ? t('common.edit') : t('scheduledJobs.noPermissionEdit')">
                    <UButton
                      color="info"
                      variant="ghost"
                      icon="i-lucide-pencil"
                      size="sm"
                      :disabled="!canUpdate"
                      @click="openEdit(j)"
                    />
                  </UTooltip>
                  <ReportPrintButton
                    table-name="scheduled-jobs"
                    :record-uuid="j.uuid"
                    icon-only
                    variant="ghost"
                    size="sm"
                  />
                  <UTooltip v-if="canViewAudit" :text="t('audit.trigger')">
                    <UButton
                      color="neutral"
                      variant="ghost"
                      icon="i-lucide-history"
                      size="sm"
                      @click="openAudit(j)"
                    />
                  </UTooltip>
                  <UTooltip :text="canDelete ? t('common.delete') : t('scheduledJobs.noPermissionDelete')">
                    <UButton
                      color="error"
                      variant="ghost"
                      icon="i-lucide-trash-2"
                      size="sm"
                      class="ms-2"
                      :disabled="!canDelete"
                      @click="openDelete(j)"
                    />
                  </UTooltip>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="flex items-center flex-wrap justify-between gap-3 px-5 py-3 border-t border-prohealth-100 shrink-0">
        <p class="text-xs text-prohealth-500">
          {{ t('scheduledJobs.paginationSummary', { shown: data.length, total }) }}
        </p>
        <div class="flex items-center gap-3">
          <UPagination
            v-if="size !== UNPAGED_PAGE_SIZE"
            v-model:page="page"
            :total="total"
            :items-per-page="size"
          />
          <UTooltip :text="$t('catalogs.pageSizeLabel')">
            <USelectMenu
              v-model="size"
              :items="pageSizeItems"
              label-key="label"
              value-key="value"
              icon="i-lucide-list"
              :search-input="false"
              :aria-label="$t('catalogs.pageSizeLabel')"
              class="w-40"
            />
          </UTooltip>
        </div>
      </div>
    </div>

    <!-- Create/edit modal (shared with the detail page) -->
    <ScheduledJobFormModal v-model:open="formOpen" :job="editingJob" @saved="onSaved" @delete="openDelete" />

    <!-- Delete confirmation modal -->
    <UModal v-model:open="deleteOpen" :title="t('scheduledJobs.deleteTitle')">
      <template #body>
        <div v-if="usageChecking" class="flex items-center gap-2 text-sm text-prohealth-600">
          <UIcon name="i-lucide-loader-2" class="w-4 h-4 animate-spin" />
          {{ t('common.loading') }}
        </div>
        <p v-else class="text-sm text-prohealth-700">
          {{
            usageInfo?.inUse === false
              ? t('scheduledJobs.deleteConfirmPermanent')
              : t('scheduledJobs.deleteConfirmDeactivate', { count: usageInfo?.count ?? 0 })
          }}
        </p>
        <div class="flex items-center justify-end gap-3 pt-5">
          <UButton color="neutral" variant="ghost" :disabled="deleting" @click="deleteOpen = false">
            {{ t('common.cancel') }}
          </UButton>
          <UButton color="error" :loading="deleting" :disabled="usageChecking" icon="i-lucide-trash-2" @click="confirmDelete">
            {{ t('common.delete') }}
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Audit modal -->
    <AuditModal
      v-if="auditTarget"
      v-model:open="auditOpen"
      entity-key="scheduled_job"
      :entity-uuid="auditTarget.uuid"
      :entity-label="auditTarget.displayName"
      :entity-code="auditTarget.code"
      :can-view-changes="canViewAuditChanges"
      :can-view-reports="canViewAuditReports"
    />
  </div>
</template>
