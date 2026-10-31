// Professional licenses of a B2P ally's holder person (V213, hub ADR 0031 §5).
// The license belongs to the PERSON: every practice site of the same
// professional (one ally per site) shows the same licenses.

export type LicenseVerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED'

export interface AllyLicenseDto {
  uuid: string
  personUuid: string
  licensingBody_Uuid?: string | null
  licensingBody_Display?: string | null
  licensingBody_Code?: string | null
  licenseNumber: string
  verificationStatus: LicenseVerificationStatus
  verificationStatus_Display?: string | null
  verifiedBy?: string | null
  verifiedAt?: string | null
  verifiedAt_Display?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

export interface AllyLicenseRequest {
  licensingBodyUuid: string
  licenseNumber: string
}

/** Public directory: only VERIFIED licenses, body + number. */
export interface PublicAllyLicenseDto {
  licensingBodyCode: string
  licensingBodyName: string
  licenseNumber: string
}
