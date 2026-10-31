import type { EmergencyContactDto, EmergencyContactScope, EmergencyContactUpdateRequest } from '~/types/members'

/**
 * The titular's emergency contact (V212). One endpoint per audience:
 * - `admin`   → /v1/admin/members/{uuid}/emergency-contact (MEMBER_EMERGENCY_CONTACT_VIEW_ALL / _UPDATE)
 * - `advisor` → /v1/me/advisor/portfolio/members/{uuid}/emergency-contact (_UPDATE_DOWNLINE, own portfolio)
 * - `own`     → /v1/me/member/emergency-contact (_VIEW_OWN / _UPDATE_OWN)
 */
export function useEmergencyContact() {
  function path(scope: EmergencyContactScope, memberUuid?: string): string {
    if (scope === 'own') return '/v1/me/member/emergency-contact'
    if (!memberUuid) throw new Error('memberUuid is required for the admin and advisor scopes')
    return scope === 'admin'
      ? `/v1/admin/members/${memberUuid}/emergency-contact`
      : `/v1/me/advisor/portfolio/members/${memberUuid}/emergency-contact`
  }

  const get = (scope: EmergencyContactScope, memberUuid?: string) =>
    useApi<EmergencyContactDto>(path(scope, memberUuid), { silent: scope === 'own' })

  const update = (scope: EmergencyContactScope, body: EmergencyContactUpdateRequest, memberUuid?: string) =>
    useApi<EmergencyContactDto>(path(scope, memberUuid), { method: 'PUT', body })

  /** Which permissions let the current user read / write each scope. */
  function permissions(scope: EmergencyContactScope): { view: string[], update: string[] } {
    if (scope === 'own') return { view: ['MEMBER_EMERGENCY_CONTACT_VIEW_OWN'], update: ['MEMBER_EMERGENCY_CONTACT_UPDATE_OWN'] }
    if (scope === 'advisor') return { view: ['MEMBER_EMERGENCY_CONTACT_UPDATE_DOWNLINE'], update: ['MEMBER_EMERGENCY_CONTACT_UPDATE_DOWNLINE'] }
    return {
      view: ['MEMBER_EMERGENCY_CONTACT_VIEW_ALL', 'MEMBER_EMERGENCY_CONTACT_UPDATE', 'MEDICAL_RECORD_VIEW'],
      update: ['MEMBER_EMERGENCY_CONTACT_UPDATE', 'MEDICAL_RECORD_UPDATE'],
    }
  }

  return { get, update, permissions }
}
