import type { Page } from '~/types/admin'
import type {
  CommissionDto,
  CommissionPayoutRequest,
  CommissionPayoutResponse,
  CommissionReRatingRequest,
  CommissionReRatingResponse,
} from '~/types/promoters'

interface ListParams {
  page?: number
  size?: number
  /** Multi-column sort, e.g. `['earnedAt,desc']` — repeated as `sort=` query params. */
  sort?: string[]
  filter?: string
  q?: string
  includeInactive?: boolean
}

/**
 * Acceso al ledger de Comisiones (/v1/admin/commissions).
 * Permisos del backend por acción:
 * - list/get → COMMISSION_VIEW_ALL · payout → COMMISSION_PAYOUT · re-rate → COMMISSION_RE_RATE
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
        ...(params.sort?.length ? { sort: params.sort } : {}),
        ...(params.filter ? { filter: params.filter } : {}),
        ...(params.q ? { q: params.q } : {}),
        ...(params.includeInactive ? { includeInactive: 'true' } : {}),
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

  /**
   * Cierre de mes: recalcula todas las comisiones INSCRIPTION PENDING del rango a la
   * banda más alta que alcanzó cada promotor (no un mix progresivo por pago).
   * Usar `dryRun: true` para previsualizar los deltas sin escribir en BD.
   */
  const reRate = (body: CommissionReRatingRequest) =>
    useApi<CommissionReRatingResponse>('/v1/admin/commissions/re-rate', { method: 'POST', body })

  return { list, get, payout, reRate }
}
