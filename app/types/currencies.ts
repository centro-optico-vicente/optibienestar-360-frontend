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

// ---- Admin CRUD over exchange_rates (/v1/admin/exchange-rates, ADR 0015 §2/§7) ----

/** Mirrors the backend `ExchangeRate.Source` enum. Only `MANUAL` rows are editable/deletable. */
export type ExchangeRateSource = 'BCV' | 'EXCHANGE_RATES_API' | 'MANUAL'

export const EXCHANGE_RATE_SOURCE_OPTIONS: { label: string, value: ExchangeRateSource, labelKey: string }[] = [
  { label: 'BCV', value: 'BCV', labelKey: 'exchangeRates.source.BCV' },
  { label: 'API externa', value: 'EXCHANGE_RATES_API', labelKey: 'exchangeRates.source.EXCHANGE_RATES_API' },
  { label: 'Manual', value: 'MANUAL', labelKey: 'exchangeRates.source.MANUAL' },
]

/** Rate is units of `quoteCurrency_Code` per 1 unit of `baseCurrency_Code`. */
export interface ExchangeRateDto {
  uuid: string
  baseCurrency_Code: string
  quoteCurrency_Code: string
  rate: number | string
  rate_Display?: string | null
  operationDate: string
  operationDate_Display?: string | null
  validFrom: string
  validFrom_Display?: string | null
  source: ExchangeRateSource
  source_Display?: string | null
  fetchedAt: string
  fetchedAt_Display?: string | null
  active: boolean
  active_Display?: string | null
  createdAt: string
  createdAt_Display?: string | null
}

/** Body of POST /v1/admin/exchange-rates — always creates a `MANUAL` row, `validFrom = now()`. */
export interface ExchangeRateCreateRequest {
  baseCurrencyCode: string
  quoteCurrencyCode: string
  rate: string
  operationDate: string
}

/** PATCH-style body of PUT /v1/admin/exchange-rates/{uuid} — only a `MANUAL` row accepts this. */
export interface ExchangeRateUpdateRequest {
  rate?: string
  operationDate?: string
  validFrom?: string
}

/** Per-currency outcome of one ingestion run (job or the "actualizar ahora" quick action). */
export type IngestionStatus = 'FETCHED' | 'ALREADY_HAD_TODAY' | 'FETCH_FAILED' | 'PARSE_FAILED'

export interface IngestionCurrencyResult {
  currencyCode: string
  status: IngestionStatus
  detail: string | null
}

/** Response of POST /v1/admin/exchange-rates/fetch-latest. */
export interface IngestionSummaryDto {
  currencies: IngestionCurrencyResult[]
}
