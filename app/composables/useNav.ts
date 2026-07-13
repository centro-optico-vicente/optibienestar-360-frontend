import { MAIN_NAV, isNavGroup } from '~/utils/nav'
import type { NavEntry, NavGroup, NavLeaf } from '~/utils/nav'

/**
 * Navegación filtrada por permisos/roles. Una hoja se muestra si el usuario tiene
 * su rol (si declara `roles`) o alguno de sus permisos (`requires`). Un grupo se
 * muestra solo si le queda al menos una vista visible.
 *
 * Es SOLO experiencia de usuario: el backend es el muro real (403). La comparten
 * el sidebar y la página de mosaico por grupo.
 *
 * Los `label`/`description` se resuelven a i18n aquí (una sola vez, en el origen),
 * de modo que el sidebar (AppNavItem) y el mosaico (NavMosaic) pintan texto ya
 * traducido sin conocer las claves. Las hojas sin `labelKey` (catálogos derivados)
 * caen a su `label` literal — se traducen en el retrofit de su propio vertical.
 */
export const useNav = () => {
  const { can, hasAnyRole } = usePermissions()
  const { t } = useI18n()

  const isLeafVisible = (leaf: NavLeaf): boolean => {
    if (leaf.roles?.length) return hasAnyRole(...leaf.roles)
    if (!leaf.requires) return true
    return Array.isArray(leaf.requires) ? leaf.requires.some(can) : can(leaf.requires)
  }

  /** Resuelve el label vía i18n; cae al `label` literal si no hay clave. */
  const navLabel = (entry: NavLeaf | NavGroup): string =>
    entry.labelKey ? t(entry.labelKey) : entry.label

  /** Resuelve la descripción vía i18n; cae a `description` (o undefined) si no hay clave. */
  const navDescription = (entry: NavLeaf | NavGroup): string | undefined =>
    entry.descriptionKey ? t(entry.descriptionKey) : entry.description

  const resolveLeaf = (leaf: NavLeaf): NavLeaf => ({
    ...leaf,
    label: navLabel(leaf),
    description: navDescription(leaf),
  })

  // Grupos con sus hijos ya filtrados y con labels resueltos; se descartan grupos
  // sin vistas visibles.
  const visibleNav = computed<NavEntry[]>(() =>
    MAIN_NAV.flatMap<NavEntry>((entry) => {
      if (!isNavGroup(entry)) return isLeafVisible(entry) ? [resolveLeaf(entry)] : []
      const children = entry.children.filter(isLeafVisible).map(resolveLeaf)
      return children.length
        ? [{ ...entry, label: navLabel(entry), description: navDescription(entry), children }]
        : []
    }),
  )

  const findGroup = (key: string): NavGroup | undefined =>
    MAIN_NAV.find((e): e is NavGroup => isNavGroup(e) && e.key === key)

  /** Grupo visible con hijos filtrados y labels resueltos, para la página de mosaico. */
  const visibleGroup = (key: string): NavGroup | undefined => {
    const group = findGroup(key)
    if (!group) return undefined
    const children = group.children.filter(isLeafVisible).map(resolveLeaf)
    return children.length
      ? { ...group, label: navLabel(group), description: navDescription(group), children }
      : undefined
  }

  /** Clave del grupo que contiene la ruta dada (para abrir el acordeón activo). */
  const groupKeyOfPath = (path: string): string | null => {
    for (const entry of MAIN_NAV) {
      if (!isNavGroup(entry)) continue
      const hit = entry.children.some(c => path === c.to || path.startsWith(`${c.to}/`))
      if (hit) return entry.key
    }
    return null
  }

  return { visibleNav, isLeafVisible, findGroup, visibleGroup, groupKeyOfPath, navLabel }
}
