import type { Page } from '~/types/admin'
import type { BenefitUsageDto, BenefitUsageRatingRequest, BenefitUsageRegisterRequest, MyUsageScope, UsagePersonSummaryDto, UsageServiceSummaryDto } from '~/types/benefits'

interface HistoryParams {
  page?: number
  size?: number
  sort?: string
  /** Free-text match against the member's document number or full name. */
  search?: string
}

/**
 * Optional filters of GET /v1/me/usage-history: who consumed (`holder` XOR
 * `beneficiaryUuid`), a catalog service (`productUuid`, across every ally) or
 * a category (`productCategoryUuid`).
 */
interface MyHistoryFilters extends MyUsageScope {
  productUuid?: string
  productCategoryUuid?: string
}

function scopeQuery(scope: MyUsageScope) {
  if (scope.holder) return { holder: true }
  if (scope.beneficiaryUuid) return { beneficiaryUuid: scope.beneficiaryUuid }
  return {}
}

/**
 * Benefit usage at the counter (/v1/allies/me/benefit-usages + /v1/allies/me/usage-history)
 * and the member's own side (/v1/me/usage-history).
 * Backend permissions per action:
 * - register  -> ALLY_REGISTER_USAGE
 * - history   -> ALLY_VIEW_OWN
 * - myHistory -> MEMBER_VIEW_OWN
 * - rateMine  -> MEMBER_RATE_USAGE
 *
 * Usages are neither edited nor deleted: they are an audit trail of what was
 * consumed. Correcting one is an admin-side concern, not a counter action. The
 * member's rating is the one exception: it's a separate, re-editable annotation.
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
    useApi<BenefitUsageDto>('/v1/allies/me/benefit-usages', { method: 'POST', body: payload })

  /**
   * Usage history for every ally the caller operates on — scope is implicit in
   * the JWT (the backend resolves "my allies" through the AllyUser pivot), so
   * there is no ally filter to pass. `search` matches the member's document
   * number or full name (backend `?search=`), no RSQL.
   */
  const history = (params: HistoryParams = {}) =>
    useApi<Page<BenefitUsageDto>>('/v1/allies/me/usage-history', {
      query: {
        page: params.page ?? 0,
        size: params.size ?? 20,
        sort: params.sort ?? 'usageDate,desc',
        search: params.search?.trim() || undefined,
      },
    })

  /**
   * The member's own usages (scope from the JWT), newest first. Each row carries
   * the member's rating (`allyRating`, `productRating`, `ratingComment`, `ratedAt`).
   */
  const myHistory = (params: Omit<HistoryParams, 'search'> & MyHistoryFilters = {}) =>
    useApi<Page<BenefitUsageDto>>('/v1/me/usage-history', {
      query: {
        page: params.page ?? 0,
        size: params.size ?? 20,
        sort: params.sort ?? 'usageDate,desc',
        ...scopeQuery(params),
        productUuid: params.productUuid || undefined,
        productCategoryUuid: params.productCategoryUuid || undefined,
      },
    })

  /**
   * My consumption grouped by service (GET /v1/me/usage-history/summary,
   * MEMBER_VIEW_OWN), most used first. Same "who" scope as `myHistory`.
   */
  const mySummary = (scope: MyUsageScope = {}) =>
    useApi<UsageServiceSummaryDto[]>('/v1/me/usage-history/summary', { query: scopeQuery(scope) })

  /**
   * Rate (or re-rate) one of my usages. Only REGISTERED usages are ratable
   * (422 `benefit_usage.rating.not_ratable`); `productRating` only when the usage
   * has an `allyProductUuid` (422 `benefit_usage.rating.product_not_applicable`).
   * Returns the updated usage. `silent` lets the caller own the error toast.
   */
  const rateMine = (usageUuid: string, payload: BenefitUsageRatingRequest, opts: { silent?: boolean } = {}) =>
    useApi<BenefitUsageDto>(`/v1/me/usage-history/${usageUuid}/rating`, {
      method: 'PUT',
      body: payload,
      silent: opts.silent,
    })

  /** Usage count per family member, for the portal's family cards. */
  const myByPerson = () =>
    useApi<UsagePersonSummaryDto[]>('/v1/me/usage-history/by-person', { silent: true })

  return { register, history, myHistory, mySummary, myByPerson, rateMine }
}
