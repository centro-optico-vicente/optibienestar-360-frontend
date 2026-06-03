import type { CatalogItem } from '~/types/catalogs'
import { toItems, type Page } from '~/types/admin'

/**
 * Factory genérico de acceso a un catálogo administrable (/v1/admin/catalogs/*).
 * Reutiliza el patrón CRUD de `useUsers`, parametrizado por `basePath`.
 *
 * Los listados ahora devuelven una página (`Page<CatalogItem>`). Para selects y la
 * tabla de administración necesitamos TODOS los registros, así que pedimos
 * `unpaged=true` (de lo contrario el backend trunca al tamaño por defecto, size=50) y
 * desempaquetamos `content` con `toItems`, de modo que `list()` sigue resolviendo a
 * `CatalogItem[]` para los consumidores. Sin filtros, el backend cachea esta consulta 1h.
 *
 * @example
 * const api = useCatalog('/v1/admin/catalogs/countries')
 * const items = await api.list()
 */
export const useCatalog = (basePath: string) => {
  const list = async (query?: Record<string, string | undefined>): Promise<CatalogItem[]> => {
    const res = await useApi<Page<CatalogItem> | CatalogItem[]>(basePath, {
      query: { unpaged: 'true', ...(query ?? {}) },
    })
    return toItems(res)
  }

  const get = (uuid: string) =>
    useApi<CatalogItem>(`${basePath}/${uuid}`)

  const create = (body: Record<string, unknown>) =>
    useApi<CatalogItem>(basePath, { method: 'POST', body })

  const update = (uuid: string, body: Record<string, unknown>) =>
    useApi<CatalogItem>(`${basePath}/${uuid}`, { method: 'PUT', body })

  const remove = (uuid: string) =>
    useApi<null>(`${basePath}/${uuid}`, { method: 'DELETE' })

  return { list, get, create, update, remove }
}
