<script setup lang="ts">
import { buildPageSizeItems, DEFAULT_PAGE_SIZE, UNPAGED_PAGE_SIZE } from '~/utils/pagination'
import type { PaymentDto, PaymentStatus } from '~/types/payments'
import {
  PAYMENT_STATUS_OPTIONS,
  paymentStatusColor,
} from '~/types/payments'
import type { SortDirection } from '~/composables/useTableSort'

definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'PAYMENT_VIEW_ALL',
})

const { t } = useI18n()
const { formatCurrency, formatDate } = useFormatters()

useSeoMeta({ title: () => t('common.seoTitle', { page: t('payments.title') }) })

const payments = usePayments()
const { can } = usePermissions()
const toast = useToast()

const canRegister = computed(() => can('PAYMENT_CREATE'))
const canApprove = computed(() => can('PAYMENT_APPROVE'))
const canReject = computed(() => can('PAYMENT_REJECT'))
const canDelete = computed(() => can('PAYMENT_DELETE'))
const canViewAuditChanges = computed(() => can('AUDIT_VIEW_ALL') || can('PAYMENT_RECORD_AUDIT_VIEW'))
const canViewAuditReports = computed(() => can('REPORT_AUDIT_VIEW_ALL') || can('PAYMENT_REPORT_AUDIT_VIEW'))
const canViewAudit = computed(() => canViewAuditChanges.value || canViewAuditReports.value)

const auditOpen = ref(false)
const auditTarget = ref<PaymentDto | null>(null)

function openAudit(p: PaymentDto) {
  auditTarget.value = p
  auditOpen.value = true
}

// ---- Listing + filters + pagination ----
const data = ref<PaymentDto[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1) // UPagination is 1-based; the API is 0-based
const size = ref(DEFAULT_PAGE_SIZE)
const pageSizeItems = buildPageSizeItems(t)
const search = ref('')
const statusFilter = ref<PaymentStatus | ''>('')
// Empty by default: no `sort=` is sent until the user clicks a column, so
// the backend's own default-sort fallback (entity_config → system_configs
// → receivedAt DESC) applies.
const sort = useTableSort([])
const hasActiveSort = computed(() => sort.hasActiveSort.value)
const isMultiSort = computed(() => sort.orders.value.length > 1)

// Status filter options (with "All" first), localized at the consumption point.
const statusFilterOptions = computed(() => [
  { label: t('payments.statusFilterAll'), value: '' },
  ...PAYMENT_STATUS_OPTIONS.map(o => ({ label: t(o.labelKey), value: o.value })),
])

function buildFilter(): string | undefined {
  // RSQL: status equality. The queue leverages the (status, received_at DESC) index.
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
      // Free-text over referenceNumber, adminNotes and supportFileName.
      q: search.value.trim() || undefined,
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

// Guards the filter watchers so "clear filters and refresh" fires a single reload.
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
  statusFilter.value = ''
  sort.reset()
  size.value = DEFAULT_PAGE_SIZE
  page.value = 1
  await nextTick()
  resetting.value = false
  load()
}

onMounted(load)

// ---- Presentation helpers ----
// Amount in the payment's currency, formatted in the VE convention. Empty → '—'.
function money(v?: number | string | null, currency?: string | null): string {
  if (v === null || v === undefined || v === '') return t('common.empty')
  return formatCurrency(Number(v), currency || 'USD')
}

// Enum label resolvers (fall back to the raw value).
function methodLabel(m?: string | null): string {
  return m ? t(`payments.methods.${m}`, m) : t('common.empty')
}
function statusLabel(s?: string | null): string {
  return s ? t(`payments.status.${s}`, s) : t('common.empty')
}

// ---- Register (modal) ----
const formOpen = ref(false)

async function onSaved() {
  // A new payment enters as PENDING; reload honoring the current filter.
  page.value = 1
  await load()
}

// ---- Review (approve/reject) ----
const reviewOpen = ref(false)
const reviewAction = ref<'approve' | 'reject'>('approve')
const reviewTarget = ref<PaymentDto | null>(null)

function openReview(p: PaymentDto, action: 'approve' | 'reject') {
  reviewTarget.value = p
  reviewAction.value = action
  reviewOpen.value = true
}

function onReviewed(updated: PaymentDto) {
  // Replace the row in-place to reflect the new status without a full reload.
  const idx = data.value.findIndex(p => p.uuid === updated.uuid)
  if (idx !== -1) data.value[idx] = updated
}

function isPending(p: PaymentDto): boolean {
  return p.status === 'PENDING'
}

// ---- Delete (only while still PENDING — a mistaken registration, not yet reviewed) ----
const deleteOpen = ref(false)
const deleting = ref(false)
const target = ref<PaymentDto | null>(null)

function openDelete(p: PaymentDto) {
  target.value = p
  deleteOpen.value = true
}

async function confirmDelete() {
  if (!target.value) return
  deleting.value = true
  try {
    await payments.remove(target.value.uuid)
    toast.add({ title: t('payments.deletedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    deleteOpen.value = false
    // If the page is left empty after deleting, step back one.
    if (data.value.length === 1 && page.value > 1) page.value -= 1
    else await load()
  }
  catch {
    // useApi already notified the error (422 already reviewed, etc.)
  }
  finally {
    deleting.value = false
  }
}
</script>

<template>
  <div class="space-y-5">
    <!-- Header -->
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-extrabold text-prohealth-900">{{ t('payments.title') }}</h1>
        <p class="text-sm text-prohealth-700/70 mt-1">
          {{ t('payments.subtitle') }}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <ListRefreshMenu :loading="loading" variant="ghost" @refresh="load" @reset="resetFilters" />
        <ReportPrintButton variant="ghost" />
        <UTooltip :text="canRegister ? t('payments.createTooltip') : t('payments.noPermissionRegister')">
          <UButton
            color="primary"
            variant="outline"
            icon="i-lucide-plus"
            :disabled="!canRegister"
            @click="formOpen = true"
          >
            {{ t('common.new') }}
          </UButton>
        </UTooltip>
      </div>
    </div>

    <!-- Filters -->
    <div class="bg-white rounded-2xl border border-prohealth-100 p-4 flex flex-wrap items-center gap-3">
      <UInput
        v-model="search"
        :placeholder="t('payments.searchPlaceholder')"
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
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('plan_Code')">
                {{ t('payments.columns.planReference') }}
                <SortIndicator :state="sort.stateOf('plan_Code')" :multi-active="isMultiSort" @clear="sort.remove('plan_Code')" />
              </th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('amount')">
                {{ t('payments.columns.amount') }}
                <SortIndicator :state="sort.stateOf('amount')" :multi-active="isMultiSort" @clear="sort.remove('amount')" />
              </th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('paymentMethod')">
                {{ t('payments.columns.method') }}
                <SortIndicator :state="sort.stateOf('paymentMethod')" :multi-active="isMultiSort" @clear="sort.remove('paymentMethod')" />
              </th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('paymentDate')">
                {{ t('payments.columns.date') }}
                <SortIndicator :state="sort.stateOf('paymentDate')" :multi-active="isMultiSort" @clear="sort.remove('paymentDate')" />
              </th>
              <th class="px-5 py-3 font-semibold">{{ t('payments.columns.proof') }}</th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('status')">
                {{ t('payments.columns.status') }}
                <SortIndicator :state="sort.stateOf('status')" :multi-active="isMultiSort" @clear="sort.remove('status')" />
              </th>
              <th class="px-5 py-3 font-semibold text-right">{{ t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-prohealth-100">
            <TableSkeleton v-if="loading" :rows="8" :cols="7" />
            <tr v-else-if="data.length === 0">
              <td colspan="7" class="px-5 py-12 text-center text-prohealth-500">
                <UIcon name="i-lucide-receipt" class="w-8 h-8 mx-auto mb-2 text-prohealth-300" />
                {{ t('payments.empty') }}
              </td>
            </tr>
            <tr
              v-for="p in data"
              v-else
              :key="p.uuid"
              class="hover:bg-prohealth-50/50 cursor-pointer"
              @click="navigateTo(`/dashboard/payments/${p.uuid}`)"
            >
              <td class="px-5 py-3">
                <div class="font-semibold text-prohealth-900 font-mono">{{ p.plan_Code || t('common.empty') }}</div>
                <div class="text-xs text-prohealth-500">
                  {{ p.referenceNumber || t('payments.noReference') }}
                  <UBadge v-if="p.inscription" color="primary" variant="subtle" size="sm" class="ml-1">{{ t('payments.allocation.inscription') }}</UBadge>
                </div>
              </td>
              <td class="px-5 py-3 font-semibold text-prohealth-900">{{ money(p.amount, p.currency) }}</td>
              <td class="px-5 py-3 text-prohealth-700">{{ p.paymentMethod_Display ?? methodLabel(p.paymentMethod) }}</td>
              <td class="px-5 py-3 text-prohealth-600">{{ p.paymentDate_Display ?? formatDate(p.paymentDate, 'short') }}</td>
              <td class="px-5 py-3">
                <UIcon
                  v-if="p.supportFileAvailable"
                  name="i-lucide-paperclip"
                  class="w-4 h-4 text-prohealth-500"
                />
                <span v-else class="text-prohealth-300">{{ t('common.empty') }}</span>
              </td>
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
                      :to="`/dashboard/payments/${p.uuid}`"
                    />
                  </UTooltip>
                  <ReportPrintButton
                    table-name="payments"
                    :record-uuid="p.uuid"
                    icon-only
                    variant="ghost"
                    size="sm"
                  />
                  <template v-if="isPending(p)">
                    <UTooltip :text="canApprove ? t('payments.tooltips.approve') : t('payments.tooltips.noPermissionApprove')">
                      <UButton
                        color="success"
                        variant="ghost"
                        icon="i-lucide-check"
                        size="sm"
                        :disabled="!canApprove"
                        @click="openReview(p, 'approve')"
                      />
                    </UTooltip>
                    <UTooltip :text="canReject ? t('payments.tooltips.reject') : t('payments.tooltips.noPermissionReject')">
                      <UButton
                        color="error"
                        variant="ghost"
                        icon="i-lucide-x"
                        size="sm"
                        :disabled="!canReject"
                        @click="openReview(p, 'reject')"
                      />
                    </UTooltip>
                  </template>
                  <UTooltip v-if="canViewAudit" :text="t('audit.trigger')">
                    <UButton
                      color="neutral"
                      variant="ghost"
                      icon="i-lucide-history"
                      size="sm"
                      @click="openAudit(p)"
                    />
                  </UTooltip>
                  <UTooltip v-if="isPending(p)" :text="canDelete ? t('common.delete') : t('payments.tooltips.noPermissionDelete')">
                    <UButton
                      color="error"
                      variant="ghost"
                      icon="i-lucide-trash-2"
                      size="sm"
                      class="ms-2"
                      :disabled="!canDelete"
                      @click="openDelete(p)"
                    />
                  </UTooltip>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="flex items-center flex-wrap justify-between gap-3 px-5 py-3 border-t border-prohealth-100 shrink-0">
        <p class="text-xs text-prohealth-500">
          {{ t('payments.paginationSummary', { shown: data.length, total }) }}
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

    <!-- Register modal -->
    <PaymentFormModal v-model:open="formOpen" @saved="onSaved" />

    <!-- Approve/reject modal -->
    <PaymentReviewModal
      v-model:open="reviewOpen"
      :action="reviewAction"
      :payment="reviewTarget"
      @reviewed="onReviewed"
    />

    <!-- Delete confirmation modal (PENDING only) -->
    <UModal v-model:open="deleteOpen" :title="t('payments.delete.title')">
      <template #body>
        <p class="text-sm text-prohealth-700">{{ t('payments.delete.confirm') }}</p>
        <div class="flex items-center justify-end gap-3 pt-5">
          <UButton color="neutral" variant="ghost" :disabled="deleting" @click="deleteOpen = false">
            {{ t('common.cancel') }}
          </UButton>
          <UButton color="error" :loading="deleting" icon="i-lucide-trash-2" @click="confirmDelete">
            {{ t('common.delete') }}
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Audit modal -->
    <AuditModal
      v-if="auditTarget"
      v-model:open="auditOpen"
      entity-key="payment"
      :entity-uuid="auditTarget.uuid"
      :entity-label="auditTarget.plan_Code ?? undefined"
      :entity-code="auditTarget.referenceNumber"
      :can-view-changes="canViewAuditChanges"
      :can-view-reports="canViewAuditReports"
    />
  </div>
</template>
