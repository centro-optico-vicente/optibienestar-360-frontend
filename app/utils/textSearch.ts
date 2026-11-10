/**
 * Lower-cases and strips diacritics so client-side filters match the way the
 * backend's `immutable_unaccent(lower(...))` search does ("jose" matches "José").
 */
export function foldText(value: string | null | undefined): string {
  return (value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** True when `term` (already trimmed) is a substring of any field, ignoring case and accents. */
export function matchesAny(term: string, ...fields: Array<string | null | undefined>): boolean {
  const needle = foldText(term)
  return fields.some(f => foldText(f).includes(needle))
}

/**
 * Same as {@link matchesAny} but takes the raw input box value: a blank term
 * matches everything, so callers can filter unconditionally.
 */
export function matchesText(term: string | null | undefined, ...fields: Array<string | null | undefined>): boolean {
  const trimmed = (term ?? '').trim()
  return trimmed === '' || matchesAny(trimmed, ...fields)
}
