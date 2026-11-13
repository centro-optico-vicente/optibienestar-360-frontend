import type { Option } from '~/types/options'

interface CatalogOptionsParams {
  q?: string
  limit?: number
  currentValues?: string[]
  /** `states/options` acepta `countryUuid`; `cities/options` acepta `stateUuid`. */
  parentUuid?: string
}

/** How long a fetched options list is reused before asking the backend again. */
const CACHE_TTL_MS = 5 * 60 * 1000

interface CacheEntry {
  expiresAt: number
  request: Promise<Option[]>
}

// Module-level: shared by every select of the SPA for the whole tab session.
// It stores the promise, not the result, so concurrent callers (several selects
// mounting at once) share a single in-flight request.
const cache = new Map<string, CacheEntry>()

/**
 * Drops every cached options list. Called after a catalog is created, updated,
 * deleted or reordered (`useCatalog`) and when the session is cleared.
 */
export const clearCatalogOptionsCache = () => cache.clear()

/**
 * Proyección liviana para selects de catálogos administrables
 * (`GET /v1/admin/catalogs/{resource}/options`), sin paginar. Reemplaza a
 * `useCatalog(basePath).list({unpaged:'true'})` en selects/dropdowns: mismo
 * contrato `q`/`limit`/`currentValues` que `usePlans`/`useMembers`/`useUsers`/`useRoles`,
 * más filtro de cascada por padre (`states?countryUuid=`, `cities?stateUuid=`).
 *
 * Lists without a search term (`q`) or `currentValues` are cached in memory for
 * {@link CACHE_TTL_MS}, keyed by resource, query and locale (labels come
 * localized). Searches always hit the backend. Callers get their own array copy,
 * so mutating the result never alters the cache.
 *
 * `base` is the path before the resource: `/v1/admin/catalogs` for the administrable
 * catalogs (default) or `/v1/admin` for entities with their own controller
 * (`useCatalogOptions('banks', '/v1/admin')` → `/v1/admin/banks/options`). Any `/options`
 * only needs a valid session (backend ADR LOC-0013, rule 3), so it works for roles
 * without the screen permission.
 *
 * @example
 * const stateOptions = useCatalogOptions('states')
 * const items = await stateOptions.options({ parentUuid: countryUuid })
 */
export const useCatalogOptions = (resource: string, base = '/v1/admin/catalogs') => {
  const { $i18n } = useNuxtApp()

  const options = async (params: CatalogOptionsParams = {}): Promise<Option[]> => {
    const query = {
      ...(params.q ? { q: params.q } : {}),
      ...(params.limit ? { limit: params.limit } : {}),
      ...(params.currentValues?.length ? { currentValues: params.currentValues } : {}),
      ...(params.parentUuid ? { [resource === 'cities' ? 'stateUuid' : 'countryUuid']: params.parentUuid } : {}),
    }
    const fetchOptions = () => useApi<Option[]>(`${base}/${resource}/options`, { query })

    if (params.q || params.currentValues?.length) return fetchOptions()

    const key = `${String(unref($i18n.locale))}|${base}|${resource}|${JSON.stringify(query)}`
    const now = Date.now()
    let entry = cache.get(key)
    if (!entry || entry.expiresAt <= now) {
      const request = fetchOptions()
      entry = { expiresAt: now + CACHE_TTL_MS, request }
      cache.set(key, entry)
      // A failed request must not stay cached: the next caller retries.
      request.catch(() => {
        if (cache.get(key)?.request === request) cache.delete(key)
      })
    }
    return [...await entry.request]
  }

  return { options }
}
