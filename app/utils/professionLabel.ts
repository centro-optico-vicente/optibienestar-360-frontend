// Sub-specialties (V213, hub ADR 0031 §6) are child professions: the backend
// sends the general profession as the FK triple `parent_Uuid`/`parent_Display`.

export interface ProfessionLike {
  uuid: string
  name: string
  parent_Uuid?: string | null
  parent_Display?: string | null
}

/** "Traumatología › Artroscopia" for a sub-specialty, the plain name otherwise. */
export function professionLabel(p: ProfessionLike): string {
  return p.parent_Display ? `${p.parent_Display} › ${p.name}` : p.name
}

/**
 * Select items grouped as a tree: each general profession followed by its
 * sub-specialties, alphabetically at both levels.
 */
export function professionTreeItems(list: ProfessionLike[]): { label: string, value: string }[] {
  const byName = (a: ProfessionLike, b: ProfessionLike) => a.name.localeCompare(b.name, 'es')
  const roots = list.filter(p => !p.parent_Uuid).sort(byName)
  const children = (uuid: string) => list.filter(p => p.parent_Uuid === uuid).sort(byName)
  const known = new Set(roots.map(r => r.uuid))
  const items: { label: string, value: string }[] = []
  for (const root of roots) {
    items.push({ label: root.name, value: root.uuid })
    for (const child of children(root.uuid)) items.push({ label: professionLabel(child), value: child.uuid })
  }
  // Sub-specialties whose general profession is inactive / not listed.
  for (const orphan of list.filter(p => p.parent_Uuid && !known.has(p.parent_Uuid)).sort(byName)) {
    items.push({ label: professionLabel(orphan), value: orphan.uuid })
  }
  return items
}
