import type { SelectItem } from '~/types/options'

/** One dropdown/date control of <ListFilterBar>. `key` is also the query param name. */
export interface ListFilterField {
  key: string
  label: string
  icon?: string
  /** Static options (small master tables). */
  items?: SelectItem[]
  /** Server-side typeahead (large masters such as members). */
  search?: (q: string) => Promise<SelectItem[]>
  /**
   * `date` renders a native date input (yyyy-MM-dd); `dateRange` renders the shared
   * <DateRangeFilter> bound to `key` (from) and `toKey` (to); default is a select.
   */
  type?: 'select' | 'date' | 'dateRange'
  /** Query param of the range's upper end — only for `type: 'dateRange'` (`key` is the lower end). */
  toKey?: string
  /** Accessible label of the range's upper date input (`label` names the lower one). */
  toLabel?: string
  class?: string
}

export type ListFilterState = Record<string, string>

/** Blank state for the given fields. */
export const emptyListFilters = (fields: ListFilterField[]): ListFilterState =>
  Object.fromEntries(fields.flatMap(f => (f.type === 'dateRange' && f.toKey ? [[f.key, ''], [f.toKey, '']] : [[f.key, '']])))

/** Query params for the non-blank filters (blank ones are omitted). */
export function listFilterQuery(state: ListFilterState): Record<string, string> {
  return Object.fromEntries(Object.entries(state).filter(([, v]) => !!v))
}

/** Number of active filters — handy for a "clear filters" affordance. */
export const activeListFilterCount = (state: ListFilterState): number =>
  Object.values(state).filter(Boolean).length

/**
 * How many filters have a value, for the «Filtros» badge of <ListFilterPanel>.
 * Accepts filter-state objects (each non-blank field counts) and single values;
 * blank strings, null/undefined, false and empty arrays don't count.
 */
export function countActiveFilters(...parts: unknown[]): number {
  const isSet = (v: unknown) => !(v == null || v === '' || v === false || (Array.isArray(v) && v.length === 0))
  return parts.reduce<number>((n, p) => {
    if (p && typeof p === 'object' && !Array.isArray(p)) return n + Object.values(p).filter(isSet).length
    return n + (isSet(p) ? 1 : 0)
  }, 0)
}
