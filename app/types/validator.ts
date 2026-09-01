// Types for the realtime validator (/v1/ally/validate/{document}), aligned with
// the backend ValidationResultDto.
//
// This is the product's moment of truth: the ally operator types the affiliate's
// document at the counter and must know, in one glance, whether the benefit can
// be applied. The backend answers from a Redis cache (60s TTL, evicted whenever a
// payment is approved/rejected or a membership flips status).
//
// Fields beyond `status` are populated progressively: identity fields appear as
// soon as the person is on file (even when not solvent, so the operator can
// confirm the human in front of them), and plan/membership fields only when a
// membership row exists.

/** Headline answer. Only ACTIVE authorizes applying the benefit. */
export type ValidationStatus =
  | 'NOT_FOUND'
  | 'NOT_ENROLLED'
  | 'NO_ACTIVE_MEMBERSHIP'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'EXPIRED'
  | 'CANCELED'

/**
 * Response of GET /v1/ally/validate/{document}. Scalars carry a localized
 * `_Display` sibling (hub ADR 0014).
 */
export interface ValidationResultDto {
  status: ValidationStatus | string
  status_Display?: string | null

  documentType?: string | null
  documentNumber?: string | null

  // Identity — present whenever the document matches a person on file.
  memberUuid?: string | null
  memberFullName?: string | null

  // Plan + membership — present only when a membership row exists.
  planUuid?: string | null
  planCode?: string | null
  planName?: string | null

  membershipUuid?: string | null
  enrolledAt?: string | null
  enrolledAt_Display?: string | null
  nextDueDate?: string | null
  nextDueDate_Display?: string | null
  lastPaidThrough?: string | null
  lastPaidThrough_Display?: string | null
  gracePeriodDays?: number | null

  /** Diagnostic only: whether the answer came from Redis. Never gate UI on this. */
  cached?: boolean
}

/**
 * The single rule the counter cares about: may the benefit be applied?
 * Mirrors the backend contract — ACTIVE and nothing else. Deliberately a
 * function over the status rather than a `usage-allowed` flag on the DTO, so the
 * frontend can never drift into treating SUSPENDED as good enough.
 */
export function isValidationActionable(result?: ValidationResultDto | null): boolean {
  return result?.status === 'ACTIVE' && !!result?.membershipUuid
}

/** Result badge/panel color (Nuxt UI palette). */
export function validationStatusColor(
  value?: string | null,
): 'success' | 'warning' | 'error' | 'neutral' {
  switch (value) {
    case 'ACTIVE': return 'success'
    // Past due but still inside grace: recoverable by paying, so it reads as a
    // warning rather than a hard failure.
    case 'SUSPENDED': return 'warning'
    case 'EXPIRED':
    case 'CANCELED': return 'error'
    case 'NOT_FOUND':
    case 'NOT_ENROLLED':
    case 'NO_ACTIVE_MEMBERSHIP': return 'neutral'
    default: return 'neutral'
  }
}

/** Result icon, paired with `validationStatusColor`. */
export function validationStatusIcon(value?: string | null): string {
  switch (value) {
    case 'ACTIVE': return 'i-lucide-circle-check-big'
    case 'SUSPENDED': return 'i-lucide-circle-alert'
    case 'EXPIRED': return 'i-lucide-circle-x'
    case 'CANCELED': return 'i-lucide-ban'
    case 'NOT_FOUND': return 'i-lucide-search-x'
    case 'NOT_ENROLLED':
    case 'NO_ACTIVE_MEMBERSHIP': return 'i-lucide-user-x'
    default: return 'i-lucide-help-circle'
  }
}
