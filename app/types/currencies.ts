// Types for the generic currency/exchange-rate lookup (ADR 0015 §7),
// aligned with the backend (CurrentExchangeRateDto).

/**
 * Response of GET /v1/exchange-rates/current?base=&quote= — the rate
 * vigente right now for a currency pair. Generic: reused by any feature
 * that needs to preview a conversion before saving (payments, commissions,
 * ally services, ...), not scoped to one vertical. `available: false`
 * (every other field null) is the degrade path (no rate vigente, unknown
 * currency code) — never an error, per "degrade, never block".
 */
export interface CurrentExchangeRateDto {
  available: boolean
  baseCurrencyCode: string | null
  quoteCurrencyCode: string | null
  rate: number | string | null
  rateDate: string | null
}
