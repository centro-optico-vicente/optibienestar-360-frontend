<script setup lang="ts">
import type { MyAllyDto } from '~/types/allies'
import type { AllyPartnershipCampaignDto } from '~/types/campaign'
import type { PromotionDto } from '~/types/promotions'
import { allyBenefitValueText } from '~/utils/promotionDiscount'

// Ally portal "Campañas" (hub ADR 0038, phase 3): active campaigns that accept
// allies (open to every ally or exclusive to mine), and my own benefits in
// each one. A benefit can be edited or removed only while no member holds it
// (the backend answers 409 otherwise).
definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'ALLY_CAMPAIGN_VIEW',
})

const { t } = useI18n()
const { can } = usePermissions()
const { formatDate, formatCurrency } = useFormatters()
const allyCampaigns = useAllyCampaigns()
const myAllies = useMyAllies()
const toast = useToast()

useSeoMeta({ title: () => t('common.seoTitle', { page: t('allyCampaigns.title') }) })

const canCreate = computed(() => can('ALLY_CAMPAIGN_PROMOTION_CREATE'))
const canUpdate = computed(() => can('ALLY_CAMPAIGN_PROMOTION_UPDATE'))
const canDelete = computed(() => can('ALLY_CAMPAIGN_PROMOTION_DELETE'))

// ---- Which ally's offers? Resolved from GET /v1/me/allies; a picker only with several ----
const allies = ref<MyAllyDto[]>([])
const selectedAllyUuid = ref<string | undefined>(undefined)
const allyOptions = computed(() => allies.value.map(a => ({ label: a.name, value: a.uuid })))

// ---- Campaigns ----
const campaigns = ref<AllyPartnershipCampaignDto[]>([])
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    campaigns.value = await allyCampaigns.list()
    await Promise.all(Object.keys(promotionsByCampaign.value).map(loadPromotions))
  }
  catch {
    campaigns.value = []
  }
  finally {
    loading.value = false
  }
}

onMounted(async () => {
  try {
    allies.value = await myAllies.list()
    selectedAllyUuid.value = allies.value[0]?.uuid
  }
  catch {
    // useApi already notified; the list still loads.
  }
  await load()
})

// ---- My benefits per campaign (loaded when the campaign is expanded) ----
const expanded = ref<Record<string, boolean>>({})
const promotionsByCampaign = ref<Record<string, PromotionDto[]>>({})
const promotionsLoading = ref<Record<string, boolean>>({})

async function loadPromotions(campaignUuid: string) {
  promotionsLoading.value = { ...promotionsLoading.value, [campaignUuid]: true }
  try {
    const list = await allyCampaigns.promotions(campaignUuid)
    promotionsByCampaign.value = { ...promotionsByCampaign.value, [campaignUuid]: list }
  }
  catch {
    promotionsByCampaign.value = { ...promotionsByCampaign.value, [campaignUuid]: [] }
  }
  finally {
    promotionsLoading.value = { ...promotionsLoading.value, [campaignUuid]: false }
  }
}

function toggle(c: AllyPartnershipCampaignDto) {
  const open = !expanded.value[c.uuid]
  expanded.value = { ...expanded.value, [c.uuid]: open }
  if (open && !promotionsByCampaign.value[c.uuid]) loadPromotions(c.uuid)
}

function vigency(c: AllyPartnershipCampaignDto): string {
  return `${formatDate(c.startsAt)} — ${c.endsAt ? formatDate(c.endsAt) : t('campaigns.openEnded')}`
}

function benefitLabel(p: PromotionDto): string {
  const value = allyBenefitValueText(p, formatCurrency, t('promotions.benefitType.FREE'))
  const qty = p.benefitQuantity && p.benefitQuantity > 1 ? ` × ${p.benefitQuantity}` : ''
  return [p.allyProduct_Display, `${value}${qty}`].filter(Boolean).join(' · ')
}

// ---- Create / edit ----
const formOpen = ref(false)
const formCampaign = ref<AllyPartnershipCampaignDto | null>(null)
const editing = ref<PromotionDto | null>(null)
function openCreate(c: AllyPartnershipCampaignDto) {
  formCampaign.value = c
  editing.value = null
  formOpen.value = true
}
function openEdit(c: AllyPartnershipCampaignDto, p: PromotionDto) {
  formCampaign.value = c
  editing.value = p
  formOpen.value = true
}
async function onSaved() {
  const c = formCampaign.value
  if (!c) return
  expanded.value = { ...expanded.value, [c.uuid]: true }
  await loadPromotions(c.uuid)
}

// ---- Delete ----
const deleteOpen = ref(false)
const deleteTarget = ref<{ campaign: AllyPartnershipCampaignDto, promotion: PromotionDto } | null>(null)
const deleting = ref(false)
function openDelete(c: AllyPartnershipCampaignDto, p: PromotionDto) {
  deleteTarget.value = { campaign: c, promotion: p }
  deleteOpen.value = true
}
async function confirmDelete() {
  const target = deleteTarget.value
  if (!target) return
  deleting.value = true
  try {
    await allyCampaigns.removePromotion(target.promotion.uuid)
    toast.add({ title: t('allyCampaigns.deletedToast'), color: 'success', icon: 'i-lucide-trash-2' })
    deleteOpen.value = false
    await loadPromotions(target.campaign.uuid)
  }
  catch {
    // useApi already notified (409 once a member holds it)
  }
  finally {
    deleting.value = false
  }
}
</script>

<template>
  <div class="space-y-6 max-w-5xl">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-extrabold text-prohealth-900">{{ t('allyCampaigns.title') }}</h1>
        <p class="text-sm text-prohealth-700/70 mt-1">{{ t('allyCampaigns.subtitle') }}</p>
      </div>
      <div class="flex items-center gap-2">
        <USelectMenu
          v-if="allies.length > 1"
          v-model="selectedAllyUuid"
          :items="allyOptions"
          label-key="label"
          value-key="value"
          icon="i-lucide-building-2"
          class="w-56"
        />
        <RefreshButton :loading="loading" :title="t('common.refreshSection')" @refresh="load" />
      </div>
    </div>

    <div v-if="loading && !campaigns.length" class="space-y-3">
      <USkeleton v-for="i in 3" :key="i" class="h-20 w-full rounded-2xl" />
    </div>
    <div v-else-if="!campaigns.length" class="bg-white rounded-2xl border border-prohealth-100 p-12 text-center">
      <UIcon name="i-lucide-megaphone" class="w-10 h-10 mx-auto mb-3 text-prohealth-300" />
      <p class="text-prohealth-700 font-semibold">{{ t('allyCampaigns.emptyTitle') }}</p>
      <p class="text-sm text-prohealth-500 mt-1">{{ t('allyCampaigns.emptyBody') }}</p>
    </div>

    <div v-for="c in campaigns" v-else :key="c.uuid" class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden">
      <div class="flex flex-wrap items-start justify-between gap-3 px-6 py-4">
        <div class="min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <h2 class="font-bold text-prohealth-900">{{ c.name }}</h2>
            <CampaignLifecycleBadge :status="c.lifecycleStatus" :display="c.lifecycleStatus_Display" />
            <UBadge v-if="c.exclusive" color="primary" variant="subtle" size="sm">{{ t('allyCampaigns.exclusive') }}</UBadge>
          </div>
          <p class="text-xs text-prohealth-500 mt-0.5">{{ vigency(c) }}</p>
          <p v-if="c.description" class="text-sm text-prohealth-700 mt-1">{{ c.description }}</p>
          <p class="text-xs text-prohealth-500 mt-1">
            {{ c.maxRedemptions != null ? t('allyCampaigns.slots', { free: c.freeSlots ?? 0, max: c.maxRedemptions }) : t('campaigns.quota.unlimited') }}
          </p>
        </div>
        <div class="flex items-center gap-2">
          <UButton v-if="canCreate" color="primary" variant="outline" size="sm" icon="i-lucide-plus" @click="openCreate(c)">
            {{ t('allyCampaigns.addBenefit') }}
          </UButton>
          <UButton
            color="neutral"
            variant="ghost"
            size="sm"
            :icon="expanded[c.uuid] ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
            @click="toggle(c)"
          >
            {{ t('allyCampaigns.myBenefits') }}
          </UButton>
        </div>
      </div>

      <div v-if="expanded[c.uuid]" class="border-t border-prohealth-100 overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-prohealth-50/60">
            <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
              <th class="px-6 py-3 font-semibold">{{ t('promotions.fields.name') }}</th>
              <th class="px-6 py-3 font-semibold">{{ t('allyCampaigns.benefit') }}</th>
              <th class="px-6 py-3 font-semibold">{{ t('promotions.columns.redemptions') }}</th>
              <th class="px-6 py-3 font-semibold text-right">{{ t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-prohealth-100">
            <TableSkeleton v-if="promotionsLoading[c.uuid]" :rows="2" :cols="4" />
            <tr v-else-if="!(promotionsByCampaign[c.uuid] ?? []).length">
              <td colspan="4" class="px-6 py-8 text-center text-prohealth-500">{{ t('allyCampaigns.noBenefits') }}</td>
            </tr>
            <tr v-for="p in promotionsByCampaign[c.uuid] ?? []" v-else :key="p.uuid" class="hover:bg-prohealth-50/50">
              <td class="px-6 py-3">
                <p class="font-medium text-prohealth-900">{{ p.name }}</p>
                <p v-if="p.description" class="text-xs text-prohealth-500">{{ p.description }}</p>
              </td>
              <td class="px-6 py-3 text-prohealth-800">{{ benefitLabel(p) }}</td>
              <td class="px-6 py-3 text-prohealth-600">
                {{ p.ownQuota && p.maxRedemptions ? `${p.redemptionsCount} / ${p.maxRedemptions}` : p.redemptionsCount }}
              </td>
              <td class="px-6 py-3">
                <div class="flex items-center justify-end gap-1">
                  <UButton v-if="canUpdate" color="neutral" variant="ghost" icon="i-lucide-pencil" size="sm" :disabled="p.redemptionsCount > 0" @click="openEdit(c, p)" />
                  <UButton v-if="canDelete" color="error" variant="ghost" icon="i-lucide-trash-2" size="sm" :disabled="p.redemptionsCount > 0" @click="openDelete(c, p)" />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <AllyCampaignPromotionFormModal
      v-model:open="formOpen"
      :campaign="formCampaign"
      :ally-uuid="selectedAllyUuid ?? null"
      :promotion="editing"
      @saved="onSaved"
    />

    <UModal v-model:open="deleteOpen" :title="t('allyCampaigns.deleteTitle')">
      <template #body>
        <p class="text-sm text-prohealth-700">{{ t('allyCampaigns.deleteConfirm', { name: deleteTarget?.promotion.name ?? '' }) }}</p>
        <div class="flex items-center justify-end gap-3 pt-5">
          <UButton color="neutral" variant="ghost" :disabled="deleting" @click="deleteOpen = false">{{ t('common.cancel') }}</UButton>
          <UButton color="error" :loading="deleting" icon="i-lucide-trash-2" @click="confirmDelete">{{ t('common.delete') }}</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
