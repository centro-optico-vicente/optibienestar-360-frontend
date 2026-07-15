// Types for the Partners vertical (/v1/admin/allies, /v1/public/allies, /v1/aliado),
// aligned with the backend integration guide (V11–V12, PRs #57–#67).
//
// The admin list is paged (Page<AllyDto>) with RSQL + `q`. The detail includes
// specialties[]. Sub-resources: services, agreements (ALLY_AGREEMENT_MANAGE) and
// users (staff with OWNER/STAFF/VIEWER membership). PUT uses PATCH semantics.

import type { CatalogRef } from '~/types/members'

// ---- Partner ----

export interface AllyDto {
  uuid: string
  name: string
  allyType?: CatalogRef
  taxDocumentType?: string
  taxDocumentNumber?: string
  email?: string
  phone?: string
  website?: string
  address?: string
  city?: CatalogRef
  description?: string
  joinedAt?: string
  published?: boolean
  publishedAt?: string | null
  status?: string
  specialties?: CatalogRef[]
  services?: AllyServiceDto[]
  createdAt?: string
}

export interface CreateAllyRequest {
  name: string
  allyTypeUuid: string
  taxDocumentType?: string
  taxDocumentNumber?: string
  email?: string
  phone?: string
  website?: string
  address?: string
  cityUuid?: string
  description?: string
  joinedAt?: string
  published?: boolean
  specialtyUuids?: string[]
}

/** PUT with PATCH semantics; `specialtyUuids` REPLACES the set when sent. */
export interface UpdateAllyRequest extends Partial<CreateAllyRequest> {
  status?: string
}

// ---- Partner services ----

/** Service review status (proposals are born in PROPOSED). */
export type ServiceReviewStatus = 'PROPOSED' | 'APPROVED' | 'REJECTED'

export interface AllyServiceDto {
  uuid: string
  name: string
  description?: string
  serviceCategory?: CatalogRef
  priceUsd?: string
  discountPct?: string
  requiresAppointment?: boolean
  reviewStatus?: ServiceReviewStatus | string
  published?: boolean
  status?: string
  createdAt?: string
}

export interface CreateAllyServiceRequest {
  serviceCategoryUuid: string
  name: string
  description?: string
  priceUsd?: string
  discountPct?: string
  requiresAppointment?: boolean
}

/** PUT with PATCH semantics; `reviewStatus` is NOT changed this way. */
export interface UpdateAllyServiceRequest extends Partial<CreateAllyServiceRequest> {
  published?: boolean
  status?: string
}

/** Body of POST /v1/aliado/services (proposal made by the partner itself). */
export interface ProposeAllyServiceRequest extends CreateAllyServiceRequest {
  allyUuid: string
}

// ---- Agreements ----
// `label` is the Spanish fallback; `labelKey` resolves to i18n at the usage point.

export type AgreementType = 'COMMERCIAL' | 'MEDICAL' | 'EXCLUSIVITY' | 'SUPPLY'

export const AGREEMENT_TYPE_OPTIONS: { label: string, value: AgreementType, labelKey: string }[] = [
  { label: 'Comercial', value: 'COMMERCIAL', labelKey: 'allies.agreements.types.COMMERCIAL' },
  { label: 'Médico', value: 'MEDICAL', labelKey: 'allies.agreements.types.MEDICAL' },
  { label: 'Exclusividad', value: 'EXCLUSIVITY', labelKey: 'allies.agreements.types.EXCLUSIVITY' },
  { label: 'Suministro', value: 'SUPPLY', labelKey: 'allies.agreements.types.SUPPLY' },
]

export interface AllyAgreementDto {
  uuid: string
  agreementType: AgreementType | string
  startDate?: string
  endDate?: string
  terms?: string
  signedPdfUrl?: string
  status?: string
  createdAt?: string
}

export interface CreateAllyAgreementRequest {
  agreementType: AgreementType
  startDate?: string
  endDate?: string
  terms?: string
  signedPdfUrl?: string
}

export interface UpdateAllyAgreementRequest extends Partial<CreateAllyAgreementRequest> {
  status?: string
}

// ---- Partner staff ----
// `label` is the Spanish fallback; `labelKey` resolves to i18n at the usage point.

export type AllyRole = 'OWNER' | 'STAFF' | 'VIEWER'

export const ALLY_ROLE_OPTIONS: { label: string, value: AllyRole, labelKey: string }[] = [
  { label: 'Propietario', value: 'OWNER', labelKey: 'allies.staff.roles.OWNER' },
  { label: 'Personal', value: 'STAFF', labelKey: 'allies.staff.roles.STAFF' },
  { label: 'Visor', value: 'VIEWER', labelKey: 'allies.staff.roles.VIEWER' },
]

/**
 * A staff membership under /v1/admin/allies/{allyUuid}/users.
 *
 * The backend flattens User + Person into `userUuid` / `userEmail` /
 * `userFullName` (see AllyUserDto + AllyMapper.toAllyUserDto) so the table
 * renders without round-trips. It does NOT send a nested `user` object.
 *
 * `uuid` is the membership row's, not the user's — `AssignAllyUserRequest.userUuid`
 * and the edit form both want `userUuid`.
 */
export interface AllyUserDto {
  uuid: string
  allyUuid?: string

  // User + Person, flattened by the backend mapper for display.
  userUuid: string
  userEmail?: string
  userFullName?: string

  allyRole: AllyRole | string
  primary?: boolean
  joinedAt?: string

  active?: boolean
  status?: string
  createdAt?: string
  updatedAt?: string
}

export interface AssignAllyUserRequest {
  userUuid: string
  allyRole: AllyRole
  /** Only valid with allyRole=OWNER and if there's no other active primary OWNER. */
  primary?: boolean
  joinedAt?: string
}

export interface UpdateAllyUserRequest {
  allyRole?: AllyRole
  primary?: boolean
  joinedAt?: string
  status?: string
}

// ---- Partner self-service ----

/**
 * Response item of GET /v1/me/allies — "which allies do I operate on?".
 *
 * `uuid` is the ALLY's uuid (not the staff-membership pivot's): it is what
 * POST /v1/ally/benefit-usage and POST /v1/aliado/services expect as
 * `allyUuid`, and reading it straight off this record is the whole point of
 * the endpoint. `allyRole` is the caller's authority inside this ally, so the
 * portal can hide write actions from a VIEWER instead of letting them 403 at
 * the counter. `joinedAt` is when the CALLER joined the ally.
 *
 * The backend returns primary membership first, then alphabetical — the portal
 * preselects the head of the list, so the order is contract, not cosmetic.
 */
export interface MyAllyDto {
  uuid: string
  name: string
  allyTypeUuid?: string | null
  allyTypeName?: string | null
  logoUrl?: string | null
  phone?: string | null
  allyRole: AllyRole | string
  primary: boolean
  joinedAt?: string | null
}

/** Roles allowed to write at the counter (validate + register usage). VIEWER is read-only. */
export function canOperateAtCounter(role?: AllyRole | string | null): boolean {
  return role === 'OWNER' || role === 'STAFF'
}

// ---- Public directory ----

/** Sanitized DTO of the public directory (only PUBLISHED + ACTIVE partners). */
export interface PublicAllyDto {
  uuid: string
  name: string
  allyType?: CatalogRef
  email?: string
  phone?: string
  website?: string
  address?: string
  city?: CatalogRef
  description?: string
  specialties?: CatalogRef[]
  services?: AllyServiceDto[]
}
