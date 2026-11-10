import type { Page } from '~/types/admin'
import type { PaymentClaimDto, ResolvePaymentClaimRequest } from '~/types/payments'

interface ListParams {
  page?: number
  size?: number
  /** `OPEN`, `KEPT_AS_CREDIT`, … — omitted lists every status. */
  status?: string
  /** Free-text, accent/case-insensitive: claim reason/comment and the payer's name/document. */
  q?: string
  /** Affiliate (member uuid) whose person made the payment. */
  memberUuid?: string
  /** `yyyy-MM-dd`, inclusive, on the day the claim was opened. */
  dateFrom?: string
  dateTo?: string
}

/**
 * Staff side of payment claims (hub ADR 0029): the paged list (COLLECTION_CLAIM_VIEW_ALL) and the resolution
 * (COLLECTION_CLAIM_RESOLVE). The payer's own claim/withdraw calls live in {@link usePayments}.
 */
export const usePaymentClaims = () => {
  const list = (params: ListParams = {}) =>
    useApi<Page<PaymentClaimDto>>('/v1/admin/payment-claims', {
      query: {
        page: params.page ?? 0,
        size: params.size ?? 20,
        ...(params.status ? { status: params.status } : {}),
        ...(params.q ? { q: params.q } : {}),
        ...(params.memberUuid ? { memberUuid: params.memberUuid } : {}),
        ...(params.dateFrom ? { dateFrom: params.dateFrom } : {}),
        ...(params.dateTo ? { dateTo: params.dateTo } : {}),
      },
    })

  /** Keeps the amount as credit, refunds it (booked as a reversal) or rejects the claim. */
  const resolve = (uuid: string, body: ResolvePaymentClaimRequest) =>
    useApi<PaymentClaimDto>(`/v1/admin/payment-claims/${uuid}/resolve`, { method: 'PUT', body })

  return { list, resolve }
}
