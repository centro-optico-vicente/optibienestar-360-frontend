import type { CatalogItem } from '~/types/catalogs'
import { toItems, type Page } from '~/types/admin'

/**
 * Factory genérico de acceso a un catálogo administrable (/v1/admin/catalogs/*).
 * Reutiliza el patrón CRUD de `useUsers`, parametrizado por `basePath`.
 *
 * El backend pagina de verdad (`page`/`size`/`sort`, más `q` para búsqueda libre y
 * `filter` en sintaxis RSQL) — sin esos parámetros cae en un atajo sin paginar
 * cacheado 1h ({@code ListQuery.isUnfilteredUnpaged}). `list()` pasa la página tal
 * cual para que la tabla de administración controle página/tamaño real contra el
 * servidor; `listAll()` sigue resolviendo a `CatalogItem[]` completo para selects
 * y opciones de FK que necesitan todos los registros.
 *
 * @example
 * const api = useCatalog('/v1/admin/catalogs/countries')
 * const page = await api.list({ page: 0, size: 25, q: 'lentes' })
 * const all = await api.listAll()
 */
export const useCatalog = (basePath: string) => {
  const list = (query?: Record<string, string | number | undefined>) =>
    useApi<Page<CatalogItem>>(basePath, { query })

  const listAll = async (query?: Record<string, string | undefined>): Promise<CatalogItem[]> => {
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
