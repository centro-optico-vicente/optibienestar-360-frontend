import type { Page } from '~/types/admin'
import type {
  AdvisorRegistrationStatus,
  AdvisorRequestDetailDto,
  AdvisorRequestListItemDto,
  MyAdvisorRequestDto,
} from '~/types/advisorRequests'

interface ListParams {
  page?: number
  size?: number
  sort?: string[]
  q?: string
  status?: AdvisorRegistrationStatus
}

const BASE = '/v1/admin/advisor-requests'

/**
 * Advisor requests: verification queue of the self-registered advisors (/quiero-ser-asesor) at
 * /v1/admin/advisor-requests — approve (real referral code, QR and commissions), reject with a reason, reopen.
 */
export const useAdvisorRequests = () => {
  const list = (params: ListParams = {}) =>
    useApi<Page<AdvisorRequestListItemDto>>(BASE, {
      query: {
        page: params.page ?? 0,
        size: params.size ?? 20,
        ...(params.sort?.length ? { sort: params.sort } : {}),
        ...(params.q ? { q: params.q } : {}),
        ...(params.status ? { status: params.status } : {}),
      },
    })

  /** Pending count for the inbox badge. Silent: the badge simply hides on error. */
  const count = (status: AdvisorRegistrationStatus = 'PENDING') =>
    useApi<{ count: number }>(`${BASE}/count`, { query: { status }, silent: true })

  const get = (uuid: string) => useApi<AdvisorRequestDetailDto>(`${BASE}/${uuid}`)

  const approve = (uuid: string) =>
    useApi<AdvisorRequestDetailDto>(`${BASE}/${uuid}/approve`, { method: 'POST' })

  const reject = (uuid: string, reason: string) =>
    useApi<AdvisorRequestDetailDto>(`${BASE}/${uuid}/reject`, { method: 'POST', body: { reason } })

  const reopen = (uuid: string) =>
    useApi<AdvisorRequestDetailDto>(`${BASE}/${uuid}/reopen`, { method: 'POST' })

  /** The applicant's own request (ADVISOR_REGISTRATION_VIEW_OWN). */
  const mine = () => useApi<MyAdvisorRequestDto>('/v1/me/advisor-request')

  return { list, count, get, approve, reject, reopen, mine }
}
