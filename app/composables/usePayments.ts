import type { Page } from '~/types/admin'
import type {
  DownlinePaymentCreateRequest,
  MyPaymentCreateRequest,
  PaymentApproveRequest,
  PaymentCreateRequest,
  PaymentDto,
  PaymentLinesUpdateRequest,
  PaymentRejectRequest,
  PaymentSupportUrlDto,
  OutPaymentCreateRequest,
  OutPaymentUpdateRequest,
} from '~/types/payments'

interface ListParams {
  page?: number
  size?: number
  /** Multi-column sort, e.g. `['receivedAt,desc']` — repeated as `sort=` query params. */
  sort?: string[]
  filter?: string
  q?: string
  /**
   * `IN`/`OUT` to constrain to one direction, `ALL` for both ("Movimientos"),
   * omitted defaults to `IN` (this screen's historical behavior). A separate
   * query param, not folded into `filter` — the backend's RSQL validator
   * doesn't support the `=in=` operator a multi-value filter would need.
   */
  direction?: 'IN' | 'OUT' | 'ALL'
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
        ...(params.direction ? { direction: params.direction } : {}),
      },
    })

  const get = (uuid: string) =>
    useApi<PaymentDto>(`/v1/admin/payments/${uuid}`)

  /**
   * Multipart registration: `payment` part (JSON) + `support` part (optional file).
   * ofetch detects the FormData and sets the multipart boundary automatically; no
   * Content-Type is forced (useApi only adds Accept + Authorization).
   *
   * `draft=true` starts the payment at `DRAFT` instead of the historical
   * one-step `PENDING` (V117 lines feature) — lines then stay editable via
   * `updateLines` until an explicit `submit`. Omitted/false keeps today's
   * behavior unchanged.
   */
  const register = (payload: PaymentCreateRequest, support?: File | null, draft?: boolean) => {
    const form = new FormData()
    form.append('payment', new Blob([JSON.stringify(payload)], { type: 'application/json' }))
    if (support) form.append('support', support)
    return useApi<PaymentDto>('/v1/admin/payments', { method: 'POST', body: form, query: draft ? { draft: true } : {} })
  }

  /** Replaces the entire lines collection of a DRAFT payment (V117 lines feature). COLLECTION_CREATE. */
  const updateLines = (uuid: string, payload: PaymentLinesUpdateRequest) =>
    useApi<PaymentDto>(`/v1/admin/payments/${uuid}/lines`, { method: 'PUT', body: payload })

  /** DRAFT -> PENDING, moves a draft collection into the admin review queue. */
  const submit = (uuid: string) =>
    useApi<PaymentDto>(`/v1/admin/payments/${uuid}/submit`, { method: 'PUT' })

  /** PENDING -> DRAFT, the only way to make a submitted payment's lines editable again. */
  const reactivateToDraft = (uuid: string) =>
    useApi<PaymentDto>(`/v1/admin/payments/${uuid}/reactivate`, { method: 'PUT' })

  const registerOut = (payload: OutPaymentCreateRequest, support?: File | null) => {
    const form = new FormData()
    form.append('payment', new Blob([JSON.stringify(payload)], { type: 'application/json' }))
    if (support) form.append('support', support)
    return useApi<PaymentDto>('/v1/admin/payments/out', { method: 'POST', body: form })
  }

  const updateOut = (uuid: string, payload: OutPaymentUpdateRequest, support?: File | null) => {
    return useApi<PaymentDto>(`/v1/admin/payments/${uuid}/out`, { method: 'PUT', body: payload })
  }

  const removeOut = (uuid: string) =>
    useApi<void>(`/v1/admin/payments/${uuid}/out`, { method: 'DELETE' })

  const processOut = (uuid: string) =>
    useApi<PaymentDto>(`/v1/admin/payments/${uuid}/out/process`, { method: 'PUT' })

  const approveOut = (uuid: string, reason?: string) =>
    useApi<PaymentDto>(`/v1/admin/payments/${uuid}/out/approve`, { method: 'PUT', body: reason ? { reason } : {} })

  const rejectOut = (uuid: string, reason: string) =>
    useApi<PaymentDto>(`/v1/admin/payments/${uuid}/out/reject`, { method: 'PUT', body: { reason } })

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

  function toPaymentForm(payload: MyPaymentCreateRequest | DownlinePaymentCreateRequest, support?: File | null) {
    const form = new FormData()
    form.append('payment', new Blob([JSON.stringify(payload)], { type: 'application/json' }))
    if (support) form.append('support', support)
    return form
  }

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

  /** Register a payment for the caller's own active membership (PAYMENT_CREATE_OWN). `draft` — see {@link register}. */
  const registerOwn = (payload: MyPaymentCreateRequest, support?: File | null, draft?: boolean) =>
    useApi<PaymentDto>('/v1/me/payments', { method: 'POST', body: toPaymentForm(payload, support), query: draft ? { draft: true } : {} })

  /** Replaces the lines of the caller's own DRAFT payment (V117 lines feature). */
  const updateLinesOwn = (uuid: string, payload: PaymentLinesUpdateRequest) =>
    useApi<PaymentDto>(`/v1/me/payments/${uuid}/lines`, { method: 'PUT', body: payload })

  /** DRAFT -> PENDING for the caller's own payment. */
  const submitOwn = (uuid: string) =>
    useApi<PaymentDto>(`/v1/me/payments/${uuid}/submit`, { method: 'PUT' })

  /** PENDING -> DRAFT for the caller's own payment. */
  const reactivateToDraftOwn = (uuid: string) =>
    useApi<PaymentDto>(`/v1/me/payments/${uuid}/reactivate`, { method: 'PUT' })

  /** Delete the caller's own still-PENDING payment (PAYMENT_DELETE_OWN). */
  const removeOwn = (uuid: string) =>
    useApi<void>(`/v1/me/payments/${uuid}`, { method: 'DELETE' })

  // ---- Promoter downline management (hub plan payments-unification, "Mis portales") ----
  /** Register a collection for an affiliate in the caller's own downline (PAYMENT_CREATE_DOWNLINE). `draft` — see {@link register}. */
  const registerForDownline = (payload: DownlinePaymentCreateRequest, support?: File | null, draft?: boolean) =>
    useApi<PaymentDto>('/v1/promoter/me/payments', { method: 'POST', body: toPaymentForm(payload, support), query: draft ? { draft: true } : {} })

  /** Replaces the lines of a DRAFT collection from the caller's own downline (V117 lines feature). */
  const updateLinesForDownline = (uuid: string, payload: PaymentLinesUpdateRequest) =>
    useApi<PaymentDto>(`/v1/promoter/me/payments/${uuid}/lines`, { method: 'PUT', body: payload })

  /** DRAFT -> PENDING for a downline collection. */
  const submitForDownline = (uuid: string) =>
    useApi<PaymentDto>(`/v1/promoter/me/payments/${uuid}/submit`, { method: 'PUT' })

  /** PENDING -> DRAFT for a downline collection. */
  const reactivateToDraftForDownline = (uuid: string) =>
    useApi<PaymentDto>(`/v1/promoter/me/payments/${uuid}/reactivate`, { method: 'PUT' })

  /** Approve a PENDING downline collection (PAYMENT_APPROVE_DOWNLINE, not granted by default). */
  const approveForDownline = (uuid: string, reason?: string) =>
    useApi<PaymentDto>(`/v1/promoter/me/payments/${uuid}/approve`, {
      method: 'PUT',
      body: (reason ? { reason } : {}) as PaymentApproveRequest,
    })

  /** Reject a PENDING downline collection (PAYMENT_REJECT_DOWNLINE, not granted by default). */
  const rejectForDownline = (uuid: string, reason: string) =>
    useApi<PaymentDto>(`/v1/promoter/me/payments/${uuid}/reject`, {
      method: 'PUT',
      body: { reason } as PaymentRejectRequest,
    })

  /** Delete a PENDING downline collection registered by mistake (PAYMENT_DELETE_DOWNLINE). */
  const removeForDownline = (uuid: string) =>
    useApi<void>(`/v1/promoter/me/payments/${uuid}`, { method: 'DELETE' })

  return {
    list, get, register, registerOut, updateOut, removeOut, processOut, approveOut, rejectOut, approve, reject, remove, supportUrl, mine, mineForPromoter,
    updateLines, submit, reactivateToDraft,
    registerOwn, removeOwn, updateLinesOwn, submitOwn, reactivateToDraftOwn,
    registerForDownline, approveForDownline, rejectForDownline, removeForDownline,
    updateLinesForDownline, submitForDownline, reactivateToDraftForDownline,
  }
}
