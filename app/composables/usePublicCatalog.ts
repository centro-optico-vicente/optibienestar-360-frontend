import type { CatalogItem } from '~/types/catalogs'
import { toItems, type Page } from '~/types/admin'

/**
 * Acceso de SOLO LECTURA a los catálogos públicos (/v1/public/catalogs/*),
 * sin autenticación. Pensado para selects de formularios públicos (registro de
 * afiliados, portal público) sin requerir login.
 *
 * Los listados ahora devuelven una página (`Page<CatalogItem>`). Como los selects
 * necesitan todos los registros, pedimos `unpaged=true` (si no, el backend trunca al
 * tamaño por defecto) y desempaquetamos `content` con `toItems`, así `list()` sigue
 * resolviendo a `CatalogItem[]`. `cities` admite filtro por `stateUuid`,
 * `states` por `country` (igual que los admin).
 *
 * @example
 * const countries = await usePublicCatalog('countries').list()
 * const cities = await usePublicCatalog('cities').list({ stateUuid })
 */
export const usePublicCatalog = (resource: string) => {
  const base = `/v1/public/catalogs/${resource}`

  const list = async (query?: Record<string, string | undefined>): Promise<CatalogItem[]> => {
    const res = await useApi<Page<CatalogItem> | CatalogItem[]>(base, {
      skipAuth: true,
      query: { unpaged: 'true', ...(query ?? {}) },
    })
    return toItems(res)
  }

  const get = (uuid: string) =>
    useApi<CatalogItem>(`${base}/${uuid}`, { skipAuth: true })

  return { list, get }
}
