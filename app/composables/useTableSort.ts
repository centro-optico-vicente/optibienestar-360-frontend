export type SortDirection = 'asc' | 'desc'

export interface SortOrder {
  field: string
  direction: SortDirection
}

export interface SortState {
  direction: SortDirection
  /** 1-based position in the active sort — shown as a badge when >1 column is active. */
  priority: number
}

/**
 * Multi-column click-to-sort state for admin record tables, mirroring what
 * Spring Data `Sort` accepts via repeated `?sort=field,direction` params.
 *
 * Click behavior (matches the backend's multi-column `ORDER BY`):
 * - Not in the sort → appended at the end, ascending.
 * - Already ascending → flips to descending, position unchanged.
 * - Already descending → removed; the other columns keep their order/direction.
 *
 * @example
 * const sort = useTableSort([{ field: 'name', direction: 'asc' }])
 * sort.toggle('name')                 // → [{ field: 'name', direction: 'desc' }]
 * sort.sortParam.value                // → ['name,desc']
 */
export function useTableSort(initial: SortOrder[] = []) {
  const orders = ref<SortOrder[]>(structuredClone(toRaw(initial)))

  // True right after `seedServerDefault` populated `orders` from the backend's
  // resolved default (entity_config / system_configs / hard fallback) purely so
  // header arrows can reflect it — not from an actual user click. The very next
  // `toggle`/`remove` must start fresh from that column alone instead of
  // compounding onto the seeded default, or every first click would silently
  // keep the default as a permanent primary sort key ahead of what the user
  // picked.
  const isServerDefault = ref(initial.length === 0)

  /** Restores the sort to the `initial` order it was created with. */
  function reset() {
    orders.value = structuredClone(toRaw(initial))
    isServerDefault.value = initial.length === 0
  }

  /**
   * Reflects the backend's resolved default sort (from `AppliedSortPage`) into
   * header arrows when the table hasn't been explicitly sorted yet. Marks the
   * seed so the next user interaction discards it instead of appending to it.
   */
  function seedServerDefault(defaultOrders: SortOrder[]) {
    orders.value = structuredClone(toRaw(defaultOrders))
    isServerDefault.value = true
  }

  function toggle(field: string) {
    if (isServerDefault.value) {
      orders.value = []
      isServerDefault.value = false
    }
    const idx = orders.value.findIndex(o => o.field === field)
    if (idx === -1) {
      orders.value.push({ field, direction: 'asc' })
    }
    else if (orders.value[idx]!.direction === 'asc') {
      orders.value[idx]!.direction = 'desc'
    }
    else {
      orders.value.splice(idx, 1)
    }
  }

  /** Drops a single column from the sort immediately, regardless of its current direction — skips the asc→desc→removed cycle `toggle` would otherwise require. No-op if the column isn't active. */
  function remove(field: string) {
    if (isServerDefault.value) {
      orders.value = []
      isServerDefault.value = false
      return
    }
    const idx = orders.value.findIndex(o => o.field === field)
    if (idx !== -1) {
      orders.value.splice(idx, 1)
    }
  }

  function stateOf(field: string): SortState | null {
    const idx = orders.value.findIndex(o => o.field === field)
    return idx === -1 ? null : { direction: orders.value[idx]!.direction, priority: idx + 1 }
  }

  /** e.g. `['name,asc', 'active,desc']` — passed straight through as `query.sort`. */
  const sortParam = computed(() => orders.value.map(o => `${o.field},${o.direction}`))

  return { orders, toggle, remove, stateOf, sortParam, reset, seedServerDefault }
}
