<script setup lang="ts">
import { buildPageSizeItems, DEFAULT_PAGE_SIZE, UNPAGED_PAGE_SIZE } from '~/utils/pagination'
import type { PaymentDto, PaymentStatus } from '~/types/payments'
import { PAYMENT_STATUS_OPTIONS, paymentStatusColor } from '~/types/payments'
import type { SortDirection } from '~/composables/useTableSort'

// "Movimientos" (hub plan payments-unification, §"Pantallas requeridas" #6) —
// master admin view over BOTH directions (IN collections + OUT commission
// payouts) in one table, for whoever needs full visibility (e.g. gerencia/
// finanzas) even though confirming cobros and executing pagos are done by
// different people on their own screens (#4 "Pagos"/future "Cobros
// generales" and #5 "Pagos generales"). Read-only — same reasoning as
// "Pagos generales".
definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'PAYMENT_VIEW_ALL',
})

const { t } = useI18n()
const { formatDate } = useFormatters()

useSeoMeta({ title: () => t('common.seoTitle', { page: t('payments.movements.title') }) })

const payments = usePayments()

const data = ref<PaymentDto[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1) // UPagination is 1-based; the API is 0-based
const size = ref(DEFAULT_PAGE_SIZE)
const pageSizeItems = buildPageSizeItems(t)
const search = ref('')
const directionFilter = ref<'IN' | 'OUT' | ''>('')
const statusFilter = ref<PaymentStatus | ''>('')
const sort = useTableSort([])
const hasActiveSort = computed(() => sort.hasActiveSort.value)
const isMultiSort = computed(() => sort.orders.value.length > 1)

const directionFilterOptions = computed(() => [
  { label: t('payments.movements.directionAll'), value: '' },
  { label: t('payments.movements.directionIn'), value: 'IN' },
  { label: t('payments.movements.directionOut'), value: 'OUT' },
])
const statusFilterOptions = computed(() => [
  { label: t('payments.statusFilterAll'), value: '' },
  ...PAYMENT_STATUS_OPTIONS.map(o => ({ label: t(o.labelKey), value: o.value })),
])

function buildFilter(): string | undefined {
  const clauses: string[] = []
  // Explicit direction==<x> when picked; the RSQL "in" form when left on
  // "Todos" so both directions show — PaymentsService only applies its own
  // IN-only default when the filter string doesn't mention `direction` at all.
  clauses.push(directionFilter.value ? `direction==${directionFilter.value}` : 'direction=in=(IN,OUT)')
  if (statusFilter.value) clauses.push(`status==${statusFilter.value}`)
  return clauses.join(';')
}

async function load() {
  loading.value = true
  try {
    const res = await payments.list({
      page: page.value - 1,
      size: size.value,
      sort: sort.sortParam.value,
      filter: buildFilter(),
      q: search.value.trim() || undefined,
    })
    data.value = res.content ?? []
    total.value = res.totalElements ?? 0
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

const resetting = ref(false)

watch(size, () => { if (!resetting.value) page.value = 1 })
watch([page, size], () => { if (!resetting.value) load() })
watch([directionFilter, statusFilter], () => { if (!resetting.value) { page.value = 1; load() } })
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, () => {
  if (resetting.value) return
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    load()
  }, 400)
})
watch(sort.orders, () => { if (!resetting.value) load() }, { deep: true })

async function resetFilters() {
  resetting.value = true
  search.value = ''
  directionFilter.value = ''
  statusFilter.value = ''
  sort.reset()
  size.value = DEFAULT_PAGE_SIZE
  page.value = 1
  await nextTick()
  resetting.value = false
  load()
}

onMounted(load)

function statusLabel(s?: string | null): string {
  return s ? t(`payments.status.${s}`, s) : t('common.empty')
}

function subjectDisplay(p: PaymentDto): string {
  // IN -> the affiliate who paid; OUT -> the promoter who was paid.
  return (p.direction === 'OUT' ? p.promoter_Display : p.member_Display) ?? t('common.empty')
}
</script>

<template>
  <div class="space-y-5">
    <!-- Header -->
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-extrabold text-prohealth-900">{{ t('payments.movements.title') }}</h1>
        <p class="text-sm text-prohealth-700/70 mt-1">{{ t('payments.movements.subtitle') }}</p>
      </div>
      <div class="flex items-center gap-2">
        <ListRefreshMenu :loading="loading" variant="ghost" @refresh="load" @reset="resetFilters" />
        <ReportPrintButton variant="ghost" />
      </div>
    </div>

    <!-- Filters -->
    <div class="bg-white rounded-2xl border border-prohealth-100 p-4 flex flex-wrap items-center gap-3">
      <UInput
        v-model="search"
        :placeholder="t('payments.movements.searchPlaceholder')"
        icon="i-lucide-search"
        size="lg"
        class="w-full max-w-md"
      />
      <USelectMenu
        v-model="directionFilter"
        :items="directionFilterOptions"
        label-key="label"
        value-key="value"
        icon="i-lucide-arrow-left-right"
        class="w-40"
      />
      <USelectMenu
        clear
        v-model="statusFilter"
        :items="statusFilterOptions"
        label-key="label"
        value-key="value"
        :placeholder="t('payments.statusFilterPlaceholder')"
        icon="i-lucide-filter"
        class="w-44"
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

    <!-- Table -->
    <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden flex flex-col h-[calc(100vh-19rem)] min-h-[24rem]">
      <div class="overflow-auto flex-1">
        <table class="w-full text-sm">
          <thead class="sticky top-0 bg-white z-10">
            <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
              <th class="px-5 py-3 font-semibold">{{ t('payments.movements.columns.direction') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('payments.movements.columns.subject') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('payments.payouts.columns.category') }}</th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('amount')">
                {{ t('payments.columns.amount') }}
                <SortIndicator :state="sort.stateOf('amount')" :multi-active="isMultiSort" @clear="sort.remove('amount')" />
              </th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('paymentDate')">
                {{ t('payments.columns.date') }}
                <SortIndicator :state="sort.stateOf('paymentDate')" :multi-active="isMultiSort" @clear="sort.remove('paymentDate')" />
              </th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('status')">
                {{ t('payments.columns.status') }}
                <SortIndicator :state="sort.stateOf('status')" :multi-active="isMultiSort" @clear="sort.remove('status')" />
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-prohealth-100">
            <TableSkeleton v-if="loading" :rows="8" :cols="6" />
            <tr v-else-if="data.length === 0">
              <td colspan="6" class="px-5 py-12 text-center text-prohealth-500">
                <UIcon name="i-lucide-arrow-left-right" class="w-8 h-8 mx-auto mb-2 text-prohealth-300" />
                {{ t('payments.movements.empty') }}
              </td>
            </tr>
            <tr
              v-for="p in data"
              v-else
              :key="p.uuid"
              class="hover:bg-prohealth-50/50 cursor-pointer"
              @click="navigateTo(p.direction === 'OUT' ? '/dashboard/payments/payouts' : `/dashboard/payments/${p.uuid}`)"
            >
              <td class="px-5 py-3">
                <UBadge :color="p.direction === 'OUT' ? 'warning' : 'primary'" variant="subtle" size="sm">
                  {{ p.direction === 'OUT' ? t('payments.movements.directionOut') : t('payments.movements.directionIn') }}
                </UBadge>
              </td>
              <td class="px-5 py-3 text-prohealth-800">{{ subjectDisplay(p) }}</td>
              <td class="px-5 py-3 text-prohealth-600">{{ p.paymentType_Display ?? t('common.empty') }}</td>
              <td class="px-5 py-3 font-medium text-prohealth-900">{{ p.amount_Display ?? p.amount }}</td>
              <td class="px-5 py-3 text-prohealth-600">{{ p.paymentDate_Display ?? formatDate(p.paymentDate, 'short') }}</td>
              <td class="px-5 py-3">
                <UBadge :color="paymentStatusColor(p.status)" variant="subtle" size="sm">
                  {{ p.status_Display ?? statusLabel(p.status) }}
                </UBadge>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t border-prohealth-100 shrink-0">
        <p class="text-xs text-prohealth-500">{{ t('catalogs.recordCount', { count: total }) }}</p>
        <div class="flex items-center gap-3">
          <UPagination v-if="size !== UNPAGED_PAGE_SIZE" v-model:page="page" :total="total" :items-per-page="size" />
          <UTooltip :text="t('catalogs.pageSizeLabel')">
            <USelectMenu
              v-model="size"
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
