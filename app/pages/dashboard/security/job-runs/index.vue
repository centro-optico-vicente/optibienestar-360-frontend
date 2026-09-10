<script setup lang="ts">
import { buildPageSizeItems, DEFAULT_PAGE_SIZE, UNPAGED_PAGE_SIZE } from '~/utils/pagination'
import { defaultTodayRange } from '~/utils/date'
import type { JobRunOutcome, JobTriggerSource, ScheduledJobRunDto } from '~/types/scheduling'
import { JOB_RUN_OUTCOME_OPTIONS } from '~/types/scheduling'
import type { SortDirection } from '~/composables/useTableSort'

definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'JOB_VIEW_ALL',
})

const { t } = useI18n()

useSeoMeta({ title: () => t('security.jobRuns.seoTitle') })

const audit = useAudit()
const { formatDate } = useFormatters()

const data = ref<ScheduledJobRunDto[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1) // UPagination es 1-based; la API es 0-based
const size = ref(DEFAULT_PAGE_SIZE)
const pageSizeItems = buildPageSizeItems(t)

const jobUuidFilter = ref<string | undefined>(undefined)
const outcomeFilter = ref<JobRunOutcome[]>([])
const OUTCOME_OPTIONS = JOB_RUN_OUTCOME_OPTIONS.map(o => ({ label: t(`scheduledJobs.outcome.${o.value}`, o.label), value: o.value }))
const TRIGGER_OPTIONS: { label: string, value: JobTriggerSource }[] = [
  { label: t('scheduledJobs.trigger.SCHEDULED'), value: 'SCHEDULED' },
  { label: t('scheduledJobs.trigger.MANUAL'), value: 'MANUAL' },
  { label: t('scheduledJobs.trigger.STARTUP'), value: 'STARTUP' },
]
const triggerFilter = ref<JobTriggerSource[]>([])
const dateRange = ref(defaultTodayRange())

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

const sort = useTableSort([])
const hasActiveSort = computed(() => sort.hasActiveSort.value)
const isMultiSort = computed(() => sort.orders.value.length > 1)

async function load() {
  loading.value = true
  try {
    const res = await audit.listJobRuns({
      jobUuid: jobUuidFilter.value,
      outcome: outcomeFilter.value,
      triggeredBy: triggerFilter.value,
      from: dateRange.value.from,
      to: dateRange.value.to,
      page: page.value - 1,
      size: size.value,
      sort: sort.sortParam.value,
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
    // useApi ya muestra el toast del error
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
watch([jobUuidFilter, outcomeFilter, triggerFilter, dateRange], () => {
  if (!resetting.value) { page.value = 1; load() }
}, { deep: true })
watch(sort.orders, () => { if (!resetting.value) load() }, { deep: true })

async function resetFilters() {
  resetting.value = true
  jobUuidFilter.value = undefined
  outcomeFilter.value = []
  triggerFilter.value = []
  dateRange.value = defaultTodayRange()
  sort.reset()
  size.value = DEFAULT_PAGE_SIZE
  page.value = 1
  await nextTick()
  resetting.value = false
  load()
}

onMounted(load)
</script>

<template>
  <div class="space-y-5">
    <!-- Header -->
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-extrabold text-prohealth-900">{{ $t('security.jobRuns.title') }}</h1>
        <p class="text-sm text-prohealth-700/70 mt-1">
          {{ $t('security.jobRuns.subtitle') }}
        </p>
      </div>
      <ListRefreshMenu :loading="loading" variant="ghost" @refresh="load" @reset="resetFilters" />
    </div>

    <!-- Filtros -->
    <div class="bg-white rounded-2xl border border-prohealth-100 p-4 flex flex-wrap items-center gap-3">
      <ScheduledJobSelect v-model="jobUuidFilter" />
      <USelectMenu
        v-model="outcomeFilter"
        :items="OUTCOME_OPTIONS"
        label-key="label"
        value-key="value"
        multiple
        clear
        :placeholder="$t('security.jobRuns.filters.outcome')"
        class="w-52"
      />
      <USelectMenu
        v-model="triggerFilter"
        :items="TRIGGER_OPTIONS"
        label-key="label"
        value-key="value"
        multiple
        clear
        :placeholder="$t('security.jobRuns.filters.trigger')"
        class="w-52"
      />
      <AuditDateRangePicker v-model="dateRange" />
      <UButton
        v-if="hasActiveSort"
        variant="link"
        color="neutral"
        size="sm"
        icon="i-lucide-list-restart"
        :title="$t('common.clearSortHint')"
        @click="sort.reset()"
      >
        {{ $t('common.clearSort') }}
      </UButton>
    </div>

    <!-- Tabla -->
    <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden flex flex-col h-[calc(100vh-18rem)] min-h-[20rem]">
      <div class="overflow-auto flex-1">
        <table class="w-full text-sm">
          <thead class="sticky top-0 bg-white z-10">
            <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
              <th class="px-5 py-3 font-semibold">{{ $t('security.jobRuns.columns.job') }}</th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('outcome')">
                {{ $t('security.jobRuns.columns.outcome') }}
                <SortIndicator :state="sort.stateOf('outcome')" :multi-active="isMultiSort" @clear="sort.remove('outcome')" />
              </th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('triggeredBy')">
                {{ $t('security.jobRuns.columns.trigger') }}
                <SortIndicator :state="sort.stateOf('triggeredBy')" :multi-active="isMultiSort" @clear="sort.remove('triggeredBy')" />
              </th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('startedAt')">
                {{ $t('security.jobRuns.columns.started') }}
                <SortIndicator :state="sort.stateOf('startedAt')" :multi-active="isMultiSort" @clear="sort.remove('startedAt')" />
              </th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('durationMs')">
                {{ $t('security.jobRuns.columns.duration') }}
                <SortIndicator :state="sort.stateOf('durationMs')" :multi-active="isMultiSort" @clear="sort.remove('durationMs')" />
              </th>
              <th class="px-5 py-3 font-semibold">{{ $t('security.jobRuns.columns.error') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-prohealth-100">
            <TableSkeleton v-if="loading" :rows="8" :cols="6" />
            <tr v-else-if="data.length === 0">
              <td colspan="6" class="px-5 py-12 text-center text-prohealth-500">
                <UIcon name="i-lucide-calendar-clock" class="w-8 h-8 mx-auto mb-2 text-prohealth-300" />
                {{ $t('security.jobRuns.empty') }}
              </td>
            </tr>
            <tr v-for="run in data" v-else :key="run.uuid" class="hover:bg-prohealth-50/50">
              <td class="px-5 py-3">
                <NuxtLink :to="`/dashboard/scheduled-jobs/${run.jobUuid}`" class="text-primary-600 hover:underline font-medium">
                  {{ run.jobCode }}
                </NuxtLink>
              </td>
              <td class="px-5 py-3">
                <UBadge :color="outcomeColor(run.outcome)" variant="subtle" size="sm">
                  {{ run.outcome_Display ?? outcomeLabel(run.outcome) }}
                </UBadge>
              </td>
              <td class="px-5 py-3 text-prohealth-700">{{ triggerLabel(run.triggeredBy) }}</td>
              <td class="px-5 py-3 text-prohealth-600">{{ run.startedAt_Display ?? formatDate(run.startedAt, 'datetime') }}</td>
              <td class="px-5 py-3 text-prohealth-700 font-mono">{{ formatDuration(run.durationMs) }}</td>
              <td class="px-5 py-3 text-prohealth-600 max-w-xs">
                <span v-if="run.errorMessage" :title="run.errorMessage" class="block truncate text-red-600">{{ run.errorMessage }}</span>
                <span v-else class="text-prohealth-300">{{ $t('common.empty') }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Paginación -->
      <div class="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t border-prohealth-100 shrink-0">
        <p class="text-xs text-prohealth-500">
          {{ $t('security.jobRuns.paginationSummary', { shown: data.length, total }) }}
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
  </div>
</template>
