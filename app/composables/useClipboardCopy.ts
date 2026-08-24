/** Copia texto al portapapeles y expone un flag `copied` que se resetea solo. */
export function useClipboardCopy(resetMs = 1500) {
  const copied = ref(false)

  async function copy(value: string) {
    if (!import.meta.client) return
    try {
      await navigator.clipboard.writeText(value)
      copied.value = true
      setTimeout(() => (copied.value = false), resetMs)
    }
    catch { /* clipboard may be unavailable (insecure context); ignore silently */ }
  }

  return { copied, copy }
}
