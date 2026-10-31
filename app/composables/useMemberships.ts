import type { Page } from '~/types/admin'
import type { MembershipCreateRequest, MembershipDto, MembershipListItemDto, MembershipSearchParams } from '~/types/memberships'

/**
 * Access to the Memberships vertical. Memberships are a sub-resource of a member
 * (enroll/list/detail live under the member), while the lifecycle transitions
 * (cancel/reactivate) hang off the flat `/v1/admin/memberships/{uuid}` root.
 * Permissions: view -> MEMBERSHIP_VIEW_ALL · enroll -> MEMBERSHIP_CREATE ·
 * cancel -> MEMBERSHIP_CANCEL · reactivate -> MEMBERSHIP_REACTIVATE.
 */
export const useMemberships = () => {
  /**
   * Cross-member list with filters (`GET /v1/admin/memberships`, MEMBERSHIP_VIEW_ALL). Empty params are
   * omitted; `status` accepts the lifecycle values plus the derived OVERDUE / DUE_SOON.
   */
  const search = (params: MembershipSearchParams = {}) => {
    const { page, size, sort, ...filters } = params
    const query: Record<string, unknown> = { page: page ?? 0, size: size ?? 20 }
    if (sort?.length) query.sort = sort
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== '') query[key] = value
    }
    return useApi<Page<MembershipListItemDto>>('/v1/admin/memberships', { query })
  }

  /** A member's memberships (flat array, not paginated). */
  const listForMember = (memberUuid: string) =>
    useApi<MembershipDto[]>(`/v1/admin/members/${memberUuid}/memberships`)

  const get = (memberUuid: string, uuid: string) =>
    useApi<MembershipDto>(`/v1/admin/members/${memberUuid}/memberships/${uuid}`)

  /** Enroll a member into a plan. Pricing snapshot is copied from the plan server-side. */
  const enroll = (memberUuid: string, body: MembershipCreateRequest) =>
    useApi<MembershipDto>(`/v1/admin/members/${memberUuid}/memberships`, { method: 'POST', body })

  /** Cancel a running membership. `reason` optional (defaults "Cancelled by admin"). */
  const cancel = (uuid: string, reason?: string) =>
    useApi<MembershipDto>(`/v1/admin/memberships/${uuid}/cancel`, {
      method: 'PUT',
      body: reason ? { reason } : {},
    })

  /** Reactivate a canceled/expired membership. `reason` optional. */
  const reactivate = (uuid: string, reason?: string) =>
    useApi<MembershipDto>(`/v1/admin/memberships/${uuid}/reactivate`, {
      method: 'PUT',
      body: reason ? { reason } : {},
    })

  return { search, listForMember, get, enroll, cancel, reactivate }
}
