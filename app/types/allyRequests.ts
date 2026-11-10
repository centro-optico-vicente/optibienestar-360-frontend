// Ally requests (hub ADR 0036): an ally that registers itself on
// /solicitar-alianza (or comes from the import template) is a real ally in
// registration_status PENDING until staff approve it. Public submit:
// POST /v1/public/ally-requests. Admin review: /v1/admin/ally-requests.

import type { AgreementType, AllyRegistrationStatus, AllySegment } from '~/types/allies'

export const ALLY_REGISTRATION_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const
/** Inbox filter: the real statuses plus IN_PROGRESS (self-registered, steps not yet sent to review; hub ADR 0037). */
export type AllyRequestStatusFilter = AllyRegistrationStatus | 'IN_PROGRESS'
export const ALLY_REGISTRATION_CHANNELS = ['SELF_SERVICE', 'IMPORT', 'ADMIN'] as const
export type AllyRegistrationChannel = typeof ALLY_REGISTRATION_CHANNELS[number]

export function allyRegistrationStatusColor(value?: string | null): 'warning' | 'success' | 'error' | 'neutral' {
  switch (value) {
    case 'PENDING': return 'warning'
    case 'APPROVED': return 'success'
    case 'REJECTED': return 'error'
    default: return 'neutral'
  }
}

/** Fiscal document types accepted for a B2B ally (RIF prefix). */
export const TAX_DOCUMENT_TYPES = ['J', 'V', 'E', 'G', 'P'] as const

/**
 * POST /v1/public/ally-requests — step 1 of the stepwise registration (hub ADR 0037 §2): only the minimum.
 * The rubro, RIF or profession, state and city come later through the own profile. `homepage` is a honeypot.
 */
export interface AllyRequestCreateRequest {
  segment: AllySegment
  name?: string
  firstName: string
  lastName: string
  documentType: 'V' | 'E'
  documentNumber: string
  mobile: string
  email: string
  /** Optional: without it the person signs in with the emailed access link. */
  password?: string
  referralCode?: string
  acceptedPortalTerms: true
  homepage: ''
}

export interface AllyRequestCreatedDto {
  allyUuid: string
  registrationStatus: AllyRegistrationStatus
  email: string
  promoterName?: string | null
}

/** Row of GET /v1/admin/ally-requests. */
export interface AllyRequestListItemDto {
  uuid: string
  allyNumber?: number | null
  name: string
  segment: AllySegment
  segment_Display?: string | null
  allyTypeNames?: string[]
  registrationStatus: AllyRegistrationStatus
  registrationStatus_Display?: string | null
  registrationChannel: AllyRegistrationChannel | string
  registrationChannel_Display?: string | null
  contactName?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  city_Display?: string | null
  /** Advisor who brought the ally in; null = none. */
  promoter_Uuid?: string | null
  promoter_Display?: string | null
  /** What the applicant said they would offer to the members. */
  registrationNote?: string | null
  createdAt: string
  createdAt_Display?: string | null
  hasUser: boolean
  hasActiveAgreement: boolean
}

export interface AllyRequestHolderDto {
  firstName: string
  lastName: string
  documentType?: string | null
  documentNumber?: string | null
  email?: string | null
  phone?: string | null
}

export interface AllyRequestAgreementDto {
  uuid: string
  agreementType: AgreementType | string
  agreementType_Display?: string | null
  startDate_Display?: string | null
  endDate_Display?: string | null
  hasSupport: boolean
}

export interface AllyRequestUserDto {
  uuid: string
  email: string
  status?: string | null
  roleNames?: string[]
}

/** GET /v1/admin/ally-requests/{uuid}. */
export interface AllyRequestDetailDto extends AllyRequestListItemDto {
  taxDocumentType?: string | null
  taxDocumentNumber?: string | null
  holder?: AllyRequestHolderDto | null
  professionNames?: string[]
  address?: string | null
  published?: boolean
  promoter_Display?: string | null
  approvedAt_Display?: string | null
  approvedBy_Display?: string | null
  rejectedAt_Display?: string | null
  rejectedBy_Display?: string | null
  rejectionReason?: string | null
  activeAgreements?: AllyRequestAgreementDto[]
  users?: AllyRequestUserDto[]
}

export interface AllyRequestApproveAgreement {
  agreementType: AgreementType
  /** yyyy-MM-dd */
  startDate: string
  endDate?: string
  autoRenew?: boolean
  noticeDays?: number
}

export interface AllyRequestApproveRequest {
  /** Required when the ally has no ACTIVE agreement yet. */
  agreement?: AllyRequestApproveAgreement
  publish: boolean
  comment?: string
}

export interface AllyRequestInviteRequest {
  documentType?: string
  documentNumber?: string
  email?: string
}

export const ALLY_IMPORT_DELIMITERS = ['auto', 'semicolon', 'comma', 'tab'] as const
export type AllyImportDelimiter = typeof ALLY_IMPORT_DELIMITERS[number]

export interface AllyImportError {
  row: number
  column?: string | null
  code?: string | null
  message: string
}

/** POST /v1/admin/ally-requests/import — same shape for the dry-run and the real import. */
export interface AllyImportResultDto {
  dryRun: boolean
  format: 'XLSX' | 'CSV' | string
  delimiter?: string | null
  totalRows: number
  validRows: number
  createdRows: number
  errors: AllyImportError[]
}
