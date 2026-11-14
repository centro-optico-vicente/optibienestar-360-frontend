<script setup lang="ts">
import type { MembershipPromotionDto } from '~/types/promotions'
import { promotionDiscountText } from '~/utils/promotionDiscount'

/** Affiliate portal: the member's active promotion and what it saves them (hub ADR 0018). Hidden when none. */
const { t } = useI18n()
const { can } = usePermissions()
const promotionsApi = usePromotions()
const { formatCurrency, formatDate } = useFormatters()

const promotion = ref<MembershipPromotionDto | null>(null)

onMounted(async () => {
  if (!can('MEMBER_VIEW_OWN')) return
  try {
    const res = await promotionsApi.mine()
    promotion.value = res.exists ? res.promotion : null
  }
  catch {
    promotion.value = null
  }
})

// "10%" or a fixed amount such as "5,00 US$" (hub ADR 0038).
// Slot lifecycle (hub ADR 0038): a pending slot must be confirmed (by paying) before its deadline.
const isPending = computed(() => promotion.value?.redemptionStatus === 'PENDING')
const pendingDeadline = computed(() => {
  const p = promotion.value
  if (!p?.redemptionExpiresAt) return null
  return p.redemptionExpiresAt_Display ?? formatDate(p.redemptionExpiresAt)
})
// What confirms the slot (hub ADR 0038 point 9): enrolling, registering the payment or its approval.
const confirmsWhen = computed(() => {
  const p = promotion.value
  if (!p?.quotaTrigger) return null
  return p.quotaTrigger_Display ?? t(`campaigns.quotaTrigger.${p.quotaTrigger}`)
})
const usableUntil = computed(() => {
  const p = promotion.value
  if (!p?.usageEndsAt) return null
  return p.usageEndsAt_Display ?? formatDate(p.usageEndsAt)
})
const pct = computed(() => promotion.value ? promotionDiscountText(promotion.value, formatCurrency) : '')
</script>

<template>
  <div v-if="promotion" class="bg-white rounded-2xl border border-prohealth-100 p-6">
    <div class="flex items-start gap-3">
      <UIcon name="i-lucide-badge-percent" class="w-8 h-8 text-primary-500 shrink-0" />
      <div class="space-y-1">
        <h2 class="font-bold text-prohealth-900">{{ t('promotions.portal.title', { name: promotion.promotion_Display ?? '' }) }}</h2>
        <p class="text-sm text-prohealth-700">
          {{ t('promotions.portal.discount', { pct, what: promotion.appliesTo_Display ?? t(`promotions.appliesTo.${promotion.appliesTo}`) }) }}
        </p>
        <p v-if="promotion.cyclesRemaining != null" class="text-sm text-prohealth-700">
          {{ t('promotions.portal.cyclesLeft', { n: promotion.cyclesRemaining }) }}
        </p>
        <template v-if="isPending">
          <p v-if="promotion.deadlineFrozen" class="text-sm text-sky-700">{{ t('promotions.portal.pendingFrozen') }}</p>
          <p v-else class="text-sm text-amber-700">
            {{ pendingDeadline ? t('promotions.portal.pendingUntil', { date: pendingDeadline }) : t('promotions.portal.pending') }}
          </p>
          <p v-if="confirmsWhen" class="text-xs text-prohealth-500">{{ t('promotions.portal.confirmsWhen', { trigger: confirmsWhen }) }}</p>
        </template>
        <p v-else-if="usableUntil" class="text-sm text-prohealth-700">{{ t('promotions.portal.usableUntil', { date: usableUntil }) }}</p>
        <p v-if="promotion.kind === 'ACQUISITION'" class="text-xs text-prohealth-500">{{ t('promotions.portal.keepOnTime') }}</p>
      </div>
    </div>
  </div>
</template>
