<script setup lang="ts">
import { buildPageSizeItems, DEFAULT_PAGE_SIZE, UNPAGED_PAGE_SIZE } from '~/utils/pagination'
import type { SortDirection } from '~/composables/useTableSort'
import type { AdvisorRegistrationStatus, AdvisorRequestListItemDto } from '~/types/advisorRequests'
import { ADVISOR_REGISTRATION_STATUSES, advisorRegistrationStatusColor } from '~/types/advisorRequests'

// Verification queue of the self-registered advisors (GET /v1/admin/advisor-requests), registered on
// /quiero-ser-asesor. Defaults to PENDING. The detail approves (QR + commissions), rejects or reopens.
definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'ADVISOR_REGISTRATION_VIEW_ALL',
})

const { t } = useI18n()
const { formatDate } = useFormatters()

useSeoMeta({ title: () => t('common.seoTitle', { page: t('nav.items.advisorRequests.label') }) })

const api = useAdvisorRequests()

const items = ref<AdvisorRequestListItemDto[]>([])
const total = ref(0)
const loading = ref(false)
const search = ref('')
const DEFAULT_STATUS: AdvisorRegistrationStatus = 'PENDING'
// 'ALL' = no filter.
const status = ref<string>(DEFAULT_STATUS)
const page = ref(1)
const pageSize = ref(DEFAULT_PAGE_SIZE)
const pageSizeItems = buildPageSizeItems(t)
const pendingCount = ref<number | null>(null)

const statusItems = computed(() => [
  { value: 'ALL', label: t('advisorRequests.statusAll') },
  ...ADVISOR_REGISTRATION_STATUSES.map(s => ({ value: s, label: t(`advisorRequests.status.${s}`) })),
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
      status: status.value === 'ALL' ? undefined : status.value as AdvisorRegistrationStatus,
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
watch(status, () => { if (!resetting.value) { page.value = 1; load() } })
watch(sort.orders, () => { if (!resetting.value) load() }, { deep: true })

async function resetFilters() {
  resetting.value = true
  search.value = ''
  status.value = DEFAULT_STATUS
  sort.reset()
  pageSize.value = DEFAULT_PAGE_SIZE
  page.value = 1
  await nextTick()
  resetting.value = false
  load()
}

function statusLabel(r: AdvisorRequestListItemDto): string {
  return r.registrationStatus_Display ?? t(`advisorRequests.status.${r.registrationStatus}`, r.registrationStatus)
}

function detailPath(r: AdvisorRequestListItemDto): string {
  return `/dashboard/advisor-requests/${r.uuid}`
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
          <h1 class="text-2xl font-extrabold text-prohealth-900">{{ t('advisorRequests.title') }}</h1>
          <UBadge v-if="pendingCount" color="warning" variant="subtle">{{ t('advisorRequests.pendingCount', { count: pendingCount }) }}</UBadge>
        </div>
        <p class="text-sm text-prohealth-700/70 mt-1">{{ t('advisorRequests.subtitle') }}</p>
      </div>
      <ListRefreshMenu :loading="loading" variant="ghost" @refresh="load" @reset="resetFilters" />
    </div>

    <ListFilterPanel :active-count="0" @clear="resetFilters">
      <UInput
        v-model="search"
        :placeholder="t('advisorRequests.searchPlaceholder')"
        icon="i-lucide-search"
        size="lg"
        class="w-full max-w-md"
      />
      <USelectMenu v-model="status" clear value-key="value" :items="statusItems" :aria-label="t('advisorRequests.columns.status')" size="lg" class="w-44" />
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
    </ListFilterPanel>

    <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden flex flex-col h-[calc(100vh-19rem)] min-h-[20rem]">
      <div class="overflow-auto flex-1">
        <table class="w-full text-sm">
          <thead class="bg-prohealth-50/60">
            <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
              <th class="px-5 py-3 font-semibold">{{ t('advisorRequests.columns.name') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('advisorRequests.columns.document') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('advisorRequests.columns.contact') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('advisorRequests.columns.zone') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('advisorRequests.columns.note') }}</th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('createdAt')">
                {{ t('advisorRequests.columns.createdAt') }}
                <SortIndicator :state="sort.stateOf('createdAt')" :multi-active="isMultiSort" @clear="sort.remove('createdAt')" />
              </th>
              <th class="px-5 py-3 font-semibold">{{ t('advisorRequests.columns.status') }}</th>
              <th class="px-5 py-3 font-semibold text-right">{{ t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-prohealth-100">
            <TableSkeleton v-if="loading" :rows="4" :cols="8" />
            <tr v-else-if="items.length === 0">
              <td colspan="8" class="px-5 py-10 text-center text-prohealth-500">
                <UIcon name="i-lucide-user-round-check" class="w-8 h-8 mx-auto mb-2 text-prohealth-300" />
                {{ t('advisorRequests.empty') }}
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
                <NuxtLink :to="detailPath(r)" class="font-medium text-prohealth-900 hover:underline">{{ r.displayName }}</NuxtLink>
              </td>
              <td class="px-5 py-3 text-prohealth-700 font-mono whitespace-nowrap">
                {{ r.documentNumber ? `${r.documentType ?? ''}-${r.documentNumber}` : t('common.empty') }}
              </td>
              <td class="px-5 py-3 text-prohealth-700">
                <p>{{ r.email || t('common.empty') }}</p>
                <p v-if="r.phone" class="text-xs text-prohealth-500">{{ r.phone }}</p>
              </td>
              <td class="px-5 py-3 text-prohealth-600">{{ r.assignedZone || t('common.empty') }}</td>
              <td class="px-5 py-3 text-prohealth-600 max-w-xs">
                <p class="line-clamp-2" :title="r.registrationNote || undefined">{{ r.registrationNote || t('common.empty') }}</p>
              </td>
              <td class="px-5 py-3 text-prohealth-600 whitespace-nowrap">{{ r.createdAt_Display ?? formatDate(r.createdAt, 'datetime') }}</td>
              <td class="px-5 py-3">
                <UBadge :color="advisorRegistrationStatusColor(r.registrationStatus)" variant="subtle" size="sm">{{ statusLabel(r) }}</UBadge>
              </td>
              <td class="px-5 py-3">
                <div class="flex items-center justify-end gap-1">
                  <UTooltip :text="t('advisorRequests.viewDetail')">
                    <UButton color="neutral" variant="ghost" icon="i-lucide-eye" size="sm" :to="detailPath(r)" :aria-label="t('advisorRequests.viewDetail')" />
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
              clear
              :items="pageSizeItems"
              label-key="label"
              value-key="value"
              icon="i-lucide-list"
              :aria-label="t('catalogs.pageSizeLabel')"
              class="w-40"
              :reset-model-value-on-clear="false"
              @clear="pageSize = DEFAULT_PAGE_SIZE"
            />
          </UTooltip>
        </div>
      </div>
    </div>
  </div>
</template>
