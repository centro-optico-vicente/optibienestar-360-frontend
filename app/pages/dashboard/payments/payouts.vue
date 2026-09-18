<script setup lang="ts">
import { buildPageSizeItems, DEFAULT_PAGE_SIZE, UNPAGED_PAGE_SIZE } from '~/utils/pagination'
import type { PaymentDto } from '~/types/payments'
import { paymentStatusColor } from '~/types/payments'
import type { SortDirection } from '~/composables/useTableSort'

// "Pagos" (Finanzas, hub plan payments-unification, §"Pantallas requeridas" #5) —
// direction=OUT payments (commission payouts), always already APPROVED and
// written only by CommissionPayoutService (/v1/admin/commissions/payout). Read-only
// by design: unlike the IN "Pagos" screen, there is no register/approve/reject
// workflow here — the admin executes payouts through the commission period-close
// action, this screen is just the resulting ledger.
definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'PAYMENT_VIEW_ALL',
})

const { t } = useI18n()
const { formatDate } = useFormatters()

useSeoMeta({ title: () => t('common.seoTitle', { page: t('payments.payouts.title') }) })

const payments = usePayments()
const { can } = usePermissions()

const canViewPromoter = computed(() => can('PROMOTER_VIEW_ALL'))

const data = ref<PaymentDto[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1) // UPagination is 1-based; the API is 0-based
const size = ref(DEFAULT_PAGE_SIZE)
const pageSizeItems = buildPageSizeItems(t)
const search = ref('')
// Empty by default: no `sort=` is sent until the user clicks a column, so
// the backend's own default-sort fallback applies — same as the IN screen.
const sort = useTableSort([])
const hasActiveSort = computed(() => sort.hasActiveSort.value)
const isMultiSort = computed(() => sort.orders.value.length > 1)

async function load() {
  loading.value = true
  try {
    const res = await payments.list({
      page: page.value - 1,
      size: size.value,
      sort: sort.sortParam.value,
      // Fixed — this screen only ever shows commission payouts, never collections.
      direction: 'OUT',
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

// ---- Detail (read-only modal — no approve/reject/delete for OUT rows) ----
const detailOpen = ref(false)
const detail = ref<PaymentDto | null>(null)

function openDetail(p: PaymentDto) {
  detail.value = p
  detailOpen.value = true
}
</script>

<template>
  <div class="space-y-5">
    <!-- Header -->
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-extrabold text-prohealth-900">{{ t('payments.payouts.title') }}</h1>
        <p class="text-sm text-prohealth-700/70 mt-1">{{ t('payments.payouts.subtitle') }}</p>
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
        :placeholder="t('payments.payouts.searchPlaceholder')"
        icon="i-lucide-search"
        size="lg"
        class="w-full max-w-md"
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
              <th class="px-5 py-3 font-semibold">{{ t('payments.payouts.columns.promoter') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('payments.payouts.columns.category') }}</th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('amount')">
                {{ t('payments.columns.amount') }}
                <SortIndicator :state="sort.stateOf('amount')" :multi-active="isMultiSort" @clear="sort.remove('amount')" />
              </th>
              <th class="px-5 py-3 font-semibold">{{ t('payments.payouts.columns.reference') }}</th>
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
                <UIcon name="i-lucide-banknote" class="w-8 h-8 mx-auto mb-2 text-prohealth-300" />
                {{ t('payments.payouts.empty') }}
              </td>
            </tr>
            <tr
              v-for="p in data"
              v-else
              :key="p.uuid"
              class="hover:bg-prohealth-50/50 cursor-pointer"
              @click="openDetail(p)"
            >
              <td class="px-5 py-3" @click.stop>
                <CommonEntityLinkCell
                  :to="p.promoter_Uuid ? `/dashboard/promoters/${p.promoter_Uuid}` : null"
                  :label="p.promoter_Display"
                  :can="canViewPromoter"
                />
              </td>
              <td class="px-5 py-3 text-prohealth-800">{{ p.paymentType_Display ?? t('common.empty') }}</td>
              <td class="px-5 py-3 font-medium text-prohealth-900">{{ p.amount_Display ?? p.amount }}</td>
              <td class="px-5 py-3 text-prohealth-600 font-mono">{{ p.referenceNumber || t('common.empty') }}</td>
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

    <!-- Detail modal (read-only) -->
    <UModal v-model:open="detailOpen" :title="t('payments.payouts.detailTitle')">
      <template #body>
        <dl v-if="detail" class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('payments.payouts.columns.promoter') }}</dt>
            <dd class="mt-0.5">
              <CommonEntityLinkCell
                :to="detail.promoter_Uuid ? `/dashboard/promoters/${detail.promoter_Uuid}` : null"
                :label="detail.promoter_Display"
                :can="canViewPromoter"
              />
            </dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('payments.payouts.columns.category') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ detail.paymentType_Display ?? t('common.empty') }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('payments.columns.amount') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ detail.amount_Display ?? detail.amount }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('payments.payouts.columns.method') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ detail.paymentMethod ?? t('common.empty') }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('payments.payouts.columns.reference') }}</dt>
            <dd class="text-prohealth-800 mt-0.5 font-mono break-all">{{ detail.referenceNumber || t('common.empty') }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('payments.columns.date') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ detail.paymentDate_Display ?? formatDate(detail.paymentDate, 'short') }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('payments.columns.status') }}</dt>
            <dd class="mt-0.5">
              <UBadge :color="paymentStatusColor(detail.status)" variant="subtle" size="sm">
                {{ detail.status_Display ?? statusLabel(detail.status) }}
              </UBadge>
            </dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('payments.payouts.columns.reviewedBy') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ detail.reviewedBy_Display || t('common.empty') }}</dd>
          </div>
        </dl>
      </template>
      <template #footer>
        <div class="w-full flex justify-end">
          <UButton color="neutral" variant="ghost" @click="detailOpen = false">{{ t('common.close') }}</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
