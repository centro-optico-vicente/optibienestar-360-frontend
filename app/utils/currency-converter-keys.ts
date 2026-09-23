import type { InjectionKey, Ref } from 'vue'

/**
 * Shared between `CurrencyConverterDisplay` (owns the hover tooltip wrapping
 * the whole field) and `CurrencyConverterTrigger` (owns the click popover,
 * rendered by the host inside the field, e.g. `UInput`'s `#trailing`) — lets
 * the tooltip suppress itself while the popover is open, instead of both
 * floating elements showing at once.
 */
export const CURRENCY_CONVERTER_POPOVER_OPEN_KEY: InjectionKey<Ref<boolean>> = Symbol('currency-converter-popover-open')
