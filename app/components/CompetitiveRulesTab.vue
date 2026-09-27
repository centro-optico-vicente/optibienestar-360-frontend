<script setup lang="ts">
import type {
  AwardStatus,
  CompetitionType,
  CompetitiveAwardDto,
  CompetitiveAwardSettlementDto,
  CompetitiveMetric,
  CompetitiveRuleDto,
  CompetitiveRuleListItemDto,
} from '~/types/competitiveCommissions'
import { COMPETITION_TYPE_OPTIONS, COMPETITIVE_METRIC_OPTIONS } from '~/types/competitiveCommissions'
import type { SortDirection } from '~/composables/useTableSort'
import { buildPageSizeItems, DEFAULT_PAGE_SIZE } from '~/utils/pagination'
import type { SelectItem } from '~/types/options'

// "Reglas competitivas" tab body (hub plan competitive-commission-rules, Fase 4)
// — kept out of commission-rules/index.vue (already 1800+ lines across 5
// verticals) per the plan's own instruction not to grow that file further.
const { t } = useI18n()
const { can } = usePermissions()
const { formatDate } = useFormatters()
const toast = useToast()
const rulesApi = useCompetitiveCommissionRules()
const awardsApi = useCompetitiveCommissionAwards()
const promotersApi = usePromoters()

const canView = computed(() => can('COMPETITIVE_COMMISSION_RULE_VIEW_ALL'))
const canCreate = computed(() => can('COMPETITIVE_COMMISSION_RULE_CREATE'))
const canUpdate = computed(() => can('COMPETITIVE_COMMISSION_RULE_UPDATE'))
const canDelete = computed(() => can('COMPETITIVE_COMMISSION_RULE_DELETE'))
const canViewAwards = computed(() => can('COMPETITIVE_COMMISSION_AWARD_VIEW_ALL'))
const canPayAwards = computed(() => can('COMPETITIVE_COMMISSION_AWARD_PAY'))
const canVoidAwards = computed(() => can('COMPETITIVE_COMMISSION_AWARD_VOID'))
const canViewAudit = computed(() => can('AUDIT_VIEW_ALL') || can('COMMISSION_RECORD_AUDIT_VIEW'))
const canViewAuditReports = computed(() => can('REPORT_AUDIT_VIEW_ALL') || can('COMMISSION_REPORT_AUDIT_VIEW'))

const subTabs = computed(() => [
  { label: t('commissionRules.competitiveRules.subTabs.rules'), value: 'rules', icon: 'i-lucide-list' },
  { label: t('commissionRules.competitiveRules.subTabs.awards'), value: 'awards', icon: 'i-lucide-award' },
])
const subTab = ref('rules')

// ═══════════════════════════════════════════════════════════════════════
// Reglas
// ═══════════════════════════════════════════════════════════════════════

const data = ref<CompetitiveRuleListItemDto[]>([])
const total = ref(0)
const loading = ref(false)
const search = ref('')
const includeInactive = ref(false)
const campaignOnly = ref(false)
const metricFilter = ref<CompetitiveMetric | undefined>(undefined)
const competitionTypeFilter = ref<CompetitionType | undefined>(undefined)
const page = ref(1)
const size = ref(DEFAULT_PAGE_SIZE)
const resetting = ref(false)

const sort = useTableSort([])
const hasActiveSort = computed(() => sort.hasActiveSort.value)
const isMultiSort = computed(() => sort.orders.value.length > 1)

const metricFilterItems = computed(() => [
  { label: t('commissionRules.filters.allMetrics'), value: undefined },
  ...COMPETITIVE_METRIC_OPTIONS.map(o => ({ label: t(o.labelKey), value: o.value })),
])
const competitionTypeFilterItems = computed(() => [
  { label: t('commissionRules.filters.allCompetitionTypes'), value: undefined },
  ...COMPETITION_TYPE_OPTIONS.map(o => ({ label: t(o.labelKey), value: o.value })),
])

async function loadRules() {
  loading.value = true
  try {
    const res = await rulesApi.list({
      page: page.value - 1,
      size: size.value,
      sort: sort.sortParam.value,
      q: search.value.trim() || undefined,
      includeInactive: includeInactive.value,
      campaignLinked: campaignOnly.value || undefined,
      metric: metricFilter.value,
      competitionType: competitionTypeFilter.value,
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
    data.value = []
    total.value = 0
  }
  finally {
    loading.value = false
  }
}

onMounted(loadRules)
watch(size, () => { if (!resetting.value) page.value = 1 })
watch([page, size], () => { if (!resetting.value) loadRules() })
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, () => {
  if (resetting.value) return
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { page.value = 1; loadRules() }, 400)
})
watch([includeInactive, campaignOnly, metricFilter, competitionTypeFilter], () => {
  if (resetting.value) return
  page.value = 1
  loadRules()
})
watch(sort.orders, () => { if (!resetting.value) loadRules() }, { deep: true })

async function resetFilters() {
  resetting.value = true
  search.value = ''
  includeInactive.value = false
  campaignOnly.value = false
  metricFilter.value = undefined
  competitionTypeFilter.value = undefined
  sort.reset()
  size.value = DEFAULT_PAGE_SIZE
  page.value = 1
  await nextTick()
  resetting.value = false
  loadRules()
}

const formOpen = ref(false)
const editingRule = ref<CompetitiveRuleDto | null>(null)
function openCreate() {
  editingRule.value = null
  cloneSource.value = null
  formOpen.value = true
}
async function openEdit(item: CompetitiveRuleListItemDto) {
  if (!canUpdate.value) return
  try {
    editingRule.value = await rulesApi.get(item.uuid)
    cloneSource.value = null
    formOpen.value = true
  }
  catch { /* useApi already notified */ }
}
async function onSaved() { await loadRules() }

const cloneSource = ref<CompetitiveRuleDto | null>(null)
async function openClone(item: CompetitiveRuleListItemDto) {
  if (!canCreate.value) return
  try {
    cloneSource.value = await rulesApi.get(item.uuid)
    editingRule.value = null
    formOpen.value = true
  }
  catch { /* useApi already notified */ }
}

const deleteOpen = ref(false)
const deleting = ref(false)
const deleteTarget = ref<{ uuid: string, name: string } | null>(null)
function openDelete(rule: { uuid: string, name: string }) { deleteTarget.value = rule; deleteOpen.value = true }
async function confirmDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await rulesApi.remove(deleteTarget.value.uuid)
    toast.add({ title: t('commissionRules.competitiveRules.deletedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    deleteOpen.value = false
    await loadRules()
  }
  catch { /* toast handled by useApi */ }
  finally { deleting.value = false }
}

const auditOpen = ref(false)
const auditTarget = ref<{ uuid: string, name: string } | null>(null)
function openAudit(item: { uuid: string, name: string }) {
  auditTarget.value = item
  auditOpen.value = true
}

const leaderboardOpen = ref(false)
const leaderboardTarget = ref<CompetitiveRuleListItemDto | null>(null)
function openLeaderboard(rule: CompetitiveRuleListItemDto) {
  leaderboardTarget.value = rule
  leaderboardOpen.value = true
}

// ═══════════════════════════════════════════════════════════════════════
// Premios otorgados
// ═══════════════════════════════════════════════════════════════════════

const awardsData = ref<CompetitiveAwardDto[]>([])
const awardsTotal = ref(0)
const awardsLoading = ref(false)
const awardsPage = ref(1)
const awardsSize = ref(DEFAULT_PAGE_SIZE)
const awardsRuleUuid = ref<string | undefined>(undefined)
const awardsPromoterUuid = ref<string | undefined>(undefined)
const awardsStatus = ref<AwardStatus | undefined>(undefined)
const awardsPeriodFrom = ref('')
const awardsPeriodTo = ref('')
const awardsResetting = ref(false)

const awardStatusItems = computed(() => [
  { label: t('commissionRules.filters.allStatuses'), value: undefined },
  { label: t('commissionRules.competitiveRules.awardStatuses.PROVISIONAL'), value: 'PROVISIONAL' },
  { label: t('commissionRules.competitiveRules.awardStatuses.PENDING'), value: 'PENDING' },
  { label: t('commissionRules.competitiveRules.awardStatuses.PAID'), value: 'PAID' },
  { label: t('commissionRules.competitiveRules.awardStatuses.VOIDED'), value: 'VOIDED' },
])

async function searchRules(q: string): Promise<SelectItem[]> {
  const res = await rulesApi.list({ q, size: 20 })
  return (res.content ?? []).map(r => ({ label: r.name, value: r.uuid }))
}
async function searchPromoters(q: string): Promise<SelectItem[]> {
  const res = await promotersApi.list({ q, size: 20 })
  return (res.content ?? []).map(p => ({ label: p.displayName, value: p.uuid }))
}

function buildAwardsFilter(): string | undefined {
  const clauses: string[] = []
  if (awardsRuleUuid.value) clauses.push(`rule.uuid==${awardsRuleUuid.value}`)
  if (awardsPromoterUuid.value) clauses.push(`promoter.uuid==${awardsPromoterUuid.value}`)
  if (awardsStatus.value) clauses.push(`status==${awardsStatus.value}`)
  if (awardsPeriodFrom.value) clauses.push(`periodStart=ge=${awardsPeriodFrom.value}`)
  if (awardsPeriodTo.value) clauses.push(`periodStart=le=${awardsPeriodTo.value}`)
  return clauses.length ? clauses.join(';') : undefined
}

async function loadAwards() {
  awardsLoading.value = true
  try {
    const res = await awardsApi.list({ page: awardsPage.value - 1, size: awardsSize.value, filter: buildAwardsFilter() })
    awardsData.value = res.content ?? []
    awardsTotal.value = res.totalElements ?? 0
  }
  catch {
    awardsData.value = []
    awardsTotal.value = 0
  }
  finally {
    awardsLoading.value = false
  }
}

watch(subTab, (tab) => { if (tab === 'awards' && awardsData.value.length === 0 && !awardsLoading.value) loadAwards() })
watch(awardsSize, () => { if (!awardsResetting.value) awardsPage.value = 1 })
watch([awardsPage, awardsSize], () => { if (!awardsResetting.value) loadAwards() })
watch([awardsRuleUuid, awardsPromoterUuid, awardsStatus, awardsPeriodFrom, awardsPeriodTo], () => {
  if (awardsResetting.value) return
  awardsPage.value = 1
  loadAwards()
})

async function resetAwardsFilters() {
  awardsResetting.value = true
  awardsRuleUuid.value = undefined
  awardsPromoterUuid.value = undefined
  awardsStatus.value = undefined
  awardsPeriodFrom.value = ''
  awardsPeriodTo.value = ''
  awardsSize.value = DEFAULT_PAGE_SIZE
  awardsPage.value = 1
  await nextTick()
  awardsResetting.value = false
  loadAwards()
}

// ---- Expandable settlements sub-table ----
const expandedAwards = ref<Set<string>>(new Set())
const settlementsByAward = ref<Record<string, CompetitiveAwardSettlementDto[]>>({})
const loadingSettlements = ref<Set<string>>(new Set())
async function toggleExpand(award: CompetitiveAwardDto) {
  const next = new Set(expandedAwards.value)
  if (next.has(award.uuid)) {
    next.delete(award.uuid)
    expandedAwards.value = next
    return
  }
  next.add(award.uuid)
  expandedAwards.value = next
  if (!settlementsByAward.value[award.uuid]) {
    loadingSettlements.value = new Set(loadingSettlements.value).add(award.uuid)
    try {
      settlementsByAward.value = { ...settlementsByAward.value, [award.uuid]: await awardsApi.settlements(award.uuid) }
    }
    catch { settlementsByAward.value = { ...settlementsByAward.value, [award.uuid]: [] } }
    finally {
      const l = new Set(loadingSettlements.value)
      l.delete(award.uuid)
      loadingSettlements.value = l
    }
  }
}

// ---- Pay (award-level shortcut, or one settlement) ----
const payOpen = ref(false)
const paying = ref(false)
const payTarget = ref<{ kind: 'award' | 'settlement', uuid: string } | null>(null)
const payReference = ref('')
function openPayAward(award: CompetitiveAwardDto) { payTarget.value = { kind: 'award', uuid: award.uuid }; payReference.value = ''; payOpen.value = true }
function openPaySettlement(settlement: CompetitiveAwardSettlementDto) { payTarget.value = { kind: 'settlement', uuid: settlement.uuid }; payReference.value = ''; payOpen.value = true }
async function confirmPay() {
  if (!payTarget.value || !payReference.value.trim()) return
  paying.value = true
  try {
    if (payTarget.value.kind === 'award') await awardsApi.pay(payTarget.value.uuid, payReference.value.trim())
    else await awardsApi.paySettlement(payTarget.value.uuid, payReference.value.trim())
    toast.add({ title: t('commissionRules.competitiveRules.payToast'), color: 'success', icon: 'i-lucide-check-circle' })
    payOpen.value = false
    await loadAwards()
    expandedAwards.value = new Set()
    settlementsByAward.value = {}
  }
  catch { /* useApi already notified */ }
  finally { paying.value = false }
}

// ---- Void ----
const voidOpen = ref(false)
const voiding = ref(false)
const voidTarget = ref<CompetitiveAwardDto | null>(null)
const voidReason = ref('')
function openVoid(award: CompetitiveAwardDto) { voidTarget.value = award; voidReason.value = ''; voidOpen.value = true }
async function confirmVoid() {
  if (!voidTarget.value || voidReason.value.trim().length < 10) return
  voiding.value = true
  try {
    await awardsApi.voidAward(voidTarget.value.uuid, voidReason.value.trim())
    toast.add({ title: t('commissionRules.competitiveRules.voidToast'), color: 'success', icon: 'i-lucide-check-circle' })
    voidOpen.value = false
    await loadAwards()
  }
  catch { /* useApi already notified */ }
  finally { voiding.value = false }
}

function statusColor(status: string): 'success' | 'warning' | 'neutral' | 'error' {
  if (status === 'PAID') return 'success'
  if (status === 'PENDING' || status === 'PROVISIONAL') return 'warning'
  if (status === 'VOIDED') return 'error'
  return 'neutral'
}
</script>

<template>
  <div class="space-y-4">
    <UTabs v-model="subTab" :items="subTabs" :content="false" size="sm" />

    <div v-show="subTab === 'rules'" class="space-y-4">
      <div class="flex items-center justify-end gap-2">
        <ListRefreshMenu :loading="loading" variant="ghost" @refresh="loadRules" @reset="resetFilters" />
        <UButton v-if="canCreate" color="primary" variant="outline" icon="i-lucide-plus" @click="openCreate">
          {{ t('common.new') }}
        </UButton>
      </div>

      <div class="bg-white rounded-2xl border border-prohealth-100 p-4 flex flex-wrap items-center gap-3">
        <UInput v-model="search" :placeholder="t('commissionRules.competitiveRules.searchPlaceholder')" icon="i-lucide-search" size="lg" class="w-full max-w-md" />
        <USelectMenu clear v-model="metricFilter" :items="metricFilterItems" label-key="label" value-key="value" icon="i-lucide-target" class="w-56" />
        <USelectMenu clear v-model="competitionTypeFilter" :items="competitionTypeFilterItems" label-key="label" value-key="value" icon="i-lucide-flag" class="w-52" />
        <UCheckbox v-model="includeInactive" :label="$t('catalogs.includeInactive')" class="self-center" />
        <UCheckbox v-model="campaignOnly" :label="t('commissionRules.filters.campaignOnly')" class="self-center" />
        <UButton v-if="hasActiveSort" variant="link" color="neutral" size="sm" icon="i-lucide-list-restart" :title="t('common.clearSortHint')" @click="sort.reset()">
          {{ t('common.clearSort') }}
        </UButton>
      </div>

      <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-prohealth-50/60">
            <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('name')">
                {{ t('commissionRules.competitiveRules.columns.name') }}
                <SortIndicator :state="sort.stateOf('name')" :multi-active="isMultiSort" @clear="sort.remove('name')" />
              </th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('metric')">
                {{ t('commissionRules.competitiveRules.columns.metric') }}
                <SortIndicator :state="sort.stateOf('metric')" :multi-active="isMultiSort" @clear="sort.remove('metric')" />
              </th>
              <th class="px-5 py-3 font-semibold">{{ t('commissionRules.competitiveRules.columns.competitionType') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('commissionRules.competitiveRules.columns.threshold') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('commissionRules.competitiveRules.columns.positions') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('commissionRules.bonusRules.columns.campaign') }}</th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('active')">
                {{ t('catalogs.columns.status') }}
                <SortIndicator :state="sort.stateOf('active')" :multi-active="isMultiSort" @clear="sort.remove('active')" />
              </th>
              <th class="px-5 py-3 font-semibold text-right">{{ t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-prohealth-100">
            <TableSkeleton v-if="loading" :rows="4" :cols="8" />
            <tr v-else-if="data.length === 0">
              <td colspan="8" class="px-5 py-10 text-center text-prohealth-500">{{ t('commissionRules.competitiveRules.empty') }}</td>
            </tr>
            <tr v-for="rule in data" v-else :key="rule.uuid" class="hover:bg-prohealth-50/50"
                :class="{ 'opacity-60': !rule.active, 'cursor-pointer': canUpdate }" @click="canUpdate && openEdit(rule)">
              <td class="px-5 py-3 font-medium text-prohealth-900">{{ rule.name }}</td>
              <td class="px-5 py-3 text-prohealth-600">{{ t(`commissionRules.competitiveRules.metrics.${rule.metric}`) }}</td>
              <td class="px-5 py-3 text-prohealth-600">{{ t(`commissionRules.competitiveRules.competitionTypes.${rule.competitionType}`) }}</td>
              <td class="px-5 py-3 text-prohealth-600">
                <span v-if="rule.thresholdCount != null">{{ rule.thresholdCount }}</span>
                <span v-else-if="rule.thresholdAmount != null">{{ rule.thresholdAmount }} {{ rule.thresholdCurrency_Display }}</span>
                <span v-else class="text-prohealth-300">—</span>
              </td>
              <td class="px-5 py-3 text-prohealth-600">{{ rule.positionsSummary }}</td>
              <td class="px-5 py-3 text-prohealth-600" @click.stop>
                <CommonEntityLinkCell :to="rule.campaign_Uuid ? `/dashboard/campaigns/${rule.campaign_Uuid}` : null" :label="rule.campaign_Display" :can="can('CAMPAIGN_VIEW_ALL')" />
              </td>
              <td class="px-5 py-3">
                <UBadge :color="rule.active ? 'success' : 'neutral'" variant="subtle" size="sm">
                  {{ rule.active ? t('catalogs.status.active') : t('catalogs.status.inactive') }}
                </UBadge>
              </td>
              <td class="px-5 py-3" @click.stop>
                <div class="flex items-center justify-end gap-1">
                  <UTooltip v-if="canUpdate" :text="t('commissionRules.competitiveRules.leaderboard.trigger')">
                    <UButton color="warning" variant="ghost" icon="i-lucide-calculator" size="sm" @click="openLeaderboard(rule)" />
                  </UTooltip>
                  <UButton v-if="canUpdate" color="info" variant="ghost" icon="i-lucide-pencil" size="sm" @click="openEdit(rule)" />
                  <UTooltip v-if="canCreate" :text="t('commissionRules.competitiveRules.cloneTrigger')">
                    <UButton color="neutral" variant="ghost" icon="i-lucide-copy" size="sm" @click="openClone(rule)" />
                  </UTooltip>
                  <UTooltip v-if="canViewAudit || canViewAuditReports" :text="t('audit.trigger')">
                    <UButton color="neutral" variant="ghost" icon="i-lucide-history" size="sm" @click="openAudit(rule)" />
                  </UTooltip>
                  <UButton v-if="canDelete" color="error" variant="ghost" icon="i-lucide-trash-2" size="sm" class="ms-2" @click="openDelete(rule)" />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        <div class="flex items-center flex-wrap justify-between gap-3 px-5 py-3 border-t border-prohealth-100 shrink-0">
          <p class="text-xs text-prohealth-500">
            {{ t('commissionRules.competitiveRules.paginationSummary', { shown: data.length, total }) }}
          </p>
          <div class="flex items-center gap-3">
            <USelectMenu clear v-model="size" :items="buildPageSizeItems(t)" label-key="label" value-key="value" class="w-32" />
            <UPagination v-model:page="page" :total="total" :items-per-page="size" />
          </div>
        </div>
      </div>
    </div>

    <div v-show="subTab === 'awards'" class="space-y-4">
      <div class="flex items-center justify-end gap-2">
        <ListRefreshMenu :loading="awardsLoading" variant="ghost" @refresh="loadAwards" @reset="resetAwardsFilters" />
      </div>

      <div class="bg-white rounded-2xl border border-prohealth-100 p-4 flex flex-wrap items-center gap-3">
        <CommonEntityReferenceSelect v-model="awardsRuleUuid" :search="searchRules"
                                     :placeholder="t('commissionRules.competitiveRules.filters.rule')" icon="i-lucide-trophy" class="w-56" />
        <CommonEntityReferenceSelect v-model="awardsPromoterUuid" :search="searchPromoters" entity="promoter"
                                     :placeholder="t('commissionRules.competitiveRules.filters.promoter')" icon="i-lucide-user" class="w-56" />
        <USelectMenu clear v-model="awardsStatus" :items="awardStatusItems" label-key="label" value-key="value" icon="i-lucide-flag" class="w-48" />
        <UInput v-model="awardsPeriodFrom" type="date" class="w-40" />
        <UInput v-model="awardsPeriodTo" type="date" class="w-40" />
      </div>

      <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-prohealth-50/60">
            <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
              <th class="px-5 py-3 font-semibold w-8" />
              <th class="px-5 py-3 font-semibold">{{ t('commissionRules.competitiveRules.awardColumns.rule') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('commissionRules.competitiveRules.awardColumns.promoter') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('commissionRules.competitiveRules.awardColumns.period') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('commissionRules.competitiveRules.awardColumns.position') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('commissionRules.competitiveRules.awardColumns.amount') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('catalogs.columns.status') }}</th>
              <th class="px-5 py-3 font-semibold text-right">{{ t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-prohealth-100">
            <TableSkeleton v-if="awardsLoading" :rows="4" :cols="8" />
            <tr v-else-if="awardsData.length === 0">
              <td colspan="8" class="px-5 py-10 text-center text-prohealth-500">{{ t('commissionRules.competitiveRules.awardsEmpty') }}</td>
            </tr>
            <template v-for="award in awardsData" v-else :key="award.uuid">
              <tr class="hover:bg-prohealth-50/50">
                <td class="px-5 py-3">
                  <UButton color="neutral" variant="ghost" size="xs"
                           :icon="expandedAwards.has(award.uuid) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
                           @click="toggleExpand(award)" />
                </td>
                <td class="px-5 py-3 text-prohealth-800">{{ award.rule_Display }}</td>
                <td class="px-5 py-3 text-prohealth-800">{{ award.promoter_Display }}</td>
                <td class="px-5 py-3 text-prohealth-600">{{ formatDate(award.periodStart) }} – {{ formatDate(award.periodEnd) }}</td>
                <td class="px-5 py-3 text-prohealth-600">
                  {{ award.awardPosition }}
                  <UBadge v-if="award.tieGroupSize > 1" color="info" variant="subtle" size="xs" class="ms-1">{{ t('commissionRules.competitiveRules.tieGroup', { n: award.tieGroupSize }) }}</UBadge>
                </td>
                <td class="px-5 py-3 text-prohealth-800 font-medium">{{ award.amount }} {{ award.currency_Display }}</td>
                <td class="px-5 py-3">
                  <UBadge :color="statusColor(award.status)" variant="subtle" size="sm">{{ t(`commissionRules.competitiveRules.awardStatuses.${award.status}`) }}</UBadge>
                </td>
                <td class="px-5 py-3">
                  <div class="flex items-center justify-end gap-1">
                    <UButton v-if="canPayAwards && award.status === 'PENDING'" color="success" variant="ghost" icon="i-lucide-banknote" size="sm" @click="openPayAward(award)" />
                    <UButton v-if="canVoidAwards && award.status !== 'PAID' && award.status !== 'VOIDED'" color="error" variant="ghost" icon="i-lucide-ban" size="sm" @click="openVoid(award)" />
                  </div>
                </td>
              </tr>
              <tr v-if="expandedAwards.has(award.uuid)">
                <td colspan="8" class="px-5 py-3 bg-prohealth-50/40">
                  <p v-if="loadingSettlements.has(award.uuid)" class="text-xs text-prohealth-500">{{ t('common.loading') }}</p>
                  <table v-else class="w-full text-xs">
                    <thead>
                      <tr class="text-left uppercase tracking-wide text-prohealth-400">
                        <th class="px-3 py-2 font-semibold">{{ t('commissionRules.competitiveRules.settlementColumns.cutKind') }}</th>
                        <th class="px-3 py-2 font-semibold">{{ t('commissionRules.competitiveRules.settlementColumns.window') }}</th>
                        <th class="px-3 py-2 font-semibold">{{ t('commissionRules.competitiveRules.settlementColumns.entitlement') }}</th>
                        <th class="px-3 py-2 font-semibold">{{ t('commissionRules.competitiveRules.settlementColumns.amount') }}</th>
                        <th class="px-3 py-2 font-semibold">{{ t('catalogs.columns.status') }}</th>
                        <th class="px-3 py-2 font-semibold text-right">{{ t('common.actions') }}</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-prohealth-100">
                      <tr v-if="(settlementsByAward[award.uuid] ?? []).length === 0">
                        <td colspan="6" class="px-3 py-4 text-center text-prohealth-400">{{ t('commissionRules.competitiveRules.settlementsEmpty') }}</td>
                      </tr>
                      <tr v-for="settlement in settlementsByAward[award.uuid] ?? []" :key="settlement.uuid">
                        <td class="px-3 py-2">{{ t(`commissionRules.competitiveRules.cutKinds.${settlement.cutKind}`) }} #{{ settlement.cutSequence }}</td>
                        <td class="px-3 py-2 text-prohealth-600">{{ formatDate(settlement.cutStart) }} – {{ formatDate(settlement.cutEnd) }}</td>
                        <td class="px-3 py-2 text-prohealth-600">{{ settlement.entitlementCumulative }}</td>
                        <td class="px-3 py-2 font-medium">{{ settlement.amount }} {{ settlement.currency_Display }}</td>
                        <td class="px-3 py-2">
                          <UBadge :color="statusColor(settlement.status)" variant="subtle" size="xs">{{ t(`commissionRules.competitiveRules.awardStatuses.${settlement.status}`) }}</UBadge>
                        </td>
                        <td class="px-3 py-2 text-right">
                          <UButton v-if="canPayAwards && settlement.status === 'PENDING'" color="success" variant="ghost" icon="i-lucide-banknote" size="xs" @click="openPaySettlement(settlement)" />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
        <div class="flex items-center flex-wrap justify-between gap-3 px-5 py-3 border-t border-prohealth-100 shrink-0">
          <p class="text-xs text-prohealth-500">{{ t('commissionRules.competitiveRules.paginationSummary', { shown: awardsData.length, total: awardsTotal }) }}</p>
          <div class="flex items-center gap-3">
            <USelectMenu clear v-model="awardsSize" :items="buildPageSizeItems(t)" label-key="label" value-key="value" class="w-32" />
            <UPagination v-model:page="awardsPage" :total="awardsTotal" :items-per-page="awardsSize" />
          </div>
        </div>
      </div>
    </div>

    <CompetitiveRuleFormModal v-model:open="formOpen" :rule="editingRule" :clone-from="cloneSource" @saved="onSaved" @delete="openDelete" />
    <CompetitiveRuleLeaderboardModal v-model:open="leaderboardOpen" :rule="leaderboardTarget" @done="loadRules" />

    <UModal v-model:open="deleteOpen" :title="t('commissionRules.competitiveRules.deleteTitle')">
      <template #body>
        <p class="text-sm text-prohealth-700">{{ t('commissionRules.competitiveRules.deleteConfirm', { name: deleteTarget?.name ?? '' }) }}</p>
        <div class="flex items-center justify-end gap-3 pt-5">
          <UButton color="neutral" variant="ghost" :disabled="deleting" @click="deleteOpen = false">{{ t('common.cancel') }}</UButton>
          <UButton color="error" icon="i-lucide-trash-2" :loading="deleting" @click="confirmDelete">{{ t('common.delete') }}</UButton>
        </div>
      </template>
    </UModal>

    <UModal v-model:open="payOpen" :title="t('commissionRules.competitiveRules.payTitle')">
      <template #body>
        <div class="space-y-4">
          <UFormField :label="t('commissionRules.competitiveRules.payoutReference')" required>
            <UInput v-model="payReference" class="w-full" />
          </UFormField>
          <div class="flex items-center justify-end gap-3">
            <UButton color="neutral" variant="ghost" :disabled="paying" @click="payOpen = false">{{ t('common.cancel') }}</UButton>
            <UButton color="success" icon="i-lucide-banknote" :loading="paying" :disabled="!payReference.trim()" @click="confirmPay">{{ t('common.confirm') }}</UButton>
          </div>
        </div>
      </template>
    </UModal>

    <UModal v-model:open="voidOpen" :title="t('commissionRules.competitiveRules.voidTitle')">
      <template #body>
        <div class="space-y-4">
          <UFormField :label="t('commissionRules.competitiveRules.voidReason')" required :help="t('commissionRules.competitiveRules.voidReasonHelp')">
            <UTextarea v-model="voidReason" :rows="3" class="w-full" />
          </UFormField>
          <div class="flex items-center justify-end gap-3">
            <UButton color="neutral" variant="ghost" :disabled="voiding" @click="voidOpen = false">{{ t('common.cancel') }}</UButton>
            <UButton color="error" icon="i-lucide-ban" :loading="voiding" :disabled="voidReason.trim().length < 10" @click="confirmVoid">{{ t('common.confirm') }}</UButton>
          </div>
        </div>
      </template>
    </UModal>

    <AuditModal
      v-if="auditTarget"
      v-model:open="auditOpen"
      entity-key="competitive_commission_rule"
      :entity-uuid="auditTarget.uuid"
      :entity-label="auditTarget.name"
      :can-view-changes="canViewAudit"
      :can-view-reports="canViewAuditReports"
    />
  </div>
</template>
