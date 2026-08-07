import type { Page } from '~/types/admin'
import type {
  CommissionTierDto,
  CreateCommissionTierRequest,
  UpdateCommissionTierRequest,
} from '~/types/commissionTiers'

interface ListParams {
  page?: number
  size?: number
  sort?: string
  filter?: string
  q?: string
}

/**
 * Acceso a las bandas de comisión por inscripción (/v1/admin/commission-tiers,
 * V42, ADR 0013 §1). Todas las operaciones requieren COMMISSION_TIER_MANAGE.
 * DELETE es soft-delete (active=false).
 */
export const useCommissionTiers = () => {
  const list = (params: ListParams = {}) =>
    useApi<Page<CommissionTierDto>>('/v1/admin/commission-tiers', {
      query: {
        page: params.page ?? 0,
        size: params.size ?? 50,
        sort: params.sort ?? 'thresholdCount,asc',
        ...(params.filter ? { filter: params.filter } : {}),
        ...(params.q ? { q: params.q } : {}),
      },
    })

  const get = (uuid: string) =>
    useApi<CommissionTierDto>(`/v1/admin/commission-tiers/${uuid}`)

  const create = (body: CreateCommissionTierRequest) =>
    useApi<CommissionTierDto>('/v1/admin/commission-tiers', { method: 'POST', body })

  const update = (uuid: string, body: UpdateCommissionTierRequest) =>
    useApi<CommissionTierDto>(`/v1/admin/commission-tiers/${uuid}`, { method: 'PUT', body })

  const remove = (uuid: string) =>
    useApi<null>(`/v1/admin/commission-tiers/${uuid}`, { method: 'DELETE' })

  return { list, get, create, update, remove }
}
