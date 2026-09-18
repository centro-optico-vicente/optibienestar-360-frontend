// Types for the manual payments vertical (/v1/admin/payments + /v1/me/payments),
// aligned with the backend (V23__payments.sql, PaymentDto / PaymentCreateRequest /
// PaymentApproveRequest / PaymentRejectRequest / PaymentSupportUrlDto).
//
// Flow: register (multipart with optional proof to R2) -> human review ->
// approve/reject (+ email + commission). The payment status follows the cycle
// PENDING -> APPROVED | REJECTED. Money (BigDecimal) may serialize as number or
// string depending on the ObjectMapper; typed as `number | string` and always
// formatted through `Number()`.

// ---- Payment method (7 values, mirror of the V23 CHECK / PaymentMethod enum) ----
export type PaymentMethod =
  | 'BANK_TRANSFER'
  | 'CASH'
  | 'ZELLE'
  | 'PAGO_MOVIL'
  | 'CRYPTO'
  | 'INTERNATIONAL_TRANSFER'
  | 'OTHER'

// `label` is the Spanish fallback; `labelKey` resolves to i18n at the usage point.
export const PAYMENT_METHOD_OPTIONS: { label: string, value: PaymentMethod, labelKey: string }[] = [
  { label: 'Transferencia bancaria', value: 'BANK_TRANSFER', labelKey: 'payments.methods.BANK_TRANSFER' },
  { label: 'Efectivo', value: 'CASH', labelKey: 'payments.methods.CASH' },
  { label: 'Zelle', value: 'ZELLE', labelKey: 'payments.methods.ZELLE' },
  { label: 'Pago móvil', value: 'PAGO_MOVIL', labelKey: 'payments.methods.PAGO_MOVIL' },
  { label: 'Cripto', value: 'CRYPTO', labelKey: 'payments.methods.CRYPTO' },
  { label: 'Transferencia internacional', value: 'INTERNATIONAL_TRANSFER', labelKey: 'payments.methods.INTERNATIONAL_TRANSFER' },
  { label: 'Otro', value: 'OTHER', labelKey: 'payments.methods.OTHER' },
]

// ---- Payment currency (ADR 0015 — the only two currencies actually in play:
// VES per ADR 0010, USD per ADR 0008; the full currency master supports more,
// but a payment is always received in one of these two) ----
export const PAYMENT_CURRENCY_OPTIONS: { label: string, value: string }[] = [
  { label: 'USD', value: 'USD' },
  { label: 'VES', value: 'VES' },
]

// ---- Review status (PENDING/APPROVED/REJECTED) ----
export type PaymentStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

// `label` is the Spanish fallback; `labelKey` resolves to i18n at the usage point.
export const PAYMENT_STATUS_OPTIONS: { label: string, value: PaymentStatus, labelKey: string }[] = [
  { label: 'Pendiente', value: 'PENDING', labelKey: 'payments.status.PENDING' },
  { label: 'Aprobado', value: 'APPROVED', labelKey: 'payments.status.APPROVED' },
  { label: 'Rechazado', value: 'REJECTED', labelKey: 'payments.status.REJECTED' },
]

/** Status badge color (Nuxt UI palette). */
export function paymentStatusColor(value?: string | null): 'warning' | 'success' | 'error' | 'neutral' {
  switch (value) {
    case 'PENDING': return 'warning'
    case 'APPROVED': return 'success'
    case 'REJECTED': return 'error'
    default: return 'neutral'
  }
}

// ---- Payment ----

/**
 * Backend response. The proof does NOT expose the raw URL; it is requested apart
 * via GET /{uuid}/support (presigned). `supportFileAvailable` flags whether a proof
 * is attached.
 */
export interface PaymentDto {
  uuid: string
  // Header (V117, hub plan payments-unification) — `direction` distinguishes
  // a collection (`IN`, the only kind this screen creates) from a commission
  // payout (`OUT`, written only by CommissionPayoutService). `paymentType` is
  // the REASON (payment_categories) — not `paymentMethod` below (the
  // line-level HOW). `membership`/`member`/`plan` below are null for `OUT`.
  direction?: 'IN' | 'OUT'
  paymentType_Uuid?: string | null
  paymentType_Display?: string | null
  person_Uuid?: string | null
  person_Display?: string | null
  promoter_Uuid?: string | null
  promoter_Display?: string | null
  // Subject (flat refs extracted by the mapper — member/membership resolve
  // to a readable `_Display` server-side, hub ADR 0014)
  membership_Uuid?: string | null
  membership_Display?: string | null
  member_Uuid?: string | null
  member_Display?: string | null
  plan_Uuid?: string | null
  plan_Display?: string | null
  /** Plan SKU (FK triple `_Code`, hub ADR 0014) — was `planCode`. */
  plan_Code?: string | null
  // Payer (null = cash at counter with no user account)
  payerUserUuid?: string | null
  // Money (ADR 0015 — currency/exchange-rate conversion, hub ADR 0014 `_Display`
  // sibling convention; conversion fields are null together when no rate is
  // available — degrade gracefully, never assume presence)
  amount: number | string
  currency: string
  amount_Display?: string | null
  currency_Code?: string | null
  /** FK pair (hub ADR 0014) — quick-link to `/dashboard/catalogs/currencies`. */
  currency_Uuid?: string | null
  currency_Display?: string | null
  amountConverted?: number | string | null
  amountConverted_Display?: string | null
  convertedCurrency_Code?: string | null
  convertedCurrency_Uuid?: string | null
  convertedCurrency_Display?: string | null
  exchangeRateUsed?: number | string | null
  exchangeRateDate?: string | null
  // Method + reference
  paymentMethod: PaymentMethod | string
  paymentMethod_Display?: string | null
  referenceNumber?: string | null
  // Dates
  paymentDate: string
  paymentDate_Display?: string | null
  receivedAt?: string | null
  receivedAt_Display?: string | null
  // Allocation
  inscription: boolean
  inscription_Display?: string | null
  /** First day of the covered month (recurring only); null when it is an inscription. */
  appliedPeriod?: string | null
  // Proof (metadata only; the URL is requested via /support)
  supportFileAvailable: boolean
  supportFileName?: string | null
  supportFileContentType?: string | null
  supportFileSizeBytes?: number | null
  adminNotes?: string | null
  // Review
  status: PaymentStatus | string
  status_Display?: string | null
  reviewedBy_Uuid?: string | null
  reviewedBy_Display?: string | null
  reviewedAt?: string | null
  reviewedAt_Display?: string | null
  reviewReason?: string | null
  // Audit
  active?: boolean
  active_Display?: string | null
  createdAt?: string
  createdAt_Display?: string | null
  updatedAt?: string
  updatedAt_Display?: string | null
}

/**
 * Body (JSON part `payment`) of POST /v1/admin/payments (multipart/form-data).
 * The proof travels apart as the `support` part (optional file).
 * `amount` as string to avoid precision loss (BigDecimal accepts string).
 */
export interface PaymentCreateRequest {
  membershipUuid: string
  amount: string
  /** ISO 4217 (3 letters). Defaults to USD in the backend when omitted. */
  currency?: string
  paymentMethod: PaymentMethod
  referenceNumber?: string
  /** ISO date (yyyy-MM-dd). Must not be in the future. */
  paymentDate: string
  /** true = inscription charge (one-time); forces appliedPeriod to null. */
  inscription?: boolean
  /** First day of the covered month (yyyy-MM-01). Only when inscription=false. */
  appliedPeriod?: string
  /** User account that paid; null = cash at counter. */
  payerUserUuid?: string
  adminNotes?: string
}

/**
 * Body of POST /v1/me/payments (multipart `payment` part). Same shape as
 * {@link PaymentCreateRequest} minus `membershipUuid`/`payerUserUuid` — the
 * backend resolves the caller's own active membership; the caller is
 * implicitly the payer.
 */
export interface MyPaymentCreateRequest {
  amount: string
  currency?: string
  paymentMethod: PaymentMethod
  referenceNumber?: string
  paymentDate: string
  inscription?: boolean
  appliedPeriod?: string
  adminNotes?: string
}

/**
 * Body of POST /v1/promoter/me/payments (multipart `payment` part) — a
 * promoter registering a collection on behalf of an affiliate in their own
 * downline (server verifies portfolio ownership).
 */
export interface DownlinePaymentCreateRequest extends MyPaymentCreateRequest {
  memberUuid: string
}

/** Optional body of PUT /v1/admin/payments/{uuid}/approve. */
export interface PaymentApproveRequest {
  /** Optional approval note (max 500). */
  reason?: string
}

/** Required body of PUT /v1/admin/payments/{uuid}/reject. */
export interface PaymentRejectRequest {
  /** Mandatory rejection reason (max 500). */
  reason: string
}

/** Response of GET /v1/admin/payments/{uuid}/support (presigned URL). */
export interface PaymentSupportUrlDto {
  url: string
  expiresAt: string
  expiresInSeconds: number
  fileName?: string | null
  contentType?: string | null
  sizeBytes?: number | null
}
