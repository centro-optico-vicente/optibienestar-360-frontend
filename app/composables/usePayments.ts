import type { Page } from '~/types/admin'
import type {
  PaymentCreateRequest,
  PaymentDto,
  PaymentSupportUrlDto,
} from '~/types/payments'

interface ListParams {
  page?: number
  size?: number
  /** Multi-column sort, e.g. `['receivedAt,desc']` — repeated as `sort=` query params. */
  sort?: string[]
  filter?: string
  q?: string
}

/**
 * Access to the manual payments vertical (/v1/admin/payments + /v1/me/payments).
 * Backend permissions per action:
 * - list/get/support -> PAYMENT_VIEW_ALL
 * - register (multipart) -> PAYMENT_CREATE
 * - approve -> PAYMENT_APPROVE · reject -> PAYMENT_REJECT
 * - mine() -> PAYMENT_VIEW_OWN (authenticated member's history)
 *
 * Payments are not edited: they are registered and then approved/rejected
 * (human review). A still-PENDING payment (a mistaken registration, not yet
 * reviewed) can be deleted (PAYMENT_DELETE) — the backend rejects deleting an
 * already APPROVED/REJECTED one, since those are the audited review outcomes.
 * The proof of payment travels as a multipart part on registration and is
 * later fetched via a presigned URL.
 */
export const usePayments = () => {
  // ---- Admin ----
  const list = (params: ListParams = {}) =>
    useApi<Page<PaymentDto>>('/v1/admin/payments', {
      query: {
        page: params.page ?? 0,
        size: params.size ?? 20,
        ...(params.sort?.length ? { sort: params.sort } : {}),
        ...(params.filter ? { filter: params.filter } : {}),
        ...(params.q ? { q: params.q } : {}),
      },
    })

  const get = (uuid: string) =>
    useApi<PaymentDto>(`/v1/admin/payments/${uuid}`)

  /**
   * Multipart registration: `payment` part (JSON) + `support` part (optional file).
   * ofetch detects the FormData and sets the multipart boundary automatically; no
   * Content-Type is forced (useApi only adds Accept + Authorization).
   */
  const register = (payload: PaymentCreateRequest, support?: File | null) => {
    const form = new FormData()
    form.append('payment', new Blob([JSON.stringify(payload)], { type: 'application/json' }))
    if (support) form.append('support', support)
    return useApi<PaymentDto>('/v1/admin/payments', { method: 'POST', body: form })
  }

  /** Approve a PENDING payment. `reason` is an optional approval note. */
  const approve = (uuid: string, reason?: string) =>
    useApi<PaymentDto>(`/v1/admin/payments/${uuid}/approve`, {
      method: 'PUT',
      body: reason ? { reason } : {},
    })

  /** Reject a PENDING payment. `reason` is mandatory (the member will see it). */
  const reject = (uuid: string, reason: string) =>
    useApi<PaymentDto>(`/v1/admin/payments/${uuid}/reject`, {
      method: 'PUT',
      body: { reason },
    })

  /**
   * Delete a still-PENDING payment registered by mistake. PAYMENT_DELETE.
   * The backend rejects (422) deleting a payment that is already APPROVED/REJECTED.
   */
  const remove = (uuid: string) =>
    useApi<void>(`/v1/admin/payments/${uuid}`, { method: 'DELETE' })

  /**
   * Presigned URL of the proof (default 5 min; ttl clamped to [1..60] in the
   * backend). 404 if there is no proof; 422 if R2 is disabled on the replica.
   */
  const supportUrl = (uuid: string, ttlMinutes?: number) =>
    useApi<PaymentSupportUrlDto>(`/v1/admin/payments/${uuid}/support`, {
      query: ttlMinutes ? { ttlMinutes } : {},
    })

  // ---- Member self-service ----
  /** My payment history (PAYMENT_VIEW_OWN). No RSQL nor free-text. */
  const mine = (params: Pick<ListParams, 'page' | 'size' | 'sort'> = {}) =>
    useApi<Page<PaymentDto>>('/v1/me/payments', {
      query: {
        page: params.page ?? 0,
        size: params.size ?? 20,
        sort: params.sort?.length ? params.sort : ['receivedAt,desc'],
      },
    })

  // ---- Promoter self-service (hub plan payments-unification, "Mis portales") ----
  /**
   * `direction=IN` -> "Cobros de mis afiliados" (collections from the
   * promoter's downline); `direction=OUT` -> "Mis pagos de comisiones"
   * (commission payouts disbursed to the promoter). PROMOTER_VIEW_OWN.
   */
  const mineForPromoter = (direction: 'IN' | 'OUT', params: Pick<ListParams, 'page' | 'size' | 'sort'> = {}) =>
    useApi<Page<PaymentDto>>('/v1/promoter/me/payments', {
      query: {
        direction,
        page: params.page ?? 0,
        size: params.size ?? 20,
        sort: params.sort?.length ? params.sort : ['receivedAt,desc'],
      },
    })

  return { list, get, register, approve, reject, remove, supportUrl, mine, mineForPromoter }
}
