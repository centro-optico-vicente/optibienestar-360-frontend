import type { Option } from '~/types/options'

interface CatalogOptionsParams {
  q?: string
  limit?: number
  currentValues?: string[]
  /** `states/options` acepta `countryUuid`; `cities/options` acepta `stateUuid`. */
  parentUuid?: string
}

/**
 * Proyección liviana para selects de catálogos administrables
 * (`GET /v1/admin/catalogs/{resource}/options`), sin paginar. Reemplaza a
 * `useCatalog(basePath).list({unpaged:'true'})` en selects/dropdowns: mismo
 * contrato `q`/`limit`/`currentValues` que `usePlans`/`useMembers`/`useUsers`/`useRoles`,
 * más filtro de cascada por padre (`states?countryUuid=`, `cities?stateUuid=`).
 *
 * @example
 * const stateOptions = useCatalogOptions('states')
 * const items = await stateOptions.options({ parentUuid: countryUuid })
 */
export const useCatalogOptions = (resource: string) => {
  const options = (params: CatalogOptionsParams = {}) =>
    useApi<Option[]>(`/v1/admin/catalogs/${resource}/options`, {
      query: {
        ...(params.q ? { q: params.q } : {}),
        ...(params.limit ? { limit: params.limit } : {}),
        ...(params.currentValues?.length ? { currentValues: params.currentValues } : {}),
        ...(params.parentUuid ? { [resource === 'cities' ? 'stateUuid' : 'countryUuid']: params.parentUuid } : {}),
      },
    })

  return { options }
}
