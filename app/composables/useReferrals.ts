import type { Page } from '~/types/admin'
import type {
  MyReferralDto,
  ReferralCodeIssueRequest,
  ReferralCodeIssueResponse,
} from '~/types/promoters'

/**
 * Acceso a Referidos: emisión del código (admin) y el histórico propio (self-service).
 * Permisos del backend por acción:
 * - issueCode → REFERRAL_CODE_CREATE (/v1/admin/referral-codes)
 * - mine → REFERRAL_CODE_VIEW_OWN (/v1/me/referrals; el UUID del afiliado sale del JWT)
 */
export const useReferrals = () => {
  /**
   * Emite o regenera el código de referido de un afiliado existente.
   * `customCode` vacío → auto-generar; idempotente si el custom coincide con el actual.
   */
  const issueCode = (body: ReferralCodeIssueRequest) =>
    useApi<ReferralCodeIssueResponse>('/v1/admin/referral-codes', { method: 'POST', body })

  /** Mi histórico de referidos (todos los estados; sin RSQL ni `q`). */
  const mine = (params: { page?: number, size?: number, sort?: string } = {}) =>
    useApi<Page<MyReferralDto>>('/v1/me/referrals', {
      query: {
        page: params.page ?? 0,
        size: params.size ?? 20,
        sort: params.sort ?? 'createdAt,desc',
      },
    })

  return { issueCode, mine }
}
