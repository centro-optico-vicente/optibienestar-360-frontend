import type { CatalogItem } from '~/types/catalogs'

/**
 * Factory genérico de acceso a un catálogo administrable (/v1/admin/catalogs/*).
 * Reutiliza el patrón CRUD de `useUsers`, parametrizado por `basePath`.
 * Los listados admin devuelven arrays planos (no paginados).
 *
 * @example
 * const api = useCatalog('/v1/admin/catalogs/countries')
 * const items = await api.list()
 */
export const useCatalog = (basePath: string) => {
  const list = (query?: Record<string, string | undefined>) =>
    useApi<CatalogItem[]>(basePath, query ? { query } : {})

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
