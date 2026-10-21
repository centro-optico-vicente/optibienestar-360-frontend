// Affiliation requests (backend V188): the public self-affiliation
// (/afiliarse) is stored as a request that staff correct, approve or reject.
// Admin: /v1/admin/affiliation-requests. Advisor portal:
// /v1/advisors/me/affiliation-requests. Public submit:
// POST /v1/public/affiliation-requests.

export const AFFILIATION_REQUEST_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const
export type AffiliationRequestStatus = typeof AFFILIATION_REQUEST_STATUSES[number]

export function affiliationRequestStatusColor(value?: string | null): 'warning' | 'success' | 'error' | 'neutral' {
  switch (value) {
    case 'PENDING': return 'warning'
    case 'APPROVED': return 'success'
    case 'REJECTED': return 'error'
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
  status: AffiliationRequestStatus
  status_Display?: string | null
  createdAt: string
  createdAt_Display?: string | null
  reviewedAt?: string | null
  reviewedAt_Display?: string | null
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
  log: AffiliationRequestLogDto[]
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
}
