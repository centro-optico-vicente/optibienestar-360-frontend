import type { CatalogItem } from '~/types/catalogs'
import { toItems, type Page } from '~/types/admin'

/**
 * Opciones de "Tipo de promotor" para selects, cargadas desde el catálogo real
 * (`GET /v1/admin/catalogs/promoter-types`). El valor es el `uuid` — es lo que
 * espera `Promoter{Create,Update}Request.promoterTypeUuid`.
 *
 * Se cachea con useState: se pide una sola vez por sesión aunque varios formularios
 * lo usen. Falla en silencio (sin toast) si no hay permiso: deja la lista vacía.
 *
 * @example
 * const { options, load } = usePromoterTypes()
 * onMounted(load)
 */
export const usePromoterTypes = () => {
  const options = useState<{ label: string, value: string }[]>('promoter-types:options', () => [])
  const loaded = useState<boolean>('promoter-types:loaded', () => false)

  const load = async () => {
    if (loaded.value) return options.value
    try {
      const res = await useApi<Page<CatalogItem> | CatalogItem[]>('/v1/admin/catalogs/promoter-types', {
        silent: true,
        query: { unpaged: 'true' },
      })
      options.value = toItems(res)
        .filter(i => i.active !== false)
        .map(i => ({ label: i.name, value: i.uuid }))
      loaded.value = true
    }
    catch {
      options.value = []
    }
    return options.value
  }

  return { options, load }
}
