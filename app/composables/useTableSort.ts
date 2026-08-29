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
  const orders = ref<SortOrder[]>(initial)

  function toggle(field: string) {
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

  function stateOf(field: string): SortState | null {
    const idx = orders.value.findIndex(o => o.field === field)
    return idx === -1 ? null : { direction: orders.value[idx]!.direction, priority: idx + 1 }
  }

  /** e.g. `['name,asc', 'active,desc']` — passed straight through as `query.sort`. */
  const sortParam = computed(() => orders.value.map(o => `${o.field},${o.direction}`))

  return { orders, toggle, stateOf, sortParam }
}
