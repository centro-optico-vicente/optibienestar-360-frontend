<script setup lang="ts">
import { buildPageSizeItems, DEFAULT_PAGE_SIZE, UNPAGED_PAGE_SIZE } from '~/utils/pagination'
import type { ApiError } from '~/types/auth'
import type {
  CampaignAudienceDto,
  CampaignDto,
  CampaignEffectivenessDto,
  CampaignExceptionDto,
  CampaignTransactionLinkDto,
} from '~/types/campaign'
import { CAMPAIGN_MODE_OPTIONS, CAMPAIGN_SCOPE_OPTIONS } from '~/types/campaign'
import type { SelectItem } from '~/types/options'
import type { CommissionTierDto } from '~/types/commissionTiers'
import type { BonusRuleDto } from '~/types/bonusRules'
import type { CollectionCommissionTierDto } from '~/types/collectionCommissionTiers'
import type { HierarchyOverrideTierDto } from '~/types/hierarchyOverrideTiers'

// Ficha/detail page for a commission campaign (hub plan "commission campaigns").
// Follows the layout conventions of promoters/[uuid].vue: header card with
// status badges + actions, "Datos generales" dl-grid card, then a set of
// bordered-card tables (pagination nested inside the card, per the list
// page's fix — see 00ce60b in this branch). Route file is named [id].vue per
// the task brief; the param still resolves to the campaign uuid.
definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'CAMPAIGN_VIEW_ALL',
})

const { t } = useI18n()
const { formatDate, formatCurrency } = useFormatters()
const { can } = usePermissions()
const toast = useToast()

const route = useRoute()
const campaignUuid = route.params.id as string

const campaignsApi = useCampaigns()
const tierApi = useCommissionTiers()
const bonusApi = useBonusRules()
const collectionApi = useCollectionCommissionTiers()
const overrideApi = useHierarchyOverrideTiers()
const promotersApi = usePromoters()

useSeoMeta({ title: () => t('common.seoTitle', { page: t('campaigns.detail.seoPage') }) })

const canUpdate = computed(() => can('CAMPAIGN_UPDATE'))
const canDelete = computed(() => can('CAMPAIGN_DELETE'))
const canCreate = computed(() => can('CAMPAIGN_CREATE'))
const canExceptionCreate = computed(() => can('CAMPAIGN_EXCEPTION_CREATE'))
const canExceptionDelete = computed(() => can('CAMPAIGN_EXCEPTION_DELETE'))
const canViewTiers = computed(() => can('COMMISSION_TIER_VIEW_ALL'))
const canCreateTiers = computed(() => can('COMMISSION_TIER_CREATE'))
const canUpdateTiers = computed(() => can('COMMISSION_TIER_UPDATE'))
const canDeleteTiers = computed(() => can('COMMISSION_TIER_DELETE'))
const canViewBonus = computed(() => can('BONUS_RULE_VIEW_ALL'))
const canCreateBonus = computed(() => can('BONUS_RULE_CREATE'))
const canUpdateBonus = computed(() => can('BONUS_RULE_UPDATE'))
const canDeleteBonus = computed(() => can('BONUS_RULE_DELETE'))
const canViewCollection = computed(() => can('COLLECTION_COMMISSION_TIER_VIEW_ALL'))
const canCreateCollection = computed(() => can('COLLECTION_COMMISSION_TIER_CREATE'))
const canUpdateCollection = computed(() => can('COLLECTION_COMMISSION_TIER_UPDATE'))
const canDeleteCollection = computed(() => can('COLLECTION_COMMISSION_TIER_DELETE'))
const canViewOverride = computed(() => can('HIERARCHY_OVERRIDE_TIER_VIEW_ALL'))
const canCreateOverride = computed(() => can('HIERARCHY_OVERRIDE_TIER_CREATE'))
const canUpdateOverride = computed(() => can('HIERARCHY_OVERRIDE_TIER_UPDATE'))
const canDeleteOverride = computed(() => can('HIERARCHY_OVERRIDE_TIER_DELETE'))

const pageSizeItems = buildPageSizeItems(t)
const detailTabs = computed(() => [
  ...(campaign.value?.scope !== 'ALL' ? [{ label: t('campaigns.detail.tabs.audience'), value: 'audience', icon: 'i-lucide-users' }] : []),
  { label: t('campaigns.detail.tabs.rules'), value: 'rules', icon: 'i-lucide-list-checks' },
  { label: t('campaigns.detail.tabs.transactions'), value: 'transactions', icon: 'i-lucide-receipt' },
  { label: t('campaigns.detail.tabs.exceptions'), value: 'exceptions', icon: 'i-lucide-triangle-alert' },
])
const activeDetailTab = ref('rules')
const auditOpen = ref(false)
const canViewAuditChanges = computed(() => can('AUDIT_VIEW_ALL'))
const canViewAuditReports = computed(() => can('REPORT_AUDIT_VIEW_ALL'))
const canViewAudit = computed(() => canViewAuditChanges.value || canViewAuditReports.value)

// =========================================================
// Campaign load
// =========================================================
const campaign = ref<CampaignDto | null>(null)
const loading = ref(true)
const notFound = ref(false)

watch(campaign, (value) => {
  if (value) activeDetailTab.value = value.scope === 'ALL' ? 'rules' : 'audience'
}, { immediate: true })

async function loadCampaign() {
  loading.value = true
  try {
    campaign.value = await campaignsApi.get(campaignUuid)
  }
  catch (err) {
    if ((err as ApiError).status === 404) notFound.value = true
    campaign.value = null
  }
  finally {
    loading.value = false
  }
}

const refreshingAll = ref(false)
async function refreshAll() {
  refreshingAll.value = true
  try {
    await Promise.all([
      loadCampaign(),
      canViewAudience.value ? loadAudience() : Promise.resolve(),
      canViewTiers.value ? loadTiers() : Promise.resolve(),
      canViewBonus.value ? loadBonus() : Promise.resolve(),
      canViewCollection.value ? loadCollection() : Promise.resolve(),
      canViewOverride.value ? loadOverride() : Promise.resolve(),
      loadTransactions(),
      loadExceptions(),
    ])
  }
  finally {
    refreshingAll.value = false
  }
}

onMounted(async () => {
  await loadCampaign()
  await Promise.all([
    loadEffectiveness(),
    canViewAudience.value ? loadAudience() : Promise.resolve(),
    canViewTiers.value ? loadTiers() : Promise.resolve(),
    canViewBonus.value ? loadBonus() : Promise.resolve(),
    canViewCollection.value ? loadCollection() : Promise.resolve(),
    canViewOverride.value ? loadOverride() : Promise.resolve(),
    loadTransactions(),
    loadExceptions(),
  ])
})

function money(v?: number | string | null, currencyCode?: string | null): string {
  if (v === null || v === undefined || v === '') return t('common.empty')
  return formatCurrency(Number(v), currencyCode || 'USD')
}

function scopeLabel(c: CampaignDto): string {
  const opt = CAMPAIGN_SCOPE_OPTIONS.find(o => o.value === c.scope)
  return opt ? t(opt.labelKey) : c.scope
}
function modeLabel(c: CampaignDto): string {
  const opt = CAMPAIGN_MODE_OPTIONS.find(o => o.value === c.mode)
  return opt ? t(opt.labelKey) : c.mode
}

// =========================================================
// Edit (shared CampaignFormModal)
// =========================================================
const formOpen = ref(false)
function openEdit() { formOpen.value = true }
function onSaved(updated: CampaignDto) { campaign.value = updated }

// =========================================================
// Relaunch (CampaignFormModal with relaunchOf + forceCreate + blanked dates)
// =========================================================
const relaunchOpen = ref(false)
function openRelaunch() { relaunchOpen.value = true }
async function onRelaunched(created: CampaignDto) {
  relaunchOpen.value = false
  await navigateTo(`/dashboard/campaigns/${created.uuid}`)
}

// =========================================================
// Effectiveness (GET /{uuid}/effectiveness) — JSON summary rendered inline,
// NOT the ADR-0012 PDF/XLSX/CSV report-download engine (campaigns aren't
// wired into GenericRecordReportService yet — backend follow-up).
// =========================================================
const effectiveness = ref<CampaignEffectivenessDto | null>(null)
const effectivenessLoading = ref(false)
const effectivenessLoaded = ref(false)

async function loadEffectiveness() {
  effectivenessLoading.value = true
  try {
    effectiveness.value = await campaignsApi.getEffectiveness(campaignUuid)
    effectivenessLoaded.value = true
  }
  catch {
    effectiveness.value = null
  }
  finally {
    effectivenessLoading.value = false
  }
}

function pct(v?: number | string | null): string {
  if (v === null || v === undefined) return t('common.empty')
  return `${Number(v).toFixed(1)}%`
}

// =========================================================
// Delete
// =========================================================
const deleteOpen = ref(false)
const deleting = ref(false)

function openDelete() {
  if (!campaign.value) return
  deleteOpen.value = true
}

async function confirmDelete() {
  if (!campaign.value) return
  deleting.value = true
  try {
    await campaignsApi.remove(campaign.value.uuid)
    toast.add({
      title: t('campaigns.deletedToast'),
      color: 'success',
      icon: 'i-lucide-check-circle',
    })
    await navigateTo('/dashboard/campaigns')
  }
  catch { /* toast handled by useApi */ }
  finally { deleting.value = false }
}

// =========================================================
// Audiencia (scope INCLUDE/EXCLUDE)
// =========================================================
const canViewAudience = computed(() => campaign.value ? campaign.value.scope !== 'ALL' : false)
const audience = ref<CampaignAudienceDto[]>([])
const audienceLoading = ref(false)

async function loadAudience() {
  audienceLoading.value = true
  try {
    const res = await campaignsApi.audience(campaignUuid, { size: 100 })
    audience.value = res.content ?? []
  }
  catch {
    audience.value = []
  }
  finally {
    audienceLoading.value = false
  }
}

const newPromoterUuid = ref<string | undefined>(undefined)
const addingAudience = ref(false)

async function searchPromoters(q: string): Promise<SelectItem[]> {
  const res = await promotersApi.list({ q, size: 20 })
  return (res.content ?? []).map(p => ({ label: p.displayName, value: p.uuid }))
}

async function addAudienceMember() {
  if (!newPromoterUuid.value) return
  addingAudience.value = true
  try {
    await campaignsApi.addAudienceMember(campaignUuid, newPromoterUuid.value)
    newPromoterUuid.value = undefined
    await loadAudience()
    if (campaign.value) campaign.value.audienceCount = audience.value.length
  }
  catch { /* toast handled by useApi */ }
  finally { addingAudience.value = false }
}

const audienceRemoveTarget = ref<CampaignAudienceDto | null>(null)
const audienceRemoveOpen = ref(false)
const audienceRemoving = ref(false)
function openRemoveAudience(m: CampaignAudienceDto) { audienceRemoveTarget.value = m; audienceRemoveOpen.value = true }
async function confirmRemoveAudience() {
  if (!audienceRemoveTarget.value) return
  audienceRemoving.value = true
  try {
    // DELETE /audience/{promoterUuid} — routed by the promoter's uuid, not the bridge row's own uuid.
    await campaignsApi.removeAudienceMember(campaignUuid, audienceRemoveTarget.value.promoter_Uuid)
    audienceRemoveOpen.value = false
    await loadAudience()
    if (campaign.value) campaign.value.audienceCount = audience.value.length
  }
  catch { /* toast handled by useApi */ }
  finally { audienceRemoving.value = false }
}

// =========================================================
// Reglas de comisión asociadas (4 types, unified read model)
// =========================================================
type RuleType = 'tier' | 'bonus' | 'collection' | 'override'
interface RuleRow {
  type: RuleType
  uuid: string
  name: string
  params: string
  active: boolean
  raw: CommissionTierDto | BonusRuleDto | CollectionCommissionTierDto | HierarchyOverrideTierDto
}

const tierRows = ref<CommissionTierDto[]>([])
const bonusRows = ref<BonusRuleDto[]>([])
const collectionRows = ref<CollectionCommissionTierDto[]>([])
const overrideRows = ref<HierarchyOverrideTierDto[]>([])
const rulesLoading = ref(false)

async function loadTiers() {
  try { tierRows.value = (await tierApi.list({ campaignUuid, size: 100, includeInactive: true })).content ?? [] }
  catch { tierRows.value = [] }
}
async function loadBonus() {
  try { bonusRows.value = (await bonusApi.list({ campaignUuid, size: 100, includeInactive: true })).content ?? [] }
  catch { bonusRows.value = [] }
}
async function loadCollection() {
  try { collectionRows.value = (await collectionApi.list({ campaignUuid, size: 100, includeInactive: true })).content ?? [] }
  catch { collectionRows.value = [] }
}
async function loadOverride() {
  try { overrideRows.value = (await overrideApi.list({ campaignUuid, size: 100, includeInactive: true })).content ?? [] }
  catch { overrideRows.value = [] }
}

async function loadAllRules() {
  rulesLoading.value = true
  try {
    await Promise.all([
      canViewTiers.value ? loadTiers() : Promise.resolve(),
      canViewBonus.value ? loadBonus() : Promise.resolve(),
      canViewCollection.value ? loadCollection() : Promise.resolve(),
      canViewOverride.value ? loadOverride() : Promise.resolve(),
    ])
  }
  finally {
    rulesLoading.value = false
  }
}

function tierParams(tier: CommissionTierDto): string {
  const reward = tier.commissionPct != null ? `${tier.commissionPct}%` : (tier.flatAmount != null ? `$${tier.flatAmount}` : '—')
  return `${t('commissionRules.tiers.columns.threshold')}: ${tier.thresholdCount} · ${reward}`
}
function bonusParams(rule: BonusRuleDto): string {
  const reward = rule.rewardType === 'PERCENTAGE' ? `${rule.rewardPct}%` : `$${rule.flatAmount} ${rule.rewardCurrency}`
  return `${t('commissionRules.bonusRules.columns.threshold')}: ${rule.thresholdCount} · ${reward}`
}
function collectionParams(tier: CollectionCommissionTierDto): string {
  return `${t('commissionRules.collectionTiers.columns.maxDays')}: ${tier.maxDays} · ${tier.commissionPct}%`
}
function overrideParams(tier: HierarchyOverrideTierDto): string {
  const reward = tier.overridePct != null ? `${tier.overridePct}%` : `${tier.flatAmount ?? '—'} ${tier.flatAmountCurrency_Code ?? ''}`.trim()
  return `${t('hierarchyOverrideTiers.columns.threshold')}: ${tier.thresholdCount} · ${reward}`
}

const ruleRows = computed<RuleRow[]>(() => [
  ...tierRows.value.map(r => ({ type: 'tier' as const, uuid: r.uuid, name: r.name, params: tierParams(r), active: r.active, raw: r })),
  ...bonusRows.value.map(r => ({ type: 'bonus' as const, uuid: r.uuid, name: r.name, params: bonusParams(r), active: r.active, raw: r })),
  ...collectionRows.value.map(r => ({ type: 'collection' as const, uuid: r.uuid, name: r.name, params: collectionParams(r), active: r.active, raw: r })),
  ...overrideRows.value.map(r => ({ type: 'override' as const, uuid: r.uuid, name: r.name, params: overrideParams(r), active: r.active, raw: r })),
])

function ruleTypeLabel(type: RuleType): string {
  return t(`campaigns.detail.ruleTypes.${type}`)
}
function ruleTypeColor(type: RuleType): 'primary' | 'success' | 'warning' | 'info' {
  return type === 'tier' ? 'primary' : type === 'bonus' ? 'success' : type === 'collection' ? 'warning' : 'info'
}
const canEditRule = (type: RuleType) =>
  type === 'tier' ? canUpdateTiers.value : type === 'bonus' ? canUpdateBonus.value : type === 'collection' ? canUpdateCollection.value : canUpdateOverride.value
const canDeleteRule = (type: RuleType) =>
  type === 'tier' ? canDeleteTiers.value : type === 'bonus' ? canDeleteBonus.value : type === 'collection' ? canDeleteCollection.value : canDeleteOverride.value

// ---- Rule modals (reusing commission-rules/index.vue's global components) ----
const tierFormOpen = ref(false)
const editingTier = ref<CommissionTierDto | null>(null)
const bonusFormOpen = ref(false)
const editingBonus = ref<BonusRuleDto | null>(null)
const collectionFormOpen = ref(false)
const editingCollection = ref<CollectionCommissionTierDto | null>(null)
const overrideFormOpen = ref(false)
const editingOverride = ref<HierarchyOverrideTierDto | null>(null)

function openEditRule(row: RuleRow) {
  if (row.type === 'tier') { editingTier.value = row.raw as CommissionTierDto; tierFormOpen.value = true }
  else if (row.type === 'bonus') { editingBonus.value = row.raw as BonusRuleDto; bonusFormOpen.value = true }
  else if (row.type === 'collection') { editingCollection.value = row.raw as CollectionCommissionTierDto; collectionFormOpen.value = true }
  else { editingOverride.value = row.raw as HierarchyOverrideTierDto; overrideFormOpen.value = true }
}

function openAddRule(type: RuleType) {
  if (type === 'tier') { editingTier.value = null; tierFormOpen.value = true }
  else if (type === 'bonus') { editingBonus.value = null; bonusFormOpen.value = true }
  else if (type === 'collection') { editingCollection.value = null; collectionFormOpen.value = true }
  else { editingOverride.value = null; overrideFormOpen.value = true }
}
const addRuleItems = computed(() => [[
  { label: t('campaigns.detail.ruleTypes.tier'), icon: 'i-lucide-trending-up', onSelect: () => openAddRule('tier'), disabled: !canCreateTiers.value },
  { label: t('campaigns.detail.ruleTypes.bonus'), icon: 'i-lucide-gift', onSelect: () => openAddRule('bonus'), disabled: !canCreateBonus.value },
  { label: t('campaigns.detail.ruleTypes.collection'), icon: 'i-lucide-calendar-clock', onSelect: () => openAddRule('collection'), disabled: !canCreateCollection.value },
  { label: t('campaigns.detail.ruleTypes.override'), icon: 'i-lucide-network', onSelect: () => openAddRule('override'), disabled: !canCreateOverride.value },
]])
const canAddAnyRule = computed(() => canCreateTiers.value || canCreateBonus.value || canCreateCollection.value || canCreateOverride.value)

// ---- Rule delete confirmations ----
const ruleDeleteOpen = ref(false)
const ruleDeleteTarget = ref<RuleRow | null>(null)
const ruleDeleting = ref(false)
function openDeleteRule(row: RuleRow) { ruleDeleteTarget.value = row; ruleDeleteOpen.value = true }
async function confirmDeleteRule() {
  const row = ruleDeleteTarget.value
  if (!row) return
  ruleDeleting.value = true
  try {
    if (row.type === 'tier') await tierApi.remove(row.uuid)
    else if (row.type === 'bonus') await bonusApi.remove(row.uuid)
    else if (row.type === 'collection') await collectionApi.remove(row.uuid)
    else await overrideApi.remove(row.uuid)
    toast.add({ title: t('common.delete'), color: 'success', icon: 'i-lucide-check-circle' })
    ruleDeleteOpen.value = false
    await loadAllRules()
  }
  catch { /* toast handled by useApi */ }
  finally { ruleDeleting.value = false }
}
function onDeleteFromTierModal(t: CommissionTierDto) { openDeleteRule({ type: 'tier', uuid: t.uuid, name: t.name, params: '', active: t.active, raw: t }) }
function onDeleteFromBonusModal(r: BonusRuleDto) { openDeleteRule({ type: 'bonus', uuid: r.uuid, name: r.name, params: '', active: r.active, raw: r }) }
function onDeleteFromCollectionModal(t: CollectionCommissionTierDto) { openDeleteRule({ type: 'collection', uuid: t.uuid, name: t.name, params: '', active: t.active, raw: t }) }
function onDeleteFromOverrideModal(t: HierarchyOverrideTierDto) { openDeleteRule({ type: 'override', uuid: t.uuid, name: t.name, params: '', active: t.active, raw: t }) }

// =========================================================
// Transacciones de la campaña (read-only)
// =========================================================
const txItems = ref<CampaignTransactionLinkDto[]>([])
const txTotal = ref(0)
const txLoading = ref(false)
const txPage = ref(1)
const txSize = ref(DEFAULT_PAGE_SIZE)

async function loadTransactions() {
  txLoading.value = true
  try {
    const res = await campaignsApi.transactions(campaignUuid, { page: txPage.value - 1, size: txSize.value })
    txItems.value = res.content ?? []
    txTotal.value = res.totalElements ?? 0
  }
  catch {
    txItems.value = []
    txTotal.value = 0
  }
  finally {
    txLoading.value = false
  }
}
watch([txPage, txSize], loadTransactions)

function txSourceLabel(tx: CampaignTransactionLinkDto): string {
  return tx.source === 'AUTO' ? t('campaigns.detail.sourceAuto') : t('campaigns.detail.sourceException')
}
function txReference(tx: CampaignTransactionLinkDto): string {
  return tx.payment_Display ?? tx.membership_Display ?? t('common.empty')
}
function txAmount(tx: CampaignTransactionLinkDto): string {
  if (tx.amount === null || tx.amount === undefined) return t('common.empty')
  return formatCurrency(Number(tx.amount), tx.currency_Code || 'USD')
}

// =========================================================
// Excepciones registradas (manual only — dedicated endpoint)
// =========================================================
const exItems = ref<CampaignExceptionDto[]>([])
const exTotal = ref(0)
const exLoading = ref(false)
const exPage = ref(1)
const exSize = ref(DEFAULT_PAGE_SIZE)

async function loadExceptions() {
  exLoading.value = true
  try {
    const res = await campaignsApi.exceptions(campaignUuid, { page: exPage.value - 1, size: exSize.value })
    exItems.value = res.content ?? []
    exTotal.value = res.totalElements ?? 0
  }
  catch {
    exItems.value = []
    exTotal.value = 0
  }
  finally {
    exLoading.value = false
  }
}
watch([exPage, exSize], loadExceptions)

function exReference(ex: CampaignExceptionDto): string {
  return ex.payment_Display ?? ex.membership_Display ?? t('common.empty')
}

const exceptionAddOpen = ref(false)
async function onExceptionAdded() {
  exceptionAddOpen.value = false
  await Promise.all([loadExceptions(), loadTransactions()])
}

const exceptionRemoveOpen = ref(false)
const exceptionRemoveTarget = ref<CampaignExceptionDto | null>(null)
const exceptionRemoving = ref(false)
function openRemoveException(ex: CampaignExceptionDto) { exceptionRemoveTarget.value = ex; exceptionRemoveOpen.value = true }
async function confirmRemoveException() {
  if (!exceptionRemoveTarget.value) return
  exceptionRemoving.value = true
  try {
    await campaignsApi.removeException(campaignUuid, exceptionRemoveTarget.value.uuid)
    toast.add({ title: t('campaigns.exceptions.removedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    exceptionRemoveOpen.value = false
    await Promise.all([loadExceptions(), loadTransactions()])
  }
  catch { /* toast handled by useApi */ }
  finally { exceptionRemoving.value = false }
}
</script>

<template>
  <div class="space-y-5">
    <UButton color="neutral" variant="ghost" icon="i-lucide-arrow-left" to="/dashboard/campaigns" size="sm">
      {{ t('campaigns.title') }}
    </UButton>

    <div v-if="loading" class="bg-white rounded-2xl border border-prohealth-100 p-6 space-y-3">
      <USkeleton class="h-7 w-64 rounded" />
      <USkeleton class="h-4 w-40 rounded" />
      <USkeleton class="h-4 w-full max-w-lg rounded" />
    </div>
    <div v-else-if="notFound || !campaign" class="bg-white rounded-2xl border border-prohealth-100 p-12 text-center">
      <UIcon name="i-lucide-search-x" class="w-10 h-10 mx-auto mb-3 text-prohealth-300" />
      <p class="text-prohealth-700 font-semibold">{{ t('campaigns.detail.notFoundTitle') }}</p>
      <p class="text-sm text-prohealth-500 mt-1">{{ t('campaigns.detail.notFoundBody') }}</p>
    </div>

    <template v-else>
      <!-- Header + actions -->
      <div class="bg-white rounded-2xl border border-prohealth-100 p-6 space-y-5">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div class="flex items-center gap-3 flex-wrap">
              <h1 class="text-2xl font-extrabold text-prohealth-900">{{ campaign.name }}</h1>
              <UBadge :color="campaign.active ? 'success' : 'neutral'" variant="subtle">
                {{ campaign.active ? t('catalogs.status.active') : t('catalogs.status.inactive') }}
              </UBadge>
              <UBadge color="primary" variant="subtle">{{ scopeLabel(campaign) }}</UBadge>
              <UBadge :color="campaign.mode === 'TARGETED' ? 'primary' : 'neutral'" variant="subtle">{{ modeLabel(campaign) }}</UBadge>
            </div>
            <p class="text-sm text-prohealth-500 mt-1">{{ formatDate(campaign.startsAt) }} — {{ formatDate(campaign.endsAt) }}</p>
          </div>

          <div class="flex items-center gap-2 flex-wrap">
            <RefreshButton size="md" variant="ghost" :icon-only="false" :loading="refreshingAll" :title="t('common.refreshRecord')" @refresh="refreshAll" />
            <ReportPrintButton table-name="campaigns" :record-uuid="campaign.uuid" variant="ghost" />
            <UTooltip v-if="canViewAudit" :text="t('audit.trigger')">
              <UButton color="neutral" variant="ghost" icon="i-lucide-history" @click="auditOpen = true" />
            </UTooltip>
            <UTooltip :text="t('campaigns.detail.relaunch')">
              <UButton color="primary" variant="ghost" icon="i-lucide-rocket" :disabled="!canCreate" @click="openRelaunch">
                {{ t('campaigns.detail.relaunch') }}
              </UButton>
            </UTooltip>
            <UButton v-if="canUpdate" color="info" variant="ghost" icon="i-lucide-pencil" @click="openEdit">
              {{ t('common.edit') }}
            </UButton>
            <UButton v-if="canDelete" color="error" variant="ghost" icon="i-lucide-trash-2" class="ms-2" @click="openDelete" />
          </div>
        </div>

        <p v-if="campaign.description" class="text-sm text-prohealth-700 mt-4 max-w-3xl">{{ campaign.description }}</p>

      <!-- 1. Datos generales -->
      <div class="pt-5 border-t border-prohealth-100">
        <h2 class="font-bold text-prohealth-900 mb-4">{{ t('campaigns.detail.generalData') }}</h2>
        <dl class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 text-sm">
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('campaigns.detail.fields.startsAt') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ formatDate(campaign.startsAt, 'datetime') }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('campaigns.detail.fields.endsAt') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ formatDate(campaign.endsAt, 'datetime') }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('campaigns.detail.fields.scope') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ scopeLabel(campaign) }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('campaigns.detail.fields.mode') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ modeLabel(campaign) }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('campaigns.detail.fields.evaluateOnlyAtEnd') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ campaign.evaluateOnlyAtEnd ? t('common.yes') : t('common.no') }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('campaigns.detail.fields.payOnlyAtEnd') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ campaign.payOnlyAtEnd ? t('common.yes') : t('common.no') }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('campaigns.detail.fields.targetAmount') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">
              {{ money(campaign.targetAmount) }}
              <span v-if="campaign.targetAmountCurrency_Display" class="text-xs text-prohealth-500">({{ campaign.targetAmountCurrency_Display }})</span>
            </dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('campaigns.detail.fields.targetCount') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ campaign.targetCount ?? t('common.empty') }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('campaigns.detail.fields.exclusivityGroup') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ campaign.exclusivityGroup || t('common.empty') }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('campaigns.detail.fields.priority') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ campaign.priority ?? t('common.empty') }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('campaigns.detail.fields.createdAt') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ formatDate(campaign.createdAt, 'datetime') }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('campaigns.detail.fields.uuid') }}</dt>
            <dd class="text-prohealth-800 mt-0.5 font-mono text-xs break-all">{{ campaign.uuid }}</dd>
          </div>
        </dl>
      </div>
      </div>

      <!-- 1b. Campaign metrics -->
      <div class="bg-white rounded-2xl border border-prohealth-100 p-6">
        <div class="flex items-center justify-between gap-3 mb-4">
          <h2 class="font-bold text-prohealth-900">{{ t('campaigns.detail.metrics') }}</h2>
          <RefreshButton :loading="effectivenessLoading" :title="t('common.refreshSection')" @refresh="loadEffectiveness" />
        </div>
        <div v-if="effectiveness" class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('campaigns.detail.effectiveness.totalCollected') }}</dt>
            <dd class="text-prohealth-800 mt-0.5 text-lg font-bold">{{ money(effectiveness.totalCollected) }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('campaigns.detail.effectiveness.transactionCount') }}</dt>
            <dd class="text-prohealth-800 mt-0.5 text-lg font-bold">{{ effectiveness.transactionCount }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('campaigns.detail.effectiveness.amountAchievedPct') }}</dt>
            <dd class="text-prohealth-800 mt-0.5 text-lg font-bold">{{ pct(effectiveness.amountAchievedPct) }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('campaigns.detail.effectiveness.countAchievedPct') }}</dt>
            <dd class="text-prohealth-800 mt-0.5 text-lg font-bold">{{ pct(effectiveness.countAchievedPct) }}</dd>
          </div>
        </div>
        <p v-else-if="effectivenessLoading" class="text-sm text-prohealth-500">{{ t('common.loading') }}</p>
        <p v-else class="text-sm text-prohealth-500">{{ t('common.error') }}</p>
      </div>
      <UTabs v-model="activeDetailTab" :items="detailTabs" :content="false" />

      <!-- 2. Audiencia -->
      <div v-if="campaign.scope !== 'ALL'" v-show="activeDetailTab === 'audience'" class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden">
        <div class="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-prohealth-100">
          <div>
            <h2 class="font-bold text-prohealth-900">{{ t('campaigns.detail.audience') }}</h2>
            <p class="text-xs text-prohealth-500 mt-0.5">{{ scopeLabel(campaign) }}</p>
          </div>
          <RefreshButton :loading="audienceLoading" :title="t('common.refreshSection')" @refresh="loadAudience" />
        </div>

        <div v-if="canUpdate" class="flex items-center gap-2 px-6 py-4 border-b border-prohealth-100">
          <CommonEntityReferenceSelect
            v-model="newPromoterUuid"
            :search="searchPromoters"
            entity="promoter"
            :placeholder="t('campaigns.detail.audiencePlaceholder')"
            :search-placeholder="t('campaigns.detail.audiencePlaceholder')"
            icon="i-lucide-search"
            class="max-w-sm"
          />
          <UButton color="primary" variant="outline" icon="i-lucide-plus" :loading="addingAudience" :disabled="!newPromoterUuid" @click="addAudienceMember">
            {{ t('campaigns.detail.addAudienceMember') }}
          </UButton>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <tbody class="divide-y divide-prohealth-100">
              <TableSkeleton v-if="audienceLoading" :rows="3" :cols="2" />
              <tr v-else-if="audience.length === 0">
                <td colspan="2" class="px-6 py-10 text-center text-prohealth-500">{{ t('campaigns.detail.audienceEmpty') }}</td>
              </tr>
              <tr v-for="m in audience" v-else :key="m.uuid" class="hover:bg-prohealth-50/50">
                <td class="px-6 py-3 font-medium text-prohealth-900">
                  <CommonEntityLinkCell :to="`/dashboard/promoters/${m.promoter_Uuid}`" :label="m.promoter_Display" :can="true" />
                </td>
                <td class="px-6 py-3 text-right">
                  <UButton v-if="canUpdate" color="error" variant="ghost" icon="i-lucide-trash-2" size="sm" @click="openRemoveAudience(m)" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 3. Reglas de comisión asociadas -->
      <div v-show="activeDetailTab === 'rules'" class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden">
        <div class="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-prohealth-100">
          <h2 class="font-bold text-prohealth-900">{{ t('campaigns.detail.rules') }}</h2>
          <div class="flex items-center gap-2">
            <RefreshButton :loading="rulesLoading" :title="t('common.refreshSection')" @refresh="loadAllRules" />
            <UDropdownMenu v-if="canAddAnyRule" :items="addRuleItems" :content="{ align: 'end' }">
              <UButton color="primary" variant="outline" icon="i-lucide-plus">{{ t('campaigns.detail.addRule') }}</UButton>
            </UDropdownMenu>
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-prohealth-50/60">
              <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
                <th class="px-6 py-3 font-semibold">{{ t('campaigns.detail.rulesColumns.type') }}</th>
                <th class="px-6 py-3 font-semibold">{{ t('campaigns.detail.rulesColumns.name') }}</th>
                <th class="px-6 py-3 font-semibold">{{ t('campaigns.detail.rulesColumns.params') }}</th>
                <th class="px-6 py-3 font-semibold text-right">{{ t('common.actions') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-prohealth-100">
              <TableSkeleton v-if="rulesLoading" :rows="3" :cols="4" />
              <tr v-else-if="ruleRows.length === 0">
                <td colspan="4" class="px-6 py-10 text-center text-prohealth-500">{{ t('campaigns.detail.rulesEmpty') }}</td>
              </tr>
              <tr v-for="row in ruleRows" v-else :key="`${row.type}-${row.uuid}`" class="hover:bg-prohealth-50/50" :class="{ 'opacity-60': !row.active }">
                <td class="px-6 py-3">
                  <UBadge :color="ruleTypeColor(row.type)" variant="subtle" size="sm">{{ ruleTypeLabel(row.type) }}</UBadge>
                </td>
                <td class="px-6 py-3 font-medium text-prohealth-900">{{ row.name }}</td>
                <td class="px-6 py-3 text-prohealth-600">{{ row.params }}</td>
                <td class="px-6 py-3">
                  <div class="flex items-center justify-end gap-1">
                    <UButton v-if="canEditRule(row.type)" color="info" variant="ghost" icon="i-lucide-pencil" size="sm" @click="openEditRule(row)" />
                    <UButton v-if="canDeleteRule(row.type)" color="error" variant="ghost" icon="i-lucide-trash-2" size="sm" class="ms-2" @click="openDeleteRule(row)" />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 4. Transacciones de la campaña -->
      <div v-show="activeDetailTab === 'transactions'" class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden">
        <div class="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-prohealth-100">
          <h2 class="font-bold text-prohealth-900">{{ t('campaigns.detail.transactions') }}</h2>
          <RefreshButton :loading="txLoading" :title="t('common.refreshSection')" @refresh="loadTransactions" />
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-prohealth-50/60">
              <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
                <th class="px-6 py-3 font-semibold">{{ t('campaigns.detail.transactionsColumns.date') }}</th>
                <th class="px-6 py-3 font-semibold">{{ t('campaigns.detail.transactionsColumns.transaction') }}</th>
                <th class="px-6 py-3 font-semibold">{{ t('campaigns.detail.transactionsColumns.source') }}</th>
                <th class="px-6 py-3 font-semibold">{{ t('campaigns.detail.transactionsColumns.amount') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-prohealth-100">
              <TableSkeleton v-if="txLoading" :rows="3" :cols="4" />
              <tr v-else-if="txItems.length === 0">
                <td colspan="4" class="px-6 py-10 text-center text-prohealth-500">{{ t('campaigns.detail.transactionsEmpty') }}</td>
              </tr>
              <tr v-for="tx in txItems" v-else :key="tx.uuid" class="hover:bg-prohealth-50/50">
                <td class="px-6 py-3 text-prohealth-600">{{ formatDate(tx.resolvedAt, 'datetime') }}</td>
                <td class="px-6 py-3 font-medium text-prohealth-900">{{ txReference(tx) }}</td>
                <td class="px-6 py-3">
                  <UBadge :color="tx.source === 'AUTO' ? 'neutral' : 'warning'" variant="subtle" size="sm">{{ txSourceLabel(tx) }}</UBadge>
                </td>
                <td class="px-6 py-3 text-prohealth-700">{{ txAmount(tx) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="flex items-center flex-wrap justify-between gap-3 px-6 py-3 border-t border-prohealth-100 shrink-0">
          <p class="text-xs text-prohealth-500">{{ t('campaigns.paginationSummary', { shown: txItems.length, total: txTotal }) }}</p>
          <div class="flex items-center gap-3">
            <UPagination v-if="txSize !== UNPAGED_PAGE_SIZE" v-model:page="txPage" :total="txTotal" :items-per-page="txSize" />
            <USelectMenu v-model="txSize" :items="pageSizeItems" label-key="label" value-key="value" icon="i-lucide-list" :search-input="false" class="w-40" />
          </div>
        </div>
      </div>

      <!-- 5. Excepciones registradas -->
      <div v-show="activeDetailTab === 'exceptions'" class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden">
        <div class="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-prohealth-100">
          <h2 class="font-bold text-prohealth-900">{{ t('campaigns.detail.exceptions') }}</h2>
          <div class="flex items-center gap-2">
            <UButton
              v-if="canExceptionCreate"
              color="primary"
              variant="outline"
              size="sm"
              icon="i-lucide-plus"
              @click="exceptionAddOpen = true"
            >
              {{ t('campaigns.exceptions.addTitle') }}
            </UButton>
            <RefreshButton :loading="exLoading" :title="t('common.refreshSection')" @refresh="loadExceptions" />
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-prohealth-50/60">
              <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
                <th class="px-6 py-3 font-semibold">{{ t('campaigns.detail.exceptionsColumns.date') }}</th>
                <th class="px-6 py-3 font-semibold">{{ t('campaigns.detail.exceptionsColumns.type') }}</th>
                <th class="px-6 py-3 font-semibold">{{ t('campaigns.detail.exceptionsColumns.transaction') }}</th>
                <th class="px-6 py-3 font-semibold">{{ t('campaigns.detail.exceptionsColumns.reason') }}</th>
                <th class="px-6 py-3 font-semibold text-right">{{ t('common.actions') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-prohealth-100">
              <TableSkeleton v-if="exLoading" :rows="3" :cols="5" />
              <tr v-else-if="exItems.length === 0">
                <td colspan="5" class="px-6 py-10 text-center text-prohealth-500">{{ t('campaigns.detail.exceptionsEmpty') }}</td>
              </tr>
              <tr v-for="ex in exItems" v-else :key="ex.uuid" class="hover:bg-prohealth-50/50">
                <td class="px-6 py-3 text-prohealth-600">{{ formatDate(ex.createdAt, 'datetime') }}</td>
                <td class="px-6 py-3">
                  <UBadge :color="ex.action === 'INCLUDE' ? 'success' : 'error'" variant="subtle" size="sm">{{ t(`campaigns.scope.${ex.action}`) }}</UBadge>
                </td>
                <td class="px-6 py-3 font-medium text-prohealth-900">{{ exReference(ex) }}</td>
                <td class="px-6 py-3 text-prohealth-600">{{ ex.reason || t('common.empty') }}</td>
                <td class="px-6 py-3">
                  <div class="flex items-center justify-end gap-1">
                    <UButton v-if="canExceptionDelete" color="error" variant="ghost" icon="i-lucide-trash-2" size="sm" @click="openRemoveException(ex)" />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="flex items-center flex-wrap justify-between gap-3 px-6 py-3 border-t border-prohealth-100 shrink-0">
          <p class="text-xs text-prohealth-500">{{ t('campaigns.paginationSummary', { shown: exItems.length, total: exTotal }) }}</p>
          <div class="flex items-center gap-3">
            <UPagination v-if="exSize !== UNPAGED_PAGE_SIZE" v-model:page="exPage" :total="exTotal" :items-per-page="exSize" />
            <USelectMenu v-model="exSize" :items="pageSizeItems" label-key="label" value-key="value" icon="i-lucide-list" :search-input="false" class="w-40" />
          </div>
        </div>
      </div>
    </template>

    <!-- Edit modal (shared) -->
    <CampaignFormModal v-model:open="formOpen" :campaign="campaign" @saved="onSaved" @delete="openDelete" />

    <!-- Relaunch modal (shared component, relaunchOf redirects submission to POST /relaunch) -->
    <CampaignFormModal
      v-model:open="relaunchOpen"
      :campaign="campaign"
      force-create
      :relaunch-of="campaign?.uuid"
      @saved="onRelaunched"
    />

    <!-- Delete campaign confirmation -->
    <UModal v-model:open="deleteOpen" :title="t('campaigns.deleteTitle')">
      <template #body>
        <p class="text-sm text-prohealth-700">
          {{ t('campaigns.deleteConfirm', { name: campaign?.name }) }}
        </p>
        <div class="flex items-center justify-end gap-3 pt-5">
          <UButton color="neutral" variant="ghost" :disabled="deleting" @click="deleteOpen = false">{{ t('common.cancel') }}</UButton>
          <UButton color="error" :loading="deleting" icon="i-lucide-trash-2" @click="confirmDelete">{{ t('common.delete') }}</UButton>
        </div>
      </template>
    </UModal>

    <!-- Remove audience member confirmation -->
    <UModal v-model:open="audienceRemoveOpen" :title="t('campaigns.detail.addAudienceMember')">
      <template #body>
        <p class="text-sm text-prohealth-700">{{ t('campaigns.detail.audienceRemoveConfirm') }}</p>
        <div class="flex items-center justify-end gap-3 pt-5">
          <UButton color="neutral" variant="ghost" :disabled="audienceRemoving" @click="audienceRemoveOpen = false">{{ t('common.cancel') }}</UButton>
          <UButton color="error" :loading="audienceRemoving" icon="i-lucide-trash-2" @click="confirmRemoveAudience">{{ t('common.delete') }}</UButton>
        </div>
      </template>
    </UModal>

    <!-- Rule modals (reused as-is from commission-rules/index.vue, campaignUuid preset only on create) -->
    <CommissionTierFormModal v-model:open="tierFormOpen" :tier="editingTier" :campaign-uuid="campaignUuid" :campaign-display="campaign?.name" @saved="loadAllRules" @delete="onDeleteFromTierModal" />
    <BonusRuleFormModal v-model:open="bonusFormOpen" :rule="editingBonus" :campaign-uuid="campaignUuid" :campaign-display="campaign?.name" @saved="loadAllRules" @delete="onDeleteFromBonusModal" />
    <CollectionCommissionTierFormModal v-model:open="collectionFormOpen" :tier="editingCollection" :campaign-uuid="campaignUuid" :campaign-display="campaign?.name" @saved="loadAllRules" @delete="onDeleteFromCollectionModal" />
    <HierarchyOverrideTierFormModal v-model:open="overrideFormOpen" :tier="editingOverride" :campaign-uuid="campaignUuid" :campaign-display="campaign?.name" @saved="loadAllRules" @delete="onDeleteFromOverrideModal" />

    <!-- Delete rule confirmation -->
    <UModal v-model:open="ruleDeleteOpen" :title="t('common.delete')">
      <template #body>
        <p class="text-sm text-prohealth-700">{{ ruleDeleteTarget?.name }}</p>
        <div class="flex items-center justify-end gap-3 pt-5">
          <UButton color="neutral" variant="ghost" :disabled="ruleDeleting" @click="ruleDeleteOpen = false">{{ t('common.cancel') }}</UButton>
          <UButton color="error" :loading="ruleDeleting" icon="i-lucide-trash-2" @click="confirmDeleteRule">{{ t('common.delete') }}</UButton>
        </div>
      </template>
    </UModal>

    <!-- Add exception -->
    <CampaignExceptionFormModal
      v-model:open="exceptionAddOpen"
      :campaign-uuid="campaignUuid"
      :campaign-display="campaign?.name"
      @success="onExceptionAdded"
    />

    <!-- Remove exception confirmation -->
    <UModal v-model:open="exceptionRemoveOpen" :title="t('campaigns.exceptions.removeTitle')">
      <template #body>
        <p class="text-sm text-prohealth-700">{{ exceptionRemoveTarget?.reason }}</p>
        <div class="flex items-center justify-end gap-3 pt-5">
          <UButton color="neutral" variant="ghost" :disabled="exceptionRemoving" @click="exceptionRemoveOpen = false">{{ t('common.cancel') }}</UButton>
          <UButton color="error" :loading="exceptionRemoving" icon="i-lucide-trash-2" @click="confirmRemoveException">{{ t('common.delete') }}</UButton>
        </div>
      </template>
    </UModal>

    <AuditModal
      v-if="campaign"
      v-model:open="auditOpen"
      entity-key="campaign"
      :entity-uuid="campaign.uuid"
      :entity-label="campaign.name"
      :can-view-changes="canViewAuditChanges"
      :can-view-reports="canViewAuditReports"
    />
  </div>
</template>
