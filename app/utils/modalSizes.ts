// Widths of form modals, by how many fields they hold — one place to tune them
// instead of a `max-w-*` per modal. Bind as `:ui="MODAL_WIDE_UI"` on <UModal>.
// Below `sm` Nuxt UI already renders the modal full width, so these only widen
// it on tablets and desktops.

/** Long forms (≈25+ fields, several sections): allies, members, payments, commission rules. */
export const MODAL_WIDE_UI = { content: 'max-w-5xl' } as const

/** Medium forms (≈14–24 fields): users, plans, advisors, campaigns. */
export const MODAL_MEDIUM_UI = { content: 'max-w-3xl' } as const
