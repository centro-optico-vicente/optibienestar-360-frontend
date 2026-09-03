import type { Page } from '~/types/admin'
import type {
  CommissionTierDto,
  CreateCommissionTierRequest,
  UpdateCommissionTierRequest,
} from '~/types/commissionTiers'

interface ListParams {
  page?: number
  size?: number
  /** Multi-column sort — repeated as `sort=` query params. */
  sort?: string[]
  filter?: string
  q?: string
  includeInactive?: boolean
  promoterTypeUuid?: string
}

/**
 * Acceso a las bandas de comisión por inscripción (/v1/admin/commission-tiers,
 * V42, ADR 0013 §1). Granular per V79: VIEW_ALL/CREATE/UPDATE/DELETE instead of one combined permission.
 * DELETE es soft-delete (active=false).
 */
export const useCommissionTiers = () => {
  const list = (params: ListParams = {}) =>
    useApi<Page<CommissionTierDto>>('/v1/admin/commission-tiers', {
      query: {
        page: params.page ?? 0,
        size: params.size ?? 50,
        ...(params.sort?.length ? { sort: params.sort } : {}),
        ...(params.filter ? { filter: params.filter } : {}),
        ...(params.q ? { q: params.q } : {}),
        ...(params.includeInactive ? { includeInactive: 'true' } : {}),
        ...(params.promoterTypeUuid ? { promoterTypeUuid: params.promoterTypeUuid } : {}),
      },
    })

  const get = (uuid: string) =>
    useApi<CommissionTierDto>(`/v1/admin/commission-tiers/${uuid}`)

  const create = (body: CreateCommissionTierRequest) =>
    useApi<CommissionTierDto>('/v1/admin/commission-tiers', { method: 'POST', body })

  const update = (uuid: string, body: UpdateCommissionTierRequest) =>
    useApi<CommissionTierDto>(`/v1/admin/commission-tiers/${uuid}`, { method: 'PUT', body })

  const remove = (uuid: string, physical = false) =>
    useApi<null>(`/v1/admin/commission-tiers/${uuid}`, { method: 'DELETE', query: physical ? { physical: true } : {} })

  /** "Ping" of FK usage before deleting: lets the UI offer a physical delete vs. a deactivation. */
  const usage = (uuid: string) =>
    useApi<{ inUse: boolean, count: number }>(`/v1/admin/commission-tiers/${uuid}/usage`)

  return { list, get, create, update, remove, usage }
}
