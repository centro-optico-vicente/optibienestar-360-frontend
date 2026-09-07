import type { CurrentExchangeRateDto } from '~/types/currencies'

/**
 * Generic "rate vigente right now" lookup (ADR 0015 §7, GET
 * /v1/exchange-rates/current) — no domain permission on the backend, just
 * being authenticated, so any screen previewing a conversion before saving
 * (payments, commissions, ally services, ...) can call this directly.
 */
export const useExchangeRates = () => {
  /**
   * Rate to multiply an amount in `base` by, to get its equivalent in
   * `quote`. `date` (ISO `yyyy-MM-dd`) previews the rate vigente as of that
   * operation date instead of right now — e.g. a payment dated earlier than
   * today should preview the rate its eventual settlement will actually
   * snapshot. Never throws on a missing rate — `available: false` is a
   * normal response (see `CurrentExchangeRateDto`); `silent` because this
   * is a best-effort UI hint, not a user-triggered action.
   */
  const current = (base: string, quote: string, date?: string) =>
    useApi<CurrentExchangeRateDto>('/v1/exchange-rates/current', {
      query: { base, quote, ...(date ? { date } : {}) },
      silent: true,
    })

  return { current }
}
