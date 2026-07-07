// Types for the Memberships vertical (/v1/admin/members/{memberUuid}/memberships),
// aligned with the backend (MembershipDto). Only the read projection is used here for
// the membership picker in the payment registration; the full membership CRUD is its
// own vertical (still to be built in the admin panel).
//
// A membership is a holder's enrollment into a Plan: it takes a "snapshot" of the plan
// pricing at enrollment time and carries the lifecycle dates and cycle status.

export interface MembershipDto {
  uuid: string
  memberUuid: string
  // Plan (flat refs)
  planUuid: string
  planCode: string
  planName: string
  planType?: string
  // Lifecycle
  enrolledAt?: string | null
  expiresAt?: string | null
  nextDueDate?: string | null
  lastPaidThrough?: string | null
  // Pricing snapshot
  inscriptionFee: number | string
  monthlyFee: number | string
  gracePeriodDays: number
  // Status
  status: string
  lastStatusChangeAt?: string | null
  lastStatusChangeReason?: string | null
  // Audit
  active?: boolean
  createdAt?: string
  updatedAt?: string
}
