// Tipos del vertical de Aliados (/v1/admin/allies, /v1/public/allies, /v1/aliado),
// alineados con la guía de integración del backend (V11–V12, PRs #57–#67).
//
// El listado admin es paginado (Page<AllyDto>) con RSQL + `q`. El detalle incluye
// specialties[]. Sub-recursos: services, agreements (ALLY_AGREEMENT_MANAGE) y
// users (staff con membresía OWNER/STAFF/VIEWER). Los PUT usan semántica PATCH.

import type { CatalogRef } from '~/types/members'

// ---- Aliado ----

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

/** PUT con semántica PATCH; `specialtyUuids` REEMPLAZA el conjunto si se envía. */
export interface UpdateAllyRequest extends Partial<CreateAllyRequest> {
  status?: string
}

// ---- Servicios del aliado ----

/** Estado de revisión del servicio (las propuestas nacen en PROPOSED). */
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

/** PUT con semántica PATCH; `reviewStatus` NO se cambia por esta vía. */
export interface UpdateAllyServiceRequest extends Partial<CreateAllyServiceRequest> {
  published?: boolean
  status?: string
}

/** Body de POST /v1/aliado/services (propuesta hecha por el propio aliado). */
export interface ProposeAllyServiceRequest extends CreateAllyServiceRequest {
  allyUuid: string
}

// ---- Acuerdos ----

export type AgreementType = 'COMMERCIAL' | 'MEDICAL' | 'EXCLUSIVITY' | 'SUPPLY'

export const AGREEMENT_TYPE_OPTIONS: { label: string, value: AgreementType }[] = [
  { label: 'Comercial', value: 'COMMERCIAL' },
  { label: 'Médico', value: 'MEDICAL' },
  { label: 'Exclusividad', value: 'EXCLUSIVITY' },
  { label: 'Suministro', value: 'SUPPLY' },
]

export function agreementTypeLabel(value?: string | null): string {
  return AGREEMENT_TYPE_OPTIONS.find(o => o.value === value)?.label ?? value ?? '—'
}

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

// ---- Staff del aliado ----

export type AllyRole = 'OWNER' | 'STAFF' | 'VIEWER'

export const ALLY_ROLE_OPTIONS: { label: string, value: AllyRole }[] = [
  { label: 'Propietario', value: 'OWNER' },
  { label: 'Personal', value: 'STAFF' },
  { label: 'Visor', value: 'VIEWER' },
]

export function allyRoleLabel(value?: string | null): string {
  return ALLY_ROLE_OPTIONS.find(o => o.value === value)?.label ?? value ?? '—'
}

export interface AllyUserDto {
  uuid: string
  user?: {
    uuid: string
    email?: string
    fullName?: string
  }
  allyRole: AllyRole | string
  primary?: boolean
  joinedAt?: string
  status?: string
}

export interface AssignAllyUserRequest {
  userUuid: string
  allyRole: AllyRole
  /** Solo válido con allyRole=OWNER y si no hay otro OWNER primary activo. */
  primary?: boolean
  joinedAt?: string
}

export interface UpdateAllyUserRequest {
  allyRole?: AllyRole
  primary?: boolean
  joinedAt?: string
  status?: string
}

// ---- Directorio público ----

/** DTO sanitizado del directorio público (solo aliados PUBLISHED + ACTIVE). */
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
