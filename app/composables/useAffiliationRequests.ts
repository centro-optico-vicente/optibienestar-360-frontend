import type { Page } from '~/types/admin'
import type {
  AffiliationRequestDetailDto,
  AffiliationRequestListItemDto,
  AffiliationRequestStatus,
  AffiliationRequestUpdateRequest,
} from '~/types/affiliationRequests'

interface ListParams {
  page?: number
  size?: number
  sort?: string[]
  q?: string
  status?: AffiliationRequestStatus
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

  /** Advisor portal: the requests that came through the caller's own QR. */
  const mine = (params: { page?: number, size?: number, status?: AffiliationRequestStatus } = {}) =>
    useApi<Page<AffiliationRequestListItemDto>>('/v1/advisors/me/affiliation-requests', {
      query: {
        page: params.page ?? 0,
        size: params.size ?? 20,
        ...(params.status ? { status: params.status } : {}),
      },
    })

  return { list, get, update, approve, reject, mine }
}
