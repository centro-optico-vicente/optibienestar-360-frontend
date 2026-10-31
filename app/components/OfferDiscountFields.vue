<script setup lang="ts">
import type { DiscountType } from '~/types/allies'
import { previewDiscount } from '~/utils/offerDiscount'

/**
 * Preferential-rate inputs of an offer (hub ADR 0031 §8): pick a fixed
 * amount or a percentage, type its value, and see the price the affiliate
 * pays plus the equivalent percentage. Shared by the admin offer form and
 * the ally portal proposal. The parent form owns validation via the field
 * names `discountPct` / `discountAmount`.
 */
const props = defineProps<{
  /** Regular public price typed in the same form (USD today). */
  price?: string | null
  /** Label of the value input when the type is PERCENTAGE. */
  percentLabel: string
}>()

const type = defineModel<DiscountType>('type', { required: true })
const pct = defineModel<string>('pct', { required: true })
const amount = defineModel<string>('amount', { required: true })

const { t } = useI18n()
const { formatCurrency, formatNumber } = useFormatters()

const typeItems = computed(() => [
  { label: t('allies.products.discount.types.PERCENTAGE'), value: 'PERCENTAGE' },
  { label: t('allies.products.discount.types.FLAT'), value: 'FLAT' },
])

const preview = computed(() => previewDiscount(props.price, type.value, pct.value, amount.value))
const hasDiscount = computed(() => (type.value === 'FLAT' ? !!amount.value : !!pct.value))
</script>

<template>
  <div class="space-y-3">
    <UFormField :label="t('allies.products.discount.typeLabel')" name="discountType">
      <URadioGroup v-model="type" :items="typeItems" orientation="horizontal" />
    </UFormField>

    <UFormField v-if="type === 'PERCENTAGE'" :label="percentLabel" name="discountPct">
      <UInput v-model="pct" placeholder="10.00" class="w-full" />
    </UFormField>
    <UFormField
      v-else
      :label="t('allies.products.discount.amountLabel')"
      name="discountAmount"
      :error="preview.exceedsPrice ? t('allies.products.discount.exceedsPrice') : undefined"
    >
      <UInput v-model="amount" placeholder="5.00" class="w-full" />
    </UFormField>

    <p v-if="hasDiscount && preview.finalPrice !== null" class="text-sm text-gray-600 dark:text-gray-300">
      {{ t('allies.products.discount.preview', {
        price: formatCurrency(preview.finalPrice, 'USD'),
        pct: preview.effectivePct === null ? '—' : formatNumber(preview.effectivePct),
      }) }}
    </p>
    <p v-else-if="type === 'FLAT' && !price" class="text-xs text-gray-500">
      {{ t('allies.products.discount.flatNeedsPrice') }}
    </p>
  </div>
</template>
