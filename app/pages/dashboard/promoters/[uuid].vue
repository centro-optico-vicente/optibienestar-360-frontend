<script setup lang="ts">
import type { ApiError } from '~/types/auth'
import type {
  CommissionPeriodSummaryDto,
  PromoterDashboardDto,
  PromoterDto,
  PromoterMemberRow,
  PromoterStatus,
} from '~/types/promoters'

definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'PROMOTER_VIEW_ALL',
})

const { t } = useI18n()
const { formatCurrency, formatDate } = useFormatters()

useSeoMeta({ title: () => t('common.seoTitle', { page: t('promoters.detail.seoPage') }) })

const route = useRoute()
const promoterUuid = route.params.uuid as string

const promoters = usePromoters()
const { can } = usePermissions()
const toast = useToast()

const canUpdate = computed(() => can('PROMOTER_UPDATE'))
const canDelete = computed(() => can('PROMOTER_DELETE'))
const canViewAuditChanges = computed(() => can('AUDIT_VIEW_ALL') || can('PROMOTER_RECORD_AUDIT_VIEW'))
const canViewAuditReports = computed(() => can('REPORT_AUDIT_VIEW_ALL') || can('PROMOTER_REPORT_AUDIT_VIEW'))
const canViewAudit = computed(() => canViewAuditChanges.value || canViewAuditReports.value)
const auditOpen = ref(false)

// ---- Promoter load ----
const promoter = ref<PromoterDto | null>(null)
const loading = ref(true)
const notFound = ref(false)

async function loadPromoter() {
  loading.value = true
  try {
    promoter.value = await promoters.get(promoterUuid)
  }
  catch (err) {
    if ((err as ApiError).status === 404) notFound.value = true
    promoter.value = null
  }
  finally {
    loading.value = false
  }
}

onMounted(async () => {
  await loadPromoter()
  await Promise.all([loadPortfolio(), loadCommissionsSummary()])
})

// Header "Refrescar": re-fetch the promoter + both tabs at once.
const refreshingAll = ref(false)
async function refreshAll() {
  refreshingAll.value = true
  try {
    await Promise.all([loadPromoter(), loadPortfolio(), loadCommissionsSummary()])
  }
  finally {
    refreshingAll.value = false
  }
}

// Amount in USD, formatted in the VE convention (useFormatters). Empty → '—'.
function money(v?: number | string | null): string {
  if (v === null || v === undefined || v === '') return t('common.empty')
  return formatCurrency(Number(v), 'USD')
}

// Status label; falls back to the raw value for unknown statuses.
function statusLabel(s?: string | null): string {
  return s ? t(`promoters.status.${s}`, s) : t('common.empty')
}

// Status → badge color: ACTIVE success, SUSPENDED warning, INACTIVE neutral.
function statusColor(s?: PromoterStatus | null): 'success' | 'warning' | 'neutral' {
  return s === 'ACTIVE' ? 'success' : s === 'SUSPENDED' ? 'warning' : 'neutral'
}

// ---- Edit (shared modal) ----
const formOpen = ref(false)

function openEdit() {
  formOpen.value = true
}

function onSaved(updated: PromoterDto) {
  promoter.value = updated
}

// ---- Restore ----
const restoring = ref(false)

async function restorePromoter() {
  if (!promoter.value) return
  restoring.value = true
  try {
    promoter.value = await promoters.update(promoter.value.uuid, { active: true })
    toast.add({ title: t('promoters.restoredToast'), color: 'success', icon: 'i-lucide-check-circle' })
  }
  catch {
    // toast handled by useApi
  }
  finally {
    restoring.value = false
  }
}

// ---- Delete ----
const deleteOpen = ref(false)
const deleting = ref(false)
const usageChecking = ref(false)
const usageInfo = ref<{ inUse: boolean, count: number } | null>(null)

async function openDelete() {
  if (!promoter.value) return
  deleteOpen.value = true
  usageChecking.value = true
  usageInfo.value = null
  try {
    usageInfo.value = await promoters.usage(promoter.value.uuid)
  }
  catch {
    // Fallback: treat as "in use" for safety (soft-deactivate instead of physical delete).
    usageInfo.value = null
  }
  finally {
    usageChecking.value = false
  }
}

async function confirmDelete() {
  if (!promoter.value) return
  deleting.value = true
  const wasPhysical = usageInfo.value?.inUse === false
  try {
    await promoters.remove(promoter.value.uuid, wasPhysical)
    toast.add({
      title: wasPhysical
        ? t('promoters.deletedPermanentToast')
        : t('promoters.deactivatedToast'),
      color: wasPhysical ? 'success' : 'info',
      icon: wasPhysical ? 'i-lucide-check-circle' : 'i-lucide-info',
    })
    await navigateTo('/dashboard/promoters')
  }
  catch {
    // toast handled by useApi
  }
  finally {
    deleting.value = false
  }
}

// ---- Tabs ----
const tabs = computed(() => [
  { label: t('promoters.tabs.referrals'), value: 'referrals', icon: 'i-lucide-users' },
  { label: t('promoters.tabs.commissions'), value: 'commissions', icon: 'i-lucide-hand-coins' },
])
const activeTab = ref('referrals')

// =========================================================
// Referidos (cartera + salud de cobranza)
// =========================================================
const dashboard = ref<PromoterDashboardDto | null>(null)
const portfolioLoading = ref(false)

async function loadPortfolio() {
  portfolioLoading.value = true
  try {
    dashboard.value = await promoters.portfolio(promoterUuid)
  }
  catch {
    // toast handled by useApi
  }
  finally {
    portfolioLoading.value = false
  }
}

type ReferralQuickFilter = 'all' | 'active' | 'overdue' | 'withoutMembership'
const referralFilter = ref<ReferralQuickFilter>('all')

function memberBucket(row: PromoterMemberRow): 'active' | 'overdue' | 'withoutMembership' {
  if (row.membershipStatus === 'ACTIVE') return 'active'
  if (row.membershipStatus === 'SUSPENDED' || row.membershipStatus === 'EXPIRED') return 'overdue'
  return 'withoutMembership'
}

const filteredPortfolio = computed(() => {
  const rows = dashboard.value?.portfolio ?? []
  if (referralFilter.value === 'all') return rows
  return rows.filter(r => memberBucket(r) === referralFilter.value)
})

function membershipStatusLabel(status: PromoterMemberRow['membershipStatus']): string {
  if (status === 'ACTIVE') return t('promoters.detail.referrals.status.active')
  if (status === 'SUSPENDED' || status === 'EXPIRED') return t('promoters.detail.referrals.status.overdue')
  return t('promoters.detail.referrals.status.withoutMembership')
}

function membershipStatusColor(status: PromoterMemberRow['membershipStatus']): 'success' | 'warning' | 'neutral' {
  if (status === 'ACTIVE') return 'success'
  if (status === 'SUSPENDED' || status === 'EXPIRED') return 'warning'
  return 'neutral'
}

// Date in the VE convention (useFormatters). Empty → '—'.
function date(iso?: string | null): string {
  return formatDate(iso, 'short')
}

// =========================================================
// Comisiones por período
// =========================================================
const commissionsSummary = ref<CommissionPeriodSummaryDto[]>([])
const commissionsLoading = ref(false)

async function loadCommissionsSummary() {
  commissionsLoading.value = true
  try {
    commissionsSummary.value = await promoters.commissionsSummary(promoterUuid)
  }
  catch {
    // toast handled by useApi
  }
  finally {
    commissionsLoading.value = false
  }
}
</script>

<template>
  <div class="space-y-5">
    <!-- Back -->
    <UButton
      color="neutral"
      variant="ghost"
      icon="i-lucide-arrow-left"
      to="/dashboard/promoters"
      size="sm"
    >
      {{ t('promoters.title') }}
    </UButton>

    <!-- Loading -->
    <div v-if="loading" class="bg-white rounded-2xl border border-prohealth-100 p-6 space-y-3">
      <USkeleton class="h-7 w-64 rounded" />
      <USkeleton class="h-4 w-40 rounded" />
      <USkeleton class="h-4 w-full max-w-lg rounded" />
    </div>

    <!-- Not found -->
    <div v-else-if="notFound || !promoter" class="bg-white rounded-2xl border border-prohealth-100 p-12 text-center">
      <UIcon name="i-lucide-search-x" class="w-10 h-10 mx-auto mb-3 text-prohealth-300" />
      <p class="text-prohealth-700 font-semibold">{{ t('promoters.detail.notFoundTitle') }}</p>
      <p class="text-sm text-prohealth-500 mt-1">{{ t('promoters.detail.notFoundBody') }}</p>
    </div>

    <template v-else>
      <!-- Header + actions -->
      <div class="bg-white rounded-2xl border border-prohealth-100 p-6">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div class="flex items-center gap-3 flex-wrap">
              <h1 class="text-2xl font-extrabold text-prohealth-900">{{ promoter.displayName }}</h1>
              <UBadge :color="statusColor(promoter.status)" variant="subtle">
                {{ promoter.status_Display ?? statusLabel(promoter.status) }}
              </UBadge>
              <UBadge :color="promoter.active ? 'success' : 'neutral'" variant="subtle">
                {{ promoter.active_Display ?? (promoter.active ? t('common.yes') : t('common.no')) }}
              </UBadge>
              <UBadge v-if="promoter.system" color="neutral" variant="subtle">
                {{ t('promoters.systemBadge') }}
              </UBadge>
            </div>
            <p class="text-sm text-prohealth-500 mt-1 font-mono">{{ promoter.referralCode }}</p>
          </div>

          <div class="flex items-center gap-2">
            <RefreshButton
              size="md"
              variant="ghost"
              :icon-only="false"
              :loading="refreshingAll"
              :title="t('common.refreshRecord')"
              @refresh="refreshAll"
            />
            <ReportPrintButton :record-uuid="promoterUuid" variant="ghost" />
            <UTooltip :text="promoter.system ? t('promoters.systemLocked') : (canUpdate ? t('promoters.editTooltip') : t('promoters.noPermissionEdit'))">
              <UButton
                color="info"
                variant="ghost"
                icon="i-lucide-pencil"
                :disabled="!canUpdate || promoter.system"
                @click="openEdit"
              >
                {{ t('common.edit') }}
              </UButton>
            </UTooltip>
            <RestoreButton
              v-if="promoter.active === false"
              :active="promoter.active"
              :allowed="canDelete"
              :loading="restoring"
              class="ms-2"
              @restore="restorePromoter"
            />
            <UTooltip v-else :text="promoter.system ? t('promoters.systemLocked') : (canDelete ? t('promoters.deleteTooltip') : t('promoters.noPermissionDelete'))">
              <UButton
                color="error"
                variant="ghost"
                icon="i-lucide-trash-2"
                class="ms-2"
                :disabled="!canDelete || promoter.system"
                @click="openDelete"
              />
            </UTooltip>
            <UTooltip v-if="canViewAudit" :text="t('audit.trigger')">
              <UButton
                color="neutral"
                variant="ghost"
                icon="i-lucide-history"
                @click="auditOpen = true"
              />
            </UTooltip>
          </div>
        </div>

        <p v-if="promoter.description" class="text-sm text-prohealth-700 mt-4 max-w-3xl">
          {{ promoter.description }}
        </p>
      </div>

      <!-- Contact -->
      <div class="bg-white rounded-2xl border border-prohealth-100 p-6">
        <h2 class="font-bold text-prohealth-900 mb-4">{{ t('promoters.detail.sections.contact') }}</h2>
        <dl class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 text-sm">
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('promoters.detail.fields.email') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ promoter.email || t('common.empty') }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('promoters.detail.fields.phone') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ promoter.phone || t('common.empty') }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('promoters.detail.fields.referralCode') }}</dt>
            <dd class="text-prohealth-800 mt-0.5 font-mono">{{ promoter.referralCode }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('promoters.detail.fields.personFullName') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ promoter.person_Display || t('common.empty') }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('promoters.detail.fields.userEmail') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ promoter.user_Display || t('common.empty') }}</dd>
          </div>
        </dl>
      </div>

      <!-- Metrics -->
      <div class="bg-white rounded-2xl border border-prohealth-100 p-6">
        <h2 class="font-bold text-prohealth-900 mb-4">{{ t('promoters.detail.sections.metrics') }}</h2>
        <dl class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 text-sm">
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('promoters.detail.fields.totalReferrals') }}</dt>
            <dd class="text-prohealth-900 text-lg font-semibold mt-0.5">{{ promoter.totalReferrals }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('promoters.detail.fields.totalCommissionPaid') }}</dt>
            <dd class="text-prohealth-900 text-lg font-semibold mt-0.5">{{ money(promoter.totalCommissionPaid) }}</dd>
          </div>
        </dl>
      </div>

      <!-- Metadata -->
      <div class="bg-white rounded-2xl border border-prohealth-100 p-6">
        <h2 class="font-bold text-prohealth-900 mb-4">{{ t('promoters.detail.sections.metadata') }}</h2>
        <dl class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 text-sm">
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('promoters.detail.fields.createdAt') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ promoter.createdAt_Display ?? formatDate(promoter.createdAt, 'datetime') }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('promoters.detail.fields.updatedAt') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ promoter.updatedAt_Display ?? formatDate(promoter.updatedAt, 'datetime') }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('promoters.detail.fields.uuid') }}</dt>
            <dd class="text-prohealth-800 mt-0.5 font-mono text-xs break-all">{{ promoter.uuid }}</dd>
          </div>
        </dl>
      </div>

      <!-- Sub-resource tabs -->
      <UTabs v-model="activeTab" :items="tabs" :content="false" />

      <!-- ============ Referidos ============ -->
      <div v-show="activeTab === 'referrals'" class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden">
        <div class="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-prohealth-100">
          <div>
            <h2 class="font-bold text-prohealth-900">{{ t('promoters.detail.referrals.title') }}</h2>
            <p class="text-xs text-prohealth-500 mt-0.5">{{ t('promoters.detail.referrals.hint') }}</p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <RefreshButton :loading="portfolioLoading" :title="t('common.refreshSection')" @refresh="loadPortfolio" />
            <UButton
              size="xs"
              variant="soft"
              :color="referralFilter === 'all' ? 'primary' : 'neutral'"
              @click="referralFilter = 'all'"
            >
              {{ t('promoters.detail.referrals.filters.all') }} ({{ dashboard?.portfolio.length ?? 0 }})
            </UButton>
            <UButton
              size="xs"
              variant="soft"
              :color="referralFilter === 'active' ? 'success' : 'neutral'"
              @click="referralFilter = 'active'"
            >
              {{ t('promoters.detail.referrals.filters.active') }} ({{ dashboard?.affiliatesUpToDate ?? 0 }})
            </UButton>
            <UButton
              size="xs"
              variant="soft"
              :color="referralFilter === 'overdue' ? 'warning' : 'neutral'"
              @click="referralFilter = 'overdue'"
            >
              {{ t('promoters.detail.referrals.filters.overdue') }} ({{ dashboard?.affiliatesOverdue ?? 0 }})
            </UButton>
            <UButton
              size="xs"
              :variant="referralFilter === 'withoutMembership' ? 'solid' : 'soft'"
              color="neutral"
              @click="referralFilter = 'withoutMembership'"
            >
              {{ t('promoters.detail.referrals.filters.withoutMembership') }} ({{ dashboard?.affiliatesWithoutMembership ?? 0 }})
            </UButton>
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
                <th class="px-6 py-3 font-semibold">{{ t('promoters.detail.referrals.columns.member') }}</th>
                <th class="px-6 py-3 font-semibold">{{ t('promoters.detail.referrals.columns.status') }}</th>
                <th class="px-6 py-3 font-semibold">{{ t('promoters.detail.referrals.columns.nextDueDate') }}</th>
                <th class="px-6 py-3 font-semibold">{{ t('promoters.detail.referrals.columns.monthlyFee') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-prohealth-100">
              <TableSkeleton v-if="portfolioLoading" :rows="3" :cols="4" />
              <tr v-else-if="filteredPortfolio.length === 0">
                <td colspan="4" class="px-6 py-10 text-center text-prohealth-500">
                  <UIcon name="i-lucide-users" class="w-7 h-7 mx-auto mb-2 text-prohealth-300" />
                  {{ t('promoters.detail.referrals.empty') }}
                </td>
              </tr>
              <tr v-for="m in filteredPortfolio" v-else :key="m.memberUuid" class="hover:bg-prohealth-50/50">
                <td class="px-6 py-3 font-semibold text-prohealth-900">{{ m.memberName }}</td>
                <td class="px-6 py-3">
                  <UBadge :color="membershipStatusColor(m.membershipStatus)" variant="subtle" size="sm">
                    {{ m.membershipStatus_Display ?? membershipStatusLabel(m.membershipStatus) }}
                  </UBadge>
                </td>
                <td class="px-6 py-3 text-prohealth-600">{{ m.nextDueDate_Display ?? date(m.nextDueDate) }}</td>
                <td class="px-6 py-3 text-prohealth-700">{{ money(m.monthlyFee) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ============ Comisiones por período ============ -->
      <div v-show="activeTab === 'commissions'" class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden">
        <div class="flex items-center justify-between px-6 py-4 border-b border-prohealth-100">
          <div>
            <h2 class="font-bold text-prohealth-900">{{ t('promoters.detail.commissions.title') }}</h2>
            <p class="text-xs text-prohealth-500 mt-0.5">{{ t('promoters.detail.commissions.hint') }}</p>
          </div>
          <RefreshButton :loading="commissionsLoading" :title="t('common.refreshSection')" @refresh="loadCommissionsSummary" />
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
                <th class="px-6 py-3 font-semibold">{{ t('promoters.detail.commissions.columns.period') }}</th>
                <th class="px-6 py-3 font-semibold">{{ t('promoters.detail.commissions.columns.count') }}</th>
                <th class="px-6 py-3 font-semibold">{{ t('promoters.detail.commissions.columns.total') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-prohealth-100">
              <TableSkeleton v-if="commissionsLoading" :rows="3" :cols="3" />
              <tr v-else-if="commissionsSummary.length === 0">
                <td colspan="3" class="px-6 py-10 text-center text-prohealth-500">
                  <UIcon name="i-lucide-hand-coins" class="w-7 h-7 mx-auto mb-2 text-prohealth-300" />
                  {{ t('promoters.detail.commissions.empty') }}
                </td>
              </tr>
              <tr v-for="s in commissionsSummary" v-else :key="`${s.periodStart}-${s.periodEnd}`" class="hover:bg-prohealth-50/50">
                <td class="px-6 py-3 font-semibold text-prohealth-900">{{ s.periodStart_Display ?? date(s.periodStart) }} – {{ s.periodEnd_Display ?? date(s.periodEnd) }}</td>
                <td class="px-6 py-3 text-prohealth-700">{{ s.commissionCount }}</td>
                <td class="px-6 py-3 text-prohealth-700">{{ money(s.totalAmount) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <!-- Edit modal (shared with the list) -->
    <PromoterFormModal v-model:open="formOpen" :promoter="promoter" @saved="onSaved" @delete="openDelete" />

    <!-- Delete confirmation modal -->
    <UModal v-model:open="deleteOpen" :title="t('promoters.deleteTitle')">
      <template #body>
        <div v-if="usageChecking" class="flex items-center gap-2 text-sm text-prohealth-600">
          <UIcon name="i-lucide-loader-2" class="w-4 h-4 animate-spin" />
          {{ t('common.loading') }}
        </div>
        <p v-else class="text-sm text-prohealth-700">
          {{
            usageInfo?.inUse === false
              ? t('promoters.deleteConfirmPermanent')
              : t('promoters.deleteConfirmDeactivate', { count: usageInfo?.count ?? 0 })
          }}
        </p>
        <div class="flex items-center justify-end gap-3 pt-5">
          <UButton color="neutral" variant="ghost" :disabled="deleting" @click="deleteOpen = false">
            {{ t('common.cancel') }}
          </UButton>
          <UButton color="error" :loading="deleting" :disabled="usageChecking" icon="i-lucide-trash-2" @click="confirmDelete">
            {{ t('common.delete') }}
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Audit modal -->
    <AuditModal
      v-if="promoter"
      v-model:open="auditOpen"
      entity-key="promoter"
      :entity-uuid="promoter.uuid"
      :entity-label="promoter.displayName"
      :entity-code="promoter.referralCode"
      :can-view-changes="canViewAuditChanges"
      :can-view-reports="canViewAuditReports"
    />
  </div>
</template>
