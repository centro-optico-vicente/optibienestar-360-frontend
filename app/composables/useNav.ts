import { MAIN_NAV, isNavGroup } from '~/utils/nav'
import type { NavEntry, NavGroup, NavLeaf } from '~/utils/nav'

/**
 * Navigation filtered by permissions/roles. A leaf is shown if the user has its
 * role (when it declares `roles`) or any of its permissions (`requires`). A group
 * is shown only if it still has at least one visible view.
 *
 * This is ONLY UX: the backend is the real wall (403). It is shared by the sidebar
 * and the per-group mosaic page.
 *
 * `label`/`description` are resolved to i18n here (once, at the source), so the
 * sidebar (AppNavItem) and the mosaic (NavMosaic) render already-translated text
 * without knowing the keys. Leaves without `labelKey` (derived catalogs) fall back
 * to their literal `label` — translated in their own vertical's retrofit.
 */
export const useNav = () => {
  const { can, hasAnyRole } = usePermissions()
  const { t } = useI18n()

  const isLeafVisible = (leaf: NavLeaf): boolean => {
    if (leaf.roles?.length) return hasAnyRole(...leaf.roles)
    if (!leaf.requires) return true
    return Array.isArray(leaf.requires) ? leaf.requires.some(can) : can(leaf.requires)
  }

  /** Resolves the label via i18n; falls back to the literal `label` when there is no key. */
  const navLabel = (entry: NavLeaf | NavGroup): string =>
    entry.labelKey ? t(entry.labelKey) : entry.label

  /** Resolves the description via i18n; falls back to `description` (or undefined) when there is no key. */
  const navDescription = (entry: NavLeaf | NavGroup): string | undefined =>
    entry.descriptionKey ? t(entry.descriptionKey) : entry.description

  const resolveLeaf = (leaf: NavLeaf): NavLeaf => ({
    ...leaf,
    label: navLabel(leaf),
    description: navDescription(leaf),
  })

  // Groups with their children already filtered and labels resolved; groups with
  // no visible views are dropped.
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

  /** Visible group with filtered children and resolved labels, for the mosaic page. */
  const visibleGroup = (key: string): NavGroup | undefined => {
    const group = findGroup(key)
    if (!group) return undefined
    const children = group.children.filter(isLeafVisible).map(resolveLeaf)
    return children.length
      ? { ...group, label: navLabel(group), description: navDescription(group), children }
      : undefined
  }

  /** Key of the group that contains the given path (to open the active accordion). */
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
