// Types for the single active auth security policy, aligned with the backend
// (SecurityPolicyDto / SecurityPolicyUpdateRequest, GET/PUT
// /v1/admin/security-policy). Integer-only — no FK/enum fields, so there are
// no `_Display` companions (hub ADR 0014).

export interface SecurityPolicyDto {
  /** `null` only when the backend has no active row and returns its in-code defaults. */
  uuid: string | null
  /** Failed logins before the account is locked. Min 1. */
  maxLoginAttempts: number
  /** Lock duration once `maxLoginAttempts` is reached. Min 1. */
  lockoutDurationMinutes: number
  /** Days until a new password expires. `0` = no expiry date. */
  daysPasswordExpires: number
  /** Last N passwords that cannot be reused. `0` = check disabled (reuse allowed). */
  passwordHistoryCount: number
  /** Stored but not enforced at login yet. Min 1. */
  maxConcurrentSessions: number
}

/** Body of PUT /v1/admin/security-policy — full replacement, every field required. */
export interface SecurityPolicyUpdateRequest {
  maxLoginAttempts: number
  lockoutDurationMinutes: number
  daysPasswordExpires: number
  passwordHistoryCount: number
  maxConcurrentSessions: number
}

/** Lower bounds enforced by the backend (Bean Validation + V191 CHECKs). */
export const SECURITY_POLICY_MIN: Record<keyof SecurityPolicyUpdateRequest, number> = {
  maxLoginAttempts: 1,
  lockoutDurationMinutes: 1,
  daysPasswordExpires: 0,
  passwordHistoryCount: 0,
  maxConcurrentSessions: 1,
}
