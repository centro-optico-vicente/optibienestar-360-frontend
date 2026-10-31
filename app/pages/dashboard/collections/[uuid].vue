<script setup lang="ts">
import type { ApiError } from '~/types/auth'
import type { PaymentDto } from '~/types/payments'
import { paymentStatusColor } from '~/types/payments'

definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'COLLECTION_VIEW_ALL',
})

const { t } = useI18n()
const { formatDate, formatMonthYear, formatCurrency } = useFormatters()

// What the affiliate actually pays (and what commissions are computed on).
function netAmount(p: PaymentDto): number {
  return Number(p.amount) - Number(p.discountAmount ?? 0)
}

useSeoMeta({ title: () => t('common.seoTitle', { page: t('payments.detail.seoPage') }) })

const route = useRoute()
const paymentUuid = route.params.uuid as string

const payments = usePayments()
const { can } = usePermissions()
const toast = useToast()

const canApprove = computed(() => can('COLLECTION_APPROVE'))
const canReject = computed(() => can('COLLECTION_REJECT'))
const canDiscount = computed(() => can('ALLOWS_DISCOUNT'))
const canAssignMembership = computed(() => can('COLLECTION_ASSIGN_MEMBERSHIP'))
const canClaimAsStaff = computed(() => can('COLLECTION_CLAIM_CREATE'))
const canViewMember = computed(() => can('MEMBER_VIEW_ALL'))
const canViewCurrency = computed(() => can('CURRENCY_VIEW_ALL'))
const canViewAuditChanges = computed(() => can('AUDIT_VIEW_ALL') || can('PAYMENT_RECORD_AUDIT_VIEW'))
const canViewAuditReports = computed(() => can('REPORT_AUDIT_VIEW_ALL') || can('PAYMENT_REPORT_AUDIT_VIEW'))
const canViewAudit = computed(() => canViewAuditChanges.value || canViewAuditReports.value)
const auditOpen = ref(false)

// Multi-month advance (V154): show the full covered range when it spans more
// than one month, else the single-month label unchanged.
function allocationLabel(p: PaymentDto): string {
  if (p.inscription) return t('payments.allocation.inscriptionFull')
  if (p.appliedPeriod && p.coverageThroughPeriod && p.coverageThroughPeriod !== p.appliedPeriod) {
    return t('payments.allocation.monthlyRange', {
      from: formatMonthYear(p.appliedPeriod),
      to: formatMonthYear(p.coverageThroughPeriod),
    })
  }
  return t('payments.allocation.monthlyPeriod', { period: formatMonthYear(p.appliedPeriod) })
}

// ---- Payment load ----
const payment = ref<PaymentDto | null>(null)
const loading = ref(true)
const notFound = ref(false)

async function loadPayment() {
  loading.value = true
  try {
    payment.value = await payments.get(paymentUuid)
  }
  catch (err) {
    if ((err as ApiError).status === 404) notFound.value = true
    payment.value = null
  }
  finally {
    loading.value = false
  }
}

onMounted(loadPayment)

// Header "Refrescar": re-fetch the payment without blanking the page.
const refreshing = ref(false)
async function refreshAll() {
  refreshing.value = true
  try {
    payment.value = await payments.get(paymentUuid)
  }
  catch {
    // useApi already notified
  }
  finally {
    refreshing.value = false
  }
}

const isPending = computed(() => payment.value?.status === 'PENDING')
const isDraft = computed(() => payment.value?.status === 'DRAFT')

// ---- Lines lifecycle (V117 lines feature): DRAFT -> PENDING -> (APPROVED|REJECTED),
// with PENDING -> DRAFT as the only way back once submitted. Same permission
// tier as approve/reject — both are "who can move this workflow forward".
const canSubmit = computed(() => canApprove.value)
const canReactivate = computed(() => canApprove.value || canReject.value)
const submitting = ref(false)
const reactivating = ref(false)

async function doSubmit() {
  if (!payment.value) return
  submitting.value = true
  try {
    payment.value = await payments.submit(payment.value.uuid)
    toast.add({ title: t('payments.detail.submittedToast'), color: 'success', icon: 'i-lucide-check-circle' })
  }
  catch {
    // useApi already notified
  }
  finally {
    submitting.value = false
  }
}

async function doReactivate() {
  if (!payment.value) return
  reactivating.value = true
  try {
    payment.value = await payments.reactivateToDraft(payment.value.uuid)
    toast.add({ title: t('payments.detail.reactivatedToast'), color: 'success', icon: 'i-lucide-undo-2' })
  }
  catch {
    // useApi already notified
  }
  finally {
    reactivating.value = false
  }
}

// ---- Presentation helpers ----
// Byte size with universal units (not localized).
function formatSize(bytes?: number | null): string {
  if (bytes === null || bytes === undefined) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Enum label resolvers (fall back to the raw value).
function methodLabel(m?: string | null): string {
  return m ? t(`payments.methods.${m}`, m) : t('common.empty')
}
function statusLabel(s?: string | null): string {
  return s ? t(`payments.status.${s}`, s) : t('common.empty')
}

// ---- View proof (presigned URL) ----
const loadingSupport = ref(false)

async function viewSupport() {
  if (!payment.value) return
  loadingSupport.value = true
  try {
    const res = await payments.supportUrl(payment.value.uuid)
    // Opens in a new tab; useApi already notifies 404/422 (no proof / R2 off).
    window.open(res.url, '_blank', 'noopener')
  }
  catch {
    // toast via useApi
  }
  finally {
    loadingSupport.value = false
  }
}

// ---- Review (approve/reject) ----
// An approved collection with no membership is the person's credit; staff can assign it to a membership.
const assignOpen = ref(false)
const canAssignCredit = computed(() =>
  canAssignMembership.value && payment.value?.direction !== 'OUT'
  && payment.value?.status === 'APPROVED' && !payment.value?.membership_Uuid)

// Staff can open a claim on an approved collection with credit left (hub ADR 0029); an open claim shows below.
const claimOpen = ref(false)
const canOpenClaim = computed(() =>
  canClaimAsStaff.value && payment.value?.direction !== 'OUT' && payment.value?.status === 'APPROVED'
  && Number(payment.value?.creditRemaining ?? 0) > 0 && !payment.value?.openClaim)

const reviewOpen = ref(false)
const reviewAction = ref<'approve' | 'reject'>('approve')

function openReview(action: 'approve' | 'reject') {
  reviewAction.value = action
  reviewOpen.value = true
}

function onReviewed(updated: PaymentDto) {
  payment.value = updated
}
</script>

<template>
  <div class="space-y-5">
    <!-- Back -->
    <UButton
      color="neutral"
      variant="ghost"
      icon="i-lucide-arrow-left"
      to="/dashboard/collections"
      size="sm"
    >
      {{ t('payments.title') }}
    </UButton>

    <!-- Loading -->
    <div v-if="loading" class="bg-white rounded-2xl border border-prohealth-100 p-6 space-y-3">
      <USkeleton class="h-7 w-64 rounded" />
      <USkeleton class="h-4 w-40 rounded" />
      <USkeleton class="h-4 w-full max-w-lg rounded" />
    </div>

    <!-- Not found -->
    <div v-else-if="notFound || !payment" class="bg-white rounded-2xl border border-prohealth-100 p-12 text-center">
      <UIcon name="i-lucide-search-x" class="w-10 h-10 mx-auto mb-3 text-prohealth-300" />
      <p class="text-prohealth-700 font-semibold">{{ t('payments.detail.notFoundTitle') }}</p>
      <p class="text-sm text-prohealth-500 mt-1">{{ t('payments.detail.notFoundBody') }}</p>
    </div>

    <template v-else>
      <!-- Header + actions -->
      <div class="bg-white rounded-2xl border border-prohealth-100 p-6">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div class="flex items-center gap-3 flex-wrap">
              <h1 class="text-2xl font-extrabold text-prohealth-900">
                <CurrencyConverterDisplay :amount="payment.amount" :currency="payment.currency_Code" :date="payment.paymentDate" v-slot="{ result }">
                  <span class="inline-flex items-center gap-1">
                    {{ payment.amount_Display }}
                    <CurrencyConverterTrigger :result="result" />
                  </span>
                </CurrencyConverterDisplay>
              </h1>
              <UBadge :color="paymentStatusColor(payment.status)" variant="subtle">
                {{ payment.status_Display ?? statusLabel(payment.status) }}
              </UBadge>
              <UBadge v-if="payment.inscription" color="primary" variant="subtle">{{ t('payments.allocation.inscription') }}</UBadge>
            </div>
            <p class="text-sm text-prohealth-500 mt-1">
              {{ payment.paymentMethod_Display ?? methodLabel(payment.paymentMethod) }} · {{ payment.paymentDate_Display ?? formatDate(payment.paymentDate, 'datetime') }}
            </p>
          </div>

          <div class="flex items-center gap-2">
            <RefreshButton
              size="md"
              variant="ghost"
              :icon-only="false"
              :loading="refreshing"
              :title="t('common.refreshRecord')"
              @refresh="refreshAll"
            />
            <ReportPrintButton :record-uuid="paymentUuid" variant="ghost" />
            <template v-if="isDraft">
              <UTooltip :text="canSubmit ? t('payments.detail.submitTooltip') : t('payments.tooltips.noPermissionApprove')">
                <UButton
                  color="primary"
                  variant="soft"
                  icon="i-lucide-send"
                  :loading="submitting"
                  :disabled="!canSubmit"
                  @click="doSubmit"
                >
                  {{ t('payments.detail.submit') }}
                </UButton>
              </UTooltip>
            </template>
            <template v-if="isPending">
              <PaymentDiscountPopover v-if="canDiscount" :payment="payment" @applied="onReviewed" />
              <UTooltip :text="canReactivate ? t('payments.detail.reactivateTooltip') : t('payments.tooltips.noPermissionApprove')">
                <UButton
                  color="neutral"
                  variant="soft"
                  icon="i-lucide-undo-2"
                  :loading="reactivating"
                  :disabled="!canReactivate"
                  @click="doReactivate"
                >
                  {{ t('payments.detail.reactivate') }}
                </UButton>
              </UTooltip>
              <UTooltip :text="canReject ? t('payments.detail.rejectTooltip') : t('payments.tooltips.noPermissionReject')">
                <UButton
                  color="error"
                  variant="soft"
                  icon="i-lucide-x"
                  :disabled="!canReject"
                  @click="openReview('reject')"
                >
                  {{ t('payments.detail.reject') }}
                </UButton>
              </UTooltip>
              <UTooltip :text="canApprove ? t('payments.detail.approveTooltip') : t('payments.tooltips.noPermissionApprove')">
                <UButton
                  color="success"
                  icon="i-lucide-check"
                  :disabled="!canApprove"
                  @click="openReview('approve')"
                >
                  {{ t('payments.detail.approve') }}
                </UButton>
              </UTooltip>
            </template>
            <UButton
              v-if="canOpenClaim"
              color="warning"
              variant="soft"
              icon="i-lucide-message-square-warning"
              @click="claimOpen = true"
            >
              {{ t('payments.claim.action') }}
            </UButton>
            <UButton
              v-if="canAssignCredit"
              color="primary"
              variant="soft"
              icon="i-lucide-link"
              @click="assignOpen = true"
            >
              {{ t('payments.assignMembership.action') }}
            </UButton>
            <UTooltip v-if="canViewAudit" :text="t('audit.trigger')">
              <UButton color="neutral" variant="ghost" icon="i-lucide-history" @click="auditOpen = true" />
            </UTooltip>
          </div>
        </div>
      </div>

      <!-- Payment detail -->
      <div class="bg-white rounded-2xl border border-prohealth-100 p-6">
        <h2 class="font-bold text-prohealth-900 mb-4">{{ t('payments.detail.sections.detail') }}</h2>
        <dl class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 text-sm">
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('payments.detail.fields.amount') }}</dt>
            <dd class="text-prohealth-900 text-lg font-semibold mt-0.5">
              <CurrencyConverterDisplay :amount="payment.amount" :currency="payment.currency_Code" :date="payment.paymentDate" v-slot="{ result }">
                <span class="inline-flex items-center gap-1">
                  {{ payment.amount_Display }}
                  <CurrencyConverterTrigger :result="result" />
                </span>
              </CurrencyConverterDisplay>
            </dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('payments.detail.fields.currency') }}</dt>
            <dd class="mt-0.5">
              <CommonEntityLinkCell
                :to="payment.currency_Uuid ? `/dashboard/catalogs/currencies?edit=${payment.currency_Uuid}` : null"
                :label="payment.currency_Display || payment.currency_Code"
                :can="canViewCurrency"
              />
            </dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('payments.detail.fields.method') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ payment.paymentMethod_Display ?? methodLabel(payment.paymentMethod) }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('payments.detail.fields.reference') }}</dt>
            <dd class="text-prohealth-800 mt-0.5 font-mono">{{ payment.referenceNumber || t('common.empty') }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('payments.detail.fields.paymentDate') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ payment.paymentDate_Display ?? formatDate(payment.paymentDate, 'datetime') }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('payments.detail.fields.received') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ payment.receivedAt_Display ?? formatDate(payment.receivedAt, 'datetime') }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('payments.detail.fields.allocation') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">
              {{ allocationLabel(payment) }}
            </dd>
          </div>
          <template v-if="payment.discountAmount">
            <div>
              <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('payments.detail.fields.discount') }}</dt>
              <dd class="text-prohealth-800 mt-0.5">
                <CurrencyConverterDisplay :amount="payment.discountAmount" :currency="payment.currency_Code" :date="payment.paymentDate" v-slot="{ result }">
                  <span class="inline-flex items-center gap-1">
                    {{ payment.discountAmount_Display ?? payment.discountAmount }}
                    <CurrencyConverterTrigger :result="result" />
                  </span>
                </CurrencyConverterDisplay>
              </dd>
            </div>
            <div>
              <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('payments.detail.fields.netAmount') }}</dt>
              <dd class="text-prohealth-900 font-semibold mt-0.5">
                <CurrencyConverterDisplay :amount="netAmount(payment)" :currency="payment.currency_Code || payment.currency" :date="payment.paymentDate" v-slot="{ result }">
                  <span class="inline-flex items-center gap-1">
                    {{ formatCurrency(netAmount(payment), payment.currency_Code || payment.currency) }}
                    <CurrencyConverterTrigger :result="result" />
                  </span>
                </CurrencyConverterDisplay>
              </dd>
            </div>
            <div>
              <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('payments.detail.fields.discountReason') }}</dt>
              <dd class="text-prohealth-800 mt-0.5">{{ payment.discountReason || t('common.empty') }}</dd>
            </div>
          </template>
        </dl>
      </div>

      <!-- Lines (V117 lines feature) — shown when the payment is split across 2+ method/amount blocks -->
      <div v-if="payment.lines && payment.lines.length > 1" class="bg-white rounded-2xl border border-prohealth-100 p-6">
        <h2 class="font-bold text-prohealth-900 mb-4">{{ t('payments.detail.sections.lines') }}</h2>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
                <th class="px-4 py-2 font-semibold">{{ t('payments.detail.linesColumns.method') }}</th>
                <th class="px-4 py-2 font-semibold">{{ t('payments.detail.linesColumns.bank') }}</th>
                <th class="px-4 py-2 font-semibold text-right">{{ t('payments.detail.linesColumns.amount') }}</th>
                <th class="px-4 py-2 font-semibold">{{ t('payments.detail.linesColumns.reference') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-prohealth-100">
              <tr v-for="line in payment.lines" :key="line.uuid">
                <td class="px-4 py-2 text-prohealth-800">{{ line.method_Display || t('common.empty') }}</td>
                <td class="px-4 py-2 text-prohealth-800">{{ line.bank_Display || t('common.empty') }}</td>
                <td class="px-4 py-2 text-prohealth-800 text-right">
                  <CurrencyConverterDisplay :amount="line.amount" :currency="payment.currency_Code" :date="payment.paymentDate" v-slot="{ result }">
                    <span class="inline-flex items-center justify-end gap-1">
                      {{ line.amount_Display ?? line.amount }}
                      <CurrencyConverterTrigger :result="result" />
                    </span>
                  </CurrencyConverterDisplay>
                </td>
                <td class="px-4 py-2 text-prohealth-800 font-mono">{{ line.referenceNumber || t('common.empty') }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Membership -->
      <div class="bg-white rounded-2xl border border-prohealth-100 p-6">
        <h2 class="font-bold text-prohealth-900 mb-4">{{ t('payments.detail.sections.membership') }}</h2>
        <dl class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 text-sm">
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('payments.detail.fields.plan') }}</dt>
            <dd class="text-prohealth-800 mt-0.5 font-mono">{{ payment.plan_Code || t('common.empty') }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('payments.detail.fields.member') }}</dt>
            <dd class="mt-0.5">
              <CommonEntityLinkCell
                :to="payment.member_Uuid ? `/dashboard/members/${payment.member_Uuid}` : null"
                :label="payment.member_Display"
                :can="canViewMember"
              />
            </dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('payments.detail.fields.membership') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ payment.membership_Display || t('common.empty') }}</dd>
          </div>
          <div v-if="payment.openClaim">
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('payments.claim.detailLabel') }}</dt>
            <dd class="text-sm text-prohealth-900 mt-0.5">
              <UBadge color="warning" variant="subtle" size="sm">
                {{ payment.openClaim.reason_Display ?? payment.openClaim.reason }} · {{ payment.openClaim.claimedAmount_Display ?? payment.openClaim.claimedAmount }}
              </UBadge>
              <span v-if="payment.openClaim.comment" class="block text-xs text-prohealth-600 mt-1">{{ payment.openClaim.comment }}</span>
              <NuxtLink v-if="can('COLLECTION_CLAIM_VIEW_ALL')" to="/dashboard/payment-claims" class="block text-xs text-cyan-700 hover:underline mt-1">
                {{ t('payments.claim.manageLink') }}
              </NuxtLink>
            </dd>
          </div>
          <div v-if="payment.beneficiary_Display">
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('payments.beneficiary.detailLabel') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">
              {{ payment.beneficiary_Display }}
              <span v-if="payment.beneficiaryDocument" class="block text-xs font-mono text-prohealth-500">{{ payment.beneficiaryDocument }}</span>
              <span v-if="payment.beneficiaryContractNumber" class="block text-xs font-mono text-prohealth-500">{{ payment.beneficiaryContractNumber }}</span>
            </dd>
          </div>
        </dl>
      </div>

      <!-- Proof of payment -->
      <div class="bg-white rounded-2xl border border-prohealth-100 p-6">
        <h2 class="font-bold text-prohealth-900 mb-4">{{ t('payments.detail.sections.proof') }}</h2>
        <div v-if="payment.supportFileAvailable" class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <UIcon name="i-lucide-file-text" class="w-8 h-8 text-prohealth-400" />
            <div>
              <p class="text-sm font-medium text-prohealth-800">{{ payment.supportFileName || t('payments.detail.proof.fileNameFallback') }}</p>
              <p class="text-xs text-prohealth-500">
                {{ payment.supportFileContentType || t('payments.detail.proof.fileTypeFallback') }}
                <template v-if="payment.supportFileSizeBytes"> · {{ formatSize(payment.supportFileSizeBytes) }}</template>
              </p>
            </div>
          </div>
          <UButton
            color="primary"
            variant="soft"
            icon="i-lucide-external-link"
            :loading="loadingSupport"
            @click="viewSupport"
          >
            {{ t('payments.detail.proof.view') }}
          </UButton>
        </div>
        <div v-else class="flex items-center gap-2 text-sm text-prohealth-500">
          <UIcon name="i-lucide-file-x" class="w-5 h-5 text-prohealth-300" />
          {{ t('payments.detail.proof.none') }}
        </div>
      </div>

      <!-- Review -->
      <div class="bg-white rounded-2xl border border-prohealth-100 p-6">
        <h2 class="font-bold text-prohealth-900 mb-4">{{ t('payments.detail.sections.review') }}</h2>
        <dl class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 text-sm">
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('payments.detail.fields.status') }}</dt>
            <dd class="mt-0.5">
              <UBadge :color="paymentStatusColor(payment.status)" variant="subtle" size="sm">
                {{ payment.status_Display ?? statusLabel(payment.status) }}
              </UBadge>
            </dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('payments.detail.fields.reviewed') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ payment.reviewedAt_Display ?? formatDate(payment.reviewedAt, 'datetime') }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('payments.detail.fields.reviewedBy') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ payment.reviewedBy_Display || t('common.empty') }}</dd>
          </div>
          <div class="sm:col-span-2 lg:col-span-3">
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('payments.detail.fields.reason') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ payment.reviewReason || t('common.empty') }}</dd>
          </div>
        </dl>
      </div>

      <!-- Admin notes -->
      <div v-if="payment.adminNotes" class="bg-white rounded-2xl border border-prohealth-100 p-6">
        <h2 class="font-bold text-prohealth-900 mb-2">{{ t('payments.detail.sections.adminNotes') }}</h2>
        <p class="text-sm text-prohealth-700 whitespace-pre-line">{{ payment.adminNotes }}</p>
      </div>

      <!-- Metadata -->
      <div class="bg-white rounded-2xl border border-prohealth-100 p-6">
        <h2 class="font-bold text-prohealth-900 mb-4">{{ t('payments.detail.sections.metadata') }}</h2>
        <dl class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 text-sm">
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('payments.detail.fields.created') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ payment.createdAt_Display ?? formatDate(payment.createdAt, 'datetime') }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('payments.detail.fields.updated') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ payment.updatedAt_Display ?? formatDate(payment.updatedAt, 'datetime') }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('payments.detail.fields.uuid') }}</dt>
            <dd class="text-prohealth-800 mt-0.5 font-mono text-xs break-all">{{ payment.uuid }}</dd>
          </div>
        </dl>
      </div>
    </template>

    <!-- Staff claim on the credit of this payment -->
    <PaymentClaimModal v-model:open="claimOpen" :payment="payment" staff @claimed="loadPayment" />

    <!-- Assign credit to a membership -->
    <PaymentAssignMembershipModal
      v-model:open="assignOpen"
      :payment="payment"
      @assigned="onReviewed"
    />

    <!-- Approve/reject modal -->
    <PaymentReviewModal
      v-model:open="reviewOpen"
      :action="reviewAction"
      :payment="payment"
      @reviewed="onReviewed"
    />

    <!-- Audit modal -->
    <AuditModal
      v-if="payment"
      v-model:open="auditOpen"
      entity-key="payment"
      :entity-uuid="payment.uuid"
      :entity-label="payment.plan_Code ?? undefined"
      :entity-code="payment.referenceNumber"
      :can-view-changes="canViewAuditChanges"
      :can-view-reports="canViewAuditReports"
    />
  </div>
</template>
