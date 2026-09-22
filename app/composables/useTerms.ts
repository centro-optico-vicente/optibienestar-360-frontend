import type { TermsVersionCreateRequest, TermsVersionDto, TermsVersionUpdateRequest, TermType } from '~/types/terms'

/**
 * Admin CRUD for T&C versions (/v1/admin/terms). Permissions: list/get/current →
 * TERMS_VIEW_ALL · create → TERMS_CREATE · update → TERMS_UPDATE (only while
 * the target version is not yet vigente — the backend rejects otherwise).
 */
export const useTerms = () => {
  const list = (type?: TermType) =>
    useApi<TermsVersionDto[]>('/v1/admin/terms', { query: type ? { type } : {} })

  const get = (uuid: string) =>
    useApi<TermsVersionDto>(`/v1/admin/terms/${uuid}`)

  const current = (type: TermType) =>
    useApi<TermsVersionDto>(`/v1/admin/terms/current/${type}`)

  const create = (body: TermsVersionCreateRequest) =>
    useApi<TermsVersionDto>('/v1/admin/terms', { method: 'POST', body })

  const update = (uuid: string, body: TermsVersionUpdateRequest) =>
    useApi<TermsVersionDto>(`/v1/admin/terms/${uuid}`, { method: 'PUT', body })

  return { list, get, current, create, update }
}
