import type { MembershipCreateRequest, MembershipDto } from '~/types/memberships'

/**
 * Access to the Memberships vertical. Memberships are a sub-resource of a member
 * (enroll/list/detail live under the member), while the lifecycle transitions
 * (cancel/reactivate) hang off the flat `/v1/admin/memberships/{uuid}` root.
 * Permissions: view -> MEMBERSHIP_VIEW_ALL · enroll -> MEMBERSHIP_CREATE ·
 * cancel -> MEMBERSHIP_CANCEL · reactivate -> MEMBERSHIP_REACTIVATE.
 */
export const useMemberships = () => {
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

  return { listForMember, get, enroll, cancel, reactivate }
}
