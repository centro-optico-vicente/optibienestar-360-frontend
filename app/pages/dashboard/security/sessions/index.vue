<script setup lang="ts">
import { buildPageSizeItems, DEFAULT_PAGE_SIZE, UNPAGED_PAGE_SIZE } from '~/utils/pagination'
import { defaultTodayRange } from '~/utils/date'
import type { LoginAuditLogDto, LoginAuditResult } from '~/types/audit'
import type { SortDirection } from '~/composables/useTableSort'

definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'AUDIT_VIEW_LOGIN',
})

const { t } = useI18n()

useSeoMeta({ title: () => t('security.sessions.seoTitle') })

const audit = useAudit()
const { formatDate } = useFormatters()

const data = ref<LoginAuditLogDto[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1) // UPagination es 1-based; la API es 0-based
const size = ref(DEFAULT_PAGE_SIZE)
const pageSizeItems = buildPageSizeItems(t)
const search = ref('')

const RESULT_OPTIONS: { label: string, value: LoginAuditResult }[] = [
  { label: t('security.sessions.results.SUCCESS'), value: 'SUCCESS' },
  { label: t('security.sessions.results.FAILED_CREDENTIALS'), value: 'FAILED_CREDENTIALS' },
  { label: t('security.sessions.results.FAILED_LOCKED'), value: 'FAILED_LOCKED' },
  { label: t('security.sessions.results.FAILED_INACTIVE'), value: 'FAILED_INACTIVE' },
]
const resultFilter = ref<LoginAuditResult[]>([])
const dateRange = ref(defaultTodayRange())

const RESULT_META: Record<LoginAuditResult, { color: 'success' | 'error', icon: string }> = {
  SUCCESS: { color: 'success', icon: 'i-lucide-check-circle' },
  FAILED_CREDENTIALS: { color: 'error', icon: 'i-lucide-circle-x' },
  FAILED_LOCKED: { color: 'error', icon: 'i-lucide-lock' },
  FAILED_INACTIVE: { color: 'error', icon: 'i-lucide-user-x' },
}

const SESSION_STATUS_COLOR: Record<string, 'success' | 'neutral' | 'warning' | 'error'> = {
  ACTIVE: 'success',
  LOGGED_OUT: 'neutral',
  EXPIRED: 'warning',
  REVOKED: 'error',
}

function resultLabel(log: LoginAuditLogDto): string {
  return log.result_Display || t(`security.sessions.results.${log.result}`, log.result)
}

function sessionStatusLabel(status: string): string {
  return t(`security.sessions.sessionStatus.${status}`, status)
}

const sort = useTableSort([])
const hasActiveSort = computed(() => sort.hasActiveSort.value)
const isMultiSort = computed(() => sort.orders.value.length > 1)

async function load() {
  loading.value = true
  try {
    const res = await audit.listLogins({
      email: search.value.trim() || undefined,
      result: resultFilter.value,
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
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, () => {
  if (resetting.value) return
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { page.value = 1; load() }, 400)
})
watch([resultFilter, dateRange], () => {
  if (!resetting.value) { page.value = 1; load() }
}, { deep: true })
watch(sort.orders, () => { if (!resetting.value) load() }, { deep: true })

async function resetFilters() {
  resetting.value = true
  search.value = ''
  resultFilter.value = []
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
        <h1 class="text-2xl font-extrabold text-prohealth-900">{{ $t('security.sessions.title') }}</h1>
        <p class="text-sm text-prohealth-700/70 mt-1">
          {{ $t('security.sessions.subtitle') }}
        </p>
      </div>
      <ListRefreshMenu :loading="loading" variant="ghost" @refresh="load" @reset="resetFilters" />
    </div>

    <!-- Filtros -->
    <div class="bg-white rounded-2xl border border-prohealth-100 p-4 flex flex-wrap items-center gap-3">
      <UInput
        v-model="search"
        :placeholder="$t('security.sessions.searchPlaceholder')"
        icon="i-lucide-search"
        size="lg"
        class="w-full max-w-md"
      />
      <USelectMenu
        v-model="resultFilter"
        :items="RESULT_OPTIONS"
        label-key="label"
        value-key="value"
        multiple
        clear
        :placeholder="$t('security.sessions.filters.result')"
        class="w-56"
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
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('attemptedEmail')">
                {{ $t('security.sessions.columns.user') }}
                <SortIndicator :state="sort.stateOf('attemptedEmail')" :multi-active="isMultiSort" @clear="sort.remove('attemptedEmail')" />
              </th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('ipAddress')">
                {{ $t('security.sessions.columns.ip') }}
                <SortIndicator :state="sort.stateOf('ipAddress')" :multi-active="isMultiSort" @clear="sort.remove('ipAddress')" />
              </th>
              <th class="px-5 py-3 font-semibold">{{ $t('security.sessions.columns.userAgent') }}</th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('result')">
                {{ $t('security.sessions.columns.result') }}
                <SortIndicator :state="sort.stateOf('result')" :multi-active="isMultiSort" @clear="sort.remove('result')" />
              </th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('sessionStatus')">
                {{ $t('security.sessions.columns.sessionStatus') }}
                <SortIndicator :state="sort.stateOf('sessionStatus')" :multi-active="isMultiSort" @clear="sort.remove('sessionStatus')" />
              </th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('attemptedAt')">
                {{ $t('security.sessions.columns.attemptedAt') }}
                <SortIndicator :state="sort.stateOf('attemptedAt')" :multi-active="isMultiSort" @clear="sort.remove('attemptedAt')" />
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-prohealth-100">
            <TableSkeleton v-if="loading" :rows="8" :cols="6" />
            <tr v-else-if="data.length === 0">
              <td colspan="6" class="px-5 py-12 text-center text-prohealth-500">
                <UIcon name="i-lucide-log-in" class="w-8 h-8 mx-auto mb-2 text-prohealth-300" />
                {{ $t('security.sessions.empty') }}
              </td>
            </tr>
            <tr v-for="log in data" v-else :key="log.uuid" class="hover:bg-prohealth-50/50">
              <td class="px-5 py-3 text-prohealth-900 font-medium">
                {{ log.attemptedEmail || $t('security.sessions.unknownUser') }}
              </td>
              <td class="px-5 py-3 text-prohealth-700 font-mono text-xs">{{ log.ipAddress || $t('common.empty') }}</td>
              <td class="px-5 py-3 text-prohealth-700 text-xs max-w-xs truncate" :title="log.userAgent || ''">
                {{ log.userAgent || $t('common.empty') }}
              </td>
              <td class="px-5 py-3">
                <UBadge :color="RESULT_META[log.result].color" variant="subtle" size="sm">
                  <UIcon :name="RESULT_META[log.result].icon" class="w-3.5 h-3.5 mr-1" />
                  {{ resultLabel(log) }}
                </UBadge>
              </td>
              <td class="px-5 py-3">
                <UBadge v-if="log.sessionStatus" :color="SESSION_STATUS_COLOR[log.sessionStatus] ?? 'neutral'" variant="subtle" size="sm">
                  {{ sessionStatusLabel(log.sessionStatus) }}
                </UBadge>
                <span v-else class="text-prohealth-400">{{ $t('common.empty') }}</span>
              </td>
              <td class="px-5 py-3 text-prohealth-700 text-xs">{{ formatDate(log.attemptedAt, 'datetime') }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Paginación -->
      <div class="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t border-prohealth-100 shrink-0">
        <p class="text-xs text-prohealth-500">
          {{ $t('security.sessions.paginationSummary', { shown: data.length, total }) }}
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
