<script setup lang="ts">
import { buildPageSizeItems, DEFAULT_PAGE_SIZE, UNPAGED_PAGE_SIZE } from '~/utils/pagination'
import type { SortDirection } from '~/composables/useTableSort'
import { allyFilterQuery, emptyAllyMasterFilters } from '~/utils/allyFilters'
import type { AllyRegistrationStatus } from '~/types/allies'
import type { AllyRegistrationChannel, AllyRequestListItemDto, AllyRequestStatusFilter } from '~/types/allyRequests'
import { ALLY_REGISTRATION_CHANNELS, ALLY_REGISTRATION_STATUSES, allyRegistrationStatusColor } from '~/types/allyRequests'

// Review queue of the ally requests (hub ADR 0036, GET /v1/admin/ally-requests):
// self-registered (/solicitar-alianza) and imported allies. Defaults to PENDING.
// "Importar" opens the template importer (ALLY_IMPORT).
definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'ALLY_REGISTRATION_VIEW_ALL',
})

const { t } = useI18n()
const { formatDate } = useFormatters()

useSeoMeta({ title: () => t('common.seoTitle', { page: t('nav.items.allyRequests.label') }) })

const api = useAllyRequests()
const advisors = useAdvisorOptions()
// The advisor list is fetched the first time the filter opens.
const advisorItems = useLazyOptions(async () => {
  await advisors.load()
  return advisors.options.value
})

const items = ref<AllyRequestListItemDto[]>([])
const total = ref(0)
const loading = ref(false)
const search = ref('')
const DEFAULT_STATUS: AllyRegistrationStatus = 'PENDING'
// 'ALL' = no filter.
const status = ref<string>(DEFAULT_STATUS)
const channel = ref<string>('ALL')
// Advisor who brought the ally in (promoter uuid); only offered with PROMOTER_VIEW_ALL.
const promoterUuid = ref<string | undefined>(undefined)
const masterFilters = ref(emptyAllyMasterFilters())
const dateFrom = ref('')
const dateTo = ref('')
const page = ref(1)
const pageSize = ref(DEFAULT_PAGE_SIZE)
const pageSizeItems = buildPageSizeItems(t)
const pendingCount = ref<number | null>(null)
const importOpen = ref(false)

const statusItems = computed(() => [
  { value: 'ALL', label: t('allyRequests.statusAll') },
  ...ALLY_REGISTRATION_STATUSES.map(s => ({ value: s, label: t(`allyRequests.status.${s}`) })),
  { value: 'IN_PROGRESS', label: t('allyRequests.status.IN_PROGRESS') },
])
const channelItems = computed(() => [
  { value: 'ALL', label: t('allyRequests.channelAll') },
  ...ALLY_REGISTRATION_CHANNELS.map(c => ({ value: c, label: t(`allyRequests.channel.${c}`) })),
])

const sort = useTableSort([])
const hasActiveSort = computed(() => sort.hasActiveSort.value)
const isMultiSort = computed(() => sort.orders.value.length > 1)

const resetting = ref(false)

async function loadPendingCount() {
  try {
    pendingCount.value = (await api.count('PENDING')).count
  }
  catch {
    pendingCount.value = null
  }
}

async function load() {
  loading.value = true
  loadPendingCount()
  try {
    const res = await api.list({
      page: page.value - 1,
      size: pageSize.value,
      sort: sort.sortParam.value,
      q: search.value.trim() || undefined,
      status: status.value === 'ALL' ? undefined : status.value as AllyRequestStatusFilter,
      channel: channel.value === 'ALL' ? undefined : channel.value as AllyRegistrationChannel,
      promoterUuid: promoterUuid.value,
      ...allyFilterQuery(masterFilters.value),
      dateFrom: dateFrom.value || undefined,
      dateTo: dateTo.value || undefined,
    })
    items.value = res.content ?? []
    total.value = res.totalElements ?? 0
    if (sort.orders.value.length === 0 && res.appliedSort?.length) {
      resetting.value = true
      sort.seedServerDefault(res.appliedSort.map(o => ({ field: o.field, direction: o.direction.toLowerCase() as SortDirection })))
      await nextTick()
      resetting.value = false
    }
  }
  catch {
    items.value = []
    total.value = 0
  }
  finally {
    loading.value = false
  }
}

const debouncedSearch = useTableFilterDebounce(() => {
  page.value = 1
  load()
})

watch(pageSize, () => { if (!resetting.value) page.value = 1 })
watch([page, pageSize], () => { if (!resetting.value) load() })
watch(search, () => { if (!resetting.value) debouncedSearch() })
watch([status, channel, promoterUuid, masterFilters, dateFrom, dateTo], () => { if (!resetting.value) { page.value = 1; load() } })
watch(sort.orders, () => { if (!resetting.value) load() }, { deep: true })

async function resetFilters() {
  resetting.value = true
  search.value = ''
  status.value = DEFAULT_STATUS
  channel.value = 'ALL'
  promoterUuid.value = undefined
  masterFilters.value = emptyAllyMasterFilters()
  dateFrom.value = ''
  dateTo.value = ''
  sort.reset()
  pageSize.value = DEFAULT_PAGE_SIZE
  page.value = 1
  await nextTick()
  resetting.value = false
  load()
}

// In progress rows are PENDING on the server (steps not yet sent to review); the filter says what they are.
function statusLabel(r: AllyRequestListItemDto): string {
  if (status.value === 'IN_PROGRESS') return t('allyRequests.status.IN_PROGRESS')
  return r.registrationStatus_Display ?? t(`allyRequests.status.${r.registrationStatus}`, r.registrationStatus)
}
function channelLabel(r: AllyRequestListItemDto): string {
  return r.registrationChannel_Display ?? t(`allyRequests.channel.${r.registrationChannel}`, String(r.registrationChannel))
}
function segmentLabel(r: AllyRequestListItemDto): string {
  return r.segment_Display ?? t(`allies.segments.${r.segment}`, r.segment)
}

function detailPath(r: AllyRequestListItemDto): string {
  return `/dashboard/ally-requests/${r.uuid}`
}

function onImported() {
  status.value = DEFAULT_STATUS
  load()
}

// ---- Keep record (ALLY_REGISTRATION_RETAIN): staff can keep a registration in progress out of the abandoned-draft cleanup ----
const { can } = usePermissions()
const toast = useToast()
const canKeep = computed(() => can('ALLY_REGISTRATION_RETAIN'))
const keepTarget = ref<{ uuid: string, retained: boolean, note: string | null } | null>(null)
const keepOpen = computed({ get: () => keepTarget.value !== null, set: (v: boolean) => { if (!v) keepTarget.value = null } })
const keeping = ref(false)

function askKeep(r: { uuid: string, retainFromCleanup?: boolean, retainNote?: string | null }) {
  keepTarget.value = { uuid: r.uuid, retained: !!r.retainFromCleanup, note: r.retainNote ?? null }
}

async function saveKeep(payload: { retain: boolean, note: string }) {
  if (!keepTarget.value) return
  keeping.value = true
  try {
    await api.retain(keepTarget.value.uuid, payload.retain, payload.note)
    toast.add({ title: payload.retain ? t('keepRecord.kept') : t('keepRecord.released'), color: 'success', icon: 'i-lucide-check-circle' })
    keepTarget.value = null
    await load()
  }
  catch {
    // useApi toasted the reason (e.g. it was already sent to review).
  }
  finally {
    keeping.value = false
  }
}

onMounted(() => {
  load()
})
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <div class="flex items-center gap-3">
          <h1 class="text-2xl font-extrabold text-prohealth-900">{{ t('allyRequests.title') }}</h1>
          <UBadge v-if="pendingCount" color="warning" variant="subtle">{{ t('allyRequests.pendingCount', { count: pendingCount }) }}</UBadge>
        </div>
        <p class="text-sm text-prohealth-700/70 mt-1">{{ t('allyRequests.subtitle') }}</p>
      </div>
      <div class="flex items-center gap-2">
        <UButton v-can="'ALLY_IMPORT'" color="primary" variant="outline" icon="i-lucide-file-spreadsheet" @click="importOpen = true">
          {{ t('allyRequests.importButton') }}
        </UButton>
        <ListRefreshMenu :loading="loading" variant="ghost" @refresh="load" @reset="resetFilters" />
      </div>
    </div>

    <div class="bg-white rounded-2xl border border-prohealth-100 p-4 flex flex-wrap items-center gap-3">
      <UInput
        v-model="search"
        :placeholder="t('allyRequests.searchPlaceholder')"
        icon="i-lucide-search"
        size="lg"
        class="w-full max-w-md"
      />
      <USelect v-model="status" :items="statusItems" :aria-label="t('allyRequests.columns.status')" size="lg" class="w-44" />
      <USelect v-model="channel" :items="channelItems" :aria-label="t('allyRequests.columns.channel')" size="lg" class="w-48" />
      <USelectMenu
        v-if="advisors.available.value"
        v-model="promoterUuid"
        clear
        :items="advisorItems.items.value"
        :loading="advisorItems.loading.value"
        value-key="value"
        label-key="label"
        :placeholder="t('allyRequests.advisorFilter')"
        icon="i-lucide-user-check"
        size="lg"
        class="w-64"
        @update:open="advisorItems.onOpen"
      />
      <AllyMasterFilters v-model="masterFilters" class="w-full" />
      <DateRangeFilter v-model:from="dateFrom" v-model:to="dateTo" :from-label="t('allyRequests.filters.dateFrom')" :to-label="t('allyRequests.filters.dateTo')" />
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

    <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden flex flex-col h-[calc(100vh-19rem)] min-h-[20rem]">
      <div class="overflow-auto flex-1">
        <table class="w-full text-sm">
          <thead class="bg-prohealth-50/60">
            <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('name')">
                {{ t('allyRequests.columns.name') }}
                <SortIndicator :state="sort.stateOf('name')" :multi-active="isMultiSort" @clear="sort.remove('name')" />
              </th>
              <th class="px-5 py-3 font-semibold">{{ t('allyRequests.columns.segment') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('allyRequests.columns.contact') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('allyRequests.columns.channel') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('allyRequests.columns.advisor') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('allyRequests.columns.benefitNote') }}</th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('createdAt')">
                {{ t('allyRequests.columns.createdAt') }}
                <SortIndicator :state="sort.stateOf('createdAt')" :multi-active="isMultiSort" @clear="sort.remove('createdAt')" />
              </th>
              <th class="px-5 py-3 font-semibold">{{ t('allyRequests.columns.status') }}</th>
              <th class="px-5 py-3 font-semibold text-right">{{ t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-prohealth-100">
            <TableSkeleton v-if="loading" :rows="4" :cols="9" />
            <tr v-else-if="items.length === 0">
              <td colspan="9" class="px-5 py-10 text-center text-prohealth-500">
                <UIcon name="i-lucide-handshake" class="w-8 h-8 mx-auto mb-2 text-prohealth-300" />
                {{ t('allyRequests.empty') }}
              </td>
            </tr>
            <tr
              v-for="r in items"
              v-else
              :key="r.uuid"
              class="hover:bg-prohealth-50/50 align-top"
              @dblclick="(e: MouseEvent) => { if (!(e.target as HTMLElement).closest('button, a')) navigateTo(detailPath(r)) }"
            >
              <td class="px-5 py-3">
                <NuxtLink :to="detailPath(r)" class="font-medium text-prohealth-900 hover:underline">{{ r.name }}</NuxtLink>
                <UBadge v-if="r.retainFromCleanup" color="info" variant="subtle" size="sm" class="ml-2" :title="r.retainNote || undefined">{{ t('keepRecord.badge') }}</UBadge>
                <p class="text-xs text-prohealth-500">
                  {{ r.allyTypeNames?.length ? r.allyTypeNames.join(', ') : t('common.empty') }}
                  <template v-if="r.city_Display"> · {{ r.city_Display }}</template>
                </p>
              </td>
              <td class="px-5 py-3">
                <UBadge :color="r.segment === 'B2P' ? 'info' : 'primary'" variant="subtle" size="sm">{{ segmentLabel(r) }}</UBadge>
              </td>
              <td class="px-5 py-3 text-prohealth-700">
                <p>{{ r.contactName || t('common.empty') }}</p>
                <p v-if="r.contactEmail" class="text-xs text-prohealth-500">{{ r.contactEmail }}</p>
                <p v-if="r.contactPhone" class="text-xs text-prohealth-500">{{ r.contactPhone }}</p>
              </td>
              <td class="px-5 py-3 text-prohealth-600">{{ channelLabel(r) }}</td>
              <td class="px-5 py-3 text-prohealth-600">{{ r.promoter_Display || t('common.empty') }}</td>
              <td class="px-5 py-3 text-prohealth-600 max-w-xs">
                <p class="line-clamp-2" :title="r.registrationNote || undefined">{{ r.registrationNote || t('common.empty') }}</p>
              </td>
              <td class="px-5 py-3 text-prohealth-600 whitespace-nowrap">{{ r.createdAt_Display ?? formatDate(r.createdAt, 'datetime') }}</td>
              <td class="px-5 py-3">
                <UBadge :color="status === 'IN_PROGRESS' ? 'neutral' : allyRegistrationStatusColor(r.registrationStatus)" variant="subtle" size="sm">{{ statusLabel(r) }}</UBadge>
              </td>
              <td class="px-5 py-3">
                <div class="flex items-center justify-end gap-1">
                  <UTooltip v-if="canKeep && status === 'IN_PROGRESS'" :text="t('keepRecord.action')">
                    <UButton color="neutral" variant="ghost" size="sm" :icon="r.retainFromCleanup ? 'i-lucide-bookmark-check' : 'i-lucide-bookmark'" :aria-label="t('keepRecord.action')" @click="askKeep(r)" />
                  </UTooltip>
                  <UTooltip :text="t('allyRequests.viewDetail')">
                    <UButton color="neutral" variant="ghost" icon="i-lucide-eye" size="sm" :to="detailPath(r)" />
                  </UTooltip>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="flex items-center flex-wrap justify-between gap-3 px-5 py-3 border-t border-prohealth-100 shrink-0">
        <p class="text-xs text-prohealth-500">{{ t('catalogs.recordCount', { count: total }) }}</p>
        <div class="flex items-center gap-3">
          <UPagination
            v-if="pageSize !== UNPAGED_PAGE_SIZE"
            v-model:page="page"
            :total="total"
            :items-per-page="pageSize"
          />
          <UTooltip :text="t('catalogs.pageSizeLabel')">
            <USelectMenu
              v-model="pageSize"
              :items="pageSizeItems"
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

    <AllyImportModal v-model:open="importOpen" @imported="onImported" />
    <KeepRecordModal v-model:open="keepOpen" :retained="keepTarget?.retained ?? false" :note="keepTarget?.note" :loading="keeping" @confirm="saveKeep" />
  </div>
</template>
