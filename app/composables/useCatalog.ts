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
  // `sort` is a repeated multi-column query param (`sort=name,asc&sort=code,desc`);
  // every other value stays a plain scalar.
  const list = (query?: Record<string, string | number | string[] | undefined>) =>
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

  const remove = (uuid: string, physical = false) =>
    useApi<null>(`${basePath}/${uuid}`, { method: 'DELETE', query: physical ? { physical: true } : {} })

  /** "Ping" of FK usage before deleting: lets the UI offer a physical delete vs. a deactivation. */
  const usage = (uuid: string) =>
    useApi<{ inUse: boolean, count: number }>(`${basePath}/${uuid}/usage`)

  /**
   * Moves a record to the position immediately after `afterRankUuid` (`null`
   * = first). Only `promoter-ranks` exposes this today (`PROMOTER_RANK_REORDER`),
   * but it's defined generically here like the rest of this factory's methods.
   * Returns the full, freshly-ordered list — callers typically ignore it and
   * just re-`load()`, same as after create/update/delete.
   */
  const reorder = (uuid: string, afterRankUuid: string | null) =>
    useApi<CatalogItem[]>(`${basePath}/${uuid}/reorder`, { method: 'PUT', body: { afterRankUuid } })

  return { list, listAll, get, create, update, remove, usage, reorder }
}
