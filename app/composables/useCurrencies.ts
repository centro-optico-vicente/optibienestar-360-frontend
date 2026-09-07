import type { Option } from '~/types/options'

/**
 * Currency admin catalog (ADR 0015, `/v1/admin/currencies`). Only the
 * options lookup is needed on the frontend today — the exchange-rates
 * settings page uses it to populate the base/quote selects instead of a
 * free-text ISO code input (typo-prone: a bad code just 404s the request).
 */
export const useCurrencies = () => {
  const options = (q?: string) =>
    useApi<Option[]>('/v1/admin/currencies/options', {
      query: { ...(q ? { q } : {}), limit: 50 },
    })

  return { options }
}
