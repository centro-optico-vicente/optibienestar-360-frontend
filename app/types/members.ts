// Tipos del vertical de Miembros/Afiliados (/v1/admin/members y /v1/me/member),
// alineados con la guía de integración del backend (V17–V19, PRs #68–#76).
//
// Los listados son paginados (Page<MemberListItemDto>) con RSQL + `q` free-text.
// El detalle incluye beneficiaries[]. El histórico médico es un sub-recurso 1:1
// con upsert vía PUT. Los PUT usan semántica PATCH (solo campos no-null).

/** Parentesco del beneficiario respecto al titular. */
export type BeneficiaryRelationship = 'CHILD' | 'SPOUSE' | 'PARENT' | 'SIBLING' | 'OTHER'

export const RELATIONSHIP_OPTIONS: { label: string, value: BeneficiaryRelationship }[] = [
  { label: 'Hijo/a', value: 'CHILD' },
  { label: 'Cónyuge', value: 'SPOUSE' },
  { label: 'Padre/Madre', value: 'PARENT' },
  { label: 'Hermano/a', value: 'SIBLING' },
  { label: 'Otro', value: 'OTHER' },
]

export function relationshipLabel(value?: string | null): string {
  return RELATIONSHIP_OPTIONS.find(o => o.value === value)?.label ?? value ?? '—'
}

/** Referencia mínima a un ítem de catálogo embebido en el DTO. */
export interface CatalogRef {
  uuid: string
  name: string
  code?: string
}

export interface BeneficiaryDto {
  uuid: string
  firstName: string
  middleName?: string
  lastName: string
  secondLastName?: string
  fullName?: string
  documentType?: string
  documentNumber?: string
  birthDate?: string
  relationship: BeneficiaryRelationship
  extraInscriptionPaid?: boolean
  status?: string
  createdAt?: string
}

export interface MemberDto {
  uuid: string
  firstName: string
  middleName?: string
  lastName: string
  secondLastName?: string
  fullName?: string
  documentType?: string
  documentNumber?: string
  birthDate?: string
  gender?: CatalogRef
  maritalStatus?: CatalogRef
  occupation?: CatalogRef
  city?: CatalogRef
  phone?: string
  email?: string
  address?: string
  enrolledAt?: string
  status?: string
  notes?: string
  beneficiaries?: BeneficiaryDto[]
  createdAt?: string
}

export interface CreateMemberRequest {
  firstName: string
  middleName?: string
  lastName: string
  secondLastName?: string
  documentType: string
  documentNumber: string
  birthDate: string
  genderUuid?: string
  maritalStatusUuid?: string
  occupationUuid?: string
  cityUuid?: string
  phone?: string
  email?: string
  address?: string
  enrolledAt?: string
  notes?: string
}

/** PUT con semántica PATCH: solo se aplican los campos enviados. */
export interface UpdateMemberRequest extends Partial<CreateMemberRequest> {
  status?: string
}

export interface CreateBeneficiaryRequest {
  firstName: string
  middleName?: string
  lastName: string
  secondLastName?: string
  documentType?: string
  documentNumber?: string
  birthDate?: string
  relationship: BeneficiaryRelationship
  extraInscriptionPaid?: boolean
}

export interface UpdateBeneficiaryRequest extends Partial<CreateBeneficiaryRequest> {
  status?: string
}

export interface MedicalRecordDto {
  uuid?: string
  bloodType?: string
  allergies?: string
  chronicConditions?: string
  currentMedications?: string
  emergencyContactName?: string
  emergencyContactPhone?: string
  emergencyContactRelationship?: string
  notes?: string
  updatedAt?: string
}

/** Body de PUT /medical-record (upsert con semántica PATCH). */
export type UpsertMedicalRecordRequest = Omit<MedicalRecordDto, 'uuid' | 'updatedAt'>
