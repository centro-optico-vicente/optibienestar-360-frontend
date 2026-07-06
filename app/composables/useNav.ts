import { MAIN_NAV, isNavGroup } from '~/utils/nav'
import type { NavEntry, NavGroup, NavLeaf } from '~/utils/nav'

/**
 * Navegación filtrada por permisos/roles. Una hoja se muestra si el usuario tiene
 * su rol (si declara `roles`) o alguno de sus permisos (`requires`). Un grupo se
 * muestra solo si le queda al menos una vista visible.
 *
 * Es SOLO experiencia de usuario: el backend es el muro real (403). La comparten
 * el sidebar y la página de mosaico por grupo.
 */
export const useNav = () => {
  const { can, hasAnyRole } = usePermissions()

  const isLeafVisible = (leaf: NavLeaf): boolean => {
    if (leaf.roles?.length) return hasAnyRole(...leaf.roles)
    if (!leaf.requires) return true
    return Array.isArray(leaf.requires) ? leaf.requires.some(can) : can(leaf.requires)
  }

  // Grupos con sus hijos ya filtrados; se descartan grupos sin vistas visibles.
  const visibleNav = computed<NavEntry[]>(() =>
    MAIN_NAV.flatMap<NavEntry>((entry) => {
      if (!isNavGroup(entry)) return isLeafVisible(entry) ? [entry] : []
      const children = entry.children.filter(isLeafVisible)
      return children.length ? [{ ...entry, children }] : []
    }),
  )

  const findGroup = (key: string): NavGroup | undefined =>
    MAIN_NAV.find((e): e is NavGroup => isNavGroup(e) && e.key === key)

  /** Clave del grupo que contiene la ruta dada (para abrir el acordeón activo). */
  const groupKeyOfPath = (path: string): string | null => {
    for (const entry of MAIN_NAV) {
      if (!isNavGroup(entry)) continue
      const hit = entry.children.some(c => path === c.to || path.startsWith(`${c.to}/`))
      if (hit) return entry.key
    }
    return null
  }

  return { visibleNav, isLeafVisible, findGroup, groupKeyOfPath }
}
