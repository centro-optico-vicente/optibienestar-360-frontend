// Onboarding policy (hub ADR 0037 §1), aligned with the backend
// OnboardingPolicyDto / OnboardingPolicyUpdateRequest (GET/PUT
// /v1/admin/onboarding-policy) and PublicOnboardingPolicyDto
// (GET /v1/public/onboarding-policy). Enum labels are translated here
// (`onboardingPolicy.modes.*`), so there are no `_Display` companions.

export const MEMBER_APPROVAL_MODES = ['MANUAL', 'AUTO_IF_PAYMENT_REPORTED', 'AUTO_ON_SUBMIT'] as const
export const MEMBER_ACTIVATION_MODES = ['ON_PAYMENT_APPROVED', 'ON_PAYMENT_REPORTED', 'IMMEDIATE'] as const
export const ALLY_APPROVAL_MODES = ['MANUAL_WITH_AGREEMENT', 'AUTO_ON_SUBMIT'] as const
export const ALLY_PUBLISH_MODES = ['MANUAL', 'ON_APPROVAL'] as const

export type MemberApprovalMode = typeof MEMBER_APPROVAL_MODES[number]
export type MemberActivationMode = typeof MEMBER_ACTIVATION_MODES[number]
export type AllyApprovalMode = typeof ALLY_APPROVAL_MODES[number]
export type AllyPublishMode = typeof ALLY_PUBLISH_MODES[number]

export interface OnboardingPolicyDto {
  /** `null` only when the backend has no row and returns its defaults (today's behavior). */
  uuid: string | null
  allowMemberSelfRegistration: boolean
  allowAllySelfRegistration: boolean
  memberApprovalMode: MemberApprovalMode
  memberActivationMode: MemberActivationMode
  allyApprovalMode: AllyApprovalMode
  allyPublishMode: AllyPublishMode
  /** Days without changes before an abandoned affiliation draft is discarded (backend V237, 1..365; admin-only). */
  memberDraftRetentionDays: number
  /** Same for an ally draft (long negotiations). A record marked "keep record" is never discarded. */
  allyDraftRetentionDays: number
}

/**
 * Body of PUT /v1/admin/onboarding-policy — full replacement. While a
 * self-registration is off its modes must be sent unchanged (422 otherwise).
 */
export type OnboardingPolicyUpdateRequest = Omit<OnboardingPolicyDto, 'uuid'>

export interface PublicOnboardingPolicyDto {
  memberSelfRegistrationEnabled: boolean
  allySelfRegistrationEnabled: boolean
  memberApprovalMode: MemberApprovalMode
  memberActivationMode: MemberActivationMode
  allyApprovalMode: AllyApprovalMode
  allyPublishMode: AllyPublishMode
}

/** `code` of the 403 a public self-registration endpoint returns while it is switched off. */
export const SELF_REGISTRATION_DISABLED_CODE = 'SELF_REGISTRATION_DISABLED'

/** Which self-registration a closed-notice on the login page refers to (`?registration=`). */
export type SelfRegistrationKind = 'member' | 'ally'
