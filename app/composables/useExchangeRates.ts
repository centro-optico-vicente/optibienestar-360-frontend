import type { Page } from '~/types/admin'
import type {
  CurrentExchangeRateDto,
  ExchangeRateCreateRequest,
  ExchangeRateDto,
  ExchangeRateUpdateRequest,
  IngestionSummaryDto,
} from '~/types/currencies'

interface ListParams {
  page?: number
  size?: number
  sort?: string[]
  base?: string
  quote?: string
  filter?: string
}

/**
 * Currency exchange rates: the generic "rate vigente" lookup (ADR 0015 §7,
 * GET /v1/exchange-rates/current — no domain permission, just authenticated,
 * so any screen previewing a conversion before saving can call it directly)
 * plus the admin CRUD over `exchange_rates` history. Backend permissions:
 * - list -> EXCHANGE_RATE_VIEW_ALL · create/fetchLatest -> EXCHANGE_RATE_CREATE
 * - update -> EXCHANGE_RATE_UPDATE (MANUAL rows only) · remove -> EXCHANGE_RATE_DELETE (MANUAL rows only)
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

  /** History for a pair, newest `validFrom` first by default. */
  const list = (params: ListParams = {}) =>
    useApi<Page<ExchangeRateDto>>('/v1/admin/exchange-rates', {
      query: {
        page: params.page ?? 0,
        size: params.size ?? 20,
        ...(params.sort?.length ? { sort: params.sort } : {}),
        ...(params.base ? { base: params.base } : {}),
        ...(params.quote ? { quote: params.quote } : {}),
        ...(params.filter ? { filter: params.filter } : {}),
      },
    })

  /** Manual entry — always `source = MANUAL`, `validFrom = now()`. */
  const create = (payload: ExchangeRateCreateRequest) =>
    useApi<ExchangeRateDto>('/v1/admin/exchange-rates', { method: 'POST', body: payload })

  /** Correct a `MANUAL` row. The backend rejects any other `source` with 422. */
  const update = (uuid: string, payload: ExchangeRateUpdateRequest) =>
    useApi<ExchangeRateDto>(`/v1/admin/exchange-rates/${uuid}`, { method: 'PUT', body: payload })

  /** Soft-delete a `MANUAL` row. The backend rejects any other `source` with 422. */
  const remove = (uuid: string) =>
    useApi<void>(`/v1/admin/exchange-rates/${uuid}`, { method: 'DELETE' })

  /**
   * "Actualizar ahora" — synchronously runs the same ingestion
   * `FetchExchangeRatesJob` runs daily, on demand.
   */
  const fetchLatest = () =>
    useApi<IngestionSummaryDto>('/v1/admin/exchange-rates/fetch-latest', { method: 'POST' })

  return { current, list, create, update, remove, fetchLatest }
}
