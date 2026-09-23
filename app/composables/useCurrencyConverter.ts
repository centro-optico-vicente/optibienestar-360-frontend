import { useDebounceFn } from '@vueuse/core'
import { nowTimeInCaracas, withCaracasOffset } from '~/utils/date'

export type CurrencyConverterState = 'idle' | 'loading' | 'ok' | 'unavailable'

export interface CurrencyConverterResult {
  state: CurrencyConverterState
  sourceAmount: number | null
  sourceCurrency: string | null
  convertedAmount: number | null
  targetCurrency: string | null
  /** Units of `rateQuoteCurrency` per 1 unit of `rateBaseCurrency` — the normalized display pair, e.g. always USD→VES even when converting VES→USD. */
  rate: number | null
  rateBaseCurrency: string | null
  rateQuoteCurrency: string | null
  rateDate: string | null
}

const DEBOUNCE_MS = 400
const FALLBACK_OFFICIAL = 'VES'
const FALLBACK_REFERENCE = 'USD'

// Module-level cache/dedup: several `CurrencyConverterDisplay` instances on
// the same screen, same pair + asOf, share one in-flight request instead of
// firing one each. Keyed `base|quote|asOf`; failures are not cached (a
// missing rate today shouldn't get "stuck" if it appears seconds later).
const rateCache = new Map<string, Promise<{ rate: number, rateDate: string | null } | null>>()

function isValidAmount(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined || raw === '') return null
  const n = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * `date` prop -> `asOf` query value for the backend.
 * - No `date` at all (master data that almost never tracks one, e.g.
 *   `CommissionTierFormModal`'s flat amount) -> `''`, so `asOf` is omitted
 *   entirely and the backend defaults to `Instant.now()` (today, right now).
 * - A `datetime-local` value (has a time component, e.g. a payment's
 *   `paymentDate`) must NOT be truncated to its date — doing so used to make
 *   the backend resolve it as midnight Caracas (`LocalDate.atStartOfDay`),
 *   earlier than same-day rate changes that take effect later (BCV typically
 *   publishes for 08:00 a.m.), silently picking a stale rate.
 * - A bare `yyyy-MM-dd` (a date without a time — some master data screen
 *   that only captures a date) is combined with the CURRENT time of day
 *   instead of midnight, for the same reason: midnight would miss any rate
 *   that became vigente later that same day.
 *
 * `withCaracasOffset`/`nowTimeInCaracas` (ADR 0010, fixed UTC-4, no DST) turn
 * either case into a proper ISO instant with an explicit offset.
 */
function asOfKey(date?: string | null): string {
  if (!date) return ''
  if (date.length > 10) return withCaracasOffset(date)
  return withCaracasOffset(`${date}T${nowTimeInCaracas()}`)
}

/**
 * Live currency-conversion preview for an amount input (ADR 0015 §7). Resolves
 * "the other system currency" from `GET /v1/organizations/currencies` (open to
 * any authenticated user, no `ORGANIZATION_VIEW` — see `useOrganization.getCurrencies`),
 * falling back to VES/USD only if that call fails or the org hasn't configured
 * one of the two. Never throws and never blocks the form: any failure or
 * missing rate just resolves to `state: 'unavailable'`.
 *
 * `amount`/`currency`/`date` accept refs, getters, or plain values — same
 * calling convention as `watch` sources. `currency` empty/omitted defaults to
 * USD (ADR 0015 rule 1); `date` empty/omitted means "now" for master data.
 */
export function useCurrencyConverter(
  amount: MaybeRefOrGetter<string | number | null | undefined>,
  currency?: MaybeRefOrGetter<string | null | undefined>,
  date?: MaybeRefOrGetter<string | null | undefined>,
) {
  const organization = useOrganization()
  const exchangeRates = useExchangeRates()

  const result = ref<CurrencyConverterResult>({
    state: 'idle',
    sourceAmount: null,
    sourceCurrency: null,
    convertedAmount: null,
    targetCurrency: null,
    rate: null,
    rateBaseCurrency: null,
    rateQuoteCurrency: null,
    rateDate: null,
  })

  async function resolveSystemCurrencies(): Promise<{ official: string, reference: string }> {
    const currencies = await organization.getCurrencies()
    return {
      official: currencies?.official?.code ?? FALLBACK_OFFICIAL,
      reference: currencies?.reference?.code ?? FALLBACK_REFERENCE,
    }
  }

  async function lookupRate(base: string, quote: string, asOf: string): Promise<{ rate: number, rateDate: string | null } | null> {
    const key = `${base}|${quote}|${asOf}`
    let pending = rateCache.get(key)
    if (!pending) {
      pending = exchangeRates
        .current(base, quote, asOf || undefined)
        .then(dto => (dto.available && dto.rate !== null ? { rate: Number(dto.rate), rateDate: dto.rateDate } : null))
        .catch(() => null)
      rateCache.set(key, pending)
      const resolved = await pending
      if (!resolved) rateCache.delete(key) // don't cache failures/unavailable
      return resolved
    }
    return pending
  }

  async function run() {
    const rawAmount = toValue(amount)
    const parsedAmount = isValidAmount(rawAmount)
    // No value entered yet: still show the button/popover with amount 0,
    // always resolved against USD (the currently-selected currency, if any,
    // only matters once there's a real amount to convert).
    const sourceAmount = parsedAmount ?? 0
    const sourceCurrency = parsedAmount !== null ? (toValue(currency) || FALLBACK_REFERENCE) : FALLBACK_REFERENCE
    const rawDate = toValue(date)
    const asOf = asOfKey(rawDate)

    const { official, reference } = await resolveSystemCurrencies()
    const targetCurrency = sourceCurrency === official ? reference : official

    if (targetCurrency === sourceCurrency) {
      result.value = { state: 'idle', sourceAmount, sourceCurrency, convertedAmount: null, targetCurrency: null, rate: null, rateBaseCurrency: null, rateQuoteCurrency: null, rateDate: null }
      return
    }

    result.value.state = 'loading'

    // Normalized display pair: always `base = currency ≠ official`, `quote = official`,
    // so the popover reads "1,00 $ = X Bs." regardless of which side is being converted.
    const displayBase = sourceCurrency === official ? targetCurrency : sourceCurrency
    const displayQuote = official
    const looked = await lookupRate(displayBase, displayQuote, asOf)

    if (!looked) {
      result.value = { state: 'unavailable', sourceAmount, sourceCurrency, convertedAmount: null, targetCurrency, rate: null, rateBaseCurrency: displayBase, rateQuoteCurrency: displayQuote, rateDate: null }
      return
    }

    const convertedAmount = sourceCurrency === displayBase
      ? sourceAmount * looked.rate
      : sourceAmount / looked.rate

    result.value = {
      state: 'ok',
      sourceAmount,
      sourceCurrency,
      convertedAmount,
      targetCurrency,
      rate: looked.rate,
      rateBaseCurrency: displayBase,
      rateQuoteCurrency: displayQuote,
      rateDate: looked.rateDate,
    }
  }

  const debouncedRun = useDebounceFn(run, DEBOUNCE_MS)

  watch(
    [() => toValue(amount), () => toValue(currency), () => toValue(date)],
    () => {
      // Flip to 'loading' synchronously so the button never renders blank
      // while the debounced lookup is pending (button itself is always
      // rendered by the component regardless of state).
      if (result.value.state !== 'loading') result.value.state = 'loading'
      debouncedRun()
    },
    { immediate: true },
  )

  return { result }
}
