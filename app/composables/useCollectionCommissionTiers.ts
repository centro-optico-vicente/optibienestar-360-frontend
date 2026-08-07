import type { Page } from '~/types/admin'
import type {
  CollectionCommissionTierDto,
  CreateCollectionCommissionTierRequest,
  UpdateCollectionCommissionTierRequest,
} from '~/types/collectionCommissionTiers'

interface ListParams {
  page?: number
  size?: number
  sort?: string
  filter?: string
  q?: string
  includeInactive?: boolean
}

/**
 * Acceso a los tramos de comisión de cobranza por días (/v1/admin/collection-commission-tiers,
 * V44, ADR 0013 §3). Todas las operaciones requieren COLLECTION_COMMISSION_TIER_MANAGE.
 * DELETE es soft-delete (active=false).
 */
export const useCollectionCommissionTiers = () => {
  const list = (params: ListParams = {}) =>
    useApi<Page<CollectionCommissionTierDto>>('/v1/admin/collection-commission-tiers', {
      query: {
        page: params.page ?? 0,
        size: params.size ?? 50,
        sort: params.sort ?? 'maxDays,asc',
        ...(params.filter ? { filter: params.filter } : {}),
        ...(params.q ? { q: params.q } : {}),
        ...(params.includeInactive ? { includeInactive: 'true' } : {}),
      },
    })

  const get = (uuid: string) =>
    useApi<CollectionCommissionTierDto>(`/v1/admin/collection-commission-tiers/${uuid}`)

  const create = (body: CreateCollectionCommissionTierRequest) =>
    useApi<CollectionCommissionTierDto>('/v1/admin/collection-commission-tiers', { method: 'POST', body })

  const update = (uuid: string, body: UpdateCollectionCommissionTierRequest) =>
    useApi<CollectionCommissionTierDto>(`/v1/admin/collection-commission-tiers/${uuid}`, { method: 'PUT', body })

  const remove = (uuid: string) =>
    useApi<null>(`/v1/admin/collection-commission-tiers/${uuid}`, { method: 'DELETE' })

  return { list, get, create, update, remove }
}
