import type { LoginResponse } from '~/types/auth'

// Affiliation requests (backend V188): the public self-affiliation
// (/afiliarse) is stored as a request that staff correct, approve or reject.
// Admin: /v1/admin/affiliation-requests. Advisor portal:
// /v1/advisors/me/affiliation-requests. Public submit:
// POST /v1/public/affiliation-requests.

// DRAFT = self-registration in progress (hub ADR 0037): the staff list hides it unless filtered with
// `status=IN_PROGRESS` (alias of DRAFT; DRAFT is also accepted).
export const AFFILIATION_REQUEST_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'DRAFT', 'IN_PROGRESS'] as const
export type AffiliationRequestStatus = typeof AFFILIATION_REQUEST_STATUSES[number]

export function affiliationRequestStatusColor(value?: string | null): 'warning' | 'success' | 'error' | 'info' | 'neutral' {
  switch (value) {
    case 'PENDING': return 'warning'
    case 'APPROVED': return 'success'
    case 'REJECTED': return 'error'
    case 'DRAFT':
    case 'IN_PROGRESS': return 'info'
    default: return 'neutral'
  }
}

/** Row of the admin list and of the advisor's own list. */
export interface AffiliationRequestListItemDto {
  uuid: string
  fullName: string
  documentType: string
  documentNumber: string
  email: string
  phone?: string | null
  plan_Uuid?: string | null
  plan_Display?: string | null
  advisor_Uuid?: string | null
  advisor_Display?: string | null
  /** `SELF_SERVICE` (public form / registration wizard) or `ASSISTED` (filled by the advisor). */
  channel?: string | null
  channel_Display?: string | null
  status: AffiliationRequestStatus
  status_Display?: string | null
  createdAt: string
  createdAt_Display?: string | null
  reviewedAt?: string | null
  reviewedAt_Display?: string | null
  /** "Keep record" (backend V237): the abandoned-draft cleanup skips this draft. */
  retainFromCleanup?: boolean
  retainNote?: string | null
  retainedAt?: string | null
  retainedAt_Display?: string | null
}

/** One edited field of an UPDATED log row. `field` is the request field name. */
export interface AffiliationRequestFieldChange {
  field: string
  from?: string | null
  to?: string | null
}

export interface AffiliationRequestLogDto {
  action: 'CREATED' | 'UPDATED' | 'APPROVED' | 'REJECTED'
  action_Display?: string | null
  fromStatus?: AffiliationRequestStatus | null
  toStatus?: AffiliationRequestStatus | null
  toStatus_Display?: string | null
  changes?: AffiliationRequestFieldChange[] | null
  comment?: string | null
  actor_Uuid?: string | null
  actor_Display?: string | null
  actionAt: string
  actionAt_Display?: string | null
}

export interface AffiliationRequestDetailDto {
  uuid: string
  firstName: string
  lastName: string
  fullName: string
  documentType: string
  documentNumber: string
  birthDate: string
  birthDate_Display?: string | null
  email: string
  phone?: string | null
  locale?: string | null
  plan_Uuid?: string | null
  plan_Display?: string | null
  advisor_Uuid?: string | null
  advisor_Display?: string | null
  referralCode?: string | null
  /** Override of the first expiry set by the advisor / reviewer (hub ADR 0034); null = inherit from the plan. */
  expiresAtOverride?: string | null
  expiresAtOverride_Display?: string | null
  /** Override of the plan's re-inscription flag; null = inherit. */
  reinscriptionRequiredOverride?: boolean | null
  termsVersion_Uuid?: string | null
  termsVersion_Display?: string | null
  /** Contract exactly as the applicant accepted it (markdown). */
  termsRenderedContent: string
  termsContentSha256: string
  termsAcceptedAt: string
  termsAcceptedAt_Display?: string | null
  ipAddress?: string | null
  userAgent?: string | null
  /** The data as it stands now renders a different contract: the member re-accepts it at first login. */
  termsChanged: boolean
  status: AffiliationRequestStatus
  status_Display?: string | null
  reviewedBy_Uuid?: string | null
  reviewedBy_Display?: string | null
  reviewedAt?: string | null
  reviewedAt_Display?: string | null
  rejectionReason?: string | null
  user_Uuid?: string | null
  member_Uuid?: string | null
  member_Display?: string | null
  membership_Uuid?: string | null
  createdAt: string
  createdAt_Display?: string | null
  /** Inscription payment the applicant reported with the request; null when none. */
  payment?: AffiliationRequestPaymentDto | null
  log: AffiliationRequestLogDto[]
}

/**
 * Inscription payment reported on /afiliarse. The amount is the plan's
 * inscriptionFee (charged server-side, never sent by the applicant). The proof
 * is fetched through GET /v1/admin/affiliation-requests/{uuid}/payment-support.
 */
export interface AffiliationRequestPaymentDto {
  paymentMethodName?: string | null
  bankName?: string | null
  referenceNumber?: string | null
  amount?: number | string | null
  amount_Display?: string | null
  currencyCode?: string | null
  paymentDate?: string | null
  paymentDate_Display?: string | null
  identification?: string | null
  phone?: string | null
  email?: string | null
  bankAccountIdentifier?: string | null
  supportFileName?: string | null
  hasSupport: boolean
  paymentUuid?: string | null
}

/** Optional `payment` of the public POST /v1/public/affiliation-requests. */
export interface AffiliationRequestPaymentRequest {
  paymentMethodUuid: string
  bankUuid?: string
  identification?: string
  bankAccountType?: string
  bankAccountCode?: string
  bankAccountIdentifier?: string
  phone?: string
  email?: string
  referenceNumber?: string
  /** ISO instant, not in the future. */
  paymentDate: string
}

export interface AffiliationRequestUpdateRequest {
  firstName: string
  lastName: string
  documentType: string
  documentNumber: string
  birthDate: string
  email: string
  phone?: string
  planUuid: string
  comment?: string
  /** Full replace: always send the current values, an omitted one clears the override (hub ADR 0034). */
  expiresAt?: string | null
  reinscriptionRequired?: boolean | null
}

/**
 * Body of POST /v1/me/advisor/affiliation-requests (assisted affiliation). The term overrides are
 * optional: `expiresAt` (future date) and `reinscriptionRequired`; omitted = the plan decides.
 */
export interface AssistedAffiliationOverrides {
  expiresAt?: string
  reinscriptionRequired?: boolean
}

// ---- Stepwise self-registration (hub ADR 0037 §2, plan phase 3) ----

/** Code of the 422 answered when the national ID or the email already has an account. */
export const ACCOUNT_EXISTS_CODE = 'ACCOUNT_EXISTS'

/** The same "already has an account" answer of the public ally form (backend `ally_request.*` codes). */
export const ALLY_ACCOUNT_EXISTS_CODES: readonly string[] = ['ally_request.email.taken', 'ally_request.document.has_account']

/** Steps of PATCH /v1/me/affiliation-request/{step}. */
export const MEMBER_REGISTRATION_STEPS = ['personal', 'plan', 'payment', 'family'] as const
export type MemberRegistrationStep = typeof MEMBER_REGISTRATION_STEPS[number]

/** Step 1, public: POST /v1/public/affiliation-requests. `homepage` is a honeypot (always ''). */
export interface AffiliationRequestStartRequest {
  firstName: string
  lastName: string
  documentType: string
  documentNumber: string
  phone: string
  email: string
  /** Optional: without it the person signs in with the emailed access link. */
  password?: string
  referralCode?: string
  acceptedPortalTerms: true
  homepage: ''
}

/** One relative of the `family` step (backend BeneficiaryCreateRequest: national ID is required). */
export interface MyAffiliationFamilyMember {
  firstName: string
  lastName: string
  documentType: string
  documentNumber: string
  /** yyyy-MM-dd */
  birthDate?: string
  relationship: string
  phone?: string
  email?: string
}

/** GET /v1/me/affiliation-request and the answer of every step (backend AffiliationRegistrationDto). */
/** Body of the "keep record" calls (PUT .../retain); `note` is optional (max 200) and ignored when releasing. */
export interface DraftRetentionRequest {
  retain: boolean
  note?: string
}

/** Answer of the "keep record" calls. */
export interface DraftRetentionDto {
  uuid: string
  retainFromCleanup: boolean
  retainNote?: string | null
  retainedAt?: string | null
  retainedAt_Display?: string | null
}

export interface MyAffiliationRequestDto {
  uuid: string
  status: AffiliationRequestStatus
  status_Display?: string | null
  firstName: string
  lastName: string
  documentType: string
  documentNumber: string
  email: string
  phone?: string | null
  /** yyyy-MM-dd */
  birthDate?: string | null
  plan_Uuid?: string | null
  plan_Display?: string | null
  termsVersionUuid?: string | null
  /** The contract was accepted (for `termsVersionUuid`); a change in the contract data voids it server-side. */
  contractAccepted?: boolean
  payment?: AffiliationRequestPaymentDto | null
  family?: MyAffiliationFamilyMember[]
  advisorName?: string | null
  referralCode?: string | null
  submittedAt?: string | null
  rejectionReason?: string | null
  /** "Keep record" (backend V237). */
  retainFromCleanup?: boolean
  retainNote?: string | null
  retainedAt?: string | null
}

/**
 * Body of PATCH /v1/me/affiliation-request/{personal|plan|payment|family}: one body for every step, all fields
 * optional (the step decides which ones it reads). With a proof it goes as multipart (`request` + `support`).
 */
export interface MyAffiliationStepRequest {
  firstName?: string
  lastName?: string
  birthDate?: string
  phone?: string
  /** Only read by an advisor's assisted draft without login (to fix a typo); the person's own flow ignores them. */
  documentType?: string
  documentNumber?: string
  email?: string
  planUuid?: string
  termsVersionUuid?: string
  contractAccepted?: boolean
  payment?: AffiliationRequestPaymentRequest
  family?: MyAffiliationFamilyMember[]
}

/** Step 1 answer: the request plus the login session of the account just created. */
export interface RegistrationStartResponse {
  uuid?: string
  status?: string
  email?: string
  advisorName?: string
  session?: LoginResponse | null
}

/**
 * POST /v1/advisors/me/affiliation-requests (assisted affiliation, backend V188): the advisor fills the
 * person's data on their own device. `contractAccepted` confirms the person read the contract shown on screen.
 */
export interface AssistedAffiliationRequest extends AssistedAffiliationOverrides {
  firstName: string
  lastName: string
  documentType: string
  documentNumber: string
  /** yyyy-MM-dd */
  birthDate: string
  email: string
  phone?: string
  password?: string
  planUuid: string
  termsVersionUuid: string
  contractAccepted: true
}

/**
 * POST /v1/me/advisor/affiliation-requests/drafts (backend AssistedAffiliationDraftStartRequest): who the person
 * is. Birth date, plan + contract, payment and family follow with PATCH /drafts/{uuid}/{step}.
 */
export interface AssistedDraftStartRequest {
  firstName: string
  lastName: string
  documentType: string
  documentNumber: string
  email: string
  phone?: string
}
