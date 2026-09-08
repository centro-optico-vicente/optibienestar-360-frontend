import type {
  ApproveCommissionsRequest,
  CommissionApprovalActionResponse,
  CommissionApprovalGroupDto,
  RejectCommissionsRequest,
} from '~/types/promoters'

/**
 * Acceso al gate de aprobación comercial (/v1/admin/commissions/*, V107).
 * Permiso del backend: `COMMISSION_APPROVE` en las tres acciones — distinto
 * de `COMMISSION_PAYOUT` (gerencia de administración), separación de
 * funciones explícita pedida por el negocio.
 *
 * Una comisión recién calculada nace PENDING (simulación); solo puede
 * pasar a PAID vía `useCommissions().payout` después de ser APPROVED aquí.
 */
export const useCommissionApproval = () => {
  /** Arma la tabla expandible de 2 niveles: un nodo por promotor con cada comisión del período debajo, sea cual sea su estado. */
  const approvalQueue = (periodStart: string, periodEnd: string) =>
    useApi<CommissionApprovalGroupDto[]>('/v1/admin/commissions/approval-queue', {
      query: { periodStart, periodEnd },
    })

  /** Aprueba las filas PENDING dadas — granularidad por fila, nunca bulk por promotor. */
  const approve = (commissionUuids: string[]) =>
    useApi<CommissionApprovalActionResponse>('/v1/admin/commissions/approve', {
      method: 'POST',
      body: { commissionUuids } satisfies ApproveCommissionsRequest,
    })

  /** Rechaza las filas PENDING dadas — cascada a los overrides jerárquicos que dependan de cada una. */
  const reject = (commissionUuids: string[], reason: string) =>
    useApi<CommissionApprovalActionResponse>('/v1/admin/commissions/reject', {
      method: 'POST',
      body: { commissionUuids, reason } satisfies RejectCommissionsRequest,
    })

  return { approvalQueue, approve, reject }
}
