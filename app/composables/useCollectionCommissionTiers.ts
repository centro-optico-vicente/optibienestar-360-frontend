import type { Page } from '~/types/admin'
import type {
  CollectionCommissionTierDto,
  CreateCollectionCommissionTierRequest,
  UpdateCollectionCommissionTierRequest,
} from '~/types/collectionCommissionTiers'

interface ListParams {
  page?: number
  size?: number
  /** Multi-column sort — repeated as `sort=` query params. */
  sort?: string[]
  filter?: string
  q?: string
  includeInactive?: boolean
  promoterTypeUuid?: string
  /** Filters rules linked to a commission campaign — used by the campaign ficha's "Rules" tab and the tab filter bar's campaign-only toggle. Filtered server-side (CollectionCommissionTiersService). */
  campaignUuid?: string
}

/**
 * Acceso a los tramos de comisión de cobranza por días (/v1/admin/collection-commission-tiers,
 * V44, ADR 0013 §3). Granular per V79: VIEW_ALL/CREATE/UPDATE/DELETE instead of one combined permission.
 * DELETE es soft-delete (active=false).
 */
export const useCollectionCommissionTiers = () => {
  const list = (params: ListParams = {}) =>
    useApi<Page<CollectionCommissionTierDto>>('/v1/admin/collection-commission-tiers', {
      query: {
        page: params.page ?? 0,
        size: params.size ?? 50,
        ...(params.sort?.length ? { sort: params.sort } : {}),
        ...(params.filter ? { filter: params.filter } : {}),
        ...(params.q ? { q: params.q } : {}),
        ...(params.includeInactive ? { includeInactive: 'true' } : {}),
        ...(params.promoterTypeUuid ? { promoterTypeUuid: params.promoterTypeUuid } : {}),
        ...(params.campaignUuid ? { campaignUuid: params.campaignUuid } : {}),
      },
    })

  const get = (uuid: string) =>
    useApi<CollectionCommissionTierDto>(`/v1/admin/collection-commission-tiers/${uuid}`)

  const create = (body: CreateCollectionCommissionTierRequest) =>
    useApi<CollectionCommissionTierDto>('/v1/admin/collection-commission-tiers', { method: 'POST', body })

  const update = (uuid: string, body: UpdateCollectionCommissionTierRequest) =>
    useApi<CollectionCommissionTierDto>(`/v1/admin/collection-commission-tiers/${uuid}`, { method: 'PUT', body })

  const remove = (uuid: string, physical = false) =>
    useApi<null>(`/v1/admin/collection-commission-tiers/${uuid}`, { method: 'DELETE', query: physical ? { physical: true } : {} })

  /** "Ping" of FK usage before deleting: lets the UI offer a physical delete vs. a deactivation. */
  const usage = (uuid: string) =>
    useApi<{ inUse: boolean, count: number }>(`/v1/admin/collection-commission-tiers/${uuid}/usage`)

  return { list, get, create, update, remove, usage }
}
