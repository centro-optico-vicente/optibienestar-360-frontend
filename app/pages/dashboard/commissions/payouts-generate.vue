<script setup lang="ts">
import { buildPageSizeItems, DEFAULT_PAGE_SIZE, UNPAGED_PAGE_SIZE } from '~/utils/pagination'
import type { SelectItem } from '~/types/options'
import type { CommissionDto, CommissionStatus } from '~/types/promoters'
import { COMMISSION_STATUS_OPTIONS, commissionStatusColor, isPayableCommissionRow } from '~/types/promoters'
import type { AppliesTo } from '~/types/commissionTiers'
import { APPLIES_TO_OPTIONS } from '~/types/commissionTiers'
import { emptyDateRange, type DateTimeRange } from '~/utils/date'
import type { SortDirection } from '~/composables/useTableSort'

// Dedicated "Generar pagos" screen (separates pagar, gerencia de
// administración/COMMISSION_PAYOUT, from aprobar/rechazar, gerencia
// comercial/COMMISSION_APPROVE, en approval.vue). Richer filter set than a
// checkbox-per-row: tipo de promotor/cargo/campaña go through dedicated
// backend params (CommissionsService#list overload); the rest stay on the
// generic RSQL `filter`.
definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'COMMISSION_PAYOUT',
})

const { t } = useI18n()
const { formatDate } = useFormatters()
useSeoMeta({ title: () => t('common.seoTitle', { page: t('commissions.payoutGenerate.title') }) })

const commissions = useCommissions()
const promotersApi = usePromoters()
const campaignsApi = useCampaigns()
const promoterTypeOptions = useCatalogOptions('promoter-types')
const rankCatalog = useCatalog('/v1/admin/promoter-ranks')
const { can } = usePermissions()

const canViewPromoter = computed(() => can('PROMOTER_VIEW_ALL'))
const canGeneratePayout = computed(() => can('COMMISSION_PAYOUT'))

// Filters panel — open by default, collapsible via the same chevron pattern
// used by RolePermissionsModal's domain groups.
const filtersOpen = ref(true)

// ---- Filters ----
const periodRange = ref<DateTimeRange>(emptyDateRange())
const promoterTypeUuid = ref<string | undefined>(undefined)
const promoterUuid = ref<string | undefined>(undefined)
const appliesTo = ref<AppliesTo | undefined>(undefined)
const status = ref<CommissionStatus | undefined>(undefined)
// UInput type="number" binds a string here, same convention as MemberFormModal's
// numberOfChildren — converted to a number only when building the RSQL clause.
const amountFrom = ref<string>('')
const amountTo = ref<string>('')
const campaignUuid = ref<string | undefined>(undefined)
const rankUuid = ref<string | undefined>(undefined)

const appliesToOptions = computed(() => APPLIES_TO_OPTIONS.map(o => ({ label: t(o.labelKey), value: o.value })))
const statusOptions = computed(() => COMMISSION_STATUS_OPTIONS.map(o => ({ label: t(o.labelKey), value: o.value })))

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
  }
}

watch(size, () => { if (!resetting.value) page.value = 1 })
watch([page, size], () => { if (!resetting.value) load() })
watch(sort.orders, () => { if (!resetting.value) load() }, { deep: true })

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

// ---- Selection ----
const payableRows = computed(() => data.value.filter(isPayableCommissionRow))
const selectedCount = computed(() => selected.value.size)

const masterState = computed<boolean | 'indeterminate'>(() => {
  const ids = payableRows.value.map(r => r.uuid)
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
  for (const row of payableRows.value) {
    if (checked) next.add(row.uuid)
    else next.delete(row.uuid)
  }
  selected.value = next
}

// ---- Generar pagos ----
const payoutOpen = ref(false)

async function onPayoutDone() {
  payoutOpen.value = false
  selected.value = new Set()
  await load()
}
</script>

<template>
  <div class="space-y-5 pb-20">
    <div>
      <h1 class="text-2xl font-extrabold text-prohealth-900 flex items-center gap-2">
        <UIcon name="i-lucide-banknote" class="w-6 h-6 text-prohealth-600" />
        {{ t('commissions.payoutGenerate.title') }}
      </h1>
      <p class="text-sm text-prohealth-700/70 mt-1">{{ t('commissions.payoutGenerate.subtitle') }}</p>
    </div>

    <!-- Filters (collapsible, open by default) -->
    <div class="bg-white rounded-2xl border border-prohealth-100 p-4 space-y-3">
      <div class="flex items-center justify-between">
        <span class="text-sm font-semibold text-prohealth-700 flex items-center gap-2">
          <UIcon name="i-lucide-filter" class="w-4 h-4 text-prohealth-400" />
          {{ t('commissions.payoutGenerate.filtersTitle') }}
        </span>
        <UButton
          type="button"
          color="neutral"
          variant="ghost"
          size="xs"
          :icon="filtersOpen ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
          :title="t('commissions.payoutGenerate.filtersTitle')"
          @click="filtersOpen = !filtersOpen"
        />
      </div>

      <div v-if="filtersOpen" class="space-y-3">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <UFormField :label="t('commissions.payoutGenerate.fields.period')">
            <div class="flex items-center gap-1">
              <AuditDateRangePicker v-model="periodRange" />
              <UButton
                v-if="periodRange.from || periodRange.to"
                color="neutral"
                variant="ghost"
                size="xs"
                icon="i-lucide-x"
                :title="t('commissions.payoutGenerate.fields.clearPeriod')"
                @click="clearPeriod"
              />
            </div>
          </UFormField>

          <UFormField :label="t('commissions.payoutGenerate.fields.promoterType')">
            <CommonEntityReferenceSelect
              v-model="promoterTypeUuid"
              :items="promoterTypeItems"
              entity="promoter_type"
              icon="i-lucide-tags"
              :placeholder="t('common.select')"
              @navigate="goToLinkedRecord"
            />
          </UFormField>

          <UFormField :label="t('commissions.payoutGenerate.fields.promoter')">
            <CommonEntityReferenceSelect
              v-model="promoterUuid"
              :search="searchPromoters"
              entity="promoter"
              icon="i-lucide-user"
              :placeholder="t('common.select')"
              @navigate="goToLinkedRecord"
            />
          </UFormField>

          <UFormField :label="t('commissions.payoutGenerate.fields.appliesTo')">
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

          <UFormField :label="t('commissions.payoutGenerate.fields.status')">
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

          <UFormField :label="t('commissions.payoutGenerate.fields.amountFrom')">
            <UInput v-model="amountFrom" type="number" min="0" class="w-full text-right">
              <template #leading>
                <span class="text-prohealth-400 text-sm">$</span>
              </template>
              <template v-if="amountFrom" #trailing>
                <UButton color="neutral" variant="ghost" size="xs" icon="i-lucide-x" @click="clearAmountFrom" />
              </template>
            </UInput>
          </UFormField>

          <UFormField :label="t('commissions.payoutGenerate.fields.amountTo')">
            <UInput v-model="amountTo" type="number" min="0" class="w-full text-right">
              <template #leading>
                <span class="text-prohealth-400 text-sm">$</span>
              </template>
              <template v-if="amountTo" #trailing>
                <UButton color="neutral" variant="ghost" size="xs" icon="i-lucide-x" @click="clearAmountTo" />
              </template>
            </UInput>
          </UFormField>

          <UFormField :label="t('commissions.payoutGenerate.fields.campaign')">
            <CommonEntityReferenceSelect
              v-model="campaignUuid"
              :search="searchCampaigns"
              entity="campaign"
              icon="i-lucide-rocket"
              :placeholder="t('common.select')"
              @navigate="goToLinkedRecord"
            />
          </UFormField>

          <UFormField :label="t('commissions.payoutGenerate.fields.rank')">
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
            {{ t('commissions.payoutGenerate.clearAll') }}
          </UButton>
          <UButton color="primary" variant="outline" icon="i-lucide-refresh-cw" :loading="loading" @click="load">
            {{ t('commissions.payoutGenerate.refreshButton') }}
          </UButton>
        </div>
      </div>
    </div>

    <!-- Table: fixed height + internal scroll, sticky header -->
    <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden flex flex-col h-[calc(100vh-26rem)] min-h-[20rem]">
      <div class="overflow-auto flex-1">
        <table class="w-full text-sm">
          <thead class="sticky top-0 bg-white z-10">
            <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
              <th class="px-4 py-2.5 w-8">
                <UCheckbox
                  :model-value="masterState"
                  :disabled="payableRows.length === 0"
                  @update:model-value="(v: boolean | 'indeterminate') => toggleAll(v === true)"
                />
              </th>
              <th class="px-4 py-2.5 font-semibold cursor-pointer select-none" @click="sort.toggle('promoter_Display')">
                {{ t('commissions.payoutGenerate.columns.promoter') }}
                <SortIndicator :state="sort.stateOf('promoter_Display')" :multi-active="isMultiSort" @clear="sort.remove('promoter_Display')" />
              </th>
              <th class="px-4 py-2.5 font-semibold cursor-pointer select-none" @click="sort.toggle('appliesTo')">
                {{ t('commissions.payoutGenerate.columns.appliesTo') }}
                <SortIndicator :state="sort.stateOf('appliesTo')" :multi-active="isMultiSort" @clear="sort.remove('appliesTo')" />
              </th>
              <th class="px-4 py-2.5 font-semibold text-right cursor-pointer select-none" @click="sort.toggle('amount')">
                {{ t('commissions.payoutGenerate.columns.amount') }}
                <SortIndicator :state="sort.stateOf('amount')" :multi-active="isMultiSort" @clear="sort.remove('amount')" />
              </th>
              <th class="px-4 py-2.5 font-semibold cursor-pointer select-none" @click="sort.toggle('earnedAt')">
                {{ t('commissions.payoutGenerate.columns.earnedAt') }}
                <SortIndicator :state="sort.stateOf('earnedAt')" :multi-active="isMultiSort" @clear="sort.remove('earnedAt')" />
              </th>
              <th class="px-4 py-2.5 font-semibold cursor-pointer select-none" @click="sort.toggle('status')">
                {{ t('commissions.payoutGenerate.columns.status') }}
                <SortIndicator :state="sort.stateOf('status')" :multi-active="isMultiSort" @clear="sort.remove('status')" />
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-prohealth-100">
            <TableSkeleton v-if="loading" :rows="8" :cols="6" />
            <tr v-else-if="data.length === 0">
              <td colspan="6" class="px-4 py-12 text-center text-prohealth-500">
                <UIcon name="i-lucide-inbox" class="w-8 h-8 mx-auto mb-2 text-prohealth-300" />
                {{ t('commissions.payoutGenerate.empty') }}
              </td>
            </tr>
            <tr v-for="row in data" v-else :key="row.uuid" class="hover:bg-prohealth-50/50">
              <td class="px-4 py-2.5">
                <UCheckbox
                  :model-value="selected.has(row.uuid)"
                  :disabled="!isPayableCommissionRow(row)"
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
              <td class="px-4 py-2.5 text-prohealth-700">{{ row.appliesTo_Display || row.appliesTo }}</td>
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
          </tbody>
        </table>
      </div>
    </div>

    <!-- Single sticky footer: pagination + selection summary (left) and generate payout (right) -->
    <div class="sticky bottom-0 z-10 bg-white border-t border-prohealth-100 shadow-[0_-2px_8px_rgba(0,0,0,0.04)] px-5 py-3 rounded-t-2xl flex flex-wrap items-center justify-between gap-3">
      <div class="flex flex-wrap items-center gap-4">
        <p class="text-xs text-prohealth-500">
          {{ t('commissions.payoutGenerate.paginationSummary', { shown: data.length, total }) }}
        </p>
        <span class="text-sm text-prohealth-500">
          {{ t('commissions.payoutGenerate.selectedCount', { count: selectedCount }) }}
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
        </div>
      </div>
      <UButton
        v-if="canGeneratePayout"
        color="primary"
        icon="i-lucide-banknote"
        :disabled="selectedCount === 0"
        @click="payoutOpen = true"
      >
        {{ t('commissions.payoutGenerate.generatePayoutButton') }}
      </UButton>
    </div>

    <CommissionPayoutBySelectionModal
      v-model:open="payoutOpen"
      :commission-uuids="[...selected]"
      @success="onPayoutDone"
    />
  </div>
</template>
