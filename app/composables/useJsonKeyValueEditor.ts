export interface KeyValuePair { key: string, value: string }
export type JsonKeyValueMode = 'kv' | 'json'

/**
 * Shared state for editing a free-form `Record<string, unknown>` (ej. el
 * campo `parameters` JSONB de un trabajo programado) either as add/remove
 * key-value rows or as raw JSON, kept in sync with each other. Used by both
 * `ScheduledJobFormModal.vue` and the scheduled-job detail page, so the
 * clave/valor ↔ JSON toggle behaves identically in both places.
 */
export function useJsonKeyValueEditor(initial: Record<string, unknown> = {}) {
  const mode = ref<JsonKeyValueMode>('kv')
  const pairs = ref<KeyValuePair[]>([])
  const json = ref('{}')
  const jsonError = ref('')

  function load(obj: Record<string, unknown> | null | undefined) {
    const safe = obj ?? {}
    pairs.value = Object.entries(safe).map(([key, value]) => ({
      key,
      value: typeof value === 'string' ? value : JSON.stringify(value),
    }))
    json.value = JSON.stringify(safe, null, 2)
    jsonError.value = ''
  }
  load(initial)

  function addRow() {
    pairs.value.push({ key: '', value: '' })
  }
  function removeRow(index: number) {
    pairs.value.splice(index, 1)
  }

  function pairsToObject(): Record<string, unknown> {
    return Object.fromEntries(
      pairs.value
        .filter(p => p.key.trim().length > 0)
        .map(p => [p.key.trim(), p.value]),
    )
  }

  /** Re-syncs the other view when the user switches tabs, so neither loses edits. */
  function switchMode(next: JsonKeyValueMode) {
    if (next === mode.value) return
    if (next === 'json') {
      json.value = JSON.stringify(pairsToObject(), null, 2)
      jsonError.value = ''
    }
    else {
      try {
        const parsed = JSON.parse(json.value || '{}')
        pairs.value = Object.entries(parsed).map(([key, value]) => ({
          key,
          value: typeof value === 'string' ? value : JSON.stringify(value),
        }))
        jsonError.value = ''
      }
      catch {
        // Keep the last valid pairs; the JSON tab keeps the invalid text
        // for the user to fix instead of silently discarding it.
        return
      }
    }
    mode.value = next
  }

  /** Resolves the current mode's edits into the final object, or `null` if the JSON tab has invalid input. */
  function resolve(): Record<string, unknown> | null {
    if (mode.value === 'kv') return pairsToObject()
    try {
      const parsed = JSON.parse(json.value || '{}')
      jsonError.value = ''
      return parsed
    }
    catch {
      jsonError.value = 'JSON inválido'
      return null
    }
  }

  return { mode, pairs, json, jsonError, load, addRow, removeRow, switchMode, resolve }
}
