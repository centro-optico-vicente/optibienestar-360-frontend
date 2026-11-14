<script setup lang="ts">
import type { CampaignSlotIssueDto, CampaignSlotIssueType } from '~/types/campaign'

/**
 * "Inconsistencias" card of the campaign detail (hub ADR 0038 point 9): approved
 * payments with a discount but no confirmed slot, pending slots whose payment is
 * already approved, and slots frozen for more than 7 days. The hourly
 * reconciliation fixes most of them; what remains here needs a person.
 */
const props = defineProps<{ campaignUuid: string }>()

const { t } = useI18n()
const { formatDate } = useFormatters()
const { can } = usePermissions()
const campaignsApi = useCampaigns()

const canViewMember = computed(() => can('MEMBER_VIEW_ALL'))
const canViewPayment = computed(() => can('PAYMENT_VIEW_ALL'))

const issues = ref<CampaignSlotIssueDto[]>([])
const loading = ref(false)
const loaded = ref(false)

async function load() {
  loading.value = true
  try {
    issues.value = await campaignsApi.slotIssues(props.campaignUuid)
    loaded.value = true
  }
  catch {
    issues.value = []
  }
  finally {
    loading.value = false
  }
}
onMounted(load)
defineExpose({ load })

const TYPE_COLORS: Record<CampaignSlotIssueType, 'error' | 'warning' | 'info'> = {
  APPROVED_DISCOUNT_WITHOUT_SLOT: 'error',
  PENDING_WITH_APPROVED_PAYMENT: 'warning',
  FROZEN_TOO_LONG: 'info',
}

function typeLabel(i: CampaignSlotIssueDto): string {
  return i.type_Display ?? t(`campaigns.slotIssues.type.${i.type}`)
}
</script>

<template>
  <div class="bg-white rounded-2xl border p-6 space-y-4" :class="issues.length ? 'border-amber-200' : 'border-prohealth-100'">
    <div class="flex items-center justify-between gap-3">
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-shield-alert" class="w-5 h-5" :class="issues.length ? 'text-amber-600' : 'text-prohealth-400'" />
        <div>
          <h2 class="font-bold text-prohealth-900">
            {{ t('campaigns.slotIssues.title') }}
            <UBadge v-if="issues.length" color="warning" variant="subtle" size="sm" class="ms-1">{{ issues.length }}</UBadge>
          </h2>
          <p class="text-xs text-prohealth-500 mt-0.5">{{ t('campaigns.slotIssues.hint') }}</p>
        </div>
      </div>
      <RefreshButton :loading="loading" :title="t('common.refreshSection')" @refresh="load" />
    </div>

    <div v-if="issues.length" class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-prohealth-50/60">
          <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
            <th class="px-4 py-2 font-semibold">{{ t('campaigns.slotIssues.columns.type') }}</th>
            <th class="px-4 py-2 font-semibold">{{ t('campaigns.slotIssues.columns.member') }}</th>
            <th class="px-4 py-2 font-semibold">{{ t('campaigns.slotIssues.columns.promotion') }}</th>
            <th class="px-4 py-2 font-semibold">{{ t('campaigns.slotIssues.columns.payment') }}</th>
            <th class="px-4 py-2 font-semibold">{{ t('campaigns.slotIssues.columns.since') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-prohealth-100">
          <tr v-for="(i, idx) in issues" :key="`${i.type}-${i.slotUuid ?? i.payment_Uuid ?? idx}`" class="align-top">
            <td class="px-4 py-2">
              <UBadge :color="TYPE_COLORS[i.type] ?? 'neutral'" variant="subtle" size="sm">{{ typeLabel(i) }}</UBadge>
              <p v-if="i.redemptionStatus" class="text-xs text-prohealth-500 mt-1">
                {{ i.redemptionStatus_Display ?? t(`promotions.redemptionStatus.${i.redemptionStatus}`) }}
              </p>
            </td>
            <td class="px-4 py-2">
              <CommonEntityLinkCell :to="i.member_Uuid ? `/dashboard/members/${i.member_Uuid}` : null" :label="i.member_Display" :can="canViewMember" />
              <p v-if="i.membership_Display" class="text-xs text-prohealth-500">{{ i.membership_Display }}</p>
            </td>
            <td class="px-4 py-2 text-prohealth-700">{{ i.promotion_Display ?? t('common.empty') }}</td>
            <td class="px-4 py-2">
              <CommonEntityLinkCell v-if="i.payment_Uuid" :to="`/dashboard/collections/${i.payment_Uuid}`" :label="i.payment_Display" :can="canViewPayment" />
              <span v-else class="text-prohealth-400">{{ t('common.empty') }}</span>
            </td>
            <td class="px-4 py-2 text-prohealth-600 whitespace-nowrap">
              {{ i.since ? (i.since_Display ?? formatDate(i.since, 'datetime')) : t('common.empty') }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-else-if="loading" class="text-sm text-prohealth-500">{{ t('common.loading') }}</p>
    <p v-else-if="loaded" class="text-sm text-green-700">{{ t('campaigns.slotIssues.none') }}</p>
    <p v-else class="text-sm text-prohealth-500">{{ t('common.error') }}</p>
  </div>
</template>
