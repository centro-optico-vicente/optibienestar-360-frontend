/**
 * Shared page-size options for every paginated admin table (catalogs, allies,
 * promoters, roles, users, members, payments, plans, commissions, scheduled
 * jobs...). Single source so every screen offers the same choices instead of
 * each page inventing its own list.
 *
 * `UNPAGED_PAGE_SIZE` (-1) is the backend's sentinel for "return everything"
 * (see `UnpagedAwarePageableArgumentResolver`: `size=-1` is equivalent to
 * `unpaged=true`) — sending it as `size` is enough, no extra query param needed.
 */
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const
export const DEFAULT_PAGE_SIZE = 25
export const UNPAGED_PAGE_SIZE = -1

export type PageSize = typeof PAGE_SIZE_OPTIONS[number] | typeof UNPAGED_PAGE_SIZE

/**
 * Builds the `USelectMenu` items for a page-size dropdown, localized via the
 * caller's own `t` (from `useI18n()`).
 *
 * @example
 * const { t } = useI18n()
 * const pageSizeItems = buildPageSizeItems(t)
 */
export function buildPageSizeItems(t: (key: string, params?: Record<string, unknown>) => string) {
  return [
    ...PAGE_SIZE_OPTIONS.map(n => ({ label: t('catalogs.pageSizePerPage', { n }), value: n })),
    { label: t('catalogs.pageSizeUnpaged'), value: UNPAGED_PAGE_SIZE },
  ]
}
