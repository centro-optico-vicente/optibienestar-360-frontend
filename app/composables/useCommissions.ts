import type { Page } from '~/types/admin'
import type {
  CommissionDto,
  CommissionPayoutBySelectionRequest,
  CommissionPayoutRequest,
  CommissionPayoutResponse,
  CommissionReRatingRequest,
  CommissionReRatingResponse,
  CommissionRetroactiveTopUpRequest,
  CommissionRetroactiveTopUpResponse,
  HierarchyOverrideReRatingRequest,
  HierarchyOverrideReRatingResponse,
} from '~/types/promoters'

interface ListParams {
  page?: number
  size?: number
  /** Multi-column sort, e.g. `['earnedAt,desc']` — repeated as `sort=` query params. */
  sort?: string[]
  filter?: string
  q?: string
  includeInactive?: boolean
  /** "Generar pagos" screen's dedicated filters — not reachable via the generic RSQL `filter`. */
  promoterTypeUuid?: string
  promoterRankUuid?: string
  campaignUuid?: string
}

/**
 * Acceso al ledger de Comisiones (/v1/admin/commissions).
 * Permisos del backend por acción:
 * - list/get → COMMISSION_VIEW_ALL · payout → COMMISSION_PAYOUT · re-rate → COMMISSION_RE_RATE
 * - void → COMMISSION_VOID
 *
 * Las comisiones no se editan ni se borran: se generan al aprobar pagos y se liquidan
 * cerrando un período con `payout`. La consulta canónica de liquidación es
 * `filter=promoter.uuid==X;status==PENDING`. Una comisión PENDING puntual puede excluirse
 * de la próxima liquidación anulándola con `voidCommission` (p. ej. incumplimiento de un
 * promotor) sin afectar el resto del período.
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
        ...(params.promoterTypeUuid ? { promoterTypeUuid: params.promoterTypeUuid } : {}),
        ...(params.promoterRankUuid ? { promoterRankUuid: params.promoterRankUuid } : {}),
        ...(params.campaignUuid ? { campaignUuid: params.campaignUuid } : {}),
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
   * Paga un conjunto de comisiones elegidas a mano en la tabla de aprobación
   * (E.2) — todas deben estar APPROVED; el backend rechaza (400) el pedido
   * completo si alguna no lo está. Usar `dryRun: true` para previsualizar
   * totales sin escribir en BD ni enviar correos.
   */
  const payoutBySelection = (body: CommissionPayoutBySelectionRequest) =>
    useApi<CommissionPayoutResponse>('/v1/admin/commissions/payout/by-selection', { method: 'POST', body })

  /**
   * Cierre de mes: recalcula todas las comisiones INSCRIPTION PENDING del rango a la
   * banda más alta que alcanzó cada promotor (no un mix progresivo por pago).
   * Usar `dryRun: true` para previsualizar los deltas sin escribir en BD.
   */
  const reRate = (body: CommissionReRatingRequest) =>
    useApi<CommissionReRatingResponse>('/v1/admin/commissions/re-rate', { method: 'POST', body })

  /**
   * Cierre de mes para el override jerárquico (hub plan §2, PR3, /v1/admin/hierarchy-overrides/re-rate):
   * resincroniza overrides cuya base quedó obsoleta y sube cada override PENDING a la banda
   * más alta de volumen de equipo que alcanzó su beneficiario (Supervisor/Coordinador).
   * Reusa COMMISSION_RE_RATE — mismo actor/acción, tabla distinta.
   */
  const overrideReRate = (body: HierarchyOverrideReRatingRequest) =>
    useApi<HierarchyOverrideReRatingResponse>('/v1/admin/hierarchy-overrides/re-rate', { method: 'POST', body })

  /**
   * Cierre de liquidación (hub plan §3, PR4): completa la diferencia entre lo ya pagado en
   * cortes parciales y lo que correspondería a la banda final del período. Correr DESPUÉS de
   * `reRate`/`overrideReRate` — esos ajustan filas PENDING; este cubre lo ya PAID.
   */
  const retroactiveTopUps = (body: CommissionRetroactiveTopUpRequest) =>
    useApi<CommissionRetroactiveTopUpResponse>('/v1/admin/commissions/retroactive-topups', { method: 'POST', body })

  /**
   * Anula una comisión PENDING puntual (p. ej. incumplimiento del promotor) — queda
   * excluida de la próxima liquidación sin tocar el resto del período. Solo aplica a
   * comisiones PENDING; PAID/VOIDED/DISPUTED son rechazadas por el backend.
   */
  const voidCommission = (uuid: string, reason: string) =>
    useApi<CommissionDto>(`/v1/admin/commissions/${uuid}/void`, { method: 'POST', body: { reason } })

  return { list, get, payout, payoutBySelection, reRate, overrideReRate, retroactiveTopUps, voidCommission }
}
