<script setup lang="ts">
import { buildPageSizeItems, DEFAULT_PAGE_SIZE, UNPAGED_PAGE_SIZE } from '~/utils/pagination'
import type { CommissionDto, CommissionStatus } from '~/types/promoters'
import type { SortDirection } from '~/composables/useTableSort'

definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'COMMISSION_VIEW_ALL',
})

const { t } = useI18n()
const { formatCurrency, formatDate } = useFormatters()

useSeoMeta({ title: () => t('common.seoTitle', { page: t('nav.items.commissions.label') }) })

const commissions = useCommissions()
const { can } = usePermissions()

const canPayout = computed(() => can('COMMISSION_PAYOUT'))
const canReRate = computed(() => can('COMMISSION_RE_RATE'))

// ---- Listing + filters + pagination (read-only ledger; no create/edit/delete) ----
const data = ref<CommissionDto[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1) // UPagination is 1-based; the API is 0-based
const size = ref(DEFAULT_PAGE_SIZE)
const pageSizeItems = buildPageSizeItems(t)
const search = ref('')
const filter = ref('') // raw RSQL, e.g. `promoter.uuid==…;status==PENDING`
const includeInactive = ref(false)
// Empty by default: no `sort=` is sent until the user clicks a column, so
// the backend's own default-sort fallback (entity_config → system_configs
// → earnedAt DESC) applies.
const sort = useTableSort([])
const hasActiveSort = computed(() => sort.hasActiveSort.value)
const isMultiSort = computed(() => sort.orders.value.length > 1)

async function load() {
  loading.value = true
  try {
    const res = await commissions.list({
      page: page.value - 1,
      size: size.value,
      sort: sort.sortParam.value,
      filter: filter.value.trim() || undefined,
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

// Guards the watchers below so restoring the default filters fires a single
// reload instead of one per changed ref.
const resetting = ref(false)

watch(size, () => { if (!resetting.value) page.value = 1 })
watch([page, size], () => { if (!resetting.value) load() })
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch([search, filter], () => {
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
  filter.value = ''
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
// Amount in the commission's currency, formatted in the VE convention. Empty → '—'.
function money(v?: number | string | null, currency?: string | null): string {
  if (v === null || v === undefined || v === '') return t('common.empty')
  return formatCurrency(Number(v), currency || 'USD')
}

// Percentage (XOR with flatAmount). Empty → '—'.
function pct(v?: number | null): string {
  return v === null || v === undefined ? t('common.empty') : `${v}%`
}

// Calculation column: percentage when present, otherwise the flat amount.
function calcLabel(c: CommissionDto): string {
  if (c.commissionPct !== null && c.commissionPct !== undefined) return `${c.commissionPct}%`
  return money(c.flatAmount, c.currency)
}

// Enum label resolvers (fall back to the raw value).
function statusLabel(s?: string | null): string {
  return s ? t(`commissions.status.${s}`, s) : t('common.empty')
}
function appliesToLabel(a?: string | null): string {
  return a ? t(`commissions.appliesTo.${a}`, a) : t('common.empty')
}

// Status badge color (Nuxt UI palette).
function statusColor(value?: CommissionStatus | string | null): 'warning' | 'success' | 'neutral' | 'error' {
  switch (value) {
    case 'PENDING': return 'warning'
    case 'PAID': return 'success'
    case 'VOIDED': return 'neutral'
    case 'DISPUTED': return 'error'
    default: return 'neutral'
  }
}

// ---- Read-only detail (modal) ----
const detailOpen = ref(false)
const detail = ref<CommissionDto | null>(null)
const detailLoading = ref(false)

async function openDetail(row: CommissionDto) {
  detailOpen.value = true
  detailLoading.value = true
  detail.value = null
  try {
    detail.value = await commissions.get(row.uuid)
  }
  catch {
    // If the detail fails to load, fall back to the list row.
    detail.value = row
  }
  finally {
    detailLoading.value = false
  }
}

// ---- Payout (close a period; modal) ----
const payoutOpen = ref(false)

async function onPayoutDone() {
  // Commissions in the range moved to PAID; reload honoring the current filter.
  page.value = 1
  await load()
}

// ---- Re-rating (month-close retroactive band bump; modal) ----
const reRatingOpen = ref(false)

async function onReRatingDone() {
  // PENDING inscription commissions in the range were recomputed; reload.
  page.value = 1
  await load()
}
</script>

<template>
  <div class="space-y-5">
    <!-- Header -->
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-extrabold text-prohealth-900">{{ t('commissions.title') }}</h1>
        <p class="text-sm text-prohealth-700/70 mt-1">
          {{ t('commissions.subtitle') }}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <ListRefreshMenu :loading="loading" variant="ghost" @refresh="load" @reset="resetFilters" />
        <ReportPrintButton variant="ghost" />
        <UButton
          v-if="canReRate"
          color="neutral"
          variant="outline"
          icon="i-lucide-refresh-cw"
          @click="reRatingOpen = true"
        >
          {{ t('commissions.reRating.button') }}
        </UButton>
        <UButton
          v-if="canPayout"
          color="primary"
          icon="i-lucide-wallet"
          @click="payoutOpen = true"
        >
          {{ t('commissions.payout.button') }}
        </UButton>
      </div>
    </div>

    <!-- Filters -->
    <div class="bg-white rounded-2xl border border-prohealth-100 p-4 flex flex-wrap items-center gap-3">
      <UInput
        v-model="search"
        :placeholder="t('commissions.searchPlaceholder')"
        icon="i-lucide-search"
        size="lg"
        class="w-full max-w-md"
      />
      <UInput
        v-model="filter"
        :placeholder="t('commissions.filterPlaceholder')"
        icon="i-lucide-filter"
        size="lg"
        class="w-full max-w-md font-mono"
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
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('promoter_Display')">
                {{ t('commissions.columns.promoter') }}
                <SortIndicator :state="sort.stateOf('promoter_Display')" :multi-active="isMultiSort" @clear="sort.remove('promoter_Display')" />
              </th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('amount')">
                {{ t('commissions.columns.amount') }}
                <SortIndicator :state="sort.stateOf('amount')" :multi-active="isMultiSort" @clear="sort.remove('amount')" />
              </th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('calculationBasis')">
                {{ t('commissions.columns.calc') }}
                <SortIndicator :state="sort.stateOf('calculationBasis')" :multi-active="isMultiSort" @clear="sort.remove('calculationBasis')" />
              </th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('appliesTo')">
                {{ t('commissions.columns.appliesTo') }}
                <SortIndicator :state="sort.stateOf('appliesTo')" :multi-active="isMultiSort" @clear="sort.remove('appliesTo')" />
              </th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('status')">
                {{ t('commissions.columns.status') }}
                <SortIndicator :state="sort.stateOf('status')" :multi-active="isMultiSort" @clear="sort.remove('status')" />
              </th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('earnedAt')">
                {{ t('commissions.columns.earnedAt') }}
                <SortIndicator :state="sort.stateOf('earnedAt')" :multi-active="isMultiSort" @clear="sort.remove('earnedAt')" />
              </th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('paidAt')">
                {{ t('commissions.columns.paidAt') }}
                <SortIndicator :state="sort.stateOf('paidAt')" :multi-active="isMultiSort" @clear="sort.remove('paidAt')" />
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-prohealth-100">
            <TableSkeleton v-if="loading" :rows="8" :cols="7" />
            <tr v-else-if="data.length === 0">
              <td colspan="7" class="px-5 py-12 text-center text-prohealth-500">
                <UIcon name="i-lucide-percent" class="w-8 h-8 mx-auto mb-2 text-prohealth-300" />
                {{ t('commissions.empty') }}
              </td>
            </tr>
            <tr
              v-for="c in data"
              v-else
              :key="c.uuid"
              class="hover:bg-prohealth-50/50 cursor-pointer"
              @click="openDetail(c)"
            >
              <td class="px-5 py-3">
                <div class="font-semibold text-prohealth-900">{{ c.promoter_Display || t('common.empty') }}</div>
                <div class="text-xs text-prohealth-500 font-mono">{{ c.promoter_Code || t('common.empty') }}</div>
              </td>
              <td class="px-5 py-3 font-semibold text-prohealth-900">{{ money(c.amount, c.currency) }}</td>
              <td class="px-5 py-3 text-prohealth-700">{{ calcLabel(c) }}</td>
              <td class="px-5 py-3">
                <UBadge color="primary" variant="subtle" size="sm">{{ c.appliesTo_Display ?? appliesToLabel(c.appliesTo) }}</UBadge>
              </td>
              <td class="px-5 py-3">
                <UBadge :color="statusColor(c.status)" variant="subtle" size="sm">
                  {{ c.status_Display ?? statusLabel(c.status) }}
                </UBadge>
              </td>
              <td class="px-5 py-3 text-prohealth-600">{{ c.earnedAt_Display ?? formatDate(c.earnedAt, 'short') }}</td>
              <td class="px-5 py-3 text-prohealth-600">{{ c.paidAt ? (c.paidAt_Display ?? formatDate(c.paidAt, 'short')) : t('common.empty') }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="flex items-center flex-wrap justify-between gap-3 px-5 py-3 border-t border-prohealth-100 shrink-0">
        <p class="text-xs text-prohealth-500">
          {{ t('commissions.paginationSummary', { shown: data.length, total }) }}
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

    <!-- Read-only detail modal -->
    <UModal v-model:open="detailOpen" :title="t('commissions.detail.title')" :ui="{ content: 'max-w-2xl' }">
      <template #body>
        <div v-if="detailLoading" class="py-12 flex flex-col items-center justify-center gap-2 text-prohealth-500">
          <UIcon name="i-lucide-loader-circle" class="w-6 h-6 animate-spin" />
          <span class="text-sm">{{ t('commissions.detail.loading') }}</span>
        </div>
        <div v-else-if="detail" class="space-y-6">
          <!-- Commission -->
          <div>
            <h3 class="font-bold text-prohealth-900 mb-3">{{ t('commissions.detail.sections.commission') }}</h3>
            <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div>
                <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('commissions.detail.fields.promoter') }}</dt>
                <dd class="text-prohealth-900 mt-0.5">{{ detail.promoter_Display || t('common.empty') }}</dd>
              </div>
              <div>
                <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('commissions.detail.fields.code') }}</dt>
                <dd class="text-prohealth-800 mt-0.5 font-mono">{{ detail.promoter_Code || t('common.empty') }}</dd>
              </div>
              <div>
                <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('commissions.detail.fields.amount') }}</dt>
                <dd class="text-prohealth-900 text-lg font-semibold mt-0.5">{{ money(detail.amount, detail.currency) }}</dd>
              </div>
              <div>
                <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('commissions.detail.fields.status') }}</dt>
                <dd class="mt-0.5">
                  <UBadge :color="statusColor(detail.status)" variant="subtle" size="sm">
                    {{ detail.status_Display ?? statusLabel(detail.status) }}
                  </UBadge>
                </dd>
              </div>
              <div>
                <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('commissions.detail.fields.appliesTo') }}</dt>
                <dd class="mt-0.5">
                  <UBadge color="primary" variant="subtle" size="sm">{{ detail.appliesTo_Display ?? appliesToLabel(detail.appliesTo) }}</UBadge>
                </dd>
              </div>
              <div>
                <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('commissions.detail.fields.active') }}</dt>
                <dd class="text-prohealth-800 mt-0.5">{{ detail.active ? t('common.yes') : t('common.no') }}</dd>
              </div>
            </dl>
          </div>

          <!-- Calculation -->
          <div>
            <h3 class="font-bold text-prohealth-900 mb-3">{{ t('commissions.detail.sections.calculation') }}</h3>
            <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div>
                <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('commissions.detail.fields.calculationBasis') }}</dt>
                <dd class="text-prohealth-800 mt-0.5">{{ money(detail.calculationBasis, detail.currency) }}</dd>
              </div>
              <div>
                <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('commissions.detail.fields.commissionPct') }}</dt>
                <dd class="text-prohealth-800 mt-0.5">{{ pct(detail.commissionPct) }}</dd>
              </div>
              <div>
                <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('commissions.detail.fields.flatAmount') }}</dt>
                <dd class="text-prohealth-800 mt-0.5">{{ money(detail.flatAmount, detail.currency) }}</dd>
              </div>
              <div>
                <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('commissions.detail.fields.tier') }}</dt>
                <dd class="text-prohealth-800 mt-0.5">{{ detail.tierNameSnapshot || t('common.empty') }}</dd>
              </div>
            </dl>
          </div>

          <!-- Period -->
          <div>
            <h3 class="font-bold text-prohealth-900 mb-3">{{ t('commissions.detail.sections.period') }}</h3>
            <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div>
                <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('commissions.detail.fields.periodStrategy') }}</dt>
                <dd class="text-prohealth-800 mt-0.5">{{ detail.periodStrategy || t('common.empty') }}</dd>
              </div>
              <div>
                <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('commissions.detail.fields.earnedAt') }}</dt>
                <dd class="text-prohealth-800 mt-0.5">{{ detail.earnedAt_Display ?? formatDate(detail.earnedAt, 'datetime') }}</dd>
              </div>
              <div>
                <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('commissions.detail.fields.periodStart') }}</dt>
                <dd class="text-prohealth-800 mt-0.5">{{ detail.periodStart_Display ?? formatDate(detail.periodStart, 'short') }}</dd>
              </div>
              <div>
                <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('commissions.detail.fields.periodEnd') }}</dt>
                <dd class="text-prohealth-800 mt-0.5">{{ detail.periodEnd_Display ?? formatDate(detail.periodEnd, 'short') }}</dd>
              </div>
            </dl>
          </div>

          <!-- Payout / review -->
          <div>
            <h3 class="font-bold text-prohealth-900 mb-3">{{ t('commissions.detail.sections.review') }}</h3>
            <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div>
                <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('commissions.detail.fields.payoutReference') }}</dt>
                <dd class="text-prohealth-800 mt-0.5 font-mono break-all">{{ detail.payoutReference || t('common.empty') }}</dd>
              </div>
              <div>
                <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('commissions.detail.fields.paidAt') }}</dt>
                <dd class="text-prohealth-800 mt-0.5">{{ detail.paidAt_Display ?? formatDate(detail.paidAt, 'datetime') }}</dd>
              </div>
              <div>
                <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('commissions.detail.fields.voidedAt') }}</dt>
                <dd class="text-prohealth-800 mt-0.5">{{ detail.voidedAt_Display ?? formatDate(detail.voidedAt, 'datetime') }}</dd>
              </div>
              <div>
                <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('commissions.detail.fields.voidReason') }}</dt>
                <dd class="text-prohealth-800 mt-0.5">{{ detail.voidReason || t('common.empty') }}</dd>
              </div>
              <div class="sm:col-span-2">
                <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('commissions.detail.fields.adminNotes') }}</dt>
                <dd class="text-prohealth-800 mt-0.5 whitespace-pre-line">{{ detail.adminNotes || t('common.empty') }}</dd>
              </div>
            </dl>
          </div>

          <!-- Metadata -->
          <div>
            <h3 class="font-bold text-prohealth-900 mb-3">{{ t('commissions.detail.sections.metadata') }}</h3>
            <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div>
                <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('commissions.detail.fields.promoterUuid') }}</dt>
                <dd class="text-prohealth-800 mt-0.5 font-mono text-xs break-all">{{ detail.promoter_Uuid || t('common.empty') }}</dd>
              </div>
              <div>
                <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('commissions.detail.fields.paymentUuid') }}</dt>
                <dd class="text-prohealth-800 mt-0.5 font-mono text-xs break-all">{{ detail.paymentUuid || t('common.empty') }}</dd>
              </div>
              <div>
                <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('commissions.detail.fields.memberUuid') }}</dt>
                <dd class="text-prohealth-800 mt-0.5 font-mono text-xs break-all">{{ detail.memberUuid || t('common.empty') }}</dd>
              </div>
              <div>
                <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('commissions.detail.fields.uuid') }}</dt>
                <dd class="text-prohealth-800 mt-0.5 font-mono text-xs break-all">{{ detail.uuid }}</dd>
              </div>
              <div>
                <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('commissions.detail.fields.createdAt') }}</dt>
                <dd class="text-prohealth-800 mt-0.5">{{ detail.createdAt_Display ?? formatDate(detail.createdAt, 'datetime') }}</dd>
              </div>
              <div>
                <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('commissions.detail.fields.updatedAt') }}</dt>
                <dd class="text-prohealth-800 mt-0.5">{{ detail.updatedAt_Display ?? formatDate(detail.updatedAt, 'datetime') }}</dd>
              </div>
            </dl>
          </div>

          <div class="flex items-center justify-end pt-2">
            <UButton color="neutral" variant="ghost" @click="detailOpen = false">
              {{ t('common.back') }}
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- Period payout modal -->
    <CommissionPayoutModal v-model:open="payoutOpen" @done="onPayoutDone" />

    <!-- Month-close retroactive re-rating modal -->
    <CommissionReRatingModal v-model:open="reRatingOpen" @done="onReRatingDone" />
  </div>
</template>
