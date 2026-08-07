<script setup lang="ts">
import type { CommissionTierDto } from '~/types/commissionTiers'
import type { BonusRuleDto } from '~/types/bonusRules'
import type { CollectionCommissionTierDto } from '~/types/collectionCommissionTiers'

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

useSeoMeta({ title: () => t('common.seoTitle', { page: t('nav.items.commissionRules.label') }) })

const tabs = computed(() => [
  { label: t('commissionRules.tabs.tiers'), value: 'tiers', icon: 'i-lucide-trending-up' },
  { label: t('commissionRules.tabs.bonusRules'), value: 'bonusRules', icon: 'i-lucide-gift' },
  { label: t('commissionRules.tabs.collectionTiers'), value: 'collectionTiers', icon: 'i-lucide-calendar-clock' },
])
const activeTab = ref('tiers')

// =========================================================
// Tab 1 — Bandas de inscripción (commission_tiers)
// =========================================================
const tierApi = useCommissionTiers()
const canManageTiers = computed(() => can('COMMISSION_TIER_MANAGE'))
const tierData = ref<CommissionTierDto[]>([])
const tierLoading = ref(false)

async function loadTiers() {
  tierLoading.value = true
  try {
    const res = await tierApi.list({ size: 100 })
    tierData.value = res.content ?? []
  }
  catch {
    tierData.value = []
  }
  finally {
    tierLoading.value = false
  }
}

const tierFormOpen = ref(false)
const editingTier = ref<CommissionTierDto | null>(null)
function openCreateTier() { editingTier.value = null; tierFormOpen.value = true }
function openEditTier(tier: CommissionTierDto) { editingTier.value = tier; tierFormOpen.value = true }
async function onTierSaved() { await loadTiers() }

const tierDeleteOpen = ref(false)
const tierDeleting = ref(false)
const tierTarget = ref<CommissionTierDto | null>(null)
function openDeleteTier(tier: CommissionTierDto) { tierTarget.value = tier; tierDeleteOpen.value = true }
function onDeleteTierFromEdit(tier: CommissionTierDto) { openDeleteTier(tier) }
async function confirmDeleteTier() {
  if (!tierTarget.value) return
  tierDeleting.value = true
  try {
    await tierApi.remove(tierTarget.value.uuid)
    toast.add({ title: t('commissionRules.tiers.deletedToast'), color: 'success', icon: 'i-lucide-check-circle' })
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
const bonusLoading = ref(false)

async function loadBonusRules() {
  bonusLoading.value = true
  try {
    const res = await bonusApi.list({ size: 100 })
    bonusData.value = res.content ?? []
  }
  catch {
    bonusData.value = []
  }
  finally {
    bonusLoading.value = false
  }
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
const canManageCollection = computed(() => can('COLLECTION_COMMISSION_TIER_MANAGE'))
const collectionData = ref<CollectionCommissionTierDto[]>([])
const collectionLoading = ref(false)
const collectionIncludeInactive = ref(false)

async function loadCollectionTiers() {
  collectionLoading.value = true
  try {
    const res = await collectionApi.list({ size: 100, includeInactive: collectionIncludeInactive.value })
    collectionData.value = res.content ?? []
  }
  catch {
    collectionData.value = []
  }
  finally {
    collectionLoading.value = false
  }
}
watch(collectionIncludeInactive, loadCollectionTiers)

const collectionFormOpen = ref(false)
const editingCollectionTier = ref<CollectionCommissionTierDto | null>(null)
function openCreateCollectionTier() { editingCollectionTier.value = null; collectionFormOpen.value = true }
function openEditCollectionTier(tier: CollectionCommissionTierDto) { editingCollectionTier.value = tier; collectionFormOpen.value = true }
async function onCollectionTierSaved() { await loadCollectionTiers() }

const collectionDeleteOpen = ref(false)
const collectionDeleting = ref(false)
const collectionTarget = ref<CollectionCommissionTierDto | null>(null)
function openDeleteCollectionTier(tier: CollectionCommissionTierDto) { collectionTarget.value = tier; collectionDeleteOpen.value = true }
function onDeleteCollectionTierFromEdit(tier: CollectionCommissionTierDto) { openDeleteCollectionTier(tier) }
async function confirmDeleteCollectionTier() {
  if (!collectionTarget.value) return
  collectionDeleting.value = true
  try {
    await collectionApi.remove(collectionTarget.value.uuid)
    toast.add({ title: t('commissionRules.collectionTiers.deletedToast'), color: 'success', icon: 'i-lucide-check-circle' })
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
            <tr v-for="tier in tierData" v-else :key="tier.uuid" class="hover:bg-prohealth-50/50">
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
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Tab 2: Bonos por escala -->
    <div v-show="activeTab === 'bonusRules'" class="space-y-4">
      <div class="flex items-center justify-end">
        <UButton color="primary" icon="i-lucide-plus" :disabled="!canManageBonus" @click="openCreateBonus">
          {{ t('commissionRules.bonusRules.new') }}
        </UButton>
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
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Tab 3: Comisión de cobranza -->
    <div v-show="activeTab === 'collectionTiers'" class="space-y-4">
      <div class="flex items-center justify-between gap-3">
        <UCheckbox v-model="collectionIncludeInactive" :label="t('catalogs.includeInactive')" />
        <UButton color="primary" icon="i-lucide-plus" :disabled="!canManageCollection" @click="openCreateCollectionTier">
          {{ t('commissionRules.collectionTiers.new') }}
        </UButton>
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
            <tr v-for="tier in collectionData" v-else :key="tier.uuid" class="hover:bg-prohealth-50/50">
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
    </div>

    <!-- Modals -->
    <CommissionTierFormModal v-model:open="tierFormOpen" :tier="editingTier" @saved="onTierSaved" @delete="onDeleteTierFromEdit" />
    <BonusRuleFormModal v-model:open="bonusFormOpen" :rule="editingBonus" @saved="onBonusSaved" @delete="onDeleteBonusFromEdit" />
    <CollectionCommissionTierFormModal v-model:open="collectionFormOpen" :tier="editingCollectionTier" @saved="onCollectionTierSaved" @delete="onDeleteCollectionTierFromEdit" />

    <!-- Delete confirmations -->
    <UModal v-model:open="tierDeleteOpen" :title="t('commissionRules.tiers.deleteTitle')">
      <template #body>
        <p class="text-sm text-prohealth-700">{{ t('commissionRules.tiers.deleteConfirm', { name: tierTarget?.name ?? '' }) }}</p>
        <div class="flex items-center justify-end gap-3 pt-5">
          <UButton color="neutral" variant="ghost" :disabled="tierDeleting" @click="tierDeleteOpen = false">{{ t('common.cancel') }}</UButton>
          <UButton color="error" :loading="tierDeleting" icon="i-lucide-trash-2" @click="confirmDeleteTier">{{ t('common.delete') }}</UButton>
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
        <p class="text-sm text-prohealth-700">{{ t('commissionRules.collectionTiers.deleteConfirm', { name: collectionTarget?.name ?? '' }) }}</p>
        <div class="flex items-center justify-end gap-3 pt-5">
          <UButton color="neutral" variant="ghost" :disabled="collectionDeleting" @click="collectionDeleteOpen = false">{{ t('common.cancel') }}</UButton>
          <UButton color="error" :loading="collectionDeleting" icon="i-lucide-trash-2" @click="confirmDeleteCollectionTier">{{ t('common.delete') }}</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
