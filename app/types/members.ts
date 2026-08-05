// Types for the Members vertical (/v1/admin/members and /v1/me/member),
// aligned with the backend integration guide (V17–V19, PRs #68–#76).
//
// Lists are paged (Page<MemberListItemDto>) with RSQL + free-text `q`. The detail
// includes beneficiaries[]. The medical record is a 1:1 sub-resource with upsert via
// PUT. PUT uses PATCH semantics (only non-null fields are applied).

/** Beneficiary relationship to the holder. */
export type BeneficiaryRelationship = 'CHILD' | 'SPOUSE' | 'PARENT' | 'SIBLING' | 'OTHER'

// `label` is the Spanish fallback; `labelKey` resolves to i18n at the usage point.
export const RELATIONSHIP_OPTIONS: { label: string, value: BeneficiaryRelationship, labelKey: string }[] = [
  { label: 'Hijo/a', value: 'CHILD', labelKey: 'members.relationships.CHILD' },
  { label: 'Cónyuge', value: 'SPOUSE', labelKey: 'members.relationships.SPOUSE' },
  { label: 'Padre/Madre', value: 'PARENT', labelKey: 'members.relationships.PARENT' },
  { label: 'Hermano/a', value: 'SIBLING', labelKey: 'members.relationships.SIBLING' },
  { label: 'Otro', value: 'OTHER', labelKey: 'members.relationships.OTHER' },
]

/** Minimal reference to a catalog item embedded in the DTO. */
export interface CatalogRef {
  uuid: string
  name: string
  code?: string
}

/** City reference embedded in a DTO — the backend sends the full CityDto, incl. its state FK. */
export interface CityRef extends CatalogRef {
  stateUuid?: string
  stateCode?: string
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
  /** Solo presente en el detalle (GET /v1/admin/members/{uuid}), no en el listado. */
  personUuid?: string
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
  city?: CityRef
  // Enrollment form data (V29)
  birthplace?: string
  numberOfChildren?: number
  spouseName?: string
  phone?: string
  landlinePhone?: string
  email?: string
  address?: string
  // Holder's employment info (V29)
  employerName?: string
  jobPosition?: string
  employerAddress?: string
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
  // Enrollment form data (V29)
  birthplace?: string
  numberOfChildren?: number
  spouseName?: string
  phone?: string
  landlinePhone?: string
  email?: string
  address?: string
  // Holder's employment info (V29)
  employerName?: string
  jobPosition?: string
  employerAddress?: string
  enrolledAt?: string
  notes?: string
}

/** PUT with PATCH semantics: only the sent fields are applied. */
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

/** Body of PUT /medical-record (upsert with PATCH semantics). */
export type UpsertMedicalRecordRequest = Omit<MedicalRecordDto, 'uuid' | 'updatedAt'>
