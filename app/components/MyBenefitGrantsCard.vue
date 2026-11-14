<script setup lang="ts">
import type { MembershipBenefitGrantDto } from '~/types/benefitGrants'
import { BENEFIT_GRANT_STATUS_COLORS } from '~/types/benefitGrants'
import { allyBenefitValueText } from '~/utils/promotionDiscount'

/** Affiliate portal "Mis beneficios": campaign vouchers redeemable at allies (hub ADR 0038). Hidden when none. */
const { t } = useI18n()
const { can } = usePermissions()
const { formatCurrency, formatDate } = useFormatters()
const promotionsApi = usePromotions()

const grants = ref<MembershipBenefitGrantDto[]>([])

onMounted(async () => {
  if (!can('MEMBER_VIEW_OWN')) return
  try {
    grants.value = await promotionsApi.myBenefitGrants({ includePending: true })
  }
  catch {
    grants.value = []
  }
})

// Slots not confirmed yet come as PENDING_CONFIRMATION pseudo-entries (hub ADR 0038 point 9): shown apart, not redeemable.
const pendingGrants = computed(() => grants.value.filter(g => g.grantStatus === 'PENDING_CONFIRMATION'))
const confirmedGrants = computed(() => grants.value.filter(g => g.grantStatus !== 'PENDING_CONFIRMATION'))

function valueLabel(g: MembershipBenefitGrantDto): string {
  return allyBenefitValueText(g, formatCurrency, t('promotions.benefitType.FREE'))
}
</script>

<template>
  <div v-if="grants.length" class="bg-white rounded-2xl border border-prohealth-100 p-6 space-y-4">
    <div class="flex items-center gap-3">
      <UIcon name="i-lucide-gift" class="w-7 h-7 text-primary-500 shrink-0" />
      <div>
        <h2 class="font-bold text-prohealth-900">{{ t('promotions.grants.title') }}</h2>
        <p class="text-xs text-prohealth-500">{{ t('promotions.grants.hint') }}</p>
      </div>
    </div>
    <ul v-if="confirmedGrants.length" class="divide-y divide-prohealth-100">
      <li v-for="(g, i) in confirmedGrants" :key="g.uuid ?? `grant-${i}`" class="py-3 flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0 space-y-0.5">
          <p class="font-medium text-prohealth-900">
            {{ g.allyProduct_Display ?? t('common.empty') }} · {{ valueLabel(g) }}
          </p>
          <p class="text-sm text-prohealth-700">{{ g.ally_Display }}</p>
          <p class="text-xs text-prohealth-500">
            {{ [g.campaign_Display, g.beneficiary_Display].filter(Boolean).join(' · ') }}
          </p>
          <p v-if="g.grantStatus === 'AVAILABLE' && g.expiresAt" class="text-xs text-prohealth-500">
            {{ t('promotions.grants.expires', { date: g.expiresAt_Display ?? formatDate(g.expiresAt) }) }}
          </p>
          <p v-if="g.grantStatus === 'REDEEMED' && g.redeemedAt" class="text-xs text-prohealth-500">
            {{ t('promotions.grants.redeemedOn', { date: g.redeemedAt_Display ?? formatDate(g.redeemedAt) }) }}
          </p>
        </div>
        <div class="flex flex-col items-end gap-1">
          <UBadge :color="BENEFIT_GRANT_STATUS_COLORS[g.grantStatus] ?? 'neutral'" variant="subtle" size="sm">
            {{ g.grantStatus_Display ?? t(`promotions.grants.status.${g.grantStatus}`) }}
          </UBadge>
          <span v-if="g.grantStatus === 'AVAILABLE'" class="text-xs text-prohealth-600">
            {{ t('promotions.grants.remaining', { n: g.remainingQty, total: g.quantity }) }}
          </span>
        </div>
      </li>
    </ul>

    <div v-if="pendingGrants.length" class="space-y-2" :class="{ 'pt-3 border-t border-prohealth-100': confirmedGrants.length }">
      <div>
        <h3 class="text-sm font-semibold text-prohealth-900">{{ t('promotions.grants.pendingTitle') }}</h3>
        <p class="text-xs text-prohealth-500">{{ t('promotions.grants.pendingHint') }}</p>
      </div>
      <ul class="divide-y divide-prohealth-100">
        <li v-for="(g, i) in pendingGrants" :key="`pending-${g.promotion_Uuid ?? i}-${i}`" class="py-3 flex flex-wrap items-start justify-between gap-3 opacity-75">
          <div class="min-w-0 space-y-0.5">
            <p class="font-medium text-prohealth-900">
              {{ g.allyProduct_Display ?? t('common.empty') }} · {{ valueLabel(g) }}
            </p>
            <p class="text-sm text-prohealth-700">{{ g.ally_Display }}</p>
            <p class="text-xs text-prohealth-500">
              {{ [g.campaign_Display, g.beneficiary_Display].filter(Boolean).join(' · ') }}
            </p>
            <p v-if="g.expiresAt" class="text-xs text-amber-700">
              {{ t('promotions.grants.confirmBy', { date: g.expiresAt_Display ?? formatDate(g.expiresAt) }) }}
            </p>
          </div>
          <UBadge :color="BENEFIT_GRANT_STATUS_COLORS.PENDING_CONFIRMATION" variant="subtle" size="sm" icon="i-lucide-hourglass">
            {{ g.grantStatus_Display ?? t('promotions.grants.status.PENDING_CONFIRMATION') }}
          </UBadge>
        </li>
      </ul>
    </div>
  </div>
</template>
