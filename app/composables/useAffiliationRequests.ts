import type { Page } from '~/types/admin'
import type {
  AffiliationRequestDetailDto,
  AffiliationRequestListItemDto,
  AffiliationRequestStatus,
  AffiliationRequestUpdateRequest,
  AssistedAffiliationRequest,
  DraftRetentionDto,
} from '~/types/affiliationRequests'
import type { PaymentSupportUrlDto } from '~/types/payments'

interface ListParams {
  page?: number
  size?: number
  sort?: string[]
  q?: string
  status?: AffiliationRequestStatus
  /** Master-table filters (query-param name → value), see `utils/listFilters.ts`. */
  extra?: Record<string, string>
}

/**
 * Affiliation requests (backend V188): admin review at
 * /v1/admin/affiliation-requests and the advisor's own list at
 * /v1/advisors/me/affiliation-requests.
 */
export const useAffiliationRequests = () => {
  const list = (params: ListParams = {}) =>
    useApi<Page<AffiliationRequestListItemDto>>('/v1/admin/affiliation-requests', {
      query: {
        page: params.page ?? 0,
        size: params.size ?? 20,
        ...(params.sort?.length ? { sort: params.sort } : {}),
        ...(params.q ? { q: params.q } : {}),
        ...(params.status ? { status: params.status } : {}),
        ...(params.extra ?? {}),
      },
    })

  const get = (uuid: string) =>
    useApi<AffiliationRequestDetailDto>(`/v1/admin/affiliation-requests/${uuid}`)

  const update = (uuid: string, body: AffiliationRequestUpdateRequest) =>
    useApi<AffiliationRequestDetailDto>(`/v1/admin/affiliation-requests/${uuid}`, { method: 'PUT', body })

  const approve = (uuid: string, comment?: string) =>
    useApi<AffiliationRequestDetailDto>(`/v1/admin/affiliation-requests/${uuid}/approve`, {
      method: 'POST',
      body: { comment: comment || undefined },
    })

  const reject = (uuid: string, reason: string) =>
    useApi<AffiliationRequestDetailDto>(`/v1/admin/affiliation-requests/${uuid}/reject`, {
      method: 'POST',
      body: { reason },
    })

  /**
   * Presigned URL of the proof attached to the reported inscription payment
   * (same shape as the payments' /support). 404 when there is no proof.
   */
  const paymentSupportUrl = (uuid: string) =>
    useApi<PaymentSupportUrlDto>(`/v1/admin/affiliation-requests/${uuid}/payment-support`)

  /**
   * Changes the advisor of a request that is not final yet (AFFILIATION_REQUEST_ASSIGN_PROMOTER;
   * 422 once approved or rejected). The approved member keeps that advisor.
   */
  const assignAdvisor = (uuid: string, promoterUuid: string, reason?: string) =>
    useApi<AffiliationRequestDetailDto>(`/v1/admin/affiliation-requests/${uuid}/advisor`, {
      method: 'PUT',
      body: { promoterUuid, reason: reason?.trim() || undefined },
    })

  /** Advisor portal: the requests that came through the caller's own QR. */
  const mine = (params: { page?: number, size?: number, status?: AffiliationRequestStatus, q?: string, dateFrom?: string, dateTo?: string } = {}) =>
    useApi<Page<AffiliationRequestListItemDto>>('/v1/advisors/me/affiliation-requests', {
      query: {
        page: params.page ?? 0,
        size: params.size ?? 20,
        ...(params.status ? { status: params.status } : {}),
        ...(params.q ? { q: params.q } : {}),
        ...(params.dateFrom ? { dateFrom: params.dateFrom } : {}),
        ...(params.dateTo ? { dateTo: params.dateTo } : {}),
      },
    })

  /** Assisted affiliation: the advisor creates the request for a person (approval emails them the access link). */
  const createAssisted = (body: AssistedAffiliationRequest) =>
    useApi<{ uuid: string, status: AffiliationRequestStatus, email: string }>('/v1/advisors/me/affiliation-requests', {
      method: 'POST',
      body,
    })

  /** Staff: keeps a draft out of the abandoned-draft cleanup, or releases it (AFFILIATION_REQUEST_DRAFT_RETAIN; 422 once submitted). */
  const retain = (uuid: string, retainIt: boolean, note?: string) =>
    useApi<DraftRetentionDto>(`/v1/admin/affiliation-requests/${uuid}/retain`, {
      method: 'PUT',
      body: { retain: retainIt, note: note?.trim() || undefined },
    })

  return { list, get, update, approve, reject, assignAdvisor, paymentSupportUrl, mine, createAssisted, retain }
}
