import type { Ref } from 'vue'
import type { SelectItem } from '~/types/options'

/**
 * Options of ONE dropdown, fetched the first time it is opened instead of when the
 * view or modal mounts — most filters and form selects are never opened, so loading
 * them up front only costs requests. The search ALWAYS goes to the server (`q`), never
 * a local filter: a dropdown shows at most `DROPDOWN_PAGE_SIZE` options, so filtering
 * those locally would hide the rest. Bind it to the select:
 *
 *   const banks = useLazyOptions(async q => (await bankOptions.options({ q })).map(...))
 *   <USelectMenu :items="banks.items.value" :loading="banks.loading.value"
 *                v-model:search-term="banks.searchTerm.value" ignore-filter
 *                @update:open="banks.onOpen" />
 *
 * - `loader(q)` receives the search term ('' when the dropdown just opened) and must pass it
 *   to the `/options` call. `ignore-filter` on the select stops it from filtering again locally.
 * - Typing re-queries the server, debounced with the shared `DEFAULT_DEBOUNCE_MS`
 *   (`useSearchDebounce`); a stale response (older query) is dropped.
 * - Loads once per instance when opened; concurrent callers share the in-flight request.
 * - A failed load is forgotten so the next open retries (useApi already notified).
 * - `initial` items (hard-coded fallbacks such as an "ALL" sentinel or the base
 *   currencies) are always listed first; loaded items with the same value are skipped.
 * - `ensureLoaded()` lets something else that needs the list (an edit form that must
 *   show the label of a preset value, a modal sharing the page's list) wait for it.
 * - `remember(value)` pins what the user picked (bind it to the select's `@update:model-value`):
 *   the select clears its search box on pick and the default list is reloaded, which may no
 *   longer contain the chosen option — a pinned option stays in `items` so its label keeps showing.
 * - `reset()` drops the loaded list so the next open fetches again (after a mutation).
 */
export function useLazyOptions<T extends { value: unknown } = SelectItem>(
  loader: (q: string) => Promise<T[]>,
  initial: T[] = [],
) {
  const loaded = ref<T[]>([]) as Ref<T[]>
  const loading = ref(false)
  const done = ref(false)
  const searchTerm = ref('')
  // Every option ever returned (by value) and the values the user picked: picked ones stay listed.
  const known = new Map<unknown, T>()
  const pinned = ref<unknown[]>([])
  let inFlight: Promise<void> | null = null
  // Bumped by reset() and by every new query: a response from before is dropped, not shown.
  let generation = 0

  const items = computed<T[]>(() => {
    const inResults = new Set(loaded.value.map(i => i.value))
    const kept = pinned.value.filter(v => !inResults.has(v)).map(v => known.get(v)).filter((i): i is T => !!i)
    const base = [...kept, ...loaded.value]
    if (!initial.length) return base
    const seen = new Set(initial.map(i => i.value))
    return [...initial, ...base.filter(i => !seen.has(i.value))]
  })

  function remember(value: unknown) {
    pinned.value = value == null || value === '' ? [] : (Array.isArray(value) ? value : [value])
  }

  function load(q: string): Promise<void> {
    const gen = ++generation
    loading.value = true
    const request = loader(q)
      .then((res) => {
        if (gen !== generation) return
        loaded.value = res ?? []
        for (const item of loaded.value) known.set(item.value, item)
        done.value = true
      })
      .catch(() => {
        if (gen === generation) loaded.value = []
      })
      .finally(() => {
        if (gen !== generation) return
        loading.value = false
        inFlight = null
      })
    inFlight = request
    return request
  }

  function ensureLoaded(): Promise<void> {
    if (done.value) return Promise.resolve()
    return inFlight ?? load(searchTerm.value.trim())
  }

  function onOpen(open: boolean) {
    if (open) void ensureLoaded()
  }

  // Typing in the select's search box queries the server (debounced).
  const search = useSearchDebounce((q: string) => { void load(q) })
  watch(searchTerm, (term) => {
    // The select clears its term on pick/close: when nothing was loaded yet there is nothing to refresh.
    if (!done.value && !inFlight) return
    search(term.trim())
  })

  function reset() {
    generation++
    inFlight = null
    loading.value = false
    done.value = false
    loaded.value = []
    known.clear()
    pinned.value = []
    searchTerm.value = ''
  }

  return { items, loading, loaded: done, searchTerm, ensureLoaded, onOpen, remember, reset }
}
