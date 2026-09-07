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

/**
 * Scalars carry a localized `_Display` sibling (hub ADR 0014). NOTE:
 * `inscriptionFee`/`monthlyFee` intentionally have NO `_Display` consumed
 * here — the backend's `MONEY` formatter is hardcoded to VES, but the
 * frontend's local `money()` helper renders these in USD (the actual plan
 * pricing currency). Wiring `_Display` for these would silently show the
 * wrong currency; flagged as a backend bug, not fixed here.
 */
export interface MembershipDto {
  uuid: string
  memberUuid: string
  // Plan (flat refs)
  planUuid: string
  planCode: string
  planName: string
  planType?: string
  planType_Display?: string | null
  // Lifecycle
  enrolledAt?: string | null
  enrolledAt_Display?: string | null
  expiresAt?: string | null
  expiresAt_Display?: string | null
  nextDueDate?: string | null
  nextDueDate_Display?: string | null
  lastPaidThrough?: string | null
  lastPaidThrough_Display?: string | null
  // Pricing snapshot (ADR 0015 — currency/exchange-rate conversion; conversion
  // fields cover `monthlyFee` ONLY, and are null together when no rate is
  // available — degrade gracefully, never assume presence)
  inscriptionFee: number | string
  monthlyFee: number | string
  currency_Code?: string | null
  /** Server-formatted `monthlyFee` (hub ADR 0014). `inscriptionFee` has no `_Display`/conversion pair — see class doc above. */
  monthlyFee_Display?: string | null
  amountConverted?: number | string | null
  amountConverted_Display?: string | null
  convertedCurrency_Code?: string | null
  exchangeRateUsed?: number | string | null
  exchangeRateDate?: string | null
  gracePeriodDays: number
  // Status
  status: MembershipStatus | string
  status_Display?: string | null
  lastStatusChangeAt?: string | null
  lastStatusChangeAt_Display?: string | null
  lastStatusChangeReason?: string | null
  // Audit
  active?: boolean
  active_Display?: string | null
  createdAt?: string
  createdAt_Display?: string | null
  updatedAt?: string
  updatedAt_Display?: string | null
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
