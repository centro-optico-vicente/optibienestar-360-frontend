<script setup lang="ts">
/**
 * Renders a server-formatted money string (`amount_Display`-style, hub ADR
 * 0014) and, when the backend also provided a currency conversion (hub ADR
 * 0015 — null when no exchange rate is available), wraps it in a hover
 * tooltip showing the converted value and the rate date. Degrades gracefully
 * to plain text when no conversion is present — no tooltip wrapper at all.
 */
const { t } = useI18n()
const { formatDate } = useFormatters()

const props = defineProps<{
  /** Value to render on screen (an `amount_Display`-style string). */
  display?: string | null
  /** Converted value to show in the tooltip (an `amountConverted_Display`-style string). */
  convertedDisplay?: string | null
  /** ISO date (`exchangeRateDate`) mentioned in the tooltip text. */
  rateDate?: string | null
}>()

const EMPTY = '—'

const text = computed(() => props.display ?? EMPTY)

const tooltipText = computed(() => {
  if (!props.convertedDisplay) return ''
  return props.rateDate
    ? t('common.currencyConversion.tooltip', { convertedDisplay: props.convertedDisplay, rateDate: formatDate(props.rateDate, 'short') })
    : t('common.currencyConversion.tooltipNoDate', { convertedDisplay: props.convertedDisplay })
})
</script>

<template>
  <UTooltip v-if="convertedDisplay" :text="tooltipText">
    <span>{{ text }}</span>
  </UTooltip>
  <template v-else>
    {{ text }}
  </template>
</template>
