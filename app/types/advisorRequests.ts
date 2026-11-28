// Advisor requests: a salesperson registers itself on /quiero-ser-asesor and gets a login with the role
// ASESOR_PENDIENTE plus a PENDING advisor. An operator verifies it (/v1/admin/advisor-requests): only then does it
// get its real referral code, QR and commissions, and the role becomes ASESOR. Public submit:
// POST /v1/public/advisor-requests. Own status: GET /v1/me/advisor-request.

import type { LoginResponse } from '~/types/auth'
import type { EducationLevel } from '~/types/promoters'

export const ADVISOR_REGISTRATION_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const
export type AdvisorRegistrationStatus = typeof ADVISOR_REGISTRATION_STATUSES[number]

/** 422 `code` values of the public form that mean "you already have an account, sign in". */
export const ADVISOR_ACCOUNT_EXISTS_CODES: readonly string[] = ['advisor_request.email.taken', 'advisor_request.document.has_account']

export function advisorRegistrationStatusColor(value?: string | null): 'warning' | 'success' | 'error' | 'neutral' {
  switch (value) {
    case 'PENDING': return 'warning'
    case 'APPROVED': return 'success'
    case 'REJECTED': return 'error'
    default: return 'neutral'
  }
}

/** POST /v1/public/advisor-requests. `homepage` is a honeypot (always ''). */
export interface AdvisorRequestCreateRequest {
  firstName: string
  lastName: string
  documentType: 'V' | 'E'
  documentNumber: string
  mobile: string
  email: string
  /** Optional (8-128): without it the person signs in with the emailed access link. */
  password?: string
  cityUuid?: string
  assignedZone?: string
  educationLevel?: EducationLevel
  profession?: string
  yearsOfExperience?: number
  lastCompany?: string
  lastPosition?: string
  vehicle?: string
  note?: string
  acceptedPortalTerms: true
  homepage: ''
}

/** 201 of the public form: the advisor is PENDING and its login already works (`session` = login response). */
export interface AdvisorRequestCreatedDto {
  uuid: string
  registrationStatus: AdvisorRegistrationStatus
  email: string
  session?: LoginResponse | null
}

/** GET /v1/me/advisor-request — the applicant's own view. */
export interface MyAdvisorRequestDto {
  uuid: string
  displayName?: string | null
  email?: string | null
  registrationStatus: AdvisorRegistrationStatus
  registrationStatus_Display?: string | null
  createdAt?: string | null
  createdAt_Display?: string | null
  approvedAt?: string | null
  approvedAt_Display?: string | null
  rejectionReason?: string | null
}

/** Row of GET /v1/admin/advisor-requests. */
export interface AdvisorRequestListItemDto {
  uuid: string
  displayName: string
  documentType?: string | null
  documentNumber?: string | null
  email?: string | null
  phone?: string | null
  assignedZone?: string | null
  registrationStatus: AdvisorRegistrationStatus
  registrationStatus_Display?: string | null
  registrationNote?: string | null
  createdAt?: string | null
  createdAt_Display?: string | null
}

/** GET /v1/admin/advisor-requests/{uuid}. `referralCode` stays null until the advisor is approved. */
export interface AdvisorRequestDetailDto extends AdvisorRequestListItemDto {
  firstName?: string | null
  lastName?: string | null
  city_Uuid?: string | null
  city_Display?: string | null
  educationLevel?: EducationLevel | null
  educationLevel_Display?: string | null
  profession?: string | null
  yearsOfExperience?: number | null
  lastCompany?: string | null
  lastPosition?: string | null
  vehicle?: string | null
  referralCode?: string | null
  approvedAt?: string | null
  approvedAt_Display?: string | null
  approvedBy_Display?: string | null
  rejectedAt?: string | null
  rejectedAt_Display?: string | null
  rejectedBy_Display?: string | null
  rejectionReason?: string | null
  user?: { uuid: string, email?: string | null, status?: string | null, roles?: string[] | null } | null
}

/** POST /v1/public/advisor-requests/availability — whether an account already uses that email / cédula. */
export interface AdvisorRequestAvailabilityDto {
  emailTaken: boolean
  documentTaken: boolean
}
