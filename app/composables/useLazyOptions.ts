import type { Ref } from 'vue'
import type { SelectItem } from '~/types/options'

/**
 * Options of ONE dropdown, fetched the first time it is opened instead of when the
 * view or modal mounts — most filters and form selects are never opened, so loading
 * them up front only costs requests. Bind it to the select:
 *
 *   const banks = useLazyOptions(async () => (await banksApi.listAll()).map(...))
 *   <USelectMenu :items="banks.items.value" :loading="banks.loading.value"
 *                @update:open="banks.onOpen" />
 *
 * - Loads once per instance; concurrent callers share the in-flight request.
 * - A failed load is forgotten so the next open retries (useApi already notified).
 * - `initial` items (hard-coded fallbacks such as an "ALL" sentinel or the base
 *   currencies) are always listed first; loaded items with the same value are skipped.
 * - `ensureLoaded()` lets something else that needs the list (an edit form that must
 *   show the label of a preset value, a modal sharing the page's list) wait for it.
 * - `reset()` drops the loaded list so the next open fetches again (after a mutation).
 */
export function useLazyOptions<T extends { value: unknown } = SelectItem>(
  loader: () => Promise<T[]>,
  initial: T[] = [],
) {
  const loaded = ref<T[]>([]) as Ref<T[]>
  const loading = ref(false)
  const done = ref(false)
  let inFlight: Promise<void> | null = null
  // Bumped by reset(): a response from before the reset is dropped, not shown.
  let generation = 0

  const items = computed<T[]>(() => {
    if (!initial.length) return loaded.value
    const seen = new Set(initial.map(i => i.value))
    return [...initial, ...loaded.value.filter(i => !seen.has(i.value))]
  })

  function ensureLoaded(): Promise<void> {
    if (done.value) return Promise.resolve()
    if (!inFlight) {
      const gen = generation
      loading.value = true
      inFlight = loader()
        .then((res) => {
          if (gen !== generation) return
          loaded.value = res ?? []
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
    }
    return inFlight
  }

  function onOpen(open: boolean) {
    if (open) void ensureLoaded()
  }

  function reset() {
    generation++
    inFlight = null
    loading.value = false
    done.value = false
    loaded.value = []
  }

  return { items, loading, loaded: done, ensureLoaded, onOpen, reset }
}
