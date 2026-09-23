<script setup lang="ts">
import type { CurrencyConverterResult } from '~/composables/useCurrencyConverter'

/**
 * Icon-button + popover with the full conversion breakdown (source amount,
 * converted amount, rate, rate date). Always visible — an empty/invalid
 * amount resolves to 0 rather than hiding the button (see
 * `useCurrencyConverter`). Takes `result` as a prop instead of computing it
 * itself so it can share one `useCurrencyConverter` instance with the
 * hover tooltip that wraps the whole field — see `CurrencyConverterDisplay`.
 */
const props = defineProps<{ result: CurrencyConverterResult }>()

const { t } = useI18n()
const { formatCurrency, formatDate } = useFormatters()

// Shared with the wrapping `CurrencyConverterDisplay` so its hover tooltip
// suppresses itself while this popover is open.
const popoverOpen = inject(CURRENCY_CONVERTER_POPOVER_OPEN_KEY, ref(false))

// Rate line always reads "1,00 <rateBaseCurrency> = X <rateQuoteCurrency>"
// (normalized by useCurrencyConverter to the org's official currency as
// quote), regardless of which direction the amount itself is being converted.
const formattedRate = computed(() => {
  const r = props.result
  if (r.state !== 'ok' || r.rate === null || !r.rateBaseCurrency || !r.rateQuoteCurrency) return ''
  const oneUnit = formatCurrency(1, r.rateBaseCurrency)
  const rateAmount = new Intl.NumberFormat('es-VE', {
    style: 'currency',
    currency: r.rateQuoteCurrency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(r.rate)
  return `${oneUnit} = ${rateAmount}`
})
</script>

<template>
  <UPopover v-model:open="popoverOpen">
    <UButton
      color="neutral"
      variant="ghost"
      size="xs"
      icon="i-lucide-coins"
      :loading="result.state === 'loading'"
      :aria-label="t('common.currencyConverter.trigger')"
    />

    <template #content>
      <div class="p-4 w-72 text-sm space-y-2">
        <template v-if="result.state === 'ok'">
          <div class="flex justify-between gap-3">
            <span class="text-prohealth-400">{{ t('common.currencyConverter.sourceAmount') }}</span>
            <span class="font-medium whitespace-nowrap">{{ formatCurrency(result.sourceAmount, result.sourceCurrency ?? undefined) }}</span>
          </div>
          <div class="flex justify-between gap-3">
            <span class="text-prohealth-400">{{ t('common.currencyConverter.convertedAmount') }}</span>
            <span class="font-medium whitespace-nowrap">{{ formatCurrency(result.convertedAmount, result.targetCurrency ?? undefined) }}</span>
          </div>
          <div class="flex justify-between gap-3">
            <span class="text-prohealth-400">{{ t('common.currencyConverter.rate') }}</span>
            <span class="font-medium whitespace-nowrap">{{ formattedRate }}</span>
          </div>
          <div class="flex justify-between gap-3">
            <span class="text-prohealth-400">{{ t('common.currencyConverter.rateDate') }}</span>
            <span class="font-medium whitespace-nowrap">{{ formatDate(result.rateDate) }}</span>
          </div>
        </template>
        <p v-else-if="result.state === 'loading'" class="text-prohealth-400">{{ t('common.loading') }}</p>
        <p v-else class="text-prohealth-400">{{ t('common.currencyConverter.noRate') }}</p>
      </div>
    </template>
  </UPopover>
</template>
