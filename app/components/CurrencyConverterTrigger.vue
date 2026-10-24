<script setup lang="ts">
import type { CatalogItem } from '~/types/catalogs'
import type { ConvertedAmountDto } from '~/types/currencies'
import type { CurrencyConverterResult } from '~/composables/useCurrencyConverter'

/**
 * Icon-button + popover with the full conversion breakdown (source amount,
 * converted amount, rate, rate date). Always visible — an empty/invalid
 * amount resolves to 0 rather than hiding the button (see
 * `useCurrencyConverter`). Takes `result` as a prop instead of computing it
 * itself so it can share one `useCurrencyConverter` instance with the
 * hover tooltip that wraps the whole field — see `CurrencyConverterDisplay`.
 *
 * A "convert to" picker lets the user see the amount in any other active
 * currency. Its default is `result.targetCurrency` (the org's opposite
 * system currency), rendered straight from `result` with no extra request;
 * picking anything else re-queries `GET /v1/exchange-rates/convert` for the
 * same amount, source currency and `asOf`, and renders the backend's
 * formatted values. Only this popover changes — the wrapping tooltip keeps
 * showing the configured conversion. The pick is per field and lasts while
 * the component lives.
 */
const props = defineProps<{ result: CurrencyConverterResult }>()

const { t } = useI18n()
const { formatCurrency, formatDate } = useFormatters()
const exchangeRates = useExchangeRates()

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

// --- "Convert to" picker ---

const FALLBACK_OFFICIAL = 'VES'
const FALLBACK_REFERENCE = 'USD'

const currencies = ref<CatalogItem[]>([])

// Prefetched on mount rather than on first open, so the picker is already
// populated when the popover renders — `loadConvertibleCurrencies` dedups
// at module level, so a listing with N popovers still fires one request.
onMounted(async () => {
  currencies.value = await loadConvertibleCurrencies()
})

/**
 * The configured opposite currency, known before anything loads: VES for a
 * USD amount and vice versa (same fallback as `useCurrencyConverter`),
 * replaced by the server-resolved `result.targetCurrency` once available —
 * which in practice is nearly always the same, so the picker never jumps.
 */
const defaultTarget = computed(() => props.result.targetCurrency
  ?? (props.result.sourceCurrency === FALLBACK_OFFICIAL ? FALLBACK_REFERENCE : FALLBACK_OFFICIAL))

const targetOptions = computed(() => {
  const options = currencies.value
    .filter(c => c.code !== props.result.sourceCurrency)
    .map(c => ({ label: c.symbol ? `${c.code} (${c.symbol})` : c.code!, value: c.code! }))
  // Catalog not loaded yet (or failed): still render the picker with the
  // default target alone, so the popover layout is stable from first paint.
  if (!options.some(o => o.value === defaultTarget.value)) options.unshift({ label: defaultTarget.value, value: defaultTarget.value })
  return options
})

/** `null` = the configured default (`result.targetCurrency`). */
const selectedTarget = ref<string | null>(null)

const targetModel = computed({
  get: () => selectedTarget.value ?? defaultTarget.value,
  set: (code: string | undefined) => {
    selectedTarget.value = !code || code === defaultTarget.value ? null : code
  },
})

// Source currency changed (e.g. the form's currency select) — the pick may
// no longer make sense (or now equal the source), so go back to the default.
watch(() => props.result.sourceCurrency, () => {
  selectedTarget.value = null
})

const override = ref<ConvertedAmountDto | null>(null)
const overrideLoading = ref(false)
let overrideRequest = 0

async function loadOverride() {
  const r = props.result
  const target = selectedTarget.value
  if (!target || !r.sourceCurrency || r.sourceAmount === null) {
    override.value = null
    return
  }
  const request = ++overrideRequest
  overrideLoading.value = true
  try {
    const dto = await exchangeRates.convert(r.sourceAmount, r.sourceCurrency, target, r.asOf || undefined)
    if (request === overrideRequest) override.value = dto
  }
  catch {
    if (request === overrideRequest) override.value = null
  }
  finally {
    if (request === overrideRequest) overrideLoading.value = false
  }
}

watch(
  [selectedTarget, () => props.result.sourceAmount, () => props.result.sourceCurrency, () => props.result.asOf],
  loadOverride,
)
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
      <div class="p-4 w-80 text-sm space-y-2">
        <div class="flex justify-between items-center gap-3">
          <span class="text-prohealth-400">{{ t('common.currencyConverter.targetCurrency') }}</span>
          <USelect
            v-model="targetModel"
            :items="targetOptions"
            size="xs"
            class="w-36"
          />
        </div>

        <template v-if="selectedTarget">
          <p v-if="overrideLoading" class="text-prohealth-400">{{ t('common.loading') }}</p>
          <template v-else-if="override?.available">
            <div class="flex justify-between gap-3">
              <span class="text-prohealth-400">{{ t('common.currencyConverter.sourceAmount') }}</span>
              <span class="font-medium whitespace-nowrap">{{ override.amount_Display }}</span>
            </div>
            <div class="flex justify-between gap-3">
              <span class="text-prohealth-400">{{ t('common.currencyConverter.convertedAmount') }}</span>
              <span class="font-medium whitespace-nowrap">{{ override.convertedAmount_Display }}</span>
            </div>
            <div class="flex justify-between gap-3">
              <span class="text-prohealth-400">{{ t('common.currencyConverter.rate') }}</span>
              <span class="font-medium whitespace-nowrap">{{ override.rate_Display }}</span>
            </div>
            <div class="flex justify-between gap-3">
              <span class="text-prohealth-400">{{ t('common.currencyConverter.rateDate') }}</span>
              <span class="font-medium whitespace-nowrap">{{ override.rateDate_Display }}</span>
            </div>
            <!-- Supplementary note, not part of the data: neutral gray + italic + separator so it doesn't read as another label/value row. -->
            <p v-if="override.viaCurrencyCode" class="flex items-center gap-1 pt-2 mt-1 border-t border-default text-xs italic text-dimmed">
              <UIcon name="i-lucide-info" class="size-3.5 shrink-0" />
              {{ t('common.currencyConverter.crossRateHint', { currency: override.viaCurrencyCode }) }}
            </p>
          </template>
          <p v-else class="text-prohealth-400">{{ t('common.currencyConverter.noRate') }}</p>
        </template>

        <template v-else-if="result.state === 'ok'">
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
