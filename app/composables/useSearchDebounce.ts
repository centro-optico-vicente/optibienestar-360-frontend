import { useDebounceFn } from '@vueuse/core'
import { DEFAULT_DEBOUNCE_MS, TABLE_FILTER_DEBOUNCE_MS } from '~/utils/debounce-config'

/**
 * Wraps `callback` in a debounce using the shared global delay
 * (`DEFAULT_DEBOUNCE_MS`, 500ms by default). Use for any server-triggered
 * search input (entity reference selects, async lookups) that should not
 * fire a request per keystroke.
 *
 * `delayMs` is an escape hatch for a call site that genuinely needs a
 * different value — prefer changing the shared constant instead.
 */
export function useSearchDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delayMs: number = DEFAULT_DEBOUNCE_MS,
) {
  return useDebounceFn(callback, delayMs)
}

/**
 * Same as {@link useSearchDebounce} but defaults to `TABLE_FILTER_DEBOUNCE_MS`
 * — the delay category for table/list/filter text inputs that re-query a
 * paginated listing on change. Kept as a separate constant (not merely an
 * alias) so it can be tuned independently of entity-search selects later.
 */
export function useTableFilterDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delayMs: number = TABLE_FILTER_DEBOUNCE_MS,
) {
  return useDebounceFn(callback, delayMs)
}
