import type { Page } from '~/types/admin'
import type { AdvisorAllyListItemDto } from '~/types/allies'

/**
 * Advisor portal, read-only: the allies the caller brought in (`allies.captured_by_promoter_id`),
 * `GET /v1/me/advisor/allies`, PROMOTER_ALLY_VIEW_OWN (backend V235).
 */
export const useAdvisorAllies = () => {
  const list = (params: { page?: number, size?: number, q?: string } = {}) =>
    useApi<Page<AdvisorAllyListItemDto>>('/v1/me/advisor/allies', {
      query: {
        page: params.page ?? 0,
        size: params.size ?? 20,
        ...(params.q ? { q: params.q } : {}),
      },
    })

  return { list }
}
