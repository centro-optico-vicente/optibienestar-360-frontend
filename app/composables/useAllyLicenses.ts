import type { AllyLicenseDto, AllyLicenseRequest, LicenseVerificationStatus, PublicAllyLicenseDto } from '~/types/licenses'

/** Admin CRUD + verification of a B2P ally's licenses (`/v1/admin/allies/{uuid}/licenses`, V213). */
/**
 * `admin` = /v1/admin/allies/{uuid}/licenses (PERSON_LICENSE_*);
 * `portal` = /v1/me/allies/{uuid}/licenses, the professional ally's own
 * licenses (hub ADR 0036: add / remove only, ALLY_LICENSE_UPDATE_OWN).
 */
export const useAllyLicenses = (scope: 'admin' | 'portal' = 'admin') => {
  const base = (allyUuid: string) => scope === 'portal'
    ? `/v1/me/allies/${allyUuid}/licenses`
    : `/v1/admin/allies/${allyUuid}/licenses`

  const list = (allyUuid: string) => useApi<AllyLicenseDto[]>(base(allyUuid))

  const create = (allyUuid: string, body: AllyLicenseRequest) =>
    useApi<AllyLicenseDto>(base(allyUuid), { method: 'POST', body })

  const update = (allyUuid: string, licenseUuid: string, body: AllyLicenseRequest) =>
    useApi<AllyLicenseDto>(`${base(allyUuid)}/${licenseUuid}`, { method: 'PUT', body })

  const verify = (allyUuid: string, licenseUuid: string, status: Exclude<LicenseVerificationStatus, 'PENDING'>) =>
    useApi<AllyLicenseDto>(`${base(allyUuid)}/${licenseUuid}/verification`, { method: 'POST', body: { status } })

  const remove = (allyUuid: string, licenseUuid: string) =>
    useApi<null>(`${base(allyUuid)}/${licenseUuid}`, { method: 'DELETE' })

  /** Portal only: active issuing bodies for the form. */
  const bodies = (allyUuid: string) =>
    useApi<{ uuid: string, code: string | null, name: string | null }[]>(`${base(allyUuid)}/bodies`)

  return { list, create, update, verify, remove, bodies }
}

/** Public: VERIFIED licenses of a published ally (`/v1/public/allies/{uuid}/licenses`). */
export const usePublicAllyLicenses = () => {
  const list = (allyUuid: string) =>
    useApi<PublicAllyLicenseDto[]>(`/v1/public/allies/${allyUuid}/licenses`, { skipAuth: true })
  return { list }
}
