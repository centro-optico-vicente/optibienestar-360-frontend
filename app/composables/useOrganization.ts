import type { OrganizationCurrenciesDto, OrganizationDto, OrganizationUpdateRequest } from '~/types/organizations'

/**
 * The single `organizations` row (ADR 0015 §4, `GET/PUT /v1/admin/organizations/me`).
 * `ensureLoaded` caches it in SSR-safe shared state (`useState`) so every
 * caller across the app — notably `useFormatters.formatCurrency`, which
 * reads `referenceCurrency_Code` as its default instead of a hardcoded
 * `'USD'` — hits the network at most once per session.
 *
 * Requires `ORGANIZATION_VIEW`; a session without it (e.g. a promoter/member
 * self-service portal) degrades to `null` silently (`silent: true` on the
 * fetch) — callers must treat a `null` organization as "unknown", never as
 * an error to surface.
 */
export const useOrganization = () => {
  const organization = useState<OrganizationDto | null>('organization', () => null)
  const loaded = useState<boolean>('organization-loaded', () => false)
  const currencies = useState<OrganizationCurrenciesDto | null>('organization-currencies', () => null)
  const currenciesLoaded = useState<boolean>('organization-currencies-loaded', () => false)

  async function ensureLoaded(): Promise<OrganizationDto | null> {
    if (loaded.value) return organization.value
    loaded.value = true // set before the await: concurrent callers share this one in-flight attempt, not one each
    try {
      organization.value = await useApi<OrganizationDto>('/v1/admin/organizations/me', { silent: true })
    }
    catch {
      organization.value = null
    }
    return organization.value
  }

  const update = (payload: OrganizationUpdateRequest) =>
    useApi<OrganizationDto>('/v1/admin/organizations/me', { method: 'PUT', body: payload })
      .then((result) => {
        organization.value = result
        return result
      })

  /**
   * The org's two system currencies via `GET /v1/organizations/currencies` —
   * open to any authenticated caller, no `ORGANIZATION_VIEW` needed, so this
   * is what `useCurrencyConverter` uses instead of `ensureLoaded()`/`organization`.
   * Cached the same way: once per session, `null` on failure (never throws).
   */
  async function getCurrencies(): Promise<OrganizationCurrenciesDto | null> {
    if (currenciesLoaded.value) return currencies.value
    currenciesLoaded.value = true
    try {
      currencies.value = await useApi<OrganizationCurrenciesDto>('/v1/organizations/currencies', { silent: true })
    }
    catch {
      currencies.value = null
    }
    return currencies.value
  }

  return { organization, ensureLoaded, update, getCurrencies }
}
