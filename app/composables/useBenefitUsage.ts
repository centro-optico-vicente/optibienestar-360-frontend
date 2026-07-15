import type { Page } from '~/types/admin'
import type { BenefitUsageDto, BenefitUsageRegisterRequest } from '~/types/benefits'

interface HistoryParams {
  page?: number
  size?: number
  sort?: string
}

/**
 * Benefit usage at the counter (/v1/ally/benefit-usage + /v1/ally/usage-history).
 * Backend permissions per action:
 * - register -> ALLY_REGISTER_USAGE
 * - history  -> ALLY_VIEW_OWN
 *
 * Usages are neither edited nor deleted: they are an audit trail of what was
 * consumed. Correcting one is an admin-side concern, not a counter action.
 */
export const useBenefitUsage = () => {
  /**
   * Register a consumed benefit. `membershipUuid` comes from the validator
   * response and `allyUuid` from GET /v1/me/allies — the operator types neither.
   *
   * The backend re-checks the membership is still ACTIVE, so a stale validation
   * (or a race with an admin cancel) is rejected with a 422 rather than
   * recorded. The caller should re-validate when that happens.
   */
  const register = (payload: BenefitUsageRegisterRequest) =>
    useApi<BenefitUsageDto>('/v1/ally/benefit-usage', { method: 'POST', body: payload })

  /**
   * Usage history for every ally the caller operates on — scope is implicit in
   * the JWT (the backend resolves "my allies" through the AllyUser pivot), so
   * there is no ally filter to pass. No RSQL nor free-text search.
   */
  const history = (params: HistoryParams = {}) =>
    useApi<Page<BenefitUsageDto>>('/v1/ally/usage-history', {
      query: {
        page: params.page ?? 0,
        size: params.size ?? 20,
        sort: params.sort ?? 'usageDate,desc',
      },
    })

  return { register, history }
}
