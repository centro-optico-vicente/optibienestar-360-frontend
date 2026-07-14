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
  // Subject (flat refs extracted by the mapper)
  membershipUuid: string
  memberUuid: string
  planUuid?: string | null
  planCode?: string | null
  // Payer (null = cash at counter with no user account)
  payerUserUuid?: string | null
  // Money
  amount: number | string
  currency: string
  // Method + reference
  paymentMethod: PaymentMethod | string
  referenceNumber?: string | null
  // Dates
  paymentDate: string
  receivedAt?: string | null
  // Allocation
  inscription: boolean
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
  reviewedByUserUuid?: string | null
  reviewedAt?: string | null
  reviewReason?: string | null
  // Audit
  active?: boolean
  createdAt?: string
  updatedAt?: string
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
