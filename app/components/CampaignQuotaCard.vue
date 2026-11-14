<script setup lang="ts">
import type { CampaignQuotaDto } from '~/types/campaign'

/**
 * Slot counters of a campaign and of each of its promotions (hub ADR 0038,
 * phase 2b): confirmed, pending, free, expired and released. Pending slots
 * occupy the quota until they are confirmed, expire or are released.
 */
const props = defineProps<{ campaignUuid: string }>()

const { t } = useI18n()
const campaignsApi = useCampaigns()

const quota = ref<CampaignQuotaDto | null>(null)
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    quota.value = await campaignsApi.quota(props.campaignUuid)
  }
  catch {
    quota.value = null
  }
  finally {
    loading.value = false
  }
}
onMounted(load)
defineExpose({ load })

const tiles = computed(() => {
  const q = quota.value
  if (!q) return []
  return [
    { key: 'total', value: q.maxRedemptions ?? t('campaigns.quota.unlimited'), class: 'text-prohealth-900' },
    { key: 'confirmed', value: q.confirmed, class: 'text-green-700' },
    { key: 'pending', value: q.pending, class: 'text-amber-600' },
    { key: 'free', value: q.free ?? t('campaigns.quota.unlimited'), class: 'text-primary-700' },
    { key: 'expired', value: q.expired, class: 'text-red-600' },
    { key: 'released', value: q.released, class: 'text-prohealth-500' },
  ]
})
</script>

<template>
  <div class="bg-white rounded-2xl border border-prohealth-100 p-6 space-y-4">
    <div class="flex items-center justify-between gap-3">
      <div>
        <h2 class="font-bold text-prohealth-900">{{ t('campaigns.quotaCard.title') }}</h2>
        <p class="text-xs text-prohealth-500 mt-0.5">{{ t('campaigns.quotaCard.hint') }}</p>
      </div>
      <RefreshButton :loading="loading" :title="t('common.refreshSection')" @refresh="load" />
    </div>

    <template v-if="quota">
      <dl class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-sm">
        <div v-for="tile in tiles" :key="tile.key">
          <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t(`campaigns.quotaCard.${tile.key}`) }}</dt>
          <dd class="mt-0.5 text-lg font-bold" :class="tile.class">{{ tile.value }}</dd>
        </div>
      </dl>

      <div v-if="quota.promotions.length" class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-prohealth-50/60">
            <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
              <th class="px-4 py-2 font-semibold">{{ t('campaigns.quotaCard.promotion') }}</th>
              <th class="px-4 py-2 font-semibold">{{ t('campaigns.quotaCard.max') }}</th>
              <th class="px-4 py-2 font-semibold text-right">{{ t('campaigns.quotaCard.confirmed') }}</th>
              <th class="px-4 py-2 font-semibold text-right">{{ t('campaigns.quotaCard.pending') }}</th>
              <th class="px-4 py-2 font-semibold text-right">{{ t('campaigns.quotaCard.free') }}</th>
              <th class="px-4 py-2 font-semibold text-right">{{ t('campaigns.quotaCard.expired') }}</th>
              <th class="px-4 py-2 font-semibold text-right">{{ t('campaigns.quotaCard.released') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-prohealth-100">
            <tr v-for="(p, i) in quota.promotions" :key="p.promotion_Uuid ?? i">
              <td class="px-4 py-2 text-prohealth-900">{{ p.promotion_Display ?? t('common.empty') }}</td>
              <td class="px-4 py-2 text-prohealth-600">
                {{ p.ownQuota && p.maxRedemptions != null ? p.maxRedemptions : t('promotions.campaignQuotaOnly') }}
              </td>
              <td class="px-4 py-2 text-right">{{ p.confirmed }}</td>
              <td class="px-4 py-2 text-right">{{ p.pending }}</td>
              <td class="px-4 py-2 text-right">{{ p.free ?? t('campaigns.quota.unlimited') }}</td>
              <td class="px-4 py-2 text-right">{{ p.expired }}</td>
              <td class="px-4 py-2 text-right">{{ p.released }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
    <p v-else-if="loading" class="text-sm text-prohealth-500">{{ t('common.loading') }}</p>
    <p v-else class="text-sm text-prohealth-500">{{ t('common.error') }}</p>
  </div>
</template>
