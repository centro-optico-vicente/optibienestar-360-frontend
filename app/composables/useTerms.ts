import type { TermsVariableDto, TermsVersionCreateRequest, TermsVersionDto, TermsVersionUpdateRequest, TermType } from '~/types/terms'

/**
 * Admin CRUD for T&C versions (/v1/admin/terms). Permissions: list/get →
 * TERMS_VIEW_ALL · create → TERMS_CREATE · update → TERMS_UPDATE (only while
 * the target version is not yet vigente — the backend rejects otherwise) ·
 * variables → TERMS_VIEW_ALL.
 */
export const useTerms = () => {
  /** Ordered by `validFrom` DESC, each row carrying the server-computed `isVigent`. */
  const list = (type?: TermType) =>
    useApi<TermsVersionDto[]>('/v1/admin/terms', { query: type ? { type } : {} })

  const get = (uuid: string) =>
    useApi<TermsVersionDto>(`/v1/admin/terms/${uuid}`)

  const create = (body: TermsVersionCreateRequest) =>
    useApi<TermsVersionDto>('/v1/admin/terms', { method: 'POST', body })

  const update = (uuid: string, body: TermsVersionUpdateRequest) =>
    useApi<TermsVersionDto>(`/v1/admin/terms/${uuid}`, { method: 'PUT', body })

  /** Variables a template of `type` may use (common ones first), for the editor's insert list. */
  const variables = (type: TermType) =>
    useApi<TermsVariableDto[]>('/v1/admin/terms/variables', { query: { type } })

  return { list, get, create, update, variables }
}
