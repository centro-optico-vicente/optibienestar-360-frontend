/**
 * `ui` prop override for a `UInput`/`UTextarea`/`USelectMenu` that is
 * `:disabled` for structural reasons (immutable field, e.g. a `code` that
 * can't change once created) rather than a transient loading/permission
 * state. Nuxt UI's own `disabled:opacity-75` is too subtle to read at a
 * glance as "this field is locked" — see `.ai/specs/07-forms.md` § Campos
 * de solo lectura / deshabilitados for the convention this codifies.
 *
 * Usage: `:ui="mode === 'edit' ? READONLY_FIELD_UI : undefined"` alongside
 * the existing `:disabled="mode === 'edit'"`.
 */
export const READONLY_FIELD_UI = {
  base: 'disabled:bg-prohealth-100 disabled:text-prohealth-400 disabled:opacity-100',
}
