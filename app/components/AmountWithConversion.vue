<script setup lang="ts">
/**
 * An amount in its own currency plus its converted value (hub ADR 0015 — every
 * amount carries its currency and its conversion). Two sources:
 *
 * - `convertedDisplay`: the conversion the backend FROZE on the record (e.g. a
 *   consumption's `consumptionAmountConverted_Display`, V229). Shown on screen,
 *   under the amount, with the rate date in a tooltip — it is the figure of
 *   record and never changes with later rates.
 * - The live popover (`CurrencyConverterDisplay` + `CurrencyConverterTrigger`)
 *   with the rate of `date`, to convert to any other currency on demand.
 *
 * Without a frozen conversion (older rows, no rate available) only the live
 * popover remains — degrade, never block.
 */
const props = defineProps<{
  amount?: number | string | null
  currency?: string | null
  /** Already formatted amount (`amount_Display`); formatted locally when absent. */
  display?: string | null
  /** Document date (yyyy-MM-dd or datetime) for the live popover's rate. */
  date?: string | null
  convertedDisplay?: string | null
  convertedCurrency?: string | null
  /** Publish date of the frozen rate (`exchangeRateDate`). */
  rateDate?: string | null
}>()

const { t } = useI18n()
const { formatCurrency, formatDate } = useFormatters()

const text = computed(() => {
  if (props.display) return props.display
  if (props.amount === null || props.amount === undefined || props.amount === '') return t('common.empty')
  return formatCurrency(Number(props.amount), props.currency || 'USD')
})

/** Same currency → the "conversion" is the amount itself; not worth a second line. */
const showConverted = computed(() =>
  !!props.convertedDisplay && (!props.convertedCurrency || props.convertedCurrency !== props.currency))

const tooltipText = computed(() => props.rateDate
  ? t('common.currencyConversion.tooltip', { convertedDisplay: props.convertedDisplay, rateDate: formatDate(props.rateDate, 'short') })
  : t('common.currencyConversion.tooltipNoDate', { convertedDisplay: props.convertedDisplay }))
</script>

<template>
  <span class="inline-flex flex-col items-end">
    <CurrencyConverterDisplay :amount="amount" :currency="currency" :date="date" v-slot="{ result }">
      <span class="inline-flex items-center justify-end gap-1">
        {{ text }}
        <CurrencyConverterTrigger :result="result" />
      </span>
    </CurrencyConverterDisplay>
    <UTooltip v-if="showConverted" :text="tooltipText">
      <span class="text-xs font-normal text-prohealth-500">≈ {{ convertedDisplay }}</span>
    </UTooltip>
  </span>
</template>
