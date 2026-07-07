import type { MembershipDto } from '~/types/memberships'

/**
 * Read-only access to a member's memberships
 * (/v1/admin/members/{memberUuid}/memberships). Permission: MEMBERSHIP_VIEW_ALL.
 *
 * Only the per-member listing is needed today for the membership picker in the
 * payment registration; the full vertical CRUD lives apart (still to be built).
 */
export const useMemberships = () => {
  /** A member's memberships (flat array, not paginated). */
  const listForMember = (memberUuid: string) =>
    useApi<MembershipDto[]>(`/v1/admin/members/${memberUuid}/memberships`)

  return { listForMember }
}
