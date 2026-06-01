import type { CatalogItem } from '~/types/catalogs'

/**
 * Acceso de SOLO LECTURA a los catálogos públicos (/v1/public/catalogs/*),
 * sin autenticación. Pensado para selects de formularios públicos (registro de
 * afiliados, portal público) sin requerir login.
 *
 * Los listados devuelven arrays planos. `cities` admite filtro por `stateUuid`,
 * `states` por `country` (igual que los admin).
 *
 * @example
 * const countries = await usePublicCatalog('countries').list()
 * const cities = await usePublicCatalog('cities').list({ stateUuid })
 */
export const usePublicCatalog = (resource: string) => {
  const base = `/v1/public/catalogs/${resource}`

  const list = (query?: Record<string, string | undefined>) =>
    useApi<CatalogItem[]>(base, { skipAuth: true, ...(query ? { query } : {}) })

  const get = (uuid: string) =>
    useApi<CatalogItem>(`${base}/${uuid}`, { skipAuth: true })

  return { list, get }
}
