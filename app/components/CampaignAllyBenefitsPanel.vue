<script setup lang="ts">
import type { CampaignAllyBenefitRowDto } from '~/types/campaign'

/**
 * "Beneficios de aliados" tab of the campaign detail (hub ADR 0038, phase 3):
 * vouchers granted per ally and promotion, to reconcile with each ally what
 * was redeemed. The cost is only recorded, not settled here.
 */
const props = defineProps<{ campaignUuid: string }>()

const { t } = useI18n()
const campaignsApi = useCampaigns()

const rows = ref<CampaignAllyBenefitRowDto[]>([])
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    rows.value = await campaignsApi.allyBenefits(props.campaignUuid)
  }
  catch {
    rows.value = []
  }
  finally {
    loading.value = false
  }
}
onMounted(load)
defineExpose({ load })
</script>

<template>
  <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden">
    <div class="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-prohealth-100">
      <div>
        <h2 class="font-bold text-prohealth-900">{{ t('campaigns.allyBenefits.title') }}</h2>
        <p class="text-xs text-prohealth-500 mt-0.5">{{ t('campaigns.allyBenefits.hint') }}</p>
      </div>
      <RefreshButton :loading="loading" :title="t('common.refreshSection')" @refresh="load" />
    </div>
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-prohealth-50/60">
          <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
            <th class="px-6 py-3 font-semibold">{{ t('campaigns.allyBenefits.ally') }}</th>
            <th class="px-6 py-3 font-semibold">{{ t('campaigns.allyBenefits.promotion') }}</th>
            <th class="px-6 py-3 font-semibold text-right">{{ t('campaigns.allyBenefits.granted') }}</th>
            <th class="px-6 py-3 font-semibold text-right">{{ t('campaigns.allyBenefits.available') }}</th>
            <th class="px-6 py-3 font-semibold text-right">{{ t('campaigns.allyBenefits.redeemed') }}</th>
            <th class="px-6 py-3 font-semibold text-right">{{ t('campaigns.allyBenefits.redeemedUnits') }}</th>
            <th class="px-6 py-3 font-semibold text-right">{{ t('campaigns.allyBenefits.expired') }}</th>
            <th class="px-6 py-3 font-semibold text-right">{{ t('campaigns.allyBenefits.canceled') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-prohealth-100">
          <TableSkeleton v-if="loading" :rows="3" :cols="8" />
          <tr v-else-if="rows.length === 0">
            <td colspan="8" class="px-6 py-10 text-center text-prohealth-500">{{ t('campaigns.allyBenefits.empty') }}</td>
          </tr>
          <tr v-for="(r, i) in rows" v-else :key="`${r.ally_Uuid}-${r.promotion_Uuid}-${i}`" class="hover:bg-prohealth-50/50">
            <td class="px-6 py-3 text-prohealth-900">{{ r.ally_Display ?? t('common.empty') }}</td>
            <td class="px-6 py-3 text-prohealth-700">{{ r.promotion_Display ?? t('common.empty') }}</td>
            <td class="px-6 py-3 text-right">{{ r.granted }}</td>
            <td class="px-6 py-3 text-right">{{ r.available }}</td>
            <td class="px-6 py-3 text-right">{{ r.redeemed }}</td>
            <td class="px-6 py-3 text-right">{{ r.redeemedUnits }}</td>
            <td class="px-6 py-3 text-right">{{ r.expired }}</td>
            <td class="px-6 py-3 text-right">{{ r.canceled }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
