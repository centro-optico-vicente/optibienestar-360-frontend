// Types for the Memberships vertical, aligned with the backend (MembershipDto,
// MembershipCreateRequest, MembershipCancelRequest, MembershipReactivateRequest).
//
// A membership is a holder's enrollment into a Plan: it takes a "snapshot" of the plan
// pricing at enrollment time (inscriptionFee / monthlyFee / gracePeriodDays) so the
// active membership stays immune to later plan edits, and carries the lifecycle dates
// and cycle status. Memberships are a sub-resource of a member — there is no global
// admin list; they are managed per member.
//
// Endpoints:
// - GET  /v1/admin/members/{memberUuid}/memberships          (list, MEMBERSHIP_VIEW_ALL)
// - GET  /v1/admin/members/{memberUuid}/memberships/{uuid}   (detail, MEMBERSHIP_VIEW_ALL)
// - POST /v1/admin/members/{memberUuid}/memberships          (enroll, MEMBERSHIP_CREATE)
// - PUT  /v1/admin/memberships/{uuid}/cancel                 (MEMBERSHIP_CANCEL)
// - PUT  /v1/admin/memberships/{uuid}/reactivate             (MEMBERSHIP_REACTIVATE)

// ---- Lifecycle status (mirror of Membership.LifecycleStatus) ----
export type MembershipStatus = 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'CANCELED'

// `label` is the Spanish fallback; `labelKey` resolves to i18n at the usage point.
export const MEMBERSHIP_STATUS_OPTIONS: { label: string, value: MembershipStatus, labelKey: string }[] = [
  { label: 'Activa', value: 'ACTIVE', labelKey: 'memberships.status.ACTIVE' },
  { label: 'Suspendida', value: 'SUSPENDED', labelKey: 'memberships.status.SUSPENDED' },
  { label: 'Vencida', value: 'EXPIRED', labelKey: 'memberships.status.EXPIRED' },
  { label: 'Cancelada', value: 'CANCELED', labelKey: 'memberships.status.CANCELED' },
]

/** Status badge color (Nuxt UI palette). */
export function membershipStatusColor(value?: string | null): 'success' | 'warning' | 'neutral' | 'error' {
  switch (value) {
    case 'ACTIVE': return 'success'
    case 'SUSPENDED': return 'warning'
    case 'EXPIRED': return 'neutral'
    case 'CANCELED': return 'error'
    default: return 'neutral'
  }
}

/** A membership can be canceled while it is still running. */
export function isMembershipCancelable(status?: string | null): boolean {
  return status === 'ACTIVE' || status === 'SUSPENDED'
}

/** A membership can be reactivated once it is canceled or expired. */
export function isMembershipReactivatable(status?: string | null): boolean {
  return status === 'CANCELED' || status === 'EXPIRED'
}

// ---- Membership ----

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
  status: MembershipStatus | string
  lastStatusChangeAt?: string | null
  lastStatusChangeReason?: string | null
  // Audit
  active?: boolean
  createdAt?: string
  updatedAt?: string
}

/**
 * Body of POST /v1/admin/members/{memberUuid}/memberships. The pricing snapshot is
 * copied from `planUuid` server-side — not sent here. `enrolledAt` defaults to today
 * and `nextDueDate` is computed as enrolledAt + 1 month regardless of the client.
 */
export interface MembershipCreateRequest {
  planUuid: string
  /** ISO date (yyyy-MM-dd). Defaults to today server-side when omitted. */
  enrolledAt?: string
  /** ISO date (yyyy-MM-dd). Optional hard expiry. */
  expiresAt?: string
}

/** Optional body of the cancel/reactivate lifecycle transitions. */
export interface MembershipReviewRequest {
  /** Free-text reason stored in lastStatusChangeReason (max 500). */
  reason?: string
}
