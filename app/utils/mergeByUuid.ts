/**
 * Adds `found` to `known` keyed by `uuid` (newer wins). Used by selects searched on the server: each
 * search returns only a page, but the form keeps resolving the item picked earlier (a method's
 * mandatory flags, a bank's code) from what it has seen so far.
 */
export function mergeByUuid<T extends { uuid: string }>(known: T[], found: T[]): T[] {
  const map = new Map(known.map(i => [i.uuid, i]))
  for (const item of found) map.set(item.uuid, item)
  return [...map.values()]
}
