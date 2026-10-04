<script setup lang="ts">
import type { MembershipPromotionDto } from '~/types/promotions'

/** Affiliate portal: the member's active promotion and what it saves them (hub ADR 0018). Hidden when none. */
const { t } = useI18n()
const { can } = usePermissions()
const promotionsApi = usePromotions()

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

const pct = computed(() => promotion.value ? (promotion.value.discountPct_Display ?? `${Number(promotion.value.discountPct)}%`) : '')
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
        <p v-if="promotion.kind === 'ACQUISITION'" class="text-xs text-prohealth-500">{{ t('promotions.portal.keepOnTime') }}</p>
      </div>
    </div>
  </div>
</template>
