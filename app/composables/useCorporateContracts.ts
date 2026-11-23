import type { Page } from '~/types/admin'
import type { MemberListItemDto } from '~/types/members'
import type { CorporateContractCreateRequest, CorporateContractDto, CorporateContractUpdateRequest } from '~/types/corporateContracts'

interface ListParams {
  page?: number
  size?: number
  /** Free text (institution name / RIF). */
  q?: string
  planUuid?: string
}

/**
 * Admin CRUD of corporate contracts (backend V38, granular per V79): CORPORATE_CONTRACT_VIEW_ALL / _CREATE /
 * _UPDATE / _DELETE, plus the contract's enrolled members (CORPORATE_CONTRACT_MEMBER_VIEW_ALL).
 */
export const useCorporateContracts = () => {
  const list = (params: ListParams = {}) =>
    useApi<Page<CorporateContractDto>>('/v1/admin/corporate-contracts', {
      query: {
        page: params.page ?? 0,
        size: params.size ?? 20,
        ...(params.q ? { q: params.q } : {}),
        ...(params.planUuid ? { planUuid: params.planUuid } : {}),
      },
    })

  const get = (uuid: string) =>
    useApi<CorporateContractDto>(`/v1/admin/corporate-contracts/${uuid}`)

  const create = (body: CorporateContractCreateRequest) =>
    useApi<CorporateContractDto>('/v1/admin/corporate-contracts', { method: 'POST', body })

  const update = (uuid: string, body: CorporateContractUpdateRequest) =>
    useApi<CorporateContractDto>(`/v1/admin/corporate-contracts/${uuid}`, { method: 'PUT', body })

  const remove = (uuid: string) =>
    useApi<void>(`/v1/admin/corporate-contracts/${uuid}`, { method: 'DELETE' })

  const members = (uuid: string, params: { page?: number, size?: number } = {}) =>
    useApi<Page<MemberListItemDto>>(`/v1/admin/corporate-contracts/${uuid}/members`, {
      query: { page: params.page ?? 0, size: params.size ?? 20 },
    })

  return { list, get, create, update, remove, members }
}
