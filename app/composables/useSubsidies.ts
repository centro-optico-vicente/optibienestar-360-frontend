import type { Page } from '~/types/admin'
import type { SubsidyAuditLogDto, SubsidyCreateRequest, SubsidyDto, SubsidyUpdateRequest } from '~/types/subsidies'

interface ListParams {
  page?: number
  size?: number
  /** Free text (reason, member name/document). */
  q?: string
  /** Only this member's subsidies. */
  memberUuid?: string
  /** `yyyy-MM-dd`: subsidies whose validity window overlaps the range. */
  dateFrom?: string
  dateTo?: string
}

/**
 * Admin surface of subsidies & exonerations (backend V41/V78): list/detail with SUBSIDY_VIEW_ALL,
 * create/update/revoke with SUBSIDY_CREATE/SUBSIDY_UPDATE/SUBSIDY_DELETE, and the immutable audit log.
 * The list only returns live (non-revoked) subsidies.
 */
export const useSubsidies = () => {
  const list = (params: ListParams = {}) =>
    useApi<Page<SubsidyDto>>('/v1/admin/subsidies', {
      query: {
        page: params.page ?? 0,
        size: params.size ?? 20,
        ...(params.q ? { q: params.q } : {}),
        ...(params.memberUuid ? { memberUuid: params.memberUuid } : {}),
        ...(params.dateFrom ? { dateFrom: params.dateFrom } : {}),
        ...(params.dateTo ? { dateTo: params.dateTo } : {}),
      },
    })

  const get = (uuid: string) =>
    useApi<SubsidyDto>(`/v1/admin/subsidies/${uuid}`)

  const create = (body: SubsidyCreateRequest) =>
    useApi<SubsidyDto>('/v1/admin/subsidies', { method: 'POST', body })

  const update = (uuid: string, body: SubsidyUpdateRequest) =>
    useApi<SubsidyDto>(`/v1/admin/subsidies/${uuid}`, { method: 'PUT', body })

  /** Soft revoke (`active=false`), recorded as REVOKED in the audit log. */
  const revoke = (uuid: string) =>
    useApi<void>(`/v1/admin/subsidies/${uuid}`, { method: 'DELETE' })

  const log = (uuid: string) =>
    useApi<SubsidyAuditLogDto[]>(`/v1/admin/subsidies/${uuid}/log`)

  return { list, get, create, update, revoke, log }
}
