import type { Option } from '~/types/options'

/**
 * Opciones de "Tipo de documento" para selects, cargadas desde el endpoint liviano
 * (`GET /v1/admin/catalogs/document-types/options`). El valor es el `code` (V, E, J, …),
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
      const res = await useApi<Option[]>('/v1/admin/catalogs/document-types/options', {
        silent: true,
        query: { limit: 200 },
      })
      options.value = res.map(o => ({ label: o.label, value: o.code ?? o.uuid }))
      loaded.value = true
    }
    catch {
      options.value = []
    }
    return options.value
  }

  return { options, load }
}
