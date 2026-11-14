<script setup lang="ts">
import type { PaymentPromotionSlotDto } from '~/types/payments'
import { REDEMPTION_STATUS_COLORS } from '~/types/promotions'

/**
 * Campaign slot of a payment (hub ADR 0038 point 9), for the staff review screens
 * and the member's payments: "Approving this payment confirms the slot of <promotion>"
 * when `confirmsOnApproval`, otherwise the slot status ("Cupo confirmado",
 * "Cupo vencido", "Cupo pendiente · congelado"…). Renders nothing without a slot.
 */
const props = withDefaults(defineProps<{
  promotionSlot?: PaymentPromotionSlotDto | null
  size?: 'xs' | 'sm' | 'md'
  /** Member-facing wording ("your slot") instead of the staff one. */
  member?: boolean
}>(), {
  promotionSlot: null,
  size: 'sm',
  member: false,
})

const { t } = useI18n()
const { formatDate } = useFormatters()

const promotionName = computed(() => props.promotionSlot?.promotion_Display ?? props.promotionSlot?.campaign_Display ?? '')

const label = computed(() => {
  const s = props.promotionSlot
  if (!s) return ''
  if (s.confirmsOnApproval) {
    return props.member
      ? t('payments.slot.confirmsOnApprovalMember', { promotion: promotionName.value })
      : t('payments.slot.confirmsOnApproval', { promotion: promotionName.value })
  }
  const status = s.redemptionStatus_Display ?? t(`promotions.redemptionStatus.${s.redemptionStatus}`)
  if (s.redemptionStatus === 'PENDING') {
    if (s.deadlineFrozen) return `${status} · ${t('payments.slot.frozen')}`
    if (s.effectiveDeadline) {
      return `${status} · ${t('payments.slot.until', { date: s.effectiveDeadline_Display ?? formatDate(s.effectiveDeadline, 'datetime') })}`
    }
  }
  return status
})

const color = computed(() => {
  const s = props.promotionSlot
  if (!s) return 'neutral' as const
  if (s.confirmsOnApproval) return 'primary' as const
  return REDEMPTION_STATUS_COLORS[s.redemptionStatus] ?? 'neutral'
})

const tooltip = computed(() => {
  const s = props.promotionSlot
  if (!s) return ''
  return [s.campaign_Display, s.promotion_Display, s.quotaTrigger ? (s.quotaTrigger_Display ?? t(`campaigns.quotaTrigger.${s.quotaTrigger}`)) : null]
    .filter(Boolean).join(' · ')
})
</script>

<template>
  <span v-if="promotionSlot">
    <UTooltip :text="tooltip" :disabled="!tooltip">
      <UBadge
        :color="color"
        variant="outline"
        :size="size"
        :icon="promotionSlot.confirmsOnApproval ? 'i-lucide-badge-check' : (promotionSlot.deadlineFrozen ? 'i-lucide-snowflake' : 'i-lucide-ticket')"
      >
        {{ label }}
      </UBadge>
    </UTooltip>
  </span>
</template>
