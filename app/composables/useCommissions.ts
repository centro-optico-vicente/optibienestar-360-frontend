import type { Page } from '~/types/admin'
import type {
  CommissionDto,
  CommissionPayoutRequest,
  CommissionPayoutResponse,
} from '~/types/promoters'

interface ListParams {
  page?: number
  size?: number
  sort?: string
  filter?: string
  q?: string
}

/**
 * Acceso al ledger de Comisiones (/v1/admin/commissions).
 * Permisos del backend por acción:
 * - list/get → COMMISSION_VIEW_ALL · payout → COMMISSION_PAYOUT
 *
 * Las comisiones no se editan ni se borran: se generan al aprobar pagos y se liquidan
 * cerrando un período con `payout`. La consulta canónica de liquidación es
 * `filter=promoter.uuid==X;status==PENDING`.
 */
export const useCommissions = () => {
  const list = (params: ListParams = {}) =>
    useApi<Page<CommissionDto>>('/v1/admin/commissions', {
      query: {
        page: params.page ?? 0,
        size: params.size ?? 20,
        sort: params.sort ?? 'earnedAt,desc',
        ...(params.filter ? { filter: params.filter } : {}),
        ...(params.q ? { q: params.q } : {}),
      },
    })

  const get = (uuid: string) =>
    useApi<CommissionDto>(`/v1/admin/commissions/${uuid}`)

  /**
   * Cierra un período: marca como PAID todas las comisiones PENDING del rango,
   * genera un CSV por promotor y envía correo a cada uno.
   * Usar `dryRun: true` para previsualizar totales sin escribir en BD ni enviar correos.
   */
  const payout = (body: CommissionPayoutRequest) =>
    useApi<CommissionPayoutResponse>('/v1/admin/commissions/payout', { method: 'POST', body })

  return { list, get, payout }
}
