/**
 * Patient medical history for medical allies (backend V215, hub ADR 0032).
 *
 * A QR scan at the counter opens a doctor–patient link; the doctor (holder of a
 * B2P ally of the medical area) or an OPERADOR_MEDICO of that ally then reads the
 * patient's medical history from any of the doctor's sites. Every read is
 * logged; the member sees the links and the reads and may revoke a link.
 */

/** Whether to offer the medical history at an ally: system switch + caller eligibility. */
export interface PatientAccessEligibilityDto {
  enabled: boolean
  eligible: boolean
}

export type PatientLinkStatus = 'ACTIVE' | 'REVOKED'

export interface AllyPatientLinkDto {
  uuid: string
  memberUuid: string
  memberFullName?: string | null
  doctorPersonUuid: string
  doctorFullName?: string | null
  /** The site (ally) where the link was opened. */
  allyUuid: string
  allyName?: string | null
  status: PatientLinkStatus
  status_Display?: string | null
  createdAt: string
  createdAt_Display?: string | null
  revokedAt?: string | null
  revokedAt_Display?: string | null
}

export interface MedicalRecordAccessDto {
  uuid: string
  doctorFullName?: string | null
  allyUuid: string
  allyName?: string | null
  accessedAt: string
  accessedAt_Display?: string | null
}

/** GET /v1/me/medical-record/access: who can read my history (links) and who read it. */
export interface MyMedicalRecordAccessDto {
  links: AllyPatientLinkDto[]
  reads: MedicalRecordAccessDto[]
}
