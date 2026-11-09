import { useDebounceFn } from '@vueuse/core'

/**
 * Browser-only draft of a registration form (hub ADR 0037 §2): before step 1 is sent there is no
 * identity yet, so what the person typed lives in `localStorage` and survives a reload. Fields named in
 * `exclude` (passwords) are never stored. Storage can be blocked: every access is wrapped.
 */
export function useRegistrationDraft<T extends object>(key: string, state: T, exclude: ReadonlyArray<keyof T> = []) {
  const storageKey = `registration-draft:${key}`

  function restore(): void {
    if (!import.meta.client) return
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) return
      const saved = JSON.parse(raw) as Partial<T>
      for (const field of Object.keys(saved) as Array<keyof T>) {
        if (exclude.includes(field) || !(field in state)) continue
        ;(state as T)[field] = saved[field] as T[keyof T]
      }
    }
    catch {
      // Corrupt or blocked storage: start with an empty form.
    }
  }

  const persist = useDebounceFn(() => {
    try {
      const copy: Record<string, unknown> = { ...state }
      for (const field of exclude) delete copy[field as string]
      localStorage.setItem(storageKey, JSON.stringify(copy))
    }
    catch {
      // Quota or blocked storage: the draft just does not survive a reload.
    }
  }, 400)

  function clear(): void {
    try {
      localStorage.removeItem(storageKey)
    }
    catch {
      // Nothing to clean.
    }
  }

  onMounted(() => {
    restore()
    // Start watching only after restoring so the restore itself is not echoed back.
    watch(() => ({ ...state }), () => { void persist() }, { deep: true })
  })

  return { clear }
}
