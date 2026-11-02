// Types for the plan term compliance screen (hub ADR 0034): which live memberships of a plan comply with the
// plan's current term rule, and bulk application of that rule.
//
// Endpoints (backend PlansController):
// - GET  /v1/admin/plans/{uuid}/membership-terms                  (summary, MEMBERSHIP_TERM_VIEW_ALL)
// - GET  /v1/admin/plans/{uuid}/membership-terms/memberships      (paged list, MEMBERSHIP_TERM_VIEW_ALL)
// - POST /v1/admin/plans/{uuid}/membership-terms/apply            (MEMBERSHIP_TERM_UPDATE)

import type { TermMode } from '~/types/plans'

export type TermCompliance = 'COMPLIES' | 'DIFFERS'

/** Counts of live memberships (ACTIVE / SUSPENDED / EXPIRED) against the plan's rule. */
export interface PlanTermSummaryDto {
  total: number
  complies: number
  differs: number
  planRequiresReinscription: boolean
  termMode?: TermMode | null
  termMode_Display?: string | null
  termFixedMonth?: number | null
  termFixedDay?: number | null
  termPeriodMonths?: number | null
  /** First expiry the plan's rule yields from today (ISO date); null when the plan does not require re-inscription. */
  suggestedExpiresAt?: string | null
  suggestedExpiresAt_Display?: string | null
}

/** Row of the membership list: the current snapshot of the membership and whether it complies. */
export interface MembershipTermRowDto {
  uuid: string
  memberUuid: string
  member_Uuid?: string | null
  member_Display?: string | null
  documentNumber?: string | null
  contractNumber?: string | null
  status: string
  status_Display?: string | null
  enrolledAt?: string | null
  enrolledAt_Display?: string | null
  expiresAt?: string | null
  expiresAt_Display?: string | null
  reinscriptionRequired: boolean
  reinscriptionRequired_Display?: string | null
  termMode?: TermMode | null
  termMode_Display?: string | null
  termFixedMonth?: number | null
  termFixedDay?: number | null
  termPeriodMonths?: number | null
  termStartedAt?: string | null
  termStartedAt_Display?: string | null
  complies: boolean
  complies_Display?: string | null
}

export interface PlanTermListParams {
  page?: number
  size?: number
  compliance?: TermCompliance | ''
  q?: string
  sort?: string[]
}

/** Empty / missing `membershipUuids` = every live membership of the plan that does not comply. */
export interface PlanTermApplyRequest {
  membershipUuids?: string[]
  /** ISO date (yyyy-MM-dd), after today; one date for all the memberships. */
  expiresAt: string
}

export interface PlanTermApplyResult {
  applied: number
  skipped: number
}
