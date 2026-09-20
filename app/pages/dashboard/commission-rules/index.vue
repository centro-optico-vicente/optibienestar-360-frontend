<script setup lang="ts">
import { buildPageSizeItems, DEFAULT_PAGE_SIZE, UNPAGED_PAGE_SIZE } from '~/utils/pagination'
import type { SelectItem } from '~/types/options'
import type { AppliesTo, CommissionTierDto } from '~/types/commissionTiers'
import { APPLIES_TO_OPTIONS } from '~/types/commissionTiers'
import type { BonusRuleDto } from '~/types/bonusRules'
import type { CollectionCommissionTierDto } from '~/types/collectionCommissionTiers'
import type { PlanType } from '~/types/plans'
import { PLAN_TYPE_OPTIONS } from '~/types/plans'
import type { SortDirection } from '~/composables/useTableSort'
import type { HierarchyOverrideTierDto, OverrideCategory } from '~/types/hierarchyOverrideTiers'
import { OVERRIDE_CATEGORY_OPTIONS } from '~/types/hierarchyOverrideTiers'

// Admin editor for the three commission-engine rule surfaces (ADR 0013):
// inscription bands (commission_tiers, V42), scale bonuses (commission_bonus_rules,
// V37) and collection buckets by days (collection_commission_tiers, V44). Each tab
// is its own simple CRUD table + modal — the backend recalculates; this UI configures.
definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: ['COMMISSION_TIER_VIEW_ALL', 'BONUS_RULE_VIEW_ALL', 'COLLECTION_COMMISSION_TIER_VIEW_ALL', 'HIERARCHY_OVERRIDE_TIER_VIEW_ALL'],
})

const { t } = useI18n()
const { can } = usePermissions()
const toast = useToast()

// Guards the per-tab filter watchers so "clear filters and refresh" fires a
// single reload instead of one per changed ref.
const resetting = ref(false)

// commission_tier and bonus_rule share the COMMISSIONS permission domain (V66/V72).
const canViewAuditChanges = computed(() => can('AUDIT_VIEW_ALL') || can('COMMISSION_RECORD_AUDIT_VIEW'))
const canViewAuditReports = computed(() => can('REPORT_AUDIT_VIEW_ALL') || can('COMMISSION_REPORT_AUDIT_VIEW'))
const canViewAudit = computed(() => canViewAuditChanges.value || canViewAuditReports.value)

const auditOpen = ref(false)
const auditEntityKey = ref<'commission_tier' | 'bonus_rule'>('commission_tier')
const auditTarget = ref<{ uuid: string, name: string } | null>(null)

function openAudit(entityKey: 'commission_tier' | 'bonus_rule', item: { uuid: string, name: string }) {
  auditEntityKey.value = entityKey
  auditTarget.value = item
  auditOpen.value = true
}

useSeoMeta({ title: () => t('common.seoTitle', { page: t('nav.items.commissionRules.label') }) })

const tabs = computed(() => [
  { label: t('commissionRules.tabs.tiers'), value: 'tiers', icon: 'i-lucide-trending-up' },
  { label: t('commissionRules.tabs.bonusRules'), value: 'bonusRules', icon: 'i-lucide-gift' },
  { label: t('commissionRules.tabs.collectionTiers'), value: 'collectionTiers', icon: 'i-lucide-calendar-clock' },
  { label: t('commissionRules.tabs.overrideTiers'), value: 'overrideTiers', icon: 'i-lucide-network' },
])
const activeTab = ref('tiers')
const pageSizeItems = buildPageSizeItems(t)

// ---- Promoter-type quick filter (shared catalog, loaded once for all 3 tabs) ----
const promoterTypeItems = ref<SelectItem[]>([])
const promoterTypeOptions = useCatalogOptions('promoter-types')
onMounted(async () => {
  try {
    const res = await promoterTypeOptions.options({ limit: 100 })
    promoterTypeItems.value = res.map(o => ({ label: o.label, value: o.uuid }))
  }
  catch {
    promoterTypeItems.value = []
  }
})
const promoterTypeFilterItems = computed(() => [
  { label: t('commissionRules.filters.allPromoterTypes'), value: undefined },
  ...promoterTypeItems.value,
])
const planTypeFilterItems = computed(() => [
  { label: t('commissionRules.filters.allPlanTypes'), value: undefined },
  ...PLAN_TYPE_OPTIONS.map(o => ({ label: t(o.labelKey), value: o.value })),
])
const appliesToFilterItems = computed(() => [
  { label: t('commissionRules.filters.allAppliesTo'), value: undefined },
  ...APPLIES_TO_OPTIONS.map(o => ({ label: t(o.labelKey), value: o.value })),
])

// ---- Rank quick filter (Supervisor/Coordinador catalog, tab 4 only) ----
const rankItems = ref<SelectItem[]>([])
const hierarchyApi = usePromoterHierarchy()
onMounted(async () => {
  try {
    const res = await hierarchyApi.rankOptions({ limit: 100 })
    rankItems.value = res.map(o => ({ label: o.label, value: o.uuid }))
  }
  catch {
    rankItems.value = []
  }
})
const rankFilterItems = computed(() => [
  { label: t('hierarchyOverrideTiers.filters.allRanks'), value: undefined },
  ...rankItems.value,
])
const categoryFilterItems = computed(() => [
  { label: t('hierarchyOverrideTiers.filters.allCategories'), value: undefined },
  ...OVERRIDE_CATEGORY_OPTIONS.map(o => ({ label: t(o.labelKey), value: o.value })),
])

// =========================================================
// Tab 1 — Bandas de inscripción (commission_tiers)
// =========================================================
const tierApi = useCommissionTiers()
const canViewTiers = computed(() => can('COMMISSION_TIER_VIEW_ALL'))
const canCreateTiers = computed(() => can('COMMISSION_TIER_CREATE'))
const canUpdateTiers = computed(() => can('COMMISSION_TIER_UPDATE'))
const canDeleteTiers = computed(() => can('COMMISSION_TIER_DELETE'))
const tierData = ref<CommissionTierDto[]>([])
const tierTotal = ref(0)
const tierLoading = ref(false)
const tierSearch = ref('')
const tierIncludeInactive = ref(false)
const tierPromoterTypeUuid = ref<string | undefined>(undefined)
const tierPlanType = ref<PlanType | undefined>(undefined)
const tierAppliesTo = ref<AppliesTo | undefined>(undefined)
const tierPage = ref(1)
const tierSize = ref(DEFAULT_PAGE_SIZE)

// RSQL: planType/appliesTo equality, applied server-side so pagination stays consistent.
function buildTierFilter(): string | undefined {
  const clauses: string[] = []
  if (tierPlanType.value) clauses.push(`planType==${tierPlanType.value}`)
  if (tierAppliesTo.value) clauses.push(`appliesTo==${tierAppliesTo.value}`)
  return clauses.length ? clauses.join(';') : undefined
}

// Empty by default: no `sort=` is sent until the user clicks a column, so
// the backend's own default-sort fallback (entity_config → system_configs
// → thresholdCount ASC) applies.
const tierSort = useTableSort([])
const tierHasActiveSort = computed(() => tierSort.hasActiveSort.value)
const tierIsMultiSort = computed(() => tierSort.orders.value.length > 1)

async function loadTiers() {
  tierLoading.value = true
  try {
    const res = await tierApi.list({
      page: tierPage.value - 1,
      size: tierSize.value,
      sort: tierSort.sortParam.value,
      q: tierSearch.value.trim() || undefined,
      filter: buildTierFilter(),
      includeInactive: tierIncludeInactive.value,
      promoterTypeUuid: tierPromoterTypeUuid.value,
    })
    tierData.value = res.content ?? []
    tierTotal.value = res.totalElements ?? 0
    if (tierSort.orders.value.length === 0 && res.appliedSort?.length) {
      resetting.value = true
      tierSort.seedServerDefault(res.appliedSort.map(o => ({ field: o.field, direction: o.direction.toLowerCase() as SortDirection })))
      await nextTick()
      resetting.value = false
    }
  }
  catch {
    tierData.value = []
    tierTotal.value = 0
  }
  finally {
    tierLoading.value = false
  }
}

watch(tierSize, () => { if (!resetting.value) tierPage.value = 1 })
watch([tierPage, tierSize], () => { if (!resetting.value) loadTiers() })
let tierSearchTimer: ReturnType<typeof setTimeout> | undefined
watch(tierSearch, () => {
  if (resetting.value) return
  clearTimeout(tierSearchTimer)
  tierSearchTimer = setTimeout(() => { tierPage.value = 1; loadTiers() }, 400)
})
watch([tierIncludeInactive, tierPromoterTypeUuid, tierPlanType, tierAppliesTo], () => {
  if (resetting.value) return
  tierPage.value = 1
  loadTiers()
})
watch(tierSort.orders, () => { if (!resetting.value) loadTiers() }, { deep: true })

async function resetTierFilters() {
  resetting.value = true
  tierSearch.value = ''
  tierIncludeInactive.value = false
  tierPromoterTypeUuid.value = undefined
  tierPlanType.value = undefined
  tierAppliesTo.value = undefined
  tierSort.reset()
  tierSize.value = DEFAULT_PAGE_SIZE
  tierPage.value = 1
  await nextTick()
  resetting.value = false
  loadTiers()
}

const tierFormOpen = ref(false)
const editingTier = ref<CommissionTierDto | null>(null)
function openCreateTier() { editingTier.value = null; tierFormOpen.value = true }
function openEditTier(tier: CommissionTierDto) { editingTier.value = tier; tierFormOpen.value = true }
async function onTierSaved() { await loadTiers() }

const tierDeleteOpen = ref(false)
const tierDeleting = ref(false)
const tierTarget = ref<CommissionTierDto | null>(null)
const tierUsageChecking = ref(false)
const tierUsageInfo = ref<{ inUse: boolean, count: number } | null>(null)
async function openDeleteTier(tier: CommissionTierDto) {
  tierTarget.value = tier
  tierDeleteOpen.value = true
  tierUsageChecking.value = true
  tierUsageInfo.value = null
  try {
    tierUsageInfo.value = await tierApi.usage(tier.uuid)
  }
  catch {
    // Fallback: treat as "in use" for safety (soft-deactivate instead of physical delete).
    tierUsageInfo.value = null
  }
  finally {
    tierUsageChecking.value = false
  }
}
function onDeleteTierFromEdit(tier: CommissionTierDto) { openDeleteTier(tier) }
async function confirmDeleteTier() {
  if (!tierTarget.value) return
  tierDeleting.value = true
  const wasPhysical = tierUsageInfo.value?.inUse === false
  try {
    await tierApi.remove(tierTarget.value.uuid, wasPhysical)
    toast.add({
      title: wasPhysical
        ? t('commissionRules.tiers.deletedPermanentToast')
        : t('commissionRules.tiers.deactivatedToast'),
      color: wasPhysical ? 'success' : 'info',
      icon: wasPhysical ? 'i-lucide-check-circle' : 'i-lucide-info',
    })
    tierDeleteOpen.value = false
    await loadTiers()
  }
  catch { /* toast handled by useApi */ }
  finally { tierDeleting.value = false }
}

function tierReward(tier: CommissionTierDto): string {
  if (tier.commissionPct != null) return `${tier.commissionPct}%`
  if (tier.flatAmount != null) return `$${tier.flatAmount}`
  return t('common.empty')
}

// =========================================================
// Tab 2 — Bonos por escala (commission_bonus_rules)
// =========================================================
const bonusApi = useBonusRules()
const canViewBonus = computed(() => can('BONUS_RULE_VIEW_ALL'))
const canCreateBonus = computed(() => can('BONUS_RULE_CREATE'))
const canUpdateBonus = computed(() => can('BONUS_RULE_UPDATE'))
const canDeleteBonus = computed(() => can('BONUS_RULE_DELETE'))
const bonusData = ref<BonusRuleDto[]>([])
const bonusTotal = ref(0)
const bonusLoading = ref(false)
const bonusSearch = ref('')
const bonusIncludeInactive = ref(false)
const bonusPromoterTypeUuid = ref<string | undefined>(undefined)
const bonusPage = ref(1)
const bonusSize = ref(DEFAULT_PAGE_SIZE)

// Empty by default: no `sort=` is sent until the user clicks a column, so
// the backend's own default-sort fallback (entity_config → system_configs
// → createdAt DESC) applies.
const bonusSort = useTableSort([])
const bonusHasActiveSort = computed(() => bonusSort.hasActiveSort.value)
const bonusIsMultiSort = computed(() => bonusSort.orders.value.length > 1)

async function loadBonusRules() {
  bonusLoading.value = true
  try {
    const res = await bonusApi.list({
      page: bonusPage.value - 1,
      size: bonusSize.value,
      sort: bonusSort.sortParam.value,
      q: bonusSearch.value.trim() || undefined,
      includeInactive: bonusIncludeInactive.value,
      promoterTypeUuid: bonusPromoterTypeUuid.value,
    })
    bonusData.value = res.content ?? []
    bonusTotal.value = res.totalElements ?? 0
    if (bonusSort.orders.value.length === 0 && res.appliedSort?.length) {
      resetting.value = true
      bonusSort.seedServerDefault(res.appliedSort.map(o => ({ field: o.field, direction: o.direction.toLowerCase() as SortDirection })))
      await nextTick()
      resetting.value = false
    }
  }
  catch {
    bonusData.value = []
    bonusTotal.value = 0
  }
  finally {
    bonusLoading.value = false
  }
}

watch(bonusSize, () => { if (!resetting.value) bonusPage.value = 1 })
watch([bonusPage, bonusSize], () => { if (!resetting.value) loadBonusRules() })
let bonusSearchTimer: ReturnType<typeof setTimeout> | undefined
watch(bonusSearch, () => {
  if (resetting.value) return
  clearTimeout(bonusSearchTimer)
  bonusSearchTimer = setTimeout(() => { bonusPage.value = 1; loadBonusRules() }, 400)
})
watch([bonusIncludeInactive, bonusPromoterTypeUuid], () => {
  if (resetting.value) return
  bonusPage.value = 1
  loadBonusRules()
})
watch(bonusSort.orders, () => { if (!resetting.value) loadBonusRules() }, { deep: true })

async function resetBonusFilters() {
  resetting.value = true
  bonusSearch.value = ''
  bonusIncludeInactive.value = false
  bonusPromoterTypeUuid.value = undefined
  bonusSort.reset()
  bonusSize.value = DEFAULT_PAGE_SIZE
  bonusPage.value = 1
  await nextTick()
  resetting.value = false
  loadBonusRules()
}

const bonusFormOpen = ref(false)
const editingBonus = ref<BonusRuleDto | null>(null)
function openCreateBonus() { editingBonus.value = null; bonusFormOpen.value = true }
function openEditBonus(rule: BonusRuleDto) { editingBonus.value = rule; bonusFormOpen.value = true }
async function onBonusSaved() { await loadBonusRules() }

const bonusDeleteOpen = ref(false)
const bonusDeleting = ref(false)
const bonusTarget = ref<BonusRuleDto | null>(null)
function openDeleteBonus(rule: BonusRuleDto) { bonusTarget.value = rule; bonusDeleteOpen.value = true }
function onDeleteBonusFromEdit(rule: BonusRuleDto) { openDeleteBonus(rule) }
async function confirmDeleteBonus() {
  if (!bonusTarget.value) return
  bonusDeleting.value = true
  try {
    await bonusApi.remove(bonusTarget.value.uuid)
    toast.add({ title: t('commissionRules.bonusRules.deletedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    bonusDeleteOpen.value = false
    await loadBonusRules()
  }
  catch { /* toast handled by useApi */ }
  finally { bonusDeleting.value = false }
}

function bonusReward(rule: BonusRuleDto): string {
  if (rule.rewardType === 'PERCENTAGE') return `${rule.rewardPct}%`
  return `$${rule.flatAmount} ${rule.rewardCurrency}`
}

// =========================================================
// Tab 3 — Comisión de cobranza (collection_commission_tiers)
// =========================================================
const collectionApi = useCollectionCommissionTiers()
const canViewCollection = computed(() => can('COLLECTION_COMMISSION_TIER_VIEW_ALL'))
const canCreateCollection = computed(() => can('COLLECTION_COMMISSION_TIER_CREATE'))
const canUpdateCollection = computed(() => can('COLLECTION_COMMISSION_TIER_UPDATE'))
const canDeleteCollection = computed(() => can('COLLECTION_COMMISSION_TIER_DELETE'))
const collectionData = ref<CollectionCommissionTierDto[]>([])
const collectionTotal = ref(0)
const collectionLoading = ref(false)
const collectionSearch = ref('')
const collectionIncludeInactive = ref(false)
const collectionPromoterTypeUuid = ref<string | undefined>(undefined)
const collectionPage = ref(1)
const collectionSize = ref(DEFAULT_PAGE_SIZE)

// Empty by default: no `sort=` is sent until the user clicks a column, so
// the backend's own default-sort fallback (entity_config → system_configs
// → maxDays ASC) applies.
const collectionSort = useTableSort([])
const collectionHasActiveSort = computed(() => collectionSort.hasActiveSort.value)
const collectionIsMultiSort = computed(() => collectionSort.orders.value.length > 1)

async function loadCollectionTiers() {
  collectionLoading.value = true
  try {
    const res = await collectionApi.list({
      page: collectionPage.value - 1,
      size: collectionSize.value,
      sort: collectionSort.sortParam.value,
      q: collectionSearch.value.trim() || undefined,
      includeInactive: collectionIncludeInactive.value,
      promoterTypeUuid: collectionPromoterTypeUuid.value,
    })
    collectionData.value = res.content ?? []
    collectionTotal.value = res.totalElements ?? 0
    if (collectionSort.orders.value.length === 0 && res.appliedSort?.length) {
      resetting.value = true
      collectionSort.seedServerDefault(res.appliedSort.map(o => ({ field: o.field, direction: o.direction.toLowerCase() as SortDirection })))
      await nextTick()
      resetting.value = false
    }
  }
  catch {
    collectionData.value = []
    collectionTotal.value = 0
  }
  finally {
    collectionLoading.value = false
  }
}

watch(collectionSize, () => { if (!resetting.value) collectionPage.value = 1 })
watch([collectionPage, collectionSize], () => { if (!resetting.value) loadCollectionTiers() })
let collectionSearchTimer: ReturnType<typeof setTimeout> | undefined
watch(collectionSearch, () => {
  if (resetting.value) return
  clearTimeout(collectionSearchTimer)
  collectionSearchTimer = setTimeout(() => { collectionPage.value = 1; loadCollectionTiers() }, 400)
})
watch([collectionIncludeInactive, collectionPromoterTypeUuid], () => {
  if (resetting.value) return
  collectionPage.value = 1
  loadCollectionTiers()
})
watch(collectionSort.orders, () => { if (!resetting.value) loadCollectionTiers() }, { deep: true })

async function resetCollectionFilters() {
  resetting.value = true
  collectionSearch.value = ''
  collectionIncludeInactive.value = false
  collectionPromoterTypeUuid.value = undefined
  collectionSort.reset()
  collectionSize.value = DEFAULT_PAGE_SIZE
  collectionPage.value = 1
  await nextTick()
  resetting.value = false
  loadCollectionTiers()
}

const collectionFormOpen = ref(false)
const editingCollectionTier = ref<CollectionCommissionTierDto | null>(null)
function openCreateCollectionTier() { editingCollectionTier.value = null; collectionFormOpen.value = true }
function openEditCollectionTier(tier: CollectionCommissionTierDto) { editingCollectionTier.value = tier; collectionFormOpen.value = true }
async function onCollectionTierSaved() { await loadCollectionTiers() }

const collectionDeleteOpen = ref(false)
const collectionDeleting = ref(false)
const collectionTarget = ref<CollectionCommissionTierDto | null>(null)
const collectionUsageChecking = ref(false)
const collectionUsageInfo = ref<{ inUse: boolean, count: number } | null>(null)
async function openDeleteCollectionTier(tier: CollectionCommissionTierDto) {
  collectionTarget.value = tier
  collectionDeleteOpen.value = true
  collectionUsageChecking.value = true
  collectionUsageInfo.value = null
  try {
    collectionUsageInfo.value = await collectionApi.usage(tier.uuid)
  }
  catch {
    // Fallback: treat as "in use" for safety (soft-deactivate instead of physical delete).
    collectionUsageInfo.value = null
  }
  finally {
    collectionUsageChecking.value = false
  }
}
function onDeleteCollectionTierFromEdit(tier: CollectionCommissionTierDto) { openDeleteCollectionTier(tier) }
async function confirmDeleteCollectionTier() {
  if (!collectionTarget.value) return
  collectionDeleting.value = true
  const wasPhysical = collectionUsageInfo.value?.inUse === false
  try {
    await collectionApi.remove(collectionTarget.value.uuid, wasPhysical)
    toast.add({
      title: wasPhysical
        ? t('commissionRules.collectionTiers.deletedPermanentToast')
        : t('commissionRules.collectionTiers.deactivatedToast'),
      color: wasPhysical ? 'success' : 'info',
      icon: wasPhysical ? 'i-lucide-check-circle' : 'i-lucide-info',
    })
    collectionDeleteOpen.value = false
    await loadCollectionTiers()
  }
  catch { /* toast handled by useApi */ }
  finally { collectionDeleting.value = false }
}

// =========================================================
// Tab 4 — Bandas de override jerárquico (hierarchy_override_tiers)
// =========================================================
const overrideApi = useHierarchyOverrideTiers()
const canViewOverride = computed(() => can('HIERARCHY_OVERRIDE_TIER_VIEW_ALL'))
const canCreateOverride = computed(() => can('HIERARCHY_OVERRIDE_TIER_CREATE'))
const canUpdateOverride = computed(() => can('HIERARCHY_OVERRIDE_TIER_UPDATE'))
const canViewPromoterRank = computed(() => can('PROMOTER_RANK_VIEW_ALL'))
const canDeleteOverride = computed(() => can('HIERARCHY_OVERRIDE_TIER_DELETE'))
const overrideData = ref<HierarchyOverrideTierDto[]>([])
const overrideTotal = ref(0)
const overrideLoading = ref(false)
const overrideSearch = ref('')
const overrideIncludeInactive = ref(false)
const overrideRankUuid = ref<string | undefined>(undefined)
const overrideCategory = ref<OverrideCategory | undefined>(undefined)
const overridePage = ref(1)
const overrideSize = ref(DEFAULT_PAGE_SIZE)

// RSQL: category equality, applied server-side so pagination stays consistent.
function buildOverrideFilter(): string | undefined {
  return overrideCategory.value ? `category==${overrideCategory.value}` : undefined
}

// Empty by default: no `sort=` is sent until the user clicks a column, so
// the backend's own default-sort fallback applies.
const overrideSort = useTableSort([])
const overrideHasActiveSort = computed(() => overrideSort.hasActiveSort.value)
const overrideIsMultiSort = computed(() => overrideSort.orders.value.length > 1)

async function loadOverrideTiers() {
  overrideLoading.value = true
  try {
    const res = await overrideApi.list({
      page: overridePage.value - 1,
      size: overrideSize.value,
      sort: overrideSort.sortParam.value,
      q: overrideSearch.value.trim() || undefined,
      filter: buildOverrideFilter(),
      includeInactive: overrideIncludeInactive.value,
      rankUuid: overrideRankUuid.value,
    })
    overrideData.value = res.content ?? []
    overrideTotal.value = res.totalElements ?? 0
    if (overrideSort.orders.value.length === 0 && res.appliedSort?.length) {
      resetting.value = true
      overrideSort.seedServerDefault(res.appliedSort.map(o => ({ field: o.field, direction: o.direction.toLowerCase() as SortDirection })))
      await nextTick()
      resetting.value = false
    }
  }
  catch {
    overrideData.value = []
    overrideTotal.value = 0
  }
  finally {
    overrideLoading.value = false
  }
}

watch(overrideSize, () => { if (!resetting.value) overridePage.value = 1 })
watch([overridePage, overrideSize], () => { if (!resetting.value) loadOverrideTiers() })
let overrideSearchTimer: ReturnType<typeof setTimeout> | undefined
watch(overrideSearch, () => {
  if (resetting.value) return
  clearTimeout(overrideSearchTimer)
  overrideSearchTimer = setTimeout(() => { overridePage.value = 1; loadOverrideTiers() }, 400)
})
watch([overrideIncludeInactive, overrideRankUuid, overrideCategory], () => {
  if (resetting.value) return
  overridePage.value = 1
  loadOverrideTiers()
})
watch(overrideSort.orders, () => { if (!resetting.value) loadOverrideTiers() }, { deep: true })

async function resetOverrideFilters() {
  resetting.value = true
  overrideSearch.value = ''
  overrideIncludeInactive.value = false
  overrideRankUuid.value = undefined
  overrideCategory.value = undefined
  overrideSort.reset()
  overrideSize.value = DEFAULT_PAGE_SIZE
  overridePage.value = 1
  await nextTick()
  resetting.value = false
  loadOverrideTiers()
}

const overrideFormOpen = ref(false)
const editingOverrideTier = ref<HierarchyOverrideTierDto | null>(null)
function openCreateOverrideTier() { editingOverrideTier.value = null; overrideFormOpen.value = true }
function openEditOverrideTier(tier: HierarchyOverrideTierDto) { editingOverrideTier.value = tier; overrideFormOpen.value = true }
async function onOverrideTierSaved() { await loadOverrideTiers() }

const overrideDeleteOpen = ref(false)
const overrideDeleting = ref(false)
const overrideTarget = ref<HierarchyOverrideTierDto | null>(null)
const overrideUsageChecking = ref(false)
const overrideUsageInfo = ref<{ inUse: boolean, count: number } | null>(null)
async function openDeleteOverrideTier(tier: HierarchyOverrideTierDto) {
  overrideTarget.value = tier
  overrideDeleteOpen.value = true
  overrideUsageChecking.value = true
  overrideUsageInfo.value = null
  try {
    overrideUsageInfo.value = await overrideApi.usage(tier.uuid)
  }
  catch {
    // Fallback: treat as "in use" for safety (soft-deactivate instead of physical delete).
    overrideUsageInfo.value = null
  }
  finally {
    overrideUsageChecking.value = false
  }
}
function onDeleteOverrideTierFromEdit(tier: HierarchyOverrideTierDto) { openDeleteOverrideTier(tier) }
async function confirmDeleteOverrideTier() {
  if (!overrideTarget.value) return
  overrideDeleting.value = true
  const wasPhysical = overrideUsageInfo.value?.inUse === false
  try {
    await overrideApi.remove(overrideTarget.value.uuid, wasPhysical)
    toast.add({
      title: wasPhysical
        ? t('hierarchyOverrideTiers.deletedPermanentToast')
        : t('hierarchyOverrideTiers.deactivatedToast'),
      color: wasPhysical ? 'success' : 'info',
      icon: wasPhysical ? 'i-lucide-check-circle' : 'i-lucide-info',
    })
    overrideDeleteOpen.value = false
    await loadOverrideTiers()
  }
  catch { /* toast handled by useApi */ }
  finally { overrideDeleting.value = false }
}

function overrideReward(tier: HierarchyOverrideTierDto): string {
  if (tier.overridePct != null) return `${tier.overridePct}%`
  if (tier.flatAmount != null) return `${tier.flatAmount} ${tier.flatAmountCurrency_Code ?? ''}`.trim()
  return t('common.empty')
}

onMounted(() => {
  if (canViewTiers.value) loadTiers()
  if (canViewBonus.value) loadBonusRules()
  if (canViewCollection.value) loadCollectionTiers()
  if (canViewOverride.value) loadOverrideTiers()
})
</script>

<template>
  <div class="space-y-5">
    <!-- Header -->
    <div>
      <h1 class="text-2xl font-extrabold text-prohealth-900">{{ t('commissionRules.title') }}</h1>
      <p class="text-sm text-prohealth-700/70 mt-1">{{ t('commissionRules.subtitle') }}</p>
    </div>

    <UTabs v-model="activeTab" :items="tabs" :content="false" />

    <!-- Tab 1: Bandas de inscripción -->
    <div v-show="activeTab === 'tiers'" class="space-y-4">
      <div class="flex items-center justify-end gap-2">
        <ListRefreshMenu :loading="tierLoading" variant="ghost" @refresh="loadTiers" @reset="resetTierFilters" />
        <UButton v-if="canCreateTiers" color="primary" variant="outline" icon="i-lucide-plus" @click="openCreateTier">
          {{ t('common.new') }}
        </UButton>
      </div>
      <div class="bg-white rounded-2xl border border-prohealth-100 p-4 flex flex-wrap items-center gap-3">
        <UInput
          v-model="tierSearch"
          :placeholder="t('commissionRules.tiers.searchPlaceholder')"
          icon="i-lucide-search"
          size="lg"
          class="w-full max-w-md"
        />
        <USelectMenu
          clear
          v-model="tierPromoterTypeUuid"
          :items="promoterTypeFilterItems"
          label-key="label"
          value-key="value"
          icon="i-lucide-users"
          class="w-56"
        />
        <USelectMenu
          clear
          v-model="tierPlanType"
          :items="planTypeFilterItems"
          label-key="label"
          value-key="value"
          icon="i-lucide-layout-grid"
          class="w-56"
        />
        <USelectMenu
          clear
          v-model="tierAppliesTo"
          :items="appliesToFilterItems"
          label-key="label"
          value-key="value"
          icon="i-lucide-target"
          class="w-48"
        />
        <UCheckbox v-model="tierIncludeInactive" :label="$t('catalogs.includeInactive')" class="self-center" />
        <UButton
          v-if="tierHasActiveSort"
          variant="link"
          color="neutral"
          size="sm"
          icon="i-lucide-list-restart"
          :title="t('common.clearSortHint')"
          @click="tierSort.reset()"
        >
          {{ t('common.clearSort') }}
        </UButton>
      </div>
      <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-prohealth-50/60">
            <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="tierSort.toggle('name')">
                {{ t('commissionRules.tiers.columns.name') }}
                <SortIndicator :state="tierSort.stateOf('name')" :multi-active="tierIsMultiSort" @clear="tierSort.remove('name')" />
              </th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="tierSort.toggle('planType')">
                {{ t('commissionRules.tiers.columns.planType') }}
                <SortIndicator :state="tierSort.stateOf('planType')" :multi-active="tierIsMultiSort" @clear="tierSort.remove('planType')" />
              </th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="tierSort.toggle('thresholdCount')">
                {{ t('commissionRules.tiers.columns.threshold') }}
                <SortIndicator :state="tierSort.stateOf('thresholdCount')" :multi-active="tierIsMultiSort" @clear="tierSort.remove('thresholdCount')" />
              </th>
              <th class="px-5 py-3 font-semibold">{{ t('commissionRules.tiers.columns.reward') }}</th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="tierSort.toggle('appliesTo')">
                {{ t('commissionRules.tiers.columns.appliesTo') }}
                <SortIndicator :state="tierSort.stateOf('appliesTo')" :multi-active="tierIsMultiSort" @clear="tierSort.remove('appliesTo')" />
              </th>
              <th class="px-5 py-3 font-semibold text-right">{{ t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-prohealth-100">
            <TableSkeleton v-if="tierLoading" :rows="4" :cols="6" />
            <tr v-else-if="tierData.length === 0">
              <td colspan="6" class="px-5 py-10 text-center text-prohealth-500">{{ t('commissionRules.tiers.empty') }}</td>
            </tr>
            <tr
              v-for="tier in tierData"
              v-else
              :key="tier.uuid"
              class="hover:bg-prohealth-50/50"
              :class="{ 'opacity-60': !tier.active, 'cursor-pointer': canUpdateTiers }"
              @click="canUpdateTiers && openEditTier(tier)"
            >
              <td class="px-5 py-3 font-medium text-prohealth-900">{{ tier.name }}</td>
              <td class="px-5 py-3 text-prohealth-600">{{ tier.planType ? t(`plans.types.${tier.planType}`) : t('commissionRules.tiers.allPlans') }}</td>
              <td class="px-5 py-3 text-prohealth-600">{{ tier.thresholdCount }}</td>
              <td class="px-5 py-3 text-prohealth-600">{{ tierReward(tier) }}</td>
              <td class="px-5 py-3">
                <UBadge color="primary" variant="subtle" size="sm">{{ t(`commissionRules.appliesTo.${tier.appliesTo}`) }}</UBadge>
              </td>
              <td class="px-5 py-3" @click.stop>
                <div class="flex items-center justify-end gap-1">
                  <UButton v-if="canUpdateTiers" color="info" variant="ghost" icon="i-lucide-pencil" size="sm" @click="openEditTier(tier)" />
                  <UTooltip v-if="canViewAudit" :text="t('audit.trigger')">
                    <UButton color="neutral" variant="ghost" icon="i-lucide-history" size="sm" @click="openAudit('commission_tier', tier)" />
                  </UTooltip>
                  <UButton v-if="canDeleteTiers" color="error" variant="ghost" icon="i-lucide-trash-2" size="sm" class="ms-2" @click="openDeleteTier(tier)" />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        <div class="flex items-center flex-wrap justify-between gap-3 px-5 py-3 border-t border-prohealth-100 shrink-0">
          <p class="text-xs text-prohealth-500">
            {{ t('commissionRules.tiers.paginationSummary', { shown: tierData.length, total: tierTotal }) }}
          </p>
          <div class="flex items-center gap-3">
            <UPagination
              v-if="tierSize !== UNPAGED_PAGE_SIZE"
              v-model:page="tierPage"
              :total="tierTotal"
              :items-per-page="tierSize"
            />
            <UTooltip :text="$t('catalogs.pageSizeLabel')">
              <USelectMenu
                v-model="tierSize"
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
    </div>

    <!-- Tab 2: Bonos por escala -->
    <div v-show="activeTab === 'bonusRules'" class="space-y-4">
      <div class="flex items-center justify-end gap-2">
        <ListRefreshMenu :loading="bonusLoading" variant="ghost" @refresh="loadBonusRules" @reset="resetBonusFilters" />
        <UButton v-if="canCreateBonus" color="primary" variant="outline" icon="i-lucide-plus" @click="openCreateBonus">
          {{ t('common.new') }}
        </UButton>
      </div>
      <div class="bg-white rounded-2xl border border-prohealth-100 p-4 flex flex-wrap items-center gap-3">
        <UInput
          v-model="bonusSearch"
          :placeholder="t('commissionRules.bonusRules.searchPlaceholder')"
          icon="i-lucide-search"
          size="lg"
          class="w-full max-w-md"
        />
        <USelectMenu
          clear
          v-model="bonusPromoterTypeUuid"
          :items="promoterTypeFilterItems"
          label-key="label"
          value-key="value"
          icon="i-lucide-users"
          class="w-56"
        />
        <UCheckbox v-model="bonusIncludeInactive" :label="$t('catalogs.includeInactive')" class="self-center" />
        <UButton
          v-if="bonusHasActiveSort"
          variant="link"
          color="neutral"
          size="sm"
          icon="i-lucide-list-restart"
          :title="t('common.clearSortHint')"
          @click="bonusSort.reset()"
        >
          {{ t('common.clearSort') }}
        </UButton>
      </div>
      <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-prohealth-50/60">
            <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="bonusSort.toggle('name')">
                {{ t('commissionRules.bonusRules.columns.name') }}
                <SortIndicator :state="bonusSort.stateOf('name')" :multi-active="bonusIsMultiSort" @clear="bonusSort.remove('name')" />
              </th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="bonusSort.toggle('metric')">
                {{ t('commissionRules.bonusRules.columns.metric') }}
                <SortIndicator :state="bonusSort.stateOf('metric')" :multi-active="bonusIsMultiSort" @clear="bonusSort.remove('metric')" />
              </th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="bonusSort.toggle('accrual')">
                {{ t('commissionRules.bonusRules.columns.accrual') }}
                <SortIndicator :state="bonusSort.stateOf('accrual')" :multi-active="bonusIsMultiSort" @clear="bonusSort.remove('accrual')" />
              </th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="bonusSort.toggle('thresholdCount')">
                {{ t('commissionRules.bonusRules.columns.threshold') }}
                <SortIndicator :state="bonusSort.stateOf('thresholdCount')" :multi-active="bonusIsMultiSort" @clear="bonusSort.remove('thresholdCount')" />
              </th>
              <th class="px-5 py-3 font-semibold">{{ t('commissionRules.bonusRules.columns.window') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('commissionRules.bonusRules.columns.reward') }}</th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="bonusSort.toggle('active')">
                {{ t('catalogs.columns.status') }}
                <SortIndicator :state="bonusSort.stateOf('active')" :multi-active="bonusIsMultiSort" @clear="bonusSort.remove('active')" />
              </th>
              <th class="px-5 py-3 font-semibold text-right">{{ t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-prohealth-100">
            <TableSkeleton v-if="bonusLoading" :rows="4" :cols="8" />
            <tr v-else-if="bonusData.length === 0">
              <td colspan="8" class="px-5 py-10 text-center text-prohealth-500">{{ t('commissionRules.bonusRules.empty') }}</td>
            </tr>
            <tr
              v-for="rule in bonusData"
              v-else
              :key="rule.uuid"
              class="hover:bg-prohealth-50/50"
              :class="{ 'opacity-60': !rule.active, 'cursor-pointer': canUpdateBonus }"
              @click="canUpdateBonus && openEditBonus(rule)"
            >
              <td class="px-5 py-3 font-medium text-prohealth-900">{{ rule.name }}</td>
              <td class="px-5 py-3 text-prohealth-600">{{ t(`commissionRules.bonusMetrics.${rule.metric}`) }}</td>
              <td class="px-5 py-3 text-prohealth-600">{{ t(`commissionRules.accrualModes.${rule.accrual}`) }}</td>
              <td class="px-5 py-3 text-prohealth-600">{{ rule.thresholdCount }}</td>
              <td class="px-5 py-3 text-prohealth-600">{{ t(`commissionRules.windowStrategies.${rule.windowStrategy}`) }}</td>
              <td class="px-5 py-3 text-prohealth-600">{{ bonusReward(rule) }}</td>
              <td class="px-5 py-3">
                <UBadge :color="rule.active ? 'success' : 'neutral'" variant="subtle" size="sm">
                  {{ rule.active ? t('catalogs.status.active') : t('catalogs.status.inactive') }}
                </UBadge>
              </td>
              <td class="px-5 py-3" @click.stop>
                <div class="flex items-center justify-end gap-1">
                  <UButton v-if="canUpdateBonus" color="info" variant="ghost" icon="i-lucide-pencil" size="sm" @click="openEditBonus(rule)" />
                  <UTooltip v-if="canViewAudit" :text="t('audit.trigger')">
                    <UButton color="neutral" variant="ghost" icon="i-lucide-history" size="sm" @click="openAudit('bonus_rule', rule)" />
                  </UTooltip>
                  <UButton v-if="canDeleteBonus" color="error" variant="ghost" icon="i-lucide-trash-2" size="sm" class="ms-2" @click="openDeleteBonus(rule)" />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        <div class="flex items-center flex-wrap justify-between gap-3 px-5 py-3 border-t border-prohealth-100 shrink-0">
          <p class="text-xs text-prohealth-500">
            {{ t('commissionRules.bonusRules.paginationSummary', { shown: bonusData.length, total: bonusTotal }) }}
          </p>
          <div class="flex items-center gap-3">
            <UPagination
              v-if="bonusSize !== UNPAGED_PAGE_SIZE"
              v-model:page="bonusPage"
              :total="bonusTotal"
              :items-per-page="bonusSize"
            />
            <UTooltip :text="$t('catalogs.pageSizeLabel')">
              <USelectMenu
                v-model="bonusSize"
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
    </div>

    <!-- Tab 3: Comisión de cobranza -->
    <div v-show="activeTab === 'collectionTiers'" class="space-y-4">
      <div class="flex items-center justify-end gap-2">
        <ListRefreshMenu :loading="collectionLoading" variant="ghost" @refresh="loadCollectionTiers" @reset="resetCollectionFilters" />
        <UButton v-if="canCreateCollection" color="primary" variant="outline" icon="i-lucide-plus" @click="openCreateCollectionTier">
          {{ t('common.new') }}
        </UButton>
      </div>
      <div class="bg-white rounded-2xl border border-prohealth-100 p-4 flex flex-wrap items-center gap-3">
        <UInput
          v-model="collectionSearch"
          :placeholder="t('commissionRules.collectionTiers.searchPlaceholder')"
          icon="i-lucide-search"
          size="lg"
          class="w-full max-w-md"
        />
        <USelectMenu
          clear
          v-model="collectionPromoterTypeUuid"
          :items="promoterTypeFilterItems"
          label-key="label"
          value-key="value"
          icon="i-lucide-users"
          class="w-56"
        />
        <UCheckbox v-model="collectionIncludeInactive" :label="t('catalogs.includeInactive')" class="self-center" />
        <UButton
          v-if="collectionHasActiveSort"
          variant="link"
          color="neutral"
          size="sm"
          icon="i-lucide-list-restart"
          :title="t('common.clearSortHint')"
          @click="collectionSort.reset()"
        >
          {{ t('common.clearSort') }}
        </UButton>
      </div>
      <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-prohealth-50/60">
            <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="collectionSort.toggle('name')">
                {{ t('commissionRules.collectionTiers.columns.name') }}
                <SortIndicator :state="collectionSort.stateOf('name')" :multi-active="collectionIsMultiSort" @clear="collectionSort.remove('name')" />
              </th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="collectionSort.toggle('maxDays')">
                {{ t('commissionRules.collectionTiers.columns.maxDays') }}
                <SortIndicator :state="collectionSort.stateOf('maxDays')" :multi-active="collectionIsMultiSort" @clear="collectionSort.remove('maxDays')" />
              </th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="collectionSort.toggle('commissionPct')">
                {{ t('commissionRules.collectionTiers.columns.commissionPct') }}
                <SortIndicator :state="collectionSort.stateOf('commissionPct')" :multi-active="collectionIsMultiSort" @clear="collectionSort.remove('commissionPct')" />
              </th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="collectionSort.toggle('active')">
                {{ t('catalogs.columns.status') }}
                <SortIndicator :state="collectionSort.stateOf('active')" :multi-active="collectionIsMultiSort" @clear="collectionSort.remove('active')" />
              </th>
              <th class="px-5 py-3 font-semibold text-right">{{ t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-prohealth-100">
            <TableSkeleton v-if="collectionLoading" :rows="4" :cols="5" />
            <tr v-else-if="collectionData.length === 0">
              <td colspan="5" class="px-5 py-10 text-center text-prohealth-500">{{ t('commissionRules.collectionTiers.empty') }}</td>
            </tr>
            <tr
              v-for="tier in collectionData"
              v-else
              :key="tier.uuid"
              class="hover:bg-prohealth-50/50"
              :class="{ 'opacity-60': !tier.active, 'cursor-pointer': canUpdateCollection }"
              @click="canUpdateCollection && openEditCollectionTier(tier)"
            >
              <td class="px-5 py-3 font-medium text-prohealth-900">{{ tier.name }}</td>
              <td class="px-5 py-3 text-prohealth-600">{{ tier.maxDays }}</td>
              <td class="px-5 py-3 text-prohealth-600">{{ tier.commissionPct }}%</td>
              <td class="px-5 py-3">
                <UBadge :color="tier.active ? 'success' : 'neutral'" variant="subtle" size="sm">
                  {{ tier.active ? t('catalogs.status.active') : t('catalogs.status.inactive') }}
                </UBadge>
              </td>
              <td class="px-5 py-3" @click.stop>
                <div class="flex items-center justify-end gap-1">
                  <UButton v-if="canUpdateCollection" color="info" variant="ghost" icon="i-lucide-pencil" size="sm" @click="openEditCollectionTier(tier)" />
                  <UButton v-if="canDeleteCollection" color="error" variant="ghost" icon="i-lucide-trash-2" size="sm" class="ms-2" @click="openDeleteCollectionTier(tier)" />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        <div class="flex items-center flex-wrap justify-between gap-3 px-5 py-3 border-t border-prohealth-100 shrink-0">
          <p class="text-xs text-prohealth-500">
            {{ t('commissionRules.collectionTiers.paginationSummary', { shown: collectionData.length, total: collectionTotal }) }}
          </p>
          <div class="flex items-center gap-3">
            <UPagination
              v-if="collectionSize !== UNPAGED_PAGE_SIZE"
              v-model:page="collectionPage"
              :total="collectionTotal"
              :items-per-page="collectionSize"
            />
            <UTooltip :text="$t('catalogs.pageSizeLabel')">
              <USelectMenu
                v-model="collectionSize"
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
    </div>

    <!-- Tab 4: Override jerárquico -->
    <div v-show="activeTab === 'overrideTiers'" class="space-y-4">
      <div class="flex items-center justify-end gap-2">
        <ListRefreshMenu :loading="overrideLoading" variant="ghost" @refresh="loadOverrideTiers" @reset="resetOverrideFilters" />
        <UButton v-if="canCreateOverride" color="primary" variant="outline" icon="i-lucide-plus" @click="openCreateOverrideTier">
          {{ t('common.new') }}
        </UButton>
      </div>
      <div class="bg-white rounded-2xl border border-prohealth-100 p-4 flex flex-wrap items-center gap-3">
        <UInput
          v-model="overrideSearch"
          :placeholder="t('hierarchyOverrideTiers.searchPlaceholder')"
          icon="i-lucide-search"
          size="lg"
          class="w-full max-w-md"
        />
        <USelectMenu
          clear
          v-model="overrideRankUuid"
          :items="rankFilterItems"
          label-key="label"
          value-key="value"
          icon="i-lucide-network"
          class="w-56"
        />
        <USelectMenu
          clear
          v-model="overrideCategory"
          :items="categoryFilterItems"
          label-key="label"
          value-key="value"
          icon="i-lucide-target"
          class="w-48"
        />
        <UCheckbox v-model="overrideIncludeInactive" :label="$t('catalogs.includeInactive')" class="self-center" />
        <UButton
          v-if="overrideHasActiveSort"
          variant="link"
          color="neutral"
          size="sm"
          icon="i-lucide-list-restart"
          :title="t('common.clearSortHint')"
          @click="overrideSort.reset()"
        >
          {{ t('common.clearSort') }}
        </UButton>
      </div>
      <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-prohealth-50/60">
            <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="overrideSort.toggle('name')">
                {{ t('hierarchyOverrideTiers.columns.name') }}
                <SortIndicator :state="overrideSort.stateOf('name')" :multi-active="overrideIsMultiSort" @clear="overrideSort.remove('name')" />
              </th>
              <th class="px-5 py-3 font-semibold">{{ t('hierarchyOverrideTiers.columns.rank') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('hierarchyOverrideTiers.columns.category') }}</th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="overrideSort.toggle('thresholdCount')">
                {{ t('hierarchyOverrideTiers.columns.threshold') }}
                <SortIndicator :state="overrideSort.stateOf('thresholdCount')" :multi-active="overrideIsMultiSort" @clear="overrideSort.remove('thresholdCount')" />
              </th>
              <th class="px-5 py-3 font-semibold">{{ t('hierarchyOverrideTiers.columns.reward') }}</th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="overrideSort.toggle('active')">
                {{ t('catalogs.columns.status') }}
                <SortIndicator :state="overrideSort.stateOf('active')" :multi-active="overrideIsMultiSort" @clear="overrideSort.remove('active')" />
              </th>
              <th class="px-5 py-3 font-semibold text-right">{{ t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-prohealth-100">
            <TableSkeleton v-if="overrideLoading" :rows="4" :cols="7" />
            <tr v-else-if="overrideData.length === 0">
              <td colspan="7" class="px-5 py-10 text-center text-prohealth-500">{{ t('hierarchyOverrideTiers.empty') }}</td>
            </tr>
            <tr
              v-for="tier in overrideData"
              v-else
              :key="tier.uuid"
              class="hover:bg-prohealth-50/50"
              :class="{ 'opacity-60': !tier.active, 'cursor-pointer': canUpdateOverride }"
              @click="canUpdateOverride && openEditOverrideTier(tier)"
            >
              <td class="px-5 py-3 font-medium text-prohealth-900">{{ tier.name }}</td>
              <td class="px-5 py-3 text-prohealth-600" @click.stop>
                <CommonEntityLinkCell
                  :to="tier.rank_Uuid ? `/dashboard/catalogs/promoter-ranks?edit=${tier.rank_Uuid}` : null"
                  :label="tier.rank_Display"
                  :can="canViewPromoterRank"
                />
              </td>
              <td class="px-5 py-3">
                <UBadge color="primary" variant="subtle" size="sm">{{ t(`hierarchyOverrideTiers.category.${tier.category}`) }}</UBadge>
              </td>
              <td class="px-5 py-3 text-prohealth-600">{{ tier.thresholdCount }}</td>
              <td class="px-5 py-3 text-prohealth-600">{{ overrideReward(tier) }}</td>
              <td class="px-5 py-3">
                <UBadge :color="tier.active ? 'success' : 'neutral'" variant="subtle" size="sm">
                  {{ tier.active ? t('catalogs.status.active') : t('catalogs.status.inactive') }}
                </UBadge>
              </td>
              <td class="px-5 py-3" @click.stop>
                <div class="flex items-center justify-end gap-1">
                  <UButton v-if="canUpdateOverride" color="info" variant="ghost" icon="i-lucide-pencil" size="sm" @click="openEditOverrideTier(tier)" />
                  <UButton v-if="canDeleteOverride" color="error" variant="ghost" icon="i-lucide-trash-2" size="sm" class="ms-2" @click="openDeleteOverrideTier(tier)" />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        <div class="flex items-center flex-wrap justify-between gap-3 px-5 py-3 border-t border-prohealth-100 shrink-0">
          <p class="text-xs text-prohealth-500">
            {{ t('hierarchyOverrideTiers.paginationSummary', { shown: overrideData.length, total: overrideTotal }) }}
          </p>
          <div class="flex items-center gap-3">
            <UPagination
              v-if="overrideSize !== UNPAGED_PAGE_SIZE"
              v-model:page="overridePage"
              :total="overrideTotal"
              :items-per-page="overrideSize"
            />
            <UTooltip :text="$t('catalogs.pageSizeLabel')">
              <USelectMenu
                v-model="overrideSize"
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
    </div>

    <!-- Modals -->
    <CommissionTierFormModal v-model:open="tierFormOpen" :tier="editingTier" @saved="onTierSaved" @delete="onDeleteTierFromEdit" />
    <BonusRuleFormModal v-model:open="bonusFormOpen" :rule="editingBonus" @saved="onBonusSaved" @delete="onDeleteBonusFromEdit" />
    <CollectionCommissionTierFormModal v-model:open="collectionFormOpen" :tier="editingCollectionTier" @saved="onCollectionTierSaved" @delete="onDeleteCollectionTierFromEdit" />
    <HierarchyOverrideTierFormModal v-model:open="overrideFormOpen" :tier="editingOverrideTier" @saved="onOverrideTierSaved" @delete="onDeleteOverrideTierFromEdit" />

    <!-- Delete confirmations -->
    <UModal v-model:open="tierDeleteOpen" :title="t('commissionRules.tiers.deleteTitle')">
      <template #body>
        <div v-if="tierUsageChecking" class="flex items-center gap-2 text-sm text-prohealth-600">
          <UIcon name="i-lucide-loader-2" class="w-4 h-4 animate-spin" />
          {{ t('common.loading') }}
        </div>
        <p v-else class="text-sm text-prohealth-700">
          {{
            tierUsageInfo?.inUse === false
              ? t('commissionRules.tiers.deleteConfirmPermanent')
              : t('commissionRules.tiers.deleteConfirmDeactivate', { count: tierUsageInfo?.count ?? 0 })
          }}
        </p>
        <div class="flex items-center justify-end gap-3 pt-5">
          <UButton color="neutral" variant="ghost" :disabled="tierDeleting" @click="tierDeleteOpen = false">{{ t('common.cancel') }}</UButton>
          <UButton color="error" :loading="tierDeleting" :disabled="tierUsageChecking" icon="i-lucide-trash-2" @click="confirmDeleteTier">{{ t('common.delete') }}</UButton>
        </div>
      </template>
    </UModal>

    <UModal v-model:open="bonusDeleteOpen" :title="t('commissionRules.bonusRules.deleteTitle')">
      <template #body>
        <p class="text-sm text-prohealth-700">{{ t('commissionRules.bonusRules.deleteConfirm', { name: bonusTarget?.name ?? '' }) }}</p>
        <div class="flex items-center justify-end gap-3 pt-5">
          <UButton color="neutral" variant="ghost" :disabled="bonusDeleting" @click="bonusDeleteOpen = false">{{ t('common.cancel') }}</UButton>
          <UButton color="error" :loading="bonusDeleting" icon="i-lucide-trash-2" @click="confirmDeleteBonus">{{ t('common.delete') }}</UButton>
        </div>
      </template>
    </UModal>

    <UModal v-model:open="collectionDeleteOpen" :title="t('commissionRules.collectionTiers.deleteTitle')">
      <template #body>
        <div v-if="collectionUsageChecking" class="flex items-center gap-2 text-sm text-prohealth-600">
          <UIcon name="i-lucide-loader-2" class="w-4 h-4 animate-spin" />
          {{ t('common.loading') }}
        </div>
        <p v-else class="text-sm text-prohealth-700">
          {{
            collectionUsageInfo?.inUse === false
              ? t('commissionRules.collectionTiers.deleteConfirmPermanent')
              : t('commissionRules.collectionTiers.deleteConfirmDeactivate', { count: collectionUsageInfo?.count ?? 0 })
          }}
        </p>
        <div class="flex items-center justify-end gap-3 pt-5">
          <UButton color="neutral" variant="ghost" :disabled="collectionDeleting" @click="collectionDeleteOpen = false">{{ t('common.cancel') }}</UButton>
          <UButton color="error" :loading="collectionDeleting" :disabled="collectionUsageChecking" icon="i-lucide-trash-2" @click="confirmDeleteCollectionTier">{{ t('common.delete') }}</UButton>
        </div>
      </template>
    </UModal>

    <UModal v-model:open="overrideDeleteOpen" :title="t('hierarchyOverrideTiers.deleteTitle')">
      <template #body>
        <div v-if="overrideUsageChecking" class="flex items-center gap-2 text-sm text-prohealth-600">
          <UIcon name="i-lucide-loader-2" class="w-4 h-4 animate-spin" />
          {{ t('common.loading') }}
        </div>
        <p v-else class="text-sm text-prohealth-700">
          {{
            overrideUsageInfo?.inUse === false
              ? t('hierarchyOverrideTiers.deleteConfirmPermanent')
              : t('hierarchyOverrideTiers.deleteConfirmDeactivate', { count: overrideUsageInfo?.count ?? 0 })
          }}
        </p>
        <div class="flex items-center justify-end gap-3 pt-5">
          <UButton color="neutral" variant="ghost" :disabled="overrideDeleting" @click="overrideDeleteOpen = false">{{ t('common.cancel') }}</UButton>
          <UButton color="error" :loading="overrideDeleting" :disabled="overrideUsageChecking" icon="i-lucide-trash-2" @click="confirmDeleteOverrideTier">{{ t('common.delete') }}</UButton>
        </div>
      </template>
    </UModal>

    <!-- Audit modal -->
    <AuditModal
      v-if="auditTarget"
      v-model:open="auditOpen"
      :entity-key="auditEntityKey"
      :entity-uuid="auditTarget.uuid"
      :entity-label="auditTarget.name"
      :can-view-changes="canViewAuditChanges"
      :can-view-reports="canViewAuditReports"
    />
  </div>
</template>
