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


// ---- Bank account type (payment_lines.bank_account_type, free VARCHAR(40) —
// restricted here to the two types actually used in Venezuela banking) ----
export const BANK_ACCOUNT_TYPE_OPTIONS: { label: string, value: string }[] = [
  { label: 'Corriente', value: 'CORRIENTE' },
  { label: 'Ahorro', value: 'AHORRO' },
]

// ---- Review status (PENDING/APPROVED/REJECTED) ----
export type PaymentStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED'

// `label` is the Spanish fallback; `labelKey` resolves to i18n at the usage point.
export const PAYMENT_STATUS_OPTIONS: { label: string, value: PaymentStatus, labelKey: string }[] = [
  { label: 'Pendiente', value: 'PENDING', labelKey: 'payments.status.PENDING' },
  { label: 'Aprobado', value: 'APPROVED', labelKey: 'payments.status.APPROVED' },
  { label: 'Rechazado', value: 'REJECTED', labelKey: 'payments.status.REJECTED' },
]

/** Status badge color (Nuxt UI palette). */
export function paymentStatusColor(value?: string | null): 'warning' | 'success' | 'error' | 'neutral' {
  switch (value) {
    case 'DRAFT':
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
  /** Who the payment credits when the payer is not the holder (V203), with document / contract snapshots. */
  beneficiary_Uuid?: string | null
  beneficiary_Display?: string | null
  beneficiaryDocument?: string | null
  beneficiaryContractNumber?: string | null
  /** Open claim on this payment's remaining credit (hub ADR 0029); `null` when there is none. */
  openClaim?: PaymentClaimDto | null
  /** Credit of this payment not yet applied to a membership; `null` when it is not credit. */
  creditRemaining?: number | string | null
  creditRemaining_Display?: string | null
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
  /** FK pair (hub ADR 0014) — only populated when the method's `mandatoryBank` is true. */
  bank_Uuid?: string | null
  bank_Display?: string | null
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
  /** First day of the LAST month covered by a multi-month advance (V154); null = single-month. */
  coverageThroughPeriod?: string | null
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
  // One-off discount (V41; all null when none applied). The affiliate pays
  // `amount - discountAmount`; commissions are computed on that net.
  discountAmount?: number | string | null
  discountAmount_Display?: string | null
  discountReason?: string | null
  discountedByUserUuid?: string | null
  discountedAt?: string | null
  discountedAt_Display?: string | null
  /**
   * Full lines collection (V117 lines feature) — every `payment_lines` row,
   * in addition to the flattened first-line fields above (kept as-is). A
   * single-line payment still populates both; a genuinely split payment
   * only shows its first line in the flat fields, the full split here.
   */
  lines?: PaymentLineDto[]
  // Audit
  active?: boolean
  active_Display?: string | null
  createdAt?: string
  createdAt_Display?: string | null
  updatedAt?: string
  updatedAt_Display?: string | null
}

/** Body of POST /v1/admin/payments/{uuid}/discount — `amount` is the discount itself, not the new total. */
export interface PaymentDiscountRequest {
  amount: number
  reason: string
}

/** GET /v1/admin/payments/discount-authority — the caller's cap in %; null = uncapped (back-office staff). */
export interface DiscountAuthorityDto {
  maxDiscountPct: number | string | null
}

/** A single `payment_lines` row (V117 lines feature) — response shape. */
export interface PaymentLineDto {
  uuid: string
  method_Uuid?: string | null
  method_Display?: string | null
  methodDescription?: string | null
  methodMandatoryIdentification: boolean
  methodMandatoryBank: boolean
  methodMandatoryBankAccount: boolean
  methodMandatoryAccountType: boolean
  methodMandatoryAccountCode: boolean
  methodMandatoryPhone: boolean
  methodMandatoryEmail: boolean
  methodMandatoryReferenceNumber: boolean
  amount: number | string
  amount_Display?: string | null
  currency_Code?: string | null
  currency_Uuid?: string | null
  currency_Display?: string | null
  referenceNumber?: string | null
  bank_Uuid?: string | null
  bank_Display?: string | null
  identification?: string | null
  bankAccountType?: string | null
  bankAccountCode?: string | null
  bankAccountIdentifier?: string | null
  phone?: string | null
  email?: string | null
  status: PaymentStatus | string
  status_Display?: string | null
  reviewedBy_Uuid?: string | null
  reviewedBy_Display?: string | null
  reviewedAt?: string | null
  reviewedAt_Display?: string | null
  reviewReason?: string | null
  /** Company account the payer indicated (V201). */
  companyBankAccount_Uuid?: string | null
  companyBankAccount_Display?: string | null
}

/**
 * Input shape for a single method/amount block within a multi-line payment
 * (V117 lines feature) — embedded in the create requests' `lines` array and
 * in {@link PaymentLinesUpdateRequest}. `amount` as string, same BigDecimal
 * convention as the header.
 */
export interface PaymentLineRequest {
  paymentMethodUuid: string
  bankUuid?: string
  amount: string
  /** Optional — omit to fall back to the header's resolved currency. */
  currencyUuid?: string
  identification?: string
  bankAccountType?: string
  bankAccountCode?: string
  bankAccountIdentifier?: string
  phone?: string
  email?: string
  referenceNumber?: string
  /** Company account (V201) the payer says they paid into; optional. */
  companyBankAccountUuid?: string
}

/** Body of `PUT /{uuid}/lines` — replaces the entire lines collection of a DRAFT payment. */
export interface PaymentLinesUpdateRequest {
  lines: PaymentLineRequest[]
  /** Optional declared header total — `sum(lines.amount)` must not exceed it; omitted = auto-total from lines. */
  amount?: string
}

/**
 * Body (JSON part `payment`) of POST /v1/admin/payments (multipart/form-data).
 * The proof travels apart as the `support` part (optional file).
 * `amount` as string to avoid precision loss (BigDecimal accepts string).
 *
 * Method-detail fields (bank/identification/account/phone/email) mirror
 * {@link OutPaymentCreateRequest} — same `payment-methods` catalog (UUID +
 * `mandatory*` flags) and the same `banks` catalog, shared between IN and OUT
 * at the backend's `payment_lines` table.
 */
export interface PaymentCreateRequest {
  membershipUuid: string
  amount: string
  /** ISO 4217 (3 letters). Defaults to USD in the backend when omitted. */
  currency?: string
  paymentMethodUuid: string
  /** Required only when the selected method's `mandatoryBank` flag is set. */
  bankUuid?: string
  identification?: string
  bankAccountType?: string
  bankAccountCode?: string
  /** Required only when the selected method's `mandatoryBankAccount` flag is set. */
  bankAccountIdentifier?: string
  phone?: string
  email?: string
  referenceNumber?: string
  /** ISO date (yyyy-MM-dd). Must not be in the future. */
  paymentDate: string
  /** true = inscription charge (one-time); forces appliedPeriod to null. */
  inscription?: boolean
  /** First day of the covered month (yyyy-MM-01). Only when inscription=false. */
  appliedPeriod?: string
  /**
   * First day of the LAST month covered by a multi-month advance (V154).
   * Only when inscription=false; must not be before `appliedPeriod`.
   */
  coverageThroughPeriod?: string
  /** User account that paid; null = cash at counter. */
  payerUserUuid?: string
  adminNotes?: string
  /**
   * Multi-line split (V117 lines feature). `undefined`/empty falls back to
   * the legacy single-line shape built from this record's own flat
   * method/amount/reference fields above (ignored when this is populated).
   */
  lines?: PaymentLineRequest[]
}

export interface OutPaymentCreateRequest {
  paymentCategoryUuid: string
  promoterUuid: string
  personUuid: string
  amount: string
  currency?: string
  paymentMethodUuid: string
  bankUuid?: string
  identification?: string
  bankAccountType?: string
  bankAccountCode?: string
  bankAccountIdentifier?: string
  phone?: string
  email?: string
  referenceNumber?: string
  paymentDate: string
  adminNotes?: string
}

export type OutPaymentUpdateRequest = OutPaymentCreateRequest

/**
 * Body of POST /v1/me/payments (multipart `payment` part). Same shape as
 * {@link PaymentCreateRequest} minus `membershipUuid`/`payerUserUuid` — the
 * backend resolves the caller's own active membership; the caller is
 * implicitly the payer.
 */
export interface MyPaymentCreateRequest {
  amount: string
  currency?: string
  paymentMethodUuid: string
  /** Required only when the selected method's `mandatoryBank` flag is set. */
  bankUuid?: string
  identification?: string
  bankAccountType?: string
  bankAccountCode?: string
  /** Required only when the selected method's `mandatoryBankAccount` flag is set. */
  bankAccountIdentifier?: string
  phone?: string
  email?: string
  referenceNumber?: string
  paymentDate: string
  inscription?: boolean
  appliedPeriod?: string
  /** See {@link PaymentCreateRequest.coverageThroughPeriod} — same rules. */
  coverageThroughPeriod?: string
  adminNotes?: string
  /** See {@link PaymentCreateRequest.lines}. */
  lines?: PaymentLineRequest[]
  /** Pay for someone else (V203): membership from a CONFIRMED lookup. */
  beneficiaryMembershipUuid?: string
  /** Holder with no active membership from a CONFIRMED lookup: the payment becomes their credit. */
  beneficiaryPersonUuid?: string
  /** Remember the first line's origin account (bank + account number) for next time (V204). */
  rememberOriginAccount?: boolean
}

/**
 * One match of GET /v1/me/payments/membership-lookup (V203). The name is abbreviated server-side; the
 * membership fields are null when the holder has no active membership (payment then becomes their credit).
 */
export interface BeneficiaryMatchDto {
  personUuid: string
  membershipUuid: string | null
  contractNumber: string | null
  holderName: string
  planName: string | null
}

/**
 * Body of POST /v1/advisors/me/payments (multipart `payment` part) — a
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

/** A bank account owned by the company (V201) — what a payer deposits into. `GET /v1/me/company-bank-accounts` + admin CRUD. */
export interface CompanyBankAccountDto {
  uuid: string
  bank_Uuid?: string | null
  bank_Code?: string | null
  bank_Display?: string | null
  currency_Code: string
  accountType: string
  accountNumber: string
  holderName: string
  holderDocument: string
  notes?: string | null
  sortOrder: number
  /** Shown without authentication on `GET /v1/public/company-bank-accounts` (V204). */
  publicVisible: boolean
  active: boolean
}

export interface CompanyBankAccountRequest {
  bankUuid: string
  /** ISO code, e.g. `USD`. */
  currency: string
  accountType: string
  accountNumber: string
  holderName: string
  holderDocument: string
  notes?: string
  sortOrder?: number
  /** Show it without authentication; defaults to private on create (V204). */
  publicVisible?: boolean
  active?: boolean
}

/** An origin account the caller chose to remember (V204): `GET /v1/me/bank-accounts`. */
export interface SavedOriginAccountDto {
  uuid: string
  bank_Uuid?: string | null
  bank_Code?: string | null
  bank_Display?: string | null
  accountType?: string | null
  accountCode?: string | null
  accountIdentifier: string
  identification?: string | null
  alias?: string | null
}

/** Body of `POST` / `PUT /v1/me/bank-accounts` — one of the caller's own origin accounts (V204). */
export interface MyBankAccountRequest {
  bankUuid: string
  accountType?: string | null
  accountCode?: string | null
  accountIdentifier: string
  identification?: string | null
  alias?: string | null
}

/** `GET /v1/me/payments/credit-balance` — the caller's credit ("saldo a favor") per currency (V201). */
export type ClaimReason = 'ERROR' | 'OVERPAID' | 'REFUND_REQUEST' | 'OTHER'
export const CLAIM_REASONS: readonly ClaimReason[] = ['ERROR', 'OVERPAID', 'REFUND_REQUEST', 'OTHER']
export type ClaimStatus = 'OPEN' | 'KEPT_AS_CREDIT' | 'REFUNDED' | 'REJECTED' | 'WITHDRAWN' | 'USED_BY_AGREEMENT'
export const CLAIM_STATUSES: readonly ClaimStatus[] = ['OPEN', 'KEPT_AS_CREDIT', 'REFUNDED', 'REJECTED', 'WITHDRAWN', 'USED_BY_AGREEMENT']

/** A claim on the remaining credit of an approved payment (hub ADR 0029). While OPEN that amount is frozen. */
export interface PaymentClaimDto {
  uuid: string
  paymentUuid: string
  /** Payment reference, payer and beneficiary — present on the admin list rows. */
  payment_Display?: string | null
  person_Display?: string | null
  beneficiary_Display?: string | null
  reason: ClaimReason
  reason_Display?: string | null
  claimedAmount: number | string
  claimedAmount_Display?: string | null
  currency_Code?: string | null
  comment?: string | null
  status: ClaimStatus
  status_Display?: string | null
  openedAt?: string | null
  openedAt_Display?: string | null
  openedBy_Display?: string | null
  resolvedAt?: string | null
  resolvedAt_Display?: string | null
  resolutionNote?: string | null
  refundedAmount?: number | string | null
}

/** Body of `POST /v1/me/payments/{uuid}/claim` and `POST /v1/admin/payments/{uuid}/claim`. */
export interface PaymentClaimRequest {
  reason: ClaimReason
  claimedAmount: number
  comment?: string
}

/** Body of `PUT /v1/admin/payment-claims/{uuid}/resolve` — COLLECTION_CLAIM_RESOLVE. */
export interface ResolvePaymentClaimRequest {
  action: 'KEEP_AS_CREDIT' | 'REFUND' | 'REJECT'
  /** Required for REFUND; at most the claimed amount. */
  refundedAmount?: number
  note?: string
}

export interface CreditBalanceDto {
  balances: Array<{ currency_Code: string, amount: number | string, amount_Display?: string | null }>
}

/** Body of `POST /v1/admin/payments/{uuid}/assign-membership` — COLLECTION_ASSIGN_MEMBERSHIP (V201). */
export interface AssignMembershipRequest {
  membershipUuid: string
  /** First day of the covered month (`yyyy-MM-01`); defaults to the current month server-side. */
  appliedPeriod?: string
  coverageThroughPeriod?: string
}
