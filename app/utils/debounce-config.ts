/**
 * Central debounce timing config — see hub spec
 * `.ai/specs/08-debounce-search-inputs.md` (centro-optico-vicente) for the
 * full rule. Any input that fires a server request on every keystroke
 * (entity search selects, table/list text filters) must debounce through
 * one of these constants instead of hardcoding its own `setTimeout(..., N)`,
 * so the delay can be tuned globally (or per-category) from one place.
 *
 * These two are the ONLY places to edit to retune delays (never hardcode a
 * number at a call site). They currently share the same 500ms value by design — they are
 * kept separate so "search selects" and "table/list filters" can diverge
 * later without touching call sites.
 */

/**
 * Delay for DROPDOWN lists: the inner search box of a select that queries the
 * server (`CommonEntityReferenceSelect`, server-side `USelectMenu` search).
 * Also the fallback for any server-triggered search input not covered below.
 */
export const DEFAULT_DEBOUNCE_MS = 500

/** Delay for TEXT BOXES: table/list search and filter inputs that re-query on change. */
export const TABLE_FILTER_DEBOUNCE_MS = 500
