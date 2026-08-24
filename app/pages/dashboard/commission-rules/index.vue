<script setup lang="ts">
import { buildPageSizeItems, DEFAULT_PAGE_SIZE, UNPAGED_PAGE_SIZE } from '~/utils/pagination'
import type { SelectItem } from '~/types/options'
import type { AppliesTo, CommissionTierDto } from '~/types/commissionTiers'
import { APPLIES_TO_OPTIONS } from '~/types/commissionTiers'
import type { BonusRuleDto } from '~/types/bonusRules'
import type { CollectionCommissionTierDto } from '~/types/collectionCommissionTiers'
import type { PlanType } from '~/types/plans'
import { PLAN_TYPE_OPTIONS } from '~/types/plans'

// Admin editor for the three commission-engine rule surfaces (ADR 0013):
// inscription bands (commission_tiers, V42), scale bonuses (commission_bonus_rules,
// V37) and collection buckets by days (collection_commission_tiers, V44). Each tab
// is its own simple CRUD table + modal — the backend recalculates; this UI configures.
definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: ['COMMISSION_TIER_MANAGE', 'BONUS_RULE_MANAGE', 'COLLECTION_COMMISSION_TIER_MANAGE'],
})

const { t } = useI18n()
const { can } = usePermissions()
const toast = useToast()

// commission_tier and bonus_rule share the COMMISSIONS permission domain (V66/V72).
const canViewAuditChanges = computed(() => can('AUDIT_VIEW_ALL') || can('COMMISSION_AUDIT_VIEW'))
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

// =========================================================
// Tab 1 — Bandas de inscripción (commission_tiers)
// =========================================================
const tierApi = useCommissionTiers()
const canManageTiers = computed(() => can('COMMISSION_TIER_MANAGE'))
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

async function loadTiers() {
  tierLoading.value = true
  try {
    const res = await tierApi.list({
      page: tierPage.value - 1,
      size: tierSize.value,
      q: tierSearch.value.trim() || undefined,
      filter: buildTierFilter(),
      includeInactive: tierIncludeInactive.value,
      promoterTypeUuid: tierPromoterTypeUuid.value,
    })
    tierData.value = res.content ?? []
    tierTotal.value = res.totalElements ?? 0
  }
  catch {
    tierData.value = []
    tierTotal.value = 0
  }
  finally {
    tierLoading.value = false
  }
}

watch(tierSize, () => { tierPage.value = 1 })
watch([tierPage, tierSize], loadTiers)
let tierSearchTimer: ReturnType<typeof setTimeout> | undefined
watch(tierSearch, () => {
  clearTimeout(tierSearchTimer)
  tierSearchTimer = setTimeout(() => { tierPage.value = 1; loadTiers() }, 400)
})
watch([tierIncludeInactive, tierPromoterTypeUuid, tierPlanType, tierAppliesTo], () => {
  tierPage.value = 1
  loadTiers()
})

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
const canManageBonus = computed(() => can('BONUS_RULE_MANAGE'))
const bonusData = ref<BonusRuleDto[]>([])
const bonusTotal = ref(0)
const bonusLoading = ref(false)
const bonusSearch = ref('')
const bonusIncludeInactive = ref(false)
const bonusPromoterTypeUuid = ref<string | undefined>(undefined)
const bonusPage = ref(1)
const bonusSize = ref(DEFAULT_PAGE_SIZE)

async function loadBonusRules() {
  bonusLoading.value = true
  try {
    const res = await bonusApi.list({
      page: bonusPage.value - 1,
      size: bonusSize.value,
      q: bonusSearch.value.trim() || undefined,
      includeInactive: bonusIncludeInactive.value,
      promoterTypeUuid: bonusPromoterTypeUuid.value,
    })
    bonusData.value = res.content ?? []
    bonusTotal.value = res.totalElements ?? 0
  }
  catch {
    bonusData.value = []
    bonusTotal.value = 0
  }
  finally {
    bonusLoading.value = false
  }
}

watch(bonusSize, () => { bonusPage.value = 1 })
watch([bonusPage, bonusSize], loadBonusRules)
let bonusSearchTimer: ReturnType<typeof setTimeout> | undefined
watch(bonusSearch, () => {
  clearTimeout(bonusSearchTimer)
  bonusSearchTimer = setTimeout(() => { bonusPage.value = 1; loadBonusRules() }, 400)
})
watch([bonusIncludeInactive, bonusPromoterTypeUuid], () => {
  bonusPage.value = 1
  loadBonusRules()
})

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
const canManageCollection = computed(() => can('COLLECTION_COMMISSION_TIER_MANAGE'))
const collectionData = ref<CollectionCommissionTierDto[]>([])
const collectionTotal = ref(0)
const collectionLoading = ref(false)
const collectionSearch = ref('')
const collectionIncludeInactive = ref(false)
const collectionPromoterTypeUuid = ref<string | undefined>(undefined)
const collectionPage = ref(1)
const collectionSize = ref(DEFAULT_PAGE_SIZE)

async function loadCollectionTiers() {
  collectionLoading.value = true
  try {
    const res = await collectionApi.list({
      page: collectionPage.value - 1,
      size: collectionSize.value,
      q: collectionSearch.value.trim() || undefined,
      includeInactive: collectionIncludeInactive.value,
      promoterTypeUuid: collectionPromoterTypeUuid.value,
    })
    collectionData.value = res.content ?? []
    collectionTotal.value = res.totalElements ?? 0
  }
  catch {
    collectionData.value = []
    collectionTotal.value = 0
  }
  finally {
    collectionLoading.value = false
  }
}

watch(collectionSize, () => { collectionPage.value = 1 })
watch([collectionPage, collectionSize], loadCollectionTiers)
let collectionSearchTimer: ReturnType<typeof setTimeout> | undefined
watch(collectionSearch, () => {
  clearTimeout(collectionSearchTimer)
  collectionSearchTimer = setTimeout(() => { collectionPage.value = 1; loadCollectionTiers() }, 400)
})
watch([collectionIncludeInactive, collectionPromoterTypeUuid], () => {
  collectionPage.value = 1
  loadCollectionTiers()
})

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

onMounted(() => {
  if (canManageTiers.value) loadTiers()
  if (canManageBonus.value) loadBonusRules()
  if (canManageCollection.value) loadCollectionTiers()
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
      <div class="flex items-center justify-end">
        <UButton color="primary" icon="i-lucide-plus" :disabled="!canManageTiers" @click="openCreateTier">
          {{ t('commissionRules.tiers.new') }}
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
          v-model="tierPromoterTypeUuid"
          :items="promoterTypeFilterItems"
          label-key="label"
          value-key="value"
          icon="i-lucide-users"
          class="w-56"
        />
        <USelectMenu
          v-model="tierPlanType"
          :items="planTypeFilterItems"
          label-key="label"
          value-key="value"
          icon="i-lucide-layout-grid"
          class="w-56"
        />
        <USelectMenu
          v-model="tierAppliesTo"
          :items="appliesToFilterItems"
          label-key="label"
          value-key="value"
          icon="i-lucide-target"
          class="w-48"
        />
        <UCheckbox v-model="tierIncludeInactive" :label="$t('catalogs.includeInactive')" class="self-center" />
      </div>
      <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-prohealth-50/60">
            <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
              <th class="px-5 py-3 font-semibold">{{ t('commissionRules.tiers.columns.name') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('commissionRules.tiers.columns.planType') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('commissionRules.tiers.columns.threshold') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('commissionRules.tiers.columns.reward') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('commissionRules.tiers.columns.appliesTo') }}</th>
              <th class="px-5 py-3 font-semibold text-right">{{ t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-prohealth-100">
            <TableSkeleton v-if="tierLoading" :rows="4" :cols="6" />
            <tr v-else-if="tierData.length === 0">
              <td colspan="6" class="px-5 py-10 text-center text-prohealth-500">{{ t('commissionRules.tiers.empty') }}</td>
            </tr>
            <tr v-for="tier in tierData" v-else :key="tier.uuid" class="hover:bg-prohealth-50/50" :class="{ 'opacity-60': !tier.active }">
              <td class="px-5 py-3 font-medium text-prohealth-900">{{ tier.name }}</td>
              <td class="px-5 py-3 text-prohealth-600">{{ tier.planType ? t(`plans.types.${tier.planType}`) : t('commissionRules.tiers.allPlans') }}</td>
              <td class="px-5 py-3 text-prohealth-600">{{ tier.thresholdCount }}</td>
              <td class="px-5 py-3 text-prohealth-600">{{ tierReward(tier) }}</td>
              <td class="px-5 py-3">
                <UBadge color="primary" variant="subtle" size="sm">{{ t(`commissionRules.appliesTo.${tier.appliesTo}`) }}</UBadge>
              </td>
              <td class="px-5 py-3" @click.stop>
                <div class="flex items-center justify-end gap-1">
                  <UButton color="neutral" variant="ghost" icon="i-lucide-pencil" size="sm" :disabled="!canManageTiers" @click="openEditTier(tier)" />
                  <UButton color="error" variant="ghost" icon="i-lucide-trash-2" size="sm" :disabled="!canManageTiers" @click="openDeleteTier(tier)" />
                  <UTooltip v-if="canViewAudit" :text="t('audit.trigger')">
                    <UButton color="neutral" variant="ghost" icon="i-lucide-history" size="sm" @click="openAudit('commission_tier', tier)" />
                  </UTooltip>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
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

    <!-- Tab 2: Bonos por escala -->
    <div v-show="activeTab === 'bonusRules'" class="space-y-4">
      <div class="flex items-center justify-end">
        <UButton color="primary" icon="i-lucide-plus" :disabled="!canManageBonus" @click="openCreateBonus">
          {{ t('commissionRules.bonusRules.new') }}
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
          v-model="bonusPromoterTypeUuid"
          :items="promoterTypeFilterItems"
          label-key="label"
          value-key="value"
          icon="i-lucide-users"
          class="w-56"
        />
        <UCheckbox v-model="bonusIncludeInactive" :label="$t('catalogs.includeInactive')" class="self-center" />
      </div>
      <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-prohealth-50/60">
            <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
              <th class="px-5 py-3 font-semibold">{{ t('commissionRules.bonusRules.columns.name') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('commissionRules.bonusRules.columns.metric') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('commissionRules.bonusRules.columns.accrual') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('commissionRules.bonusRules.columns.threshold') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('commissionRules.bonusRules.columns.window') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('commissionRules.bonusRules.columns.reward') }}</th>
              <th class="px-5 py-3 font-semibold text-right">{{ t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-prohealth-100">
            <TableSkeleton v-if="bonusLoading" :rows="4" :cols="7" />
            <tr v-else-if="bonusData.length === 0">
              <td colspan="7" class="px-5 py-10 text-center text-prohealth-500">{{ t('commissionRules.bonusRules.empty') }}</td>
            </tr>
            <tr v-for="rule in bonusData" v-else :key="rule.uuid" class="hover:bg-prohealth-50/50">
              <td class="px-5 py-3 font-medium text-prohealth-900">{{ rule.name }}</td>
              <td class="px-5 py-3 text-prohealth-600">{{ t(`commissionRules.bonusMetrics.${rule.metric}`) }}</td>
              <td class="px-5 py-3 text-prohealth-600">{{ t(`commissionRules.accrualModes.${rule.accrual}`) }}</td>
              <td class="px-5 py-3 text-prohealth-600">{{ rule.thresholdCount }}</td>
              <td class="px-5 py-3 text-prohealth-600">{{ t(`commissionRules.windowStrategies.${rule.windowStrategy}`) }}</td>
              <td class="px-5 py-3 text-prohealth-600">{{ bonusReward(rule) }}</td>
              <td class="px-5 py-3" @click.stop>
                <div class="flex items-center justify-end gap-1">
                  <UButton color="neutral" variant="ghost" icon="i-lucide-pencil" size="sm" :disabled="!canManageBonus" @click="openEditBonus(rule)" />
                  <UButton color="error" variant="ghost" icon="i-lucide-trash-2" size="sm" :disabled="!canManageBonus" @click="openDeleteBonus(rule)" />
                  <UTooltip v-if="canViewAudit" :text="t('audit.trigger')">
                    <UButton color="neutral" variant="ghost" icon="i-lucide-history" size="sm" @click="openAudit('bonus_rule', rule)" />
                  </UTooltip>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
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

    <!-- Tab 3: Comisión de cobranza -->
    <div v-show="activeTab === 'collectionTiers'" class="space-y-4">
      <div class="flex items-center justify-end">
        <UButton color="primary" icon="i-lucide-plus" :disabled="!canManageCollection" @click="openCreateCollectionTier">
          {{ t('commissionRules.collectionTiers.new') }}
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
          v-model="collectionPromoterTypeUuid"
          :items="promoterTypeFilterItems"
          label-key="label"
          value-key="value"
          icon="i-lucide-users"
          class="w-56"
        />
        <UCheckbox v-model="collectionIncludeInactive" :label="t('catalogs.includeInactive')" class="self-center" />
      </div>
      <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-prohealth-50/60">
            <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
              <th class="px-5 py-3 font-semibold">{{ t('commissionRules.collectionTiers.columns.name') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('commissionRules.collectionTiers.columns.maxDays') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('commissionRules.collectionTiers.columns.commissionPct') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('catalogs.columns.status') }}</th>
              <th class="px-5 py-3 font-semibold text-right">{{ t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-prohealth-100">
            <TableSkeleton v-if="collectionLoading" :rows="4" :cols="5" />
            <tr v-else-if="collectionData.length === 0">
              <td colspan="5" class="px-5 py-10 text-center text-prohealth-500">{{ t('commissionRules.collectionTiers.empty') }}</td>
            </tr>
            <tr v-for="tier in collectionData" v-else :key="tier.uuid" class="hover:bg-prohealth-50/50" :class="{ 'opacity-60': !tier.active }">
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
                  <UButton color="neutral" variant="ghost" icon="i-lucide-pencil" size="sm" :disabled="!canManageCollection" @click="openEditCollectionTier(tier)" />
                  <UButton color="error" variant="ghost" icon="i-lucide-trash-2" size="sm" :disabled="!canManageCollection" @click="openDeleteCollectionTier(tier)" />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
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

    <!-- Modals -->
    <CommissionTierFormModal v-model:open="tierFormOpen" :tier="editingTier" @saved="onTierSaved" @delete="onDeleteTierFromEdit" />
    <BonusRuleFormModal v-model:open="bonusFormOpen" :rule="editingBonus" @saved="onBonusSaved" @delete="onDeleteBonusFromEdit" />
    <CollectionCommissionTierFormModal v-model:open="collectionFormOpen" :tier="editingCollectionTier" @saved="onCollectionTierSaved" @delete="onDeleteCollectionTierFromEdit" />

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
