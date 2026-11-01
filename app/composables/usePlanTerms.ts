import type { Page } from '~/types/admin'
import type {
  MembershipTermRowDto,
  PlanTermApplyRequest,
  PlanTermApplyResult,
  PlanTermListParams,
  PlanTermSummaryDto,
} from '~/types/planTerms'

/**
 * Term compliance of the memberships of a plan (hub ADR 0034). View -> MEMBERSHIP_TERM_VIEW_ALL ·
 * apply the plan's rule -> MEMBERSHIP_TERM_UPDATE.
 */
export const usePlanTerms = () => {
  const summary = (planUuid: string) =>
    useApi<PlanTermSummaryDto>(`/v1/admin/plans/${planUuid}/membership-terms`)

  /** Live memberships of the plan; empty params are omitted. */
  const list = (planUuid: string, params: PlanTermListParams = {}) =>
    useApi<Page<MembershipTermRowDto>>(`/v1/admin/plans/${planUuid}/membership-terms/memberships`, {
      query: {
        page: params.page ?? 0,
        size: params.size ?? 10,
        ...(params.compliance ? { compliance: params.compliance } : {}),
        ...(params.q ? { q: params.q } : {}),
        ...(params.sort?.length ? { sort: params.sort } : {}),
      },
    })

  /** Copies the plan's rule onto the given memberships (none = all that differ) with the chosen first expiry. */
  const apply = (planUuid: string, body: PlanTermApplyRequest) =>
    useApi<PlanTermApplyResult>(`/v1/admin/plans/${planUuid}/membership-terms/apply`, { method: 'POST', body })

  return { summary, list, apply }
}
