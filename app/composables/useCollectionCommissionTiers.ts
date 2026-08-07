import type { Page } from '~/types/admin'
import type {
<<<<<<< Updated upstream
  CollectionCommissionTierDto,
  CreateCollectionCommissionTierRequest,
  UpdateCollectionCommissionTierRequest,
} from '~/types/collectionCommissionTiers'
=======
  CollectionCommissionTierCreateRequest,
  CollectionCommissionTierDto,
  CollectionCommissionTierUpdateRequest,
} from '~/types/promoters'
>>>>>>> Stashed changes

interface ListParams {
  page?: number
  size?: number
  sort?: string
  filter?: string
  q?: string
  includeInactive?: boolean
<<<<<<< Updated upstream
  promoterTypeUuid?: string
}

/**
 * Acceso a los tramos de comisión de cobranza por días (/v1/admin/collection-commission-tiers,
 * V44, ADR 0013 §3). Todas las operaciones requieren COLLECTION_COMMISSION_TIER_MANAGE.
 * DELETE es soft-delete (active=false).
=======
}

/**
 * Acceso a /v1/admin/collection-commission-tiers (V44, ADR 0013 §3). Bandas de
 * comisión de cobranza por días de mora cobrados. Todas las acciones — incluido
 * el listado — exigen COLLECTION_COMMISSION_TIER_MANAGE (a diferencia de otros
 * verticales, aquí no hay un permiso de solo-lectura separado).
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
        ...(params.includeInactive ? { includeInactive: 'true' } : {}),
        ...(params.promoterTypeUuid ? { promoterTypeUuid: params.promoterTypeUuid } : {}),
=======
        ...(params.includeInactive ? { includeInactive: true } : {}),
>>>>>>> Stashed changes
      },
    })

  const get = (uuid: string) =>
    useApi<CollectionCommissionTierDto>(`/v1/admin/collection-commission-tiers/${uuid}`)

<<<<<<< Updated upstream
  const create = (body: CreateCollectionCommissionTierRequest) =>
    useApi<CollectionCommissionTierDto>('/v1/admin/collection-commission-tiers', { method: 'POST', body })

  const update = (uuid: string, body: UpdateCollectionCommissionTierRequest) =>
=======
  const create = (body: CollectionCommissionTierCreateRequest) =>
    useApi<CollectionCommissionTierDto>('/v1/admin/collection-commission-tiers', { method: 'POST', body })

  const update = (uuid: string, body: CollectionCommissionTierUpdateRequest) =>
>>>>>>> Stashed changes
    useApi<CollectionCommissionTierDto>(`/v1/admin/collection-commission-tiers/${uuid}`, { method: 'PUT', body })

  const remove = (uuid: string) =>
    useApi<null>(`/v1/admin/collection-commission-tiers/${uuid}`, { method: 'DELETE' })

  return { list, get, create, update, remove }
}
