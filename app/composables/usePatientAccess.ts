import type { Page } from '~/types/admin'
import type { MedicalRecordDto } from '~/types/members'
import type {
  AllyPatientLinkDto,
  MyMedicalRecordAccessDto,
  PatientAccessEligibilityDto,
} from '~/types/patientAccess'

/**
 * Patient medical history for medical allies (hub ADR 0032).
 *
 * Ally side (MEMBER_MEDICAL_RECORD_VIEW_PATIENT; the backend narrows it to the
 * doctor or an OPERADOR_MEDICO of a B2P medical ally):
 * - eligibility -> whether to show "Ver historia médica" at this ally
 * - openLink    -> ONLY after a QR scan of the credential, never for a typed document
 * - patients    -> "Mis pacientes"
 * - medicalRecord -> read-only, logged, never cached
 *
 * Member side: myAccess (ALLY_PATIENT_LINK_VIEW_OWN), revoke (ALLY_PATIENT_LINK_REVOKE_OWN).
 */
export const usePatientAccess = () => {
  const base = (allyUuid: string) => `/v1/me/allies/${allyUuid}/patients`

  const eligibility = (allyUuid: string) =>
    useApi<PatientAccessEligibilityDto>(`${base(allyUuid)}/eligibility`, { silent: true })

  const openLink = (allyUuid: string, memberUuid: string) =>
    useApi<AllyPatientLinkDto>(`${base(allyUuid)}/${memberUuid}/links`, { method: 'POST' })

  const patients = (allyUuid: string, params: { page?: number, size?: number } = {}) =>
    useApi<Page<AllyPatientLinkDto>>(base(allyUuid), { query: params })

  const medicalRecord = (allyUuid: string, memberUuid: string) =>
    useApi<MedicalRecordDto>(`${base(allyUuid)}/${memberUuid}/medical-record`)

  const myAccess = () => useApi<MyMedicalRecordAccessDto>('/v1/me/medical-record/access')

  const revoke = (linkUuid: string) =>
    useApi<AllyPatientLinkDto>(`/v1/me/medical-record/links/${linkUuid}`, { method: 'DELETE' })

  return { eligibility, openLink, patients, medicalRecord, myAccess, revoke }
}
