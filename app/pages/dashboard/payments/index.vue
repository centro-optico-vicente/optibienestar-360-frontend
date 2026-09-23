<script setup lang="ts">
import { buildPageSizeItems, DEFAULT_PAGE_SIZE, UNPAGED_PAGE_SIZE } from '~/utils/pagination'
import type { PaymentDto, PaymentStatus } from '~/types/payments'
import { PAYMENT_STATUS_OPTIONS, paymentStatusColor } from '~/types/payments'
import type { SortDirection } from '~/composables/useTableSort'

// "Pagos" is the administrative OUT ledger for commission payouts and manual
// payment entries, including their review workflow.
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
const canViewCurrency = computed(() => can('CURRENCY_VIEW_ALL'))
const canCreate = computed(() => can('PAYMENT_CREATE'))
const canUpdate = computed(() => can('PAYMENT_UPDATE'))
const canDelete = computed(() => can('PAYMENT_DELETE'))
const canProcess = computed(() => can('PAYMENT_PROCESS'))
const canApprove = computed(() => can('PAYMENT_APPROVE'))
const canReject = computed(() => can('PAYMENT_REJECT'))
const canExceptionCreate = computed(() => can('CAMPAIGN_EXCEPTION_CREATE'))

// ---- Campaign exception (Part G): row action to include/exclude a payment ----
const exceptionOpen = ref(false)
const exceptionPayment = ref<PaymentDto | null>(null)
function openExceptionModal(p: PaymentDto) {
  exceptionPayment.value = p
  exceptionOpen.value = true
}

const data = ref<PaymentDto[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1) // UPagination is 1-based; the API is 0-based
const size = ref(DEFAULT_PAGE_SIZE)
const pageSizeItems = buildPageSizeItems(t)
const search = ref('')
const statusFilter = ref<PaymentStatus | null>(null)
// Empty by default: no `sort=` is sent until the user clicks a column, so
// the backend's own default-sort fallback applies — same as the IN screen.
const sort = useTableSort([])
const hasActiveSort = computed(() => sort.hasActiveSort.value)
const isMultiSort = computed(() => sort.orders.value.length > 1)

const statusFilterOptions = computed(() => [
  { label: t('payments.statusFilterAll'), value: null },
  ...PAYMENT_STATUS_OPTIONS.map(o => ({ label: t(o.labelKey), value: o.value })),
])

function buildFilter(): string | undefined {
  return statusFilter.value ? `status==${statusFilter.value}` : undefined
}

async function load() {
  loading.value = true
  try {
    const res = await payments.list({
      page: page.value - 1,
      size: size.value,
      sort: sort.sortParam.value,
      filter: buildFilter(),
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
watch(statusFilter, () => {
  if (!resetting.value) { page.value = 1; load() }
})
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
  statusFilter.value = null
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

function methodLabel(m?: string | null): string {
  return m ? t(`payments.methods.${m}`, m) : t('common.empty')
}

// ---- Detail and DRAFT workflow ----
const detailOpen = ref(false)
const detail = ref<PaymentDto | null>(null)
const formOpen = ref(false)
const formTarget = ref<PaymentDto | null>(null)
const deleting = ref(false)

function openDetail(p: PaymentDto) {
  detail.value = p
  detailOpen.value = true
}

function openCreate() {
  formTarget.value = null
  formOpen.value = true
}

function openEdit(p: PaymentDto) {
  formTarget.value = p
  formOpen.value = true
}

async function onSaved() {
  formOpen.value = false
  await load()
}

async function removePayment(p: PaymentDto) {
  if (!window.confirm(t('payments.payouts.deleteConfirm'))) return
  deleting.value = true
  try {
    await payments.removeOut(p.uuid)
    detailOpen.value = false
    await load()
  }
  catch {
    // useApi already reports the API error.
  }
  finally {
    deleting.value = false
  }
}

async function processPayment(p: PaymentDto) {
  try {
    await payments.processOut(p.uuid)
    await load()
  }
  catch {
    // useApi already reports the API error.
  }
}

async function reviewPayment(p: PaymentDto, approve: boolean) {
  const reason = approve ? undefined : window.prompt('Motivo del rechazo')
  if (!approve && !reason?.trim()) return
  try {
    if (approve) await payments.approveOut(p.uuid)
    else await payments.rejectOut(p.uuid, reason!.trim())
    detailOpen.value = false
    await load()
  }
  catch {
    // useApi already reports the API error.
  }
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
        <ReportPrintButton table-name="payments" :search-query="search" variant="ghost" />
        <UTooltip :text="canCreate ? t('payments.createTooltip') : t('payments.noPermissionRegister')">
          <UButton color="primary" variant="outline" icon="i-lucide-plus" :disabled="!canCreate" @click="openCreate">
            {{ t('common.new') }}
          </UButton>
        </UTooltip>
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
      <USelectMenu
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
              <th class="px-5 py-3 font-semibold">{{ t('payments.payouts.columns.promoter') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('payments.payouts.columns.category') }}</th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('amount')">
                {{ t('payments.columns.amount') }}
                <SortIndicator :state="sort.stateOf('amount')" :multi-active="isMultiSort" @clear="sort.remove('amount')" />
              </th>
              <th class="px-5 py-3 font-semibold">{{ t('payments.payouts.columns.method') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('payments.payouts.columns.reference') }}</th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('paymentDate')">
                {{ t('payments.columns.date') }}
                <SortIndicator :state="sort.stateOf('paymentDate')" :multi-active="isMultiSort" @clear="sort.remove('paymentDate')" />
              </th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('status')">
                {{ t('payments.columns.status') }}
                <SortIndicator :state="sort.stateOf('status')" :multi-active="isMultiSort" @clear="sort.remove('status')" />
              </th>
              <th class="px-5 py-3 font-semibold text-right">{{ t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-prohealth-100">
            <TableSkeleton v-if="loading" :rows="8" :cols="8" />
            <tr v-else-if="data.length === 0">
              <td colspan="8" class="px-5 py-12 text-center text-prohealth-500">
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
              <td class="px-5 py-3 font-semibold text-prohealth-900">
                <MoneyWithTooltip :display="p.amount_Display" :converted-display="p.amountConverted_Display" :rate-date="p.exchangeRateDate" />
                <div class="text-xs font-normal mt-0.5" @click.stop>
                  <CommonEntityLinkCell
                    :to="p.currency_Uuid ? `/dashboard/catalogs/currencies?edit=${p.currency_Uuid}` : null"
                    :label="p.currency_Display || p.currency_Code"
                    :can="canViewCurrency"
                  />
                </div>
              </td>
              <td class="px-5 py-3 text-prohealth-600">
                {{ p.paymentMethod_Display ?? methodLabel(p.paymentMethod) }}
              </td>
              <td class="px-5 py-3 text-prohealth-600 font-mono">{{ p.referenceNumber || t('common.empty') }}</td>
              <td class="px-5 py-3 text-prohealth-600">{{ p.paymentDate_Display ?? formatDate(p.paymentDate, 'datetime') }}</td>
              <td class="px-5 py-3">
                <UBadge :color="paymentStatusColor(p.status)" variant="subtle" size="sm">
                  {{ p.status_Display ?? statusLabel(p.status) }}
                </UBadge>
              </td>
              <td class="px-5 py-3" @click.stop>
                <div class="flex items-center justify-end gap-1">
                  <UTooltip :text="t('payments.tooltips.viewDetail')">
                    <UButton
                      color="neutral"
                      variant="ghost"
                      icon="i-lucide-eye"
                      size="sm"
                      @click="openDetail(p)"
                    />
                  </UTooltip>
                  <UTooltip v-if="canUpdate && p.status === 'DRAFT'" :text="t('common.edit')">
                    <UButton color="neutral" variant="ghost" icon="i-lucide-pencil" size="sm" @click="openEdit(p)" />
                  </UTooltip>
                  <UTooltip v-if="canDelete && p.status === 'DRAFT'" :text="t('common.delete')">
                    <UButton color="error" variant="ghost" icon="i-lucide-trash-2" size="sm" :loading="deleting" @click="removePayment(p)" />
                  </UTooltip>
                  <UButton v-if="canProcess && p.status === 'DRAFT'" color="primary" variant="ghost" icon="i-lucide-send" size="sm" @click="processPayment(p)" />
                  <UButton v-if="canApprove && p.status === 'PENDING'" color="success" variant="ghost" icon="i-lucide-check" size="sm" @click="reviewPayment(p, true)" />
                  <UButton v-if="canReject && p.status === 'PENDING'" color="error" variant="ghost" icon="i-lucide-x" size="sm" @click="reviewPayment(p, false)" />
                  <UTooltip v-if="canExceptionCreate" :text="t('campaigns.exceptions.addRowTooltip')">
                    <UButton color="neutral" variant="ghost" icon="i-lucide-rocket" size="sm" @click="openExceptionModal(p)" />
                  </UTooltip>
                  <ReportPrintButton
                    table-name="payments"
                    :record-uuid="p.uuid"
                    icon-only
                    variant="ghost"
                    size="sm"
                  />
                </div>
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
            <dd class="text-prohealth-800 mt-0.5">{{ detail.paymentMethod_Display ?? methodLabel(detail.paymentMethod) }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('payments.payouts.columns.reference') }}</dt>
            <dd class="text-prohealth-800 mt-0.5 font-mono break-all">{{ detail.referenceNumber || t('common.empty') }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('payments.columns.date') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ detail.paymentDate_Display ?? formatDate(detail.paymentDate, 'datetime') }}</dd>
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
        <div class="w-full flex items-center justify-between">
          <ReportPrintButton
            v-if="detail"
            table-name="payments"
            :record-uuid="detail.uuid"
            size="sm"
          />
          <UButton color="neutral" variant="ghost" @click="detailOpen = false">{{ t('common.close') }}</UButton>
          <UButton v-if="detail && canUpdate && detail.status === 'DRAFT'" color="primary" variant="outline" @click="detailOpen = false; openEdit(detail)">
            {{ t('common.edit') }}
          </UButton>
          <UButton v-if="detail && canDelete && detail.status === 'DRAFT'" color="error" variant="outline" :loading="deleting" @click="removePayment(detail)">
            {{ t('common.delete') }}
          </UButton>
        </div>
      </template>
    </UModal>
    <OutPaymentFormModal v-model:open="formOpen" :payment="formTarget" @saved="onSaved" />
    <CampaignExceptionFormModal
      v-model:open="exceptionOpen"
      :payment-uuid="exceptionPayment?.uuid"
      :payment-display="exceptionPayment?.referenceNumber || exceptionPayment?.promoter_Display"
    />
  </div>
</template>
