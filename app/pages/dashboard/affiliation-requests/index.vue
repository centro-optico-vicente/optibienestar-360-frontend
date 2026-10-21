<script setup lang="ts">
import { buildPageSizeItems, DEFAULT_PAGE_SIZE, UNPAGED_PAGE_SIZE } from '~/utils/pagination'
import type { SortDirection } from '~/composables/useTableSort'
import type { AffiliationRequestListItemDto, AffiliationRequestStatus } from '~/types/affiliationRequests'
import { AFFILIATION_REQUEST_STATUSES, affiliationRequestStatusColor } from '~/types/affiliationRequests'

// Review queue of the public affiliation requests (backend V188,
// GET /v1/admin/affiliation-requests). Defaults to PENDING, newest first.
definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'AFFILIATION_REQUEST_VIEW_ALL',
})

const { t } = useI18n()
const { formatDate } = useFormatters()

useSeoMeta({ title: () => t('common.seoTitle', { page: t('nav.items.affiliationRequests.label') }) })

const api = useAffiliationRequests()

const items = ref<AffiliationRequestListItemDto[]>([])
const total = ref(0)
const loading = ref(false)
const search = ref('')
const DEFAULT_STATUS: AffiliationRequestStatus = 'PENDING'
// 'ALL' = no status filter.
const status = ref<string>(DEFAULT_STATUS)
const page = ref(1)
const pageSize = ref(DEFAULT_PAGE_SIZE)
const pageSizeItems = buildPageSizeItems(t)

const statusItems = computed(() => [
  { value: 'ALL', label: t('affiliationRequests.statusAll') },
  ...AFFILIATION_REQUEST_STATUSES.map(s => ({ value: s, label: t(`affiliationRequests.status.${s}`) })),
])

const sort = useTableSort([])
const hasActiveSort = computed(() => sort.hasActiveSort.value)
const isMultiSort = computed(() => sort.orders.value.length > 1)

const resetting = ref(false)

async function load() {
  loading.value = true
  try {
    const res = await api.list({
      page: page.value - 1,
      size: pageSize.value,
      sort: sort.sortParam.value,
      q: search.value.trim() || undefined,
      status: status.value === 'ALL' ? undefined : status.value as AffiliationRequestStatus,
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

function statusLabel(r: AffiliationRequestListItemDto): string {
  return r.status_Display ?? t(`affiliationRequests.status.${r.status}`, r.status)
}

function detailPath(r: AffiliationRequestListItemDto): string {
  return `/dashboard/affiliation-requests/${r.uuid}`
}

onMounted(load)
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-extrabold text-prohealth-900">{{ t('affiliationRequests.title') }}</h1>
        <p class="text-sm text-prohealth-700/70 mt-1">{{ t('affiliationRequests.subtitle') }}</p>
      </div>
      <ListRefreshMenu :loading="loading" variant="ghost" @refresh="load" @reset="resetFilters" />
    </div>

    <div class="bg-white rounded-2xl border border-prohealth-100 p-4 flex flex-wrap items-center gap-3">
      <UInput
        v-model="search"
        :placeholder="t('affiliationRequests.searchPlaceholder')"
        icon="i-lucide-search"
        size="lg"
        class="w-full max-w-md"
      />
      <USelect
        v-model="status"
        :items="statusItems"
        :aria-label="t('affiliationRequests.columns.status')"
        size="lg"
        class="w-48"
      />
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
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('fullName')">
                {{ t('affiliationRequests.columns.applicant') }}
                <SortIndicator :state="sort.stateOf('fullName')" :multi-active="isMultiSort" @clear="sort.remove('fullName')" />
              </th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('documentNumber')">
                {{ t('affiliationRequests.columns.document') }}
                <SortIndicator :state="sort.stateOf('documentNumber')" :multi-active="isMultiSort" @clear="sort.remove('documentNumber')" />
              </th>
              <th class="px-5 py-3 font-semibold">{{ t('affiliationRequests.columns.plan') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('affiliationRequests.columns.advisor') }}</th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('createdAt')">
                {{ t('affiliationRequests.columns.createdAt') }}
                <SortIndicator :state="sort.stateOf('createdAt')" :multi-active="isMultiSort" @clear="sort.remove('createdAt')" />
              </th>
              <th class="px-5 py-3 font-semibold">{{ t('affiliationRequests.columns.status') }}</th>
              <th class="px-5 py-3 font-semibold text-right">{{ t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-prohealth-100">
            <TableSkeleton v-if="loading" :rows="4" :cols="7" />
            <tr v-else-if="items.length === 0">
              <td colspan="7" class="px-5 py-10 text-center text-prohealth-500">
                <UIcon name="i-lucide-user-plus" class="w-8 h-8 mx-auto mb-2 text-prohealth-300" />
                {{ t('affiliationRequests.empty') }}
              </td>
            </tr>
            <tr
              v-for="r in items"
              v-else
              :key="r.uuid"
              class="hover:bg-prohealth-50/50"
              @dblclick="(e: MouseEvent) => { if (!(e.target as HTMLElement).closest('button, a')) navigateTo(detailPath(r)) }"
            >
              <td class="px-5 py-3">
                <NuxtLink :to="detailPath(r)" class="font-medium text-prohealth-900 hover:underline">{{ r.fullName }}</NuxtLink>
                <p class="text-xs text-prohealth-500">{{ r.email }}</p>
              </td>
              <td class="px-5 py-3 text-prohealth-600 font-mono">{{ r.documentType }}-{{ r.documentNumber }}</td>
              <td class="px-5 py-3 text-prohealth-600">{{ r.plan_Display ?? t('common.empty') }}</td>
              <td class="px-5 py-3 text-prohealth-600">{{ r.advisor_Display ?? t('common.empty') }}</td>
              <td class="px-5 py-3 text-prohealth-600">{{ r.createdAt_Display ?? formatDate(r.createdAt, 'datetime') }}</td>
              <td class="px-5 py-3">
                <UBadge :color="affiliationRequestStatusColor(r.status)" variant="subtle" size="sm">{{ statusLabel(r) }}</UBadge>
              </td>
              <td class="px-5 py-3">
                <div class="flex items-center justify-end gap-1">
                  <UTooltip :text="t('affiliationRequests.viewDetail')">
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
  </div>
</template>
