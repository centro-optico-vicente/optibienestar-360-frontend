// Types for the Partners vertical (/v1/admin/allies, /v1/public/allies, /v1/aliado),
// aligned with the backend integration guide (V11–V12, PRs #57–#67).
//
// The admin list is paged (Page<AllyDto>) with RSQL + `q`. The detail includes
// specialties[]. Sub-resources: services, agreements (ALLY_AGREEMENT_VIEW_ALL/
// CREATE/UPDATE/DELETE) and users (staff with OWNER/STAFF/VIEWER membership,
// ALLY_USER_VIEW_ALL/CREATE/UPDATE/DELETE). PUT uses PATCH semantics.

import type { CatalogRef, CityRef } from '~/types/members'

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
  whatsapp?: string
  instagram?: string
  facebook?: string
  address?: string
  city?: CityRef
  googleMapsUrl?: string
  description?: string
  joinedAt?: string
  published?: boolean
  publishedAt?: string | null
  status?: string
  /** Soft-delete/reactivation flag — distinct from `status` (a business workflow value). */
  active?: boolean
  specialties?: CatalogRef[]
  services?: AllyServiceDto[]
  createdAt?: string
}

/**
 * Row of the admin list `GET /v1/admin/allies` (`Page<AllyListItemDto>`).
 *
 * Pilot for the `_Display` convention (hub ADR 0014): every foreign key
 * travels as the pair `<rel>_Uuid` + `<rel>_Display`, and every
 * presentational scalar as the raw, typed value + a server-resolved,
 * locale-aware `<field>_Display` sibling. Render the `_Display` string
 * directly (`row.allyType_Display ?? t('common.empty')`); keep the raw value
 * for sorting and logic. `_Display` fields are read-only — never sent back.
 *
 * Compact projection: omits email, tax ID, website, specialties… The edit
 * form loads the full {@link AllyDto} via `GET /v1/admin/allies/{uuid}`.
 */
export interface AllyListItemDto {
  uuid: string
  name: string

  allyType_Uuid: string | null
  allyType_Display: string | null
  city_Uuid: string | null
  city_Display: string | null

  taxDocumentType?: string | null
  taxDocumentNumber?: string | null

  logoUrl?: string | null
  phone?: string | null

  published: boolean
  published_Display: string | null
  publishedAt?: string | null
  publishedAt_Display: string | null

  active: boolean
  active_Display: string | null
  status?: string | null
  status_Display: string | null

  createdAt?: string | null
  createdAt_Display: string | null
}

export interface CreateAllyRequest {
  name: string
  allyTypeUuid: string
  taxDocumentType?: string
  taxDocumentNumber?: string
  email?: string
  phone?: string
  website?: string
  whatsapp?: string
  instagram?: string
  facebook?: string
  address?: string
  cityUuid?: string
  googleMapsUrl?: string
  description?: string
  joinedAt?: string
  published?: boolean
  specialtyUuids?: string[]
}

/** PUT with PATCH semantics; `specialtyUuids` REPLACES the set when sent. */
export interface UpdateAllyRequest extends Partial<CreateAllyRequest> {
  status?: string
  active?: boolean
}

// ---- Partner services ----

/** Service review status (proposals are born in PROPOSED). */
export type ServiceReviewStatus = 'PROPOSED' | 'APPROVED' | 'REJECTED'

/** Scalars carry a localized `_Display` sibling (hub ADR 0014) — render it directly. */
export interface AllyServiceDto {
  uuid: string
  name: string
  description?: string
  serviceCategory?: CatalogRef
  priceUsd?: string
  discountPct?: string
  requiresAppointment?: boolean
  reviewStatus?: ServiceReviewStatus | string
  reviewStatus_Display?: string | null
  published?: boolean
  published_Display?: string | null
  active?: boolean
  active_Display?: string | null
  status?: string
  status_Display?: string | null
  createdAt?: string
  createdAt_Display?: string | null
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

/** Scalars carry a localized `_Display` sibling (hub ADR 0014) — render it directly. */
export interface AllyAgreementDto {
  uuid: string
  agreementType: AgreementType | string
  agreementType_Display?: string | null
  startDate?: string
  startDate_Display?: string | null
  endDate?: string
  endDate_Display?: string | null
  terms?: string
  signedPdfUrl?: string
  active?: boolean
  active_Display?: string | null
  status?: string
  status_Display?: string | null
  createdAt?: string
  createdAt_Display?: string | null
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
  allyType_Uuid?: string | null
  allyType_Display?: string | null
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

/**
 * Response item of GET /v1/admin/users/{userUuid}/allies — the inverse of
 * `AllyUserDto`: "which allies does this user belong to?", from the user's side.
 * Gated by ALLY_VIEW_ALL. Always 200, `[]` if the user has no ally memberships.
 */
export interface UserAllyDto {
  allyUuid: string
  allyName: string
  allyRole: AllyRole | string
  primary?: boolean
  joinedAt?: string
  active?: boolean
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
  whatsapp?: string
  instagram?: string
  facebook?: string
  address?: string
  city?: CatalogRef
  googleMapsUrl?: string
  description?: string
  specialties?: CatalogRef[]
  services?: AllyServiceDto[]
}
