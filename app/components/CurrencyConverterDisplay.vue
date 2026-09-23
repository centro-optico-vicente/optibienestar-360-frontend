<script setup lang="ts">
/**
 * Wraps an amount input with a hover tooltip showing the live
 * currency-conversion preview (ADR 0015 §7) — the tooltip triggers over the
 * whole wrapped field, not just the icon-button that opens the full
 * breakdown popover (`CurrencyConverterTrigger`, rendered by the caller via
 * the exposed `result`, typically in the input's `#trailing` slot). One
 * `useCurrencyConverter` instance is owned here so the tooltip and the
 * trigger share the same result instead of fetching twice.
 *
 * Usage:
 * ```vue
 * <CurrencyConverterDisplay :amount="state.amount" :currency="state.currency" :date="state.paymentDate" v-slot="{ result }">
 *   <UInput v-model="state.amount" class="w-full">
 *     <template #trailing><CurrencyConverterTrigger :result="result" /></template>
 *   </UInput>
 * </CurrencyConverterDisplay>
 * ```
 *
 * The tooltip also opens on focus of the wrapped field (via `focusin`, see
 * below — Reka's own `focus` listener doesn't bubble to a nested `<input>`),
 * not just hover. While the popover (`CurrencyConverterTrigger`) is open,
 * the tooltip is suppressed — see `CURRENCY_CONVERTER_POPOVER_OPEN_KEY` — so
 * the two never show at once.
 */
const props = defineProps<{
  amount: string | number | null | undefined
  /** ISO currency code. Empty/omitted defaults to USD (ADR 0015 rule 1). */
  currency?: string | null
  /** `yyyy-MM-dd` or ISO datetime. Empty/omitted means "now" (master data). */
  date?: string | null
}>()

const { t } = useI18n()
const { formatCurrency, formatDate } = useFormatters()

const { result } = useCurrencyConverter(
  () => props.amount,
  () => props.currency,
  () => props.date,
)

const popoverOpen = ref(false)
provide(CURRENCY_CONVERTER_POPOVER_OPEN_KEY, popoverOpen)

const hasTooltip = computed(() => (result.value.state === 'ok' || result.value.state === 'unavailable') && !popoverOpen.value)

// Reka UI's Tooltip only shows on focus via the native `focus` event, which
// does NOT bubble — it fires only on the actual element that gets focused
// (the `<input>` nested inside the wrapped slot), never on the outer element
// where Reka attaches its listener. Hover works fine (pointermove/pointerleave
// are measured directly on that outer element), but focus never did. Fix:
// drive `open` ourselves via focusin/focusout (which DO bubble) on top of the
// normal hover flow — passing `open` as a controlled v-model doesn't break
// Reka's own hover-driven open/close, it just mirrors it into this ref too.
//
// The focusin/focusout listeners live on a span OUTSIDE `UTooltip` (not
// wrapping its slot) — wrapping the slot itself in an extra element breaks
// Reka's popper positioning, since that wrapper becomes the trigger it
// measures for placement; a `display: contents` one has no box at all, so
// the tooltip anchored at (0,0) — top-left of the screen — instead of over
// the field. Listening outside doesn't touch what Reka treats as the trigger.
const tooltipOpen = ref(false)
const wrapperRef = ref<HTMLElement | null>(null)

function onFocusIn() {
  if (hasTooltip.value) tooltipOpen.value = true
}

function onFocusOut(event: FocusEvent) {
  const next = event.relatedTarget as Node | null
  if (!next || !wrapperRef.value?.contains(next)) tooltipOpen.value = false
}

// `disabled` on UTooltip only stops Reka's own listeners from opening it —
// it doesn't force-close an `open` we already set ourselves. Without this,
// a tooltip opened via focus could linger visible after e.g. the popover
// opens (hasTooltip flips false) while the field stays focused.
watch(hasTooltip, (has) => {
  if (!has) tooltipOpen.value = false
})
</script>

<template>
  <span ref="wrapperRef" @focusin="onFocusIn" @focusout="onFocusOut">
    <UTooltip :open="tooltipOpen" @update:open="tooltipOpen = $event" :disabled="!hasTooltip">
      <slot :result="result" />

      <template #content>
        <div class="px-1 py-0.5 text-xs space-y-0.5">
          <template v-if="result.state === 'ok'">
            <p>{{ t('common.currencyConverter.tooltipLabel') }} <strong>{{ formatCurrency(result.convertedAmount, result.targetCurrency ?? undefined) }}</strong></p>
            <p>{{ t('common.currencyConverter.tooltipRateDateLabel') }} <strong>{{ formatDate(result.rateDate) }}</strong></p>
          </template>
          <p v-else>{{ t('common.currencyConverter.noRate') }}</p>
        </div>
      </template>
    </UTooltip>
  </span>
</template>
