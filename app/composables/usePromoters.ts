import type { Page } from '~/types/admin'
import type {
  CommissionPeriodSummaryDto,
  PromoterCreateRequest,
  PromoterDashboardDto,
  PromoterDto,
  PromoterUpdateRequest,
} from '~/types/promoters'

interface ListParams {
  page?: number
  size?: number
  sort?: string
  filter?: string
  q?: string
  includeInactive?: boolean
}

/**
 * Acceso al vertical de Promotores (/v1/admin/promoters).
 * Permisos del backend por acción:
 * - list/get → PROMOTER_VIEW_ALL · create → PROMOTER_CREATE
 * - update → PROMOTER_UPDATE · remove → PROMOTER_DELETE
 *
 * La fila del sistema INSTITUCION aparece en el listado (`system: true`) pero no se
 * puede crear, editar ni eliminar (el backend responde 422).
 */
export const usePromoters = () => {
  const list = (params: ListParams = {}) =>
    useApi<Page<PromoterDto>>('/v1/admin/promoters', {
      query: {
        page: params.page ?? 0,
        size: params.size ?? 50,
        sort: params.sort ?? 'displayName,asc',
        ...(params.filter ? { filter: params.filter } : {}),
        ...(params.q ? { q: params.q } : {}),
        ...(params.includeInactive ? { includeInactive: 'true' } : {}),
      },
    })

  const get = (uuid: string) =>
    useApi<PromoterDto>(`/v1/admin/promoters/${uuid}`)

  /** Cartera + salud de cobranza + comisiones del mes, vista admin de GET /v1/promoter/me. */
  const portfolio = (uuid: string) =>
    useApi<PromoterDashboardDto>(`/v1/admin/promoters/${uuid}/portfolio`)

  /** Histórico mensual de comisiones del promotor, más reciente primero. */
  const commissionsSummary = (uuid: string) =>
    useApi<CommissionPeriodSummaryDto[]>(`/v1/admin/promoters/${uuid}/commissions/summary`)

  const create = (body: PromoterCreateRequest) =>
    useApi<PromoterDto>('/v1/admin/promoters', { method: 'POST', body })

  const update = (uuid: string, body: PromoterUpdateRequest) =>
    useApi<PromoterDto>(`/v1/admin/promoters/${uuid}`, { method: 'PUT', body })

  const remove = (uuid: string) =>
    useApi<null>(`/v1/admin/promoters/${uuid}`, { method: 'DELETE' })

<<<<<<< Updated upstream
  /** Cartera de afiliados + salud de cobranza + comisiones del mes en curso. */
  const portfolio = (uuid: string) =>
    useApi<PromoterDashboardDto>(`/v1/admin/promoters/${uuid}/portfolio`)

  /** Historial de comisiones por período, más reciente primero. */
  const commissionsSummary = (uuid: string) =>
    useApi<CommissionPeriodSummaryDto[]>(`/v1/admin/promoters/${uuid}/commissions/summary`)

  return { list, get, create, update, remove, portfolio, commissionsSummary }
=======
  return { list, get, portfolio, commissionsSummary, create, update, remove }
>>>>>>> Stashed changes
}
