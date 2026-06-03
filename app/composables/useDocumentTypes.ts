import type { CatalogItem } from '~/types/catalogs'
import { toItems, type Page } from '~/types/admin'

/**
 * Opciones de "Tipo de documento" para selects, cargadas desde el catálogo real
 * (`GET /v1/admin/catalogs/document-types`). El valor es el `code` (V, E, J, …),
 * que es lo que esperan los formularios (UserDto.documentType, etc.).
 *
 * Se cachea con useState: se pide una sola vez por sesión aunque varios formularios
 * lo usen. Falla en silencio (sin toast) si no hay permiso: deja la lista vacía.
 *
 * @example
 * const { options, load } = useDocumentTypes()
 * onMounted(load)
 */
export const useDocumentTypes = () => {
  const options = useState<{ label: string, value: string }[]>('document-types:options', () => [])
  const loaded = useState<boolean>('document-types:loaded', () => false)

  const load = async () => {
    if (loaded.value) return options.value
    try {
      const res = await useApi<Page<CatalogItem> | CatalogItem[]>('/v1/admin/catalogs/document-types', {
        silent: true,
        query: { unpaged: 'true' },
      })
      options.value = toItems(res)
        .filter(i => i.active !== false)
        .map(i => ({
          label: i.code ? `${i.code} — ${i.name}` : i.name,
          value: i.code ?? i.uuid,
        }))
      loaded.value = true
    }
    catch {
      options.value = []
    }
    return options.value
  }

  return { options, load }
}
