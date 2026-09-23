<script setup lang="ts">
import { buildPageSizeItems, DEFAULT_PAGE_SIZE, UNPAGED_PAGE_SIZE } from '~/utils/pagination'
import type { SelectItem } from '~/types/options'
import type { CommissionDto, CommissionStatus } from '~/types/promoters'
import { COMMISSION_STATUS_OPTIONS, commissionStatusColor, isCommissionRowCheckable } from '~/types/promoters'
import type { AppliesTo } from '~/types/commissionTiers'
import { APPLIES_TO_OPTIONS } from '~/types/commissionTiers'
import { emptyDateRange, type DateTimeRange } from '~/utils/date'
import type { SortDirection } from '~/composables/useTableSort'

// Same filters/pagination/grouping pattern as payouts-generate.vue (E.2), but
// against the approval gate: status defaults to PENDING, selection is
// restricted to PENDING rows (isCommissionRowCheckable), and the footer
// approves/rejects instead of generating payouts. useCommissionApproval() is
// only used for approve/reject — listing goes through the generic
// GET /v1/admin/commissions like every other commissions screen.
definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'COMMISSION_APPROVE',
})

const { t } = useI18n()
const { formatDate } = useFormatters()
useSeoMeta({ title: () => t('common.seoTitle', { page: t('commissions.approval.title') }) })

const commissions = useCommissions()
const commissionApproval = useCommissionApproval()
const toast = useToast()
const promotersApi = usePromoters()
const campaignsApi = useCampaigns()
const promoterTypeOptions = useCatalogOptions('promoter-types')
const rankCatalog = useCatalog('/v1/admin/promoter-ranks')
const { can } = usePermissions()

const canViewPromoter = computed(() => can('PROMOTER_VIEW_ALL'))

// Filters panel — open by default, collapsible via the same chevron pattern
// used by payouts-generate.vue.
const filtersOpen = ref(true)

// ---- Filters ----
const periodRange = ref<DateTimeRange>(emptyDateRange())
const promoterTypeUuid = ref<string | undefined>(undefined)
const promoterUuid = ref<string | undefined>(undefined)
const appliesTo = ref<AppliesTo | undefined>(undefined)
// Approval queue default: only PENDING rows need a decision — still
// clearable/changeable like any other filter.
const status = ref<CommissionStatus | undefined>('PENDING')
// UInput type="number" binds a string here, same convention as MemberFormModal's
// numberOfChildren — converted to a number only when building the RSQL clause.
const amountFrom = ref<string>('')
const amountTo = ref<string>('')
const campaignUuid = ref<string | undefined>(undefined)
const rankUuid = ref<string | undefined>(undefined)

const appliesToOptions = computed(() => APPLIES_TO_OPTIONS.map(o => ({ label: t(o.labelKey), value: o.value })))
const statusOptions = computed(() => COMMISSION_STATUS_OPTIONS.map(o => ({ label: t(o.labelKey), value: o.value })))

// Same resolution order as payouts-generate.vue's `appliesToLabel`:
// server-resolved `_Display` first, then the local i18n catalog, then the raw value.
function appliesToLabel(row: CommissionDto): string {
  if (row.appliesTo_Display) {
    return row.appliesTo_Display
  }
  const option = APPLIES_TO_OPTIONS.find(o => o.value === row.appliesTo)
  return option ? t(option.labelKey) : (row.appliesTo ?? '')
}

// Shared `ui` override for `type="number"` inputs: hides the native
// increment/decrement spin buttons, which otherwise overlap the
// right-aligned text and money `$` prefix, so the caret lands where expected.
const NUMBER_INPUT_UI = {
  base: 'w-full text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
}

async function searchPromoters(q: string): Promise<SelectItem[]> {
  const res = await promotersApi.list({ q, size: 20 })
  return (res.content ?? []).map(p => ({ label: p.displayName, value: p.uuid }))
}

async function searchCampaigns(q: string): Promise<SelectItem[]> {
  const res = await campaignsApi.list({ q, size: 20 })
  return (res.content ?? []).map(c => ({ label: c.name, value: c.uuid }))
}

function goToLinkedRecord(to: string) {
  navigateTo(to)
}

// Small, fixed catalogs — loaded once, filtered client-side by CommonEntityReferenceSelect's `items` mode.
const promoterTypeItems = ref<SelectItem[]>([])
const rankItems = ref<SelectItem[]>([])

async function loadStaticCatalogs() {
  try {
    const res = await promoterTypeOptions.options({ limit: 100 })
    promoterTypeItems.value = res.map(o => ({ label: o.label, value: o.uuid }))
  }
  catch {
    promoterTypeItems.value = []
  }
  try {
    const ranks = await rankCatalog.listAll()
    rankItems.value = ranks.map(r => ({ label: r.name, value: r.uuid }))
  }
  catch {
    rankItems.value = []
  }
}

function clearPeriod() {
  periodRange.value = emptyDateRange()
}
function clearAmountFrom() {
  amountFrom.value = ''
}
function clearAmountTo() {
  amountTo.value = ''
}

function clearFilters() {
  resetting.value = true
  periodRange.value = emptyDateRange()
  promoterTypeUuid.value = undefined
  promoterUuid.value = undefined
  appliesTo.value = undefined
  status.value = undefined
  amountFrom.value = ''
  amountTo.value = ''
  campaignUuid.value = undefined
  rankUuid.value = undefined
  page.value = 1
  nextTick(() => {
    resetting.value = false
    load()
  })
}

// ---- RSQL for the filters with no dedicated param (status/appliesTo/amount/promoter/period) ----
function buildFilter(): string | undefined {
  const clauses: string[] = []
  if (status.value) clauses.push(`status==${status.value}`)
  if (appliesTo.value) clauses.push(`appliesTo==${appliesTo.value}`)
  if (amountFrom.value.trim()) clauses.push(`amount=ge=${amountFrom.value.trim()}`)
  if (amountTo.value.trim()) clauses.push(`amount=le=${amountTo.value.trim()}`)
  if (promoterUuid.value) clauses.push(`promoter.uuid==${promoterUuid.value}`)
  if (periodRange.value.from) clauses.push(`earnedAt=ge=${periodRange.value.from}`)
  if (periodRange.value.to) clauses.push(`earnedAt=le=${periodRange.value.to}`)
  return clauses.length ? clauses.join(';') : undefined
}

// ---- Listing + pagination ----
const data = ref<CommissionDto[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1) // UPagination is 1-based; the API is 0-based
const size = ref(DEFAULT_PAGE_SIZE)
const pageSizeItems = buildPageSizeItems(t)
const resetting = ref(false)

// The scrollable body keeps its `scrollTop` across reloads (sort click, page
// change, filter change) because the DOM node itself never unmounts — only
// its rows do. Left alone, a reorder (e.g. sorting by promoter) can leave the
// viewport scrolled past the new first group's header row, which then sits
// hidden behind the sticky `<thead>` while that group's own data rows — far
// enough down to still be in view — render normally, looking like a group
// with no header at all. Reset to the top on every reload so row 1 is always
// under, not behind, the sticky header.
const tableScrollEl = ref<HTMLDivElement | null>(null)

// ---- Grouping (mutually exclusive with server-side pagination — see watchers below) ----
const groupByPromoter = ref(false)
const expandedGroups = ref<Set<string>>(new Set())

// Empty by default: no `sort=` is sent until the user clicks a column, same
// convention as commissions/index.vue — the backend's own default-sort
// fallback applies until then.
const sort = useTableSort([])
const isMultiSort = computed(() => sort.orders.value.length > 1)

// Selection is scoped to the currently loaded page — reset on every reload
// (filter change, page change, manual refresh) so it never points at rows
// no longer on screen.
const selected = ref<Set<string>>(new Set())

async function load() {
  loading.value = true
  try {
    const res = await commissions.list({
      page: page.value - 1,
      size: size.value,
      sort: sort.sortParam.value,
      filter: buildFilter(),
      promoterTypeUuid: promoterTypeUuid.value,
      promoterRankUuid: rankUuid.value,
      campaignUuid: campaignUuid.value,
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
    data.value = []
    total.value = 0
  }
  finally {
    selected.value = new Set()
    loading.value = false
    await nextTick()
    if (tableScrollEl.value) tableScrollEl.value.scrollTop = 0
  }
}

watch(size, () => { if (!resetting.value) page.value = 1 })
watch([page, size], () => { if (!resetting.value) load() })
watch(sort.orders, () => { if (!resetting.value) load() }, { deep: true })

// Grouping and server-side pagination are mutually exclusive — a promoter
// could otherwise be split across pages. Neither watcher re-triggers the
// other: each only assigns when the target isn't already at that value, so
// the resulting no-op change on the other ref never fires its own watcher.
watch(groupByPromoter, (v) => {
  if (v && size.value !== UNPAGED_PAGE_SIZE) size.value = UNPAGED_PAGE_SIZE
})
watch(size, (s) => {
  if (s !== UNPAGED_PAGE_SIZE && groupByPromoter.value) groupByPromoter.value = false
})

let filterTimer: ReturnType<typeof setTimeout> | undefined
watch(
  [periodRange, promoterTypeUuid, promoterUuid, appliesTo, status, amountFrom, amountTo, campaignUuid, rankUuid],
  () => {
    if (resetting.value) return
    clearTimeout(filterTimer)
    filterTimer = setTimeout(() => {
      page.value = 1
      load()
    }, 300)
  },
  { deep: true },
)

onMounted(() => {
  loadStaticCatalogs()
  load()
})

// ---- Selection (only PENDING rows can be approved/rejected) ----
const checkableRows = computed(() => data.value.filter(isCommissionRowCheckable))
const selectedCount = computed(() => selected.value.size)

const masterState = computed<boolean | 'indeterminate'>(() => {
  const ids = checkableRows.value.map(r => r.uuid)
  if (ids.length === 0) return false
  const count = ids.filter(id => selected.value.has(id)).length
  if (count === 0) return false
  if (count === ids.length) return true
  return 'indeterminate'
})

function toggleRow(uuid: string, checked: boolean) {
  const next = new Set(selected.value)
  if (checked) next.add(uuid)
  else next.delete(uuid)
  selected.value = next
}

function toggleAll(checked: boolean) {
  const next = new Set(selected.value)
  for (const row of checkableRows.value) {
    if (checked) next.add(row.uuid)
    else next.delete(row.uuid)
  }
  selected.value = next
}

// ---- Grouping by promoter (client-side clustering of `data.value`) ----
// Uses a Map, not an assumption that rows of the same promoter are
// contiguous — no sort is pinned here, so they can appear in any order
// depending on whichever column the user has sorted.
interface CommissionGroup {
  key: string
  label: string
  code?: string
  rows: CommissionDto[]
}

const groupedByPromoterRows = computed<CommissionGroup[] | null>(() => {
  if (!groupByPromoter.value) return null
  const map = new Map<string, CommissionGroup>()
  for (const row of data.value) {
    const key = row.promoter_Uuid || row.promoter_Display || ''
    let group = map.get(key)
    if (!group) {
      group = { key, label: row.promoter_Display || t('common.empty'), code: row.promoter_Code || undefined, rows: [] }
      map.set(key, group)
    }
    group.rows.push(row)
  }
  return Array.from(map.values())
})

// Groups open by default: whenever the clustering changes (grouping just
// turned on, or fresh `data` while it's on), expand every key it doesn't
// already know about instead of collapsing everything — that would also
// discard a user's manual collapse on an unrelated reload.
watch(groupedByPromoterRows, (groups) => {
  if (!groups) return
  const next = new Set(expandedGroups.value)
  let changed = false
  for (const group of groups) {
    if (!next.has(group.key)) {
      next.add(group.key)
      changed = true
    }
  }
  if (changed) expandedGroups.value = next
})

function isGroupExpanded(key: string): boolean {
  return expandedGroups.value.has(key)
}

function toggleGroupExpanded(key: string) {
  const next = new Set(expandedGroups.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  expandedGroups.value = next
}

function groupCheckableRows(group: CommissionGroup): CommissionDto[] {
  return group.rows.filter(isCommissionRowCheckable)
}

function groupState(group: CommissionGroup): boolean | 'indeterminate' {
  const ids = groupCheckableRows(group).map(r => r.uuid)
  if (ids.length === 0) return false
  const count = ids.filter(id => selected.value.has(id)).length
  if (count === 0) return false
  if (count === ids.length) return true
  return 'indeterminate'
}

function toggleGroupAll(group: CommissionGroup, checked: boolean) {
  const next = new Set(selected.value)
  for (const row of groupCheckableRows(group)) {
    if (checked) next.add(row.uuid)
    else next.delete(row.uuid)
  }
  selected.value = next
}

// ---- Approve ----
const approving = ref(false)
async function onApprove() {
  if (selected.value.size === 0) return
  approving.value = true
  try {
    const res = await commissionApproval.approve([...selected.value])
    toast.add({
      title: t('commissions.approval.approvedToast', { count: res.commissionUuids.length }),
      color: 'success',
      icon: 'i-lucide-check-circle',
    })
    await load()
  }
  catch {
    // useApi ya notificó el error
  }
  finally {
    approving.value = false
  }
}

// ---- Reject ----
const rejectOpen = ref(false)
const rejecting = ref(false)
async function onReject(reason: string) {
  if (selected.value.size === 0) return
  rejecting.value = true
  try {
    const res = await commissionApproval.reject([...selected.value], reason)
    toast.add({
      title: t('commissions.approval.rejectedToast', {
        count: res.commissionUuids.length,
        overrides: res.cascadedOverridesVoided,
      }),
      color: 'warning',
      icon: 'i-lucide-circle-x',
    })
    rejectOpen.value = false
    await load()
  }
  catch {
    // useApi ya notificó el error
  }
  finally {
    rejecting.value = false
  }
}
</script>

<template>
  <div class="space-y-5 pb-20">
    <div>
      <h1 class="text-2xl font-extrabold text-prohealth-900 flex items-center gap-2">
        <UIcon name="i-lucide-badge-check" class="w-6 h-6 text-prohealth-600" />
        {{ t('commissions.approval.title') }}
      </h1>
      <p class="text-sm text-prohealth-700/70 mt-1">{{ t('commissions.approval.subtitle') }}</p>
    </div>

    <!-- Filters (collapsible, open by default) -->
    <div class="bg-white rounded-2xl border border-prohealth-100 p-4 space-y-3">
      <div class="flex items-center justify-between">
        <span class="text-sm font-semibold text-prohealth-700 flex items-center gap-2">
          <UIcon name="i-lucide-filter" class="w-4 h-4 text-prohealth-400" />
          {{ t('commissions.approval.filtersTitle') }}
        </span>
        <UButton
          type="button"
          color="neutral"
          variant="ghost"
          size="xs"
          :icon="filtersOpen ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
          :title="t('commissions.approval.filtersTitle')"
          @click="filtersOpen = !filtersOpen"
        />
      </div>

      <div v-if="filtersOpen" class="space-y-3">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <UFormField :label="t('commissions.approval.fields.period')">
            <div class="flex items-center gap-1">
              <AuditDateRangePicker v-model="periodRange" />
              <UButton
                v-if="periodRange.from || periodRange.to"
                color="neutral"
                variant="ghost"
                size="xs"
                icon="i-lucide-x"
                :title="t('commissions.approval.fields.clearPeriod')"
                @click="clearPeriod"
              />
            </div>
          </UFormField>

          <UFormField :label="t('commissions.approval.fields.promoterType')">
            <CommonEntityReferenceSelect
              v-model="promoterTypeUuid"
              :items="promoterTypeItems"
              entity="promoter_type"
              icon="i-lucide-tags"
              :placeholder="t('common.select')"
              @navigate="goToLinkedRecord"
            />
          </UFormField>

          <UFormField :label="t('commissions.approval.fields.promoter')">
            <CommonEntityReferenceSelect
              v-model="promoterUuid"
              :search="searchPromoters"
              entity="promoter"
              icon="i-lucide-user"
              :placeholder="t('common.select')"
              @navigate="goToLinkedRecord"
            />
          </UFormField>

          <UFormField :label="t('commissions.approval.fields.appliesTo')">
            <USelectMenu
              clear
              v-model="appliesTo"
              :items="appliesToOptions"
              label-key="label"
              value-key="value"
              icon="i-lucide-list-tree"
              :placeholder="t('common.select')"
              class="w-full"
            />
          </UFormField>

          <UFormField :label="t('commissions.approval.fields.status')">
            <USelectMenu
              clear
              v-model="status"
              :items="statusOptions"
              label-key="label"
              value-key="value"
              icon="i-lucide-flag"
              :placeholder="t('common.select')"
              class="w-full"
            />
          </UFormField>

          <UFormField :label="t('commissions.approval.fields.amountFrom')">
            <UInput v-model="amountFrom" type="number" min="0" class="w-full" :ui="NUMBER_INPUT_UI">
              <template #leading>
                <span class="text-prohealth-400 text-sm">$</span>
              </template>
              <template v-if="amountFrom" #trailing>
                <UButton color="neutral" variant="ghost" size="xs" icon="i-lucide-x" @click="clearAmountFrom" />
              </template>
            </UInput>
          </UFormField>

          <UFormField :label="t('commissions.approval.fields.amountTo')">
            <UInput v-model="amountTo" type="number" min="0" class="w-full" :ui="NUMBER_INPUT_UI">
              <template #leading>
                <span class="text-prohealth-400 text-sm">$</span>
              </template>
              <template v-if="amountTo" #trailing>
                <UButton color="neutral" variant="ghost" size="xs" icon="i-lucide-x" @click="clearAmountTo" />
              </template>
            </UInput>
          </UFormField>

          <UFormField :label="t('commissions.approval.fields.campaign')">
            <CommonEntityReferenceSelect
              v-model="campaignUuid"
              :search="searchCampaigns"
              entity="campaign"
              icon="i-lucide-rocket"
              :placeholder="t('common.select')"
              @navigate="goToLinkedRecord"
            />
          </UFormField>

          <UFormField :label="t('commissions.approval.fields.rank')">
            <CommonEntityReferenceSelect
              v-model="rankUuid"
              :items="rankItems"
              entity="promoter_rank"
              icon="i-lucide-award"
              :placeholder="t('common.select')"
              @navigate="goToLinkedRecord"
            />
          </UFormField>
        </div>

        <div class="flex items-center justify-end gap-2 pt-1">
          <UButton color="neutral" variant="link" size="sm" icon="i-lucide-list-restart" @click="clearFilters">
            {{ t('commissions.approval.clearAll') }}
          </UButton>
          <UButton color="primary" variant="outline" icon="i-lucide-refresh-cw" :loading="loading" @click="load">
            {{ t('commissions.approval.refreshButton') }}
          </UButton>
        </div>
      </div>
    </div>

    <!-- Table: fixed height + internal scroll, sticky header -->
    <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden flex flex-col h-[calc(100vh-26rem)] min-h-[20rem]">
      <div ref="tableScrollEl" class="overflow-auto flex-1">
        <table class="w-full text-sm">
          <thead class="sticky top-0 bg-white z-10">
            <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
              <th class="px-4 py-2.5 w-8 text-center">
                <UCheckbox
                  :model-value="masterState"
                  :disabled="checkableRows.length === 0"
                  @update:model-value="(v: boolean | 'indeterminate') => toggleAll(v === true)"
                />
              </th>
              <th class="px-4 py-2.5 font-semibold cursor-pointer select-none text-center" @click="sort.toggle('promoter_Display')">
                <span class="flex items-center justify-center gap-1">
                  {{ t('commissions.approval.columns.promoter') }}
                  <SortIndicator
                    :state="sort.stateOf('promoter_Display')"
                    :multi-active="isMultiSort"
                    @clear="sort.remove('promoter_Display')"
                  />
                </span>
              </th>
              <th class="px-4 py-2.5 font-semibold cursor-pointer select-none text-center" @click="sort.toggle('appliesTo')">
                <span class="flex items-center justify-center gap-1">
                  {{ t('commissions.approval.columns.appliesTo') }}
                  <SortIndicator
                    :state="sort.stateOf('appliesTo')"
                    :multi-active="isMultiSort"
                    @clear="sort.remove('appliesTo')"
                  />
                </span>
              </th>
              <th class="px-4 py-2.5 font-semibold cursor-pointer select-none text-center" @click="sort.toggle('amount')">
                <span class="flex items-center justify-center gap-1">
                  {{ t('commissions.approval.columns.amount') }}
                  <SortIndicator :state="sort.stateOf('amount')" :multi-active="isMultiSort" @clear="sort.remove('amount')" />
                </span>
              </th>
              <th class="px-4 py-2.5 font-semibold cursor-pointer select-none text-center" @click="sort.toggle('earnedAt')">
                <span class="flex items-center justify-center gap-1">
                  {{ t('commissions.approval.columns.earnedAt') }}
                  <SortIndicator :state="sort.stateOf('earnedAt')" :multi-active="isMultiSort" @clear="sort.remove('earnedAt')" />
                </span>
              </th>
              <th class="px-4 py-2.5 font-semibold cursor-pointer select-none text-center" @click="sort.toggle('status')">
                <span class="flex items-center justify-center gap-1">
                  {{ t('commissions.approval.columns.status') }}
                  <SortIndicator
                    :state="sort.stateOf('status')"
                    :multi-active="isMultiSort"
                    @clear="sort.remove('status')"
                  />
                </span>
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-prohealth-100">
            <TableSkeleton v-if="loading" :rows="8" :cols="6" />
            <tr v-else-if="data.length === 0">
              <td colspan="6" class="px-4 py-12 text-center text-prohealth-500">
                <UIcon name="i-lucide-inbox" class="w-8 h-8 mx-auto mb-2 text-prohealth-300" />
                {{ t('commissions.approval.empty') }}
              </td>
            </tr>
            <template v-else-if="groupedByPromoterRows">
              <template v-for="group in groupedByPromoterRows" :key="group.key">
                <tr class="bg-prohealth-50/60 hover:bg-prohealth-100/60 cursor-pointer select-none" @click="toggleGroupExpanded(group.key)">
                  <td class="px-4 py-2.5" @click.stop>
                    <UCheckbox
                      :model-value="groupState(group)"
                      :disabled="groupCheckableRows(group).length === 0"
                      @update:model-value="(v: boolean | 'indeterminate') => toggleGroupAll(group, v === true)"
                    />
                  </td>
                  <td colspan="5" class="px-4 py-2.5 font-semibold text-prohealth-800">
                    <span class="inline-flex items-center gap-1.5">
                      <UIcon :name="isGroupExpanded(group.key) ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" class="w-4 h-4 text-prohealth-400" />
                      {{ group.label }}
                      <span v-if="group.code" class="text-xs font-mono text-prohealth-400 font-normal">{{ group.code }}</span>
                      <span class="text-xs text-prohealth-400 font-normal">({{ group.rows.length }})</span>
                    </span>
                  </td>
                </tr>
                <template v-if="isGroupExpanded(group.key)">
                  <tr
                    v-for="row in group.rows"
                    :key="row.uuid"
                    class="hover:bg-prohealth-50/50"
                    @dblclick="isCommissionRowCheckable(row) && toggleRow(row.uuid, !selected.has(row.uuid))"
                  >
                    <td class="px-4 py-2.5">
                      <UCheckbox
                        :model-value="selected.has(row.uuid)"
                        :disabled="!isCommissionRowCheckable(row)"
                        @update:model-value="(v: boolean | 'indeterminate') => toggleRow(row.uuid, v === true)"
                      />
                    </td>
                    <td class="px-4 py-2.5">
                      <div class="font-semibold">
                        <CommonEntityLinkCell
                          :to="row.promoter_Uuid ? `/dashboard/promoters/${row.promoter_Uuid}` : null"
                          :label="row.promoter_Display"
                          :can="canViewPromoter"
                        />
                      </div>
                      <div class="text-xs text-prohealth-500 font-mono">{{ row.promoter_Code || t('common.empty') }}</div>
                    </td>
                    <td class="px-4 py-2.5 text-prohealth-700">{{ appliesToLabel(row) }}</td>
                    <td class="px-4 py-2.5 text-right font-medium text-prohealth-900">
                      <MoneyWithTooltip :display="row.amount_Display" :converted-display="row.amountConverted_Display" :rate-date="row.exchangeRateDate" />
                    </td>
                    <td class="px-4 py-2.5 text-prohealth-600 text-xs">{{ row.earnedAt_Display || formatDate(row.earnedAt, 'datetime') }}</td>
                    <td class="px-4 py-2.5">
                      <UBadge :color="commissionStatusColor(row.status)" variant="subtle" size="sm">
                        {{ row.status_Display || row.status }}
                      </UBadge>
                    </td>
                  </tr>
                </template>
              </template>
            </template>
            <template v-else>
              <tr
                v-for="row in data"
                :key="row.uuid"
                class="hover:bg-prohealth-50/50"
                @dblclick="isCommissionRowCheckable(row) && toggleRow(row.uuid, !selected.has(row.uuid))"
              >
                <td class="px-4 py-2.5">
                  <UCheckbox
                    :model-value="selected.has(row.uuid)"
                    :disabled="!isCommissionRowCheckable(row)"
                    @update:model-value="(v: boolean | 'indeterminate') => toggleRow(row.uuid, v === true)"
                  />
                </td>
                <td class="px-4 py-2.5">
                  <div class="font-semibold">
                    <CommonEntityLinkCell
                      :to="row.promoter_Uuid ? `/dashboard/promoters/${row.promoter_Uuid}` : null"
                      :label="row.promoter_Display"
                      :can="canViewPromoter"
                    />
                  </div>
                  <div class="text-xs text-prohealth-500 font-mono">{{ row.promoter_Code || t('common.empty') }}</div>
                </td>
                <td class="px-4 py-2.5 text-prohealth-700">{{ appliesToLabel(row) }}</td>
                <td class="px-4 py-2.5 text-right font-medium text-prohealth-900">
                  <MoneyWithTooltip :display="row.amount_Display" :converted-display="row.amountConverted_Display" :rate-date="row.exchangeRateDate" />
                </td>
                <td class="px-4 py-2.5 text-prohealth-600 text-xs">{{ row.earnedAt_Display || formatDate(row.earnedAt, 'datetime') }}</td>
                <td class="px-4 py-2.5">
                  <UBadge :color="commissionStatusColor(row.status)" variant="subtle" size="sm">
                    {{ row.status_Display || row.status }}
                  </UBadge>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Single sticky footer: pagination + selection summary (left) and reject/approve (right) -->
    <div class="sticky bottom-0 z-10 bg-white border-t border-prohealth-100 shadow-[0_-2px_8px_rgba(0,0,0,0.04)] px-5 py-3 rounded-t-2xl flex flex-wrap items-center justify-between gap-3">
      <div class="flex flex-wrap items-center gap-4">
        <p class="text-xs text-prohealth-500">
          {{ t('commissions.approval.paginationSummary', { shown: data.length, total }) }}
        </p>
        <span class="text-sm text-prohealth-500">
          {{ t('commissions.approval.selectedCount', { count: selectedCount }) }}
        </span>
        <div class="flex items-center gap-3">
          <UPagination
            v-if="size !== UNPAGED_PAGE_SIZE"
            v-model:page="page"
            :total="total"
            :items-per-page="size"
          />
          <USelectMenu
            v-model="size"
            :items="pageSizeItems"
            label-key="label"
            value-key="value"
            icon="i-lucide-list"
            :search-input="false"
            class="w-40"
          />
          <UCheckbox v-model="groupByPromoter" :label="t('commissions.approval.groupByPromoter')" />
        </div>
      </div>
      <div class="flex items-center gap-2">
        <UButton
          color="error"
          variant="outline"
          icon="i-lucide-x"
          :disabled="selectedCount === 0"
          @click="rejectOpen = true"
        >
          {{ t('commissions.approval.rejectButton') }}
        </UButton>
        <UButton
          color="primary"
          icon="i-lucide-check"
          :loading="approving"
          :disabled="selectedCount === 0"
          @click="onApprove"
        >
          {{ t('commissions.approval.approveButton') }}
        </UButton>
      </div>
    </div>

    <CommissionRejectReasonModal
      v-model:open="rejectOpen"
      :count="selectedCount"
      :submitting="rejecting"
      @confirm="onReject"
    />
  </div>
</template>
