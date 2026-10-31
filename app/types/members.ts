// Types for the Members vertical (/v1/admin/members and /v1/me/member),
// aligned with the backend integration guide (V17–V19, PRs #68–#76).
//
// Lists are paged (Page<MemberListItemDto>) with RSQL + free-text `q`. The detail
// does NOT include beneficiaries: they live in their own sub-resource
// (/v1/admin/members/{uuid}/beneficiaries, /v1/me/family); the detail only carries
// counts (activeBeneficiariesCount, slot summary). The medical record is a 1:1
// sub-resource with upsert via PUT. PUT uses PATCH semantics (only non-null fields are applied).

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

/** `Option.label` is the member's full name, `Option.code` is the document number (see `MembersService.listOptions`). */
export function memberOptionLabel(o: { label: string, code: string | null }): string {
  return o.code ? `${o.label} · ${o.code}` : o.label
}

/** Minimal reference to a catalog item embedded in the DTO. */
export interface CatalogRef {
  uuid: string
  name: string
  code?: string
}

/**
 * City reference embedded in a detail DTO — the backend sends the full CityDto,
 * whose state FK follows the FK triple (hub ADR 0014): `state_Uuid` drives the
 * state→city cascade in edit forms; `state_Code` is the short label.
 */
export interface CityRef extends CatalogRef {
  state_Uuid?: string | null
  state_Display?: string | null
  state_Code?: string | null
}

/** Family-nucleus slot a beneficiary occupies (backend V178). */
export type BeneficiarySlotType = 'BASE' | 'EXTRA'

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
  /** Family-nucleus slot (V178): BASE = included in the plan, EXTRA = paid extension. */
  slotType?: BeneficiarySlotType
  slotType_Display?: string | null
  status?: string
  createdAt?: string
}

/**
 * Row of the admin list `GET /v1/admin/members` (`Page<MemberListItemDto>`).
 *
 * Compact projection following the `_Display` convention (hub ADR 0014):
 * every foreign key travels as `<rel>_Uuid` + `<rel>_Display`, every
 * presentational scalar as the raw value + a server-resolved, locale-aware
 * `<field>_Display` sibling. Render the `_Display` string directly; keep the
 * raw value for sorting/logic. `_Display` fields are read-only.
 *
 * Compact: no `email`/name-parts/catalogs — the edit form loads the full
 * {@link MemberDto} via `GET /v1/admin/members/{uuid}`.
 */
export interface MemberListItemDto {
  uuid: string
  fullName: string
  documentType?: string | null
  documentNumber?: string | null
  phone?: string | null

  city_Uuid: string | null
  city_Display: string | null

  enrolledAt?: string | null
  enrolledAt_Display: string | null

  currentPromoter_Uuid: string | null
  currentPromoter_Display: string | null

  active: boolean
  active_Display: string | null
  status?: string | null
  status_Display: string | null

  createdAt?: string | null
  createdAt_Display: string | null
  confirmedAt?: string | null
  confirmedAt_Display: string | null
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
  /** Soft-delete/reactivation flag — distinct from `status` (a business workflow value). */
  active?: boolean
  notes?: string
  // Family-nucleus slot summary (detail only). Totals come from the active
  // membership's plan: null without one; extraSlotsTotal null = no cap.
  baseSlotsUsed?: number
  baseSlotsTotal?: number | null
  extraSlotsUsed?: number
  extraSlotsTotal?: number | null
  // Promoter attribution — null/undefined cuando el afiliado no está vinculado.
  currentPromoterUuid?: string
  currentPromoterName?: string
  createdAt?: string
  /** Fecha de confirmación (primer pago aprobado, o manual para afiliados con subsidio). null/undefined = pendiente. */
  confirmedAt?: string
  /** `false` = the person's credit is frozen: it is not applied automatically to monthly fees (hub ADR 0029). */
  creditAutoApply?: boolean
  creditHoldReason?: string | null
  creditHoldAt?: string | null
  creditHoldAt_Display?: string | null
}

/** Fila del histórico de reasignaciones de promotor de un afiliado (GET .../advisor-history). @JsonInclude(NON_NULL) en el backend. */
export interface MemberPromoterAssignmentDto {
  uuid: string
  memberUuid: string
  memberName?: string
  fromPromoterUuid?: string
  fromPromoterName?: string
  toPromoterUuid: string
  toPromoterName: string
  actorUserUuid?: string
  reason: string
  assignedAt: string
}

/** Body de POST /v1/admin/members/{uuid}/assign-advisor — exactamente uno de promoterUuid/referralCode. */
export interface AssignPromoterRequest {
  promoterUuid?: string
  referralCode?: string
  reason: string
}

/** Body de POST /v1/admin/members/advisor/bulk-assign — reasignación de cartera a un promotor (todo o nada). */
export interface BulkAssignPromoterRequest {
  memberUuids: string[]
  promoterUuid: string
  reason: string
}

/** Body de POST /v1/admin/members/advisor/portfolio-to-supervisor — sube toda la cartera al supervisor activo más cercano (o INSTITUCION). */
export interface PortfolioToSupervisorRequest {
  sourcePromoterUuid: string
  reason: string
}

/** Respuesta de POST /v1/admin/members/{uuid}/confirm. */
export interface MemberConfirmationDto {
  memberUuid: string
  confirmedAt: string
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
  active?: boolean
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

/** `GET /v1/me/member/advisor` — the caller's advisor and previous ones ("Mi asesor"). `exists=false` when they have no member record. */
export interface MyAdvisorDto {
  exists: boolean
  advisorUuid?: string | null
  advisorName?: string | null
  /** Newest first; `fromName` is absent for the first assignment. */
  history: Array<{
    fromName?: string | null
    toName: string
    assignedAt: string
    assignedAt_Display?: string | null
  }>
}

// ---- Emergency contact (V212, hub ADR 0031 §14) ----
// Only the three emergency-contact columns of the medical record, behind their own
// permissions so operators, advisors and the affiliate can fill them without seeing clinical data.

/** Backend enum `MedicalRecord.EmergencyContactRelationship` (one more value than beneficiaries: FRIEND). */
export type EmergencyContactRelationship = BeneficiaryRelationship | 'FRIEND'

export const EMERGENCY_RELATIONSHIP_OPTIONS: { value: EmergencyContactRelationship, labelKey: string }[] = [
  ...RELATIONSHIP_OPTIONS.map(o => ({ value: o.value as EmergencyContactRelationship, labelKey: o.labelKey })),
  { value: 'FRIEND', labelKey: 'members.relationships.FRIEND' },
]

/** `GET .../emergency-contact` — `exists=false` while nothing has been loaded. */
export interface EmergencyContactDto {
  name?: string | null
  phone?: string | null
  relationship?: EmergencyContactRelationship | null
  relationship_Display?: string | null
  exists: boolean
}

/** Body of `PUT .../emergency-contact`. Replace semantics: null or blank clears a field. */
export interface EmergencyContactUpdateRequest {
  name?: string | null
  phone?: string | null
  relationship?: EmergencyContactRelationship | null
}

/** Which surface to call: staff (any member), advisor (own portfolio) or the affiliate's own record. */
export type EmergencyContactScope = 'admin' | 'advisor' | 'own'

/** Editable state of `EmergencyContactFields` (empty strings while typing; trimmed to null on save). */
export interface EmergencyContactFieldsState {
  name: string
  phone: string
  relationship: EmergencyContactRelationship | undefined
}

/** Request body from the form state; blank → null so the backend clears the field. */
export function toEmergencyContactRequest(s: EmergencyContactFieldsState): EmergencyContactUpdateRequest {
  return { name: s.name.trim() || null, phone: s.phone.trim() || null, relationship: s.relationship ?? null }
}

export function hasEmergencyContact(s: EmergencyContactFieldsState): boolean {
  return Boolean(s.name.trim() || s.phone.trim() || s.relationship)
}
