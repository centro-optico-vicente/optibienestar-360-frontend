import type { CurrentExchangeRateDto } from '~/types/currencies'

/**
 * Generic "rate vigente" lookup (ADR 0015 §7, GET /v1/exchange-rates/current)
 * — no domain permission on the backend, just being authenticated, so any
 * screen previewing a conversion before saving (payments, commissions, ally
 * services, ...) can call this directly.
 */
export const useExchangeRates = () => {
  /**
   * Rate to multiply an amount in `base` by, to get its equivalent in
   * `quote`. `asOf` previews the rate vigente as of that point in time
   * instead of right now — a bare `yyyy-MM-dd` is enough (e.g. a payment
   * dated earlier than today, so the preview matches the rate its eventual
   * settlement will actually snapshot); pass a full ISO timestamp instead
   * when the caller genuinely knows the document's own exact time. Omitted
   * means "right now". Never throws on a missing rate — `available: false`
   * is a normal response (see `CurrentExchangeRateDto`); `silent` because
   * this is a best-effort UI hint, not a user-triggered action.
   */
  const current = (base: string, quote: string, asOf?: string) =>
    useApi<CurrentExchangeRateDto>('/v1/exchange-rates/current', {
      query: { base, quote, ...(asOf ? { asOf } : {}) },
      silent: true,
    })

  return { current }
}
