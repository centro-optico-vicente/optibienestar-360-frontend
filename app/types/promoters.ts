// Tipos del vertical de Promotores, Comisiones y Referidos
// (/v1/admin/promoters, /v1/admin/commissions, /v1/admin/referral-codes, /v1/me/referrals).
//
// Los campos `status` llegan como String en el backend pero están fijados por CHECK
// constraints a literales del enum de la entidad (PromoterStatus, CommissionStatus,
// ReferralStatus) — se modelan aquí como uniones TS. Los listados son Page<T> con RSQL
// + `q`; las actualizaciones usan PATCH semantics (solo se aplican los campos enviados).

/** Estado de un promotor. */
export type PromoterStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'

// `label` es el fallback en español; `labelKey` resuelve a i18n en el punto de uso.
export const PROMOTER_STATUS_OPTIONS: { label: string, value: PromoterStatus, labelKey: string }[] = [
  { label: 'Activo', value: 'ACTIVE', labelKey: 'promoters.status.ACTIVE' },
  { label: 'Inactivo', value: 'INACTIVE', labelKey: 'promoters.status.INACTIVE' },
  { label: 'Suspendido', value: 'SUSPENDED', labelKey: 'promoters.status.SUSPENDED' },
]

/**
 * Estado de una comisión en el ledger. `APPROVED`/`REJECTED` (V107) son el
 * gate comercial entre el cálculo y el pago — una comisión recién calculada
 * nace `PENDING` (simulación) y solo puede pasar a `PAID` vía `/payout`
 * después de ser `APPROVED`.
 */
export type CommissionStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID' | 'VOIDED' | 'DISPUTED'

export const COMMISSION_STATUS_OPTIONS: { label: string, value: CommissionStatus, labelKey: string }[] = [
  { label: 'Pendiente', value: 'PENDING', labelKey: 'commissions.status.PENDING' },
  { label: 'Aprobada', value: 'APPROVED', labelKey: 'commissions.status.APPROVED' },
  { label: 'Rechazada', value: 'REJECTED', labelKey: 'commissions.status.REJECTED' },
  { label: 'Pagada', value: 'PAID', labelKey: 'commissions.status.PAID' },
  { label: 'Anulada', value: 'VOIDED', labelKey: 'commissions.status.VOIDED' },
  { label: 'En disputa', value: 'DISPUTED', labelKey: 'commissions.status.DISPUTED' },
]

/** Color de badge (Nuxt UI) para el estado de una comisión. */
export function commissionStatusColor(status?: CommissionStatus | string | null) {
  switch (status) {
    case 'PAID': return 'success' as const
    case 'APPROVED': return 'info' as const
    case 'PENDING': return 'warning' as const
    case 'REJECTED': return 'error' as const
    case 'VOIDED': return 'neutral' as const
    default: return 'neutral' as const // DISPUTED / desconocido
  }
}

/** A qué se aplica la comisión. */
export type CommissionAppliesTo = 'INSCRIPTION' | 'MONTHLY'

/** Estrategia de período de liquidación. */
export type CommissionPeriodStrategy =
  | 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'ANNUAL'

/** Estado de un referido. */
export type ReferralStatus =
  | 'PENDING_ENROLLMENT' | 'REGISTERED' | 'EXPIRED' | 'REWARD_GRANTED' | 'VOIDED'

export const REFERRAL_STATUS_OPTIONS: { label: string, value: ReferralStatus, labelKey: string }[] = [
  { label: 'Por inscribir', value: 'PENDING_ENROLLMENT', labelKey: 'referrals.status.PENDING_ENROLLMENT' },
  { label: 'Registrado', value: 'REGISTERED', labelKey: 'referrals.status.REGISTERED' },
  { label: 'Expirado', value: 'EXPIRED', labelKey: 'referrals.status.EXPIRED' },
  { label: 'Recompensa otorgada', value: 'REWARD_GRANTED', labelKey: 'referrals.status.REWARD_GRANTED' },
  { label: 'Anulado', value: 'VOIDED', labelKey: 'referrals.status.VOIDED' },
]

// ---- Promotores ----

/**
 * `user`/`person`/`promoterType` follow the `_Display` convention (hub ADR
 * 0014): every FK travels as `<rel>_Uuid` + `<rel>_Display` — there is no
 * flat `userEmail`/`personFullName`/`personRif`/`promoterTypeName` on the
 * real response. `person_Display` already combines the RIF + full name
 * (`"<rif> <fullName>"`), so there's no separate RIF field to read.
 * Presentational scalars (`active`, `status`, `createdAt`, `updatedAt`)
 * also carry a `_Display` sibling. `totalCommissionPaid` intentionally has
 * NO `_Display` consumed anywhere — the backend's `MONEY` formatter is
 * hardcoded to VES, but the frontend renders it in USD.
 */
export interface PromoterDto {
  uuid: string
  displayName: string
  description?: string
  referralCode: string
  /** true en la fila del sistema INSTITUCION (no editable ni eliminable). */
  system: boolean
  user_Uuid?: string | null
  user_Display?: string | null
  person_Uuid?: string | null
  person_Display?: string | null
  promoterType_Uuid?: string | null
  promoterType_Display?: string | null
  /** Cargo jerárquico (V101) — eje independiente de `promoterType`. Read-only aquí; se cambia vía `change-rank`. */
  rank_Uuid?: string | null
  rank_Display?: string | null
  /** Supervisor vigente (V101) — `null` = tope de su propia cadena. Read-only aquí; se cambia vía `assign-supervisor`/`change-rank`. */
  supervisor_Uuid?: string | null
  supervisor_Display?: string | null
  email?: string
  phone?: string
  totalReferrals: number
  totalCommissionPaid: number
  active: boolean
  active_Display?: string | null
  status: PromoterStatus
  status_Display?: string | null
  createdAt: string
  createdAt_Display?: string | null
  updatedAt: string
  updatedAt_Display?: string | null
}

/**
 * One affiliate in a promoter's portfolio — row of `PromoterDashboardDto.portfolio`.
 * `membershipStatus`/`nextDueDate` carry a `_Display` sibling (hub ADR 0014);
 * `monthlyFee` does NOT — same known `MONEY`→VES vs. real USD pricing case
 * (see `PromoterDto`).
 */
export interface PromoterMemberRow {
  memberUuid: string
  memberName: string
  /** ACTIVE = al día; SUSPENDED/EXPIRED = vencida; null = sin membresía activa. */
  membershipStatus: 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | null
  membershipStatus_Display?: string | null
  nextDueDate: string | null
  nextDueDate_Display?: string | null
  monthlyFee: number | null
}

/**
 * Body of GET /v1/admin/promoters/{uuid}/portfolio — a promoter's portfolio +
 * collection health. `periodStart`/`periodEnd` carry a `_Display` sibling;
 * `periodCommissions` does NOT (same MONEY→VES case).
 */
export interface PromoterDashboardDto {
  promoterUuid: string
  promoterName: string
  referralCode: string
  activeAffiliates: number
  affiliatesUpToDate: number
  affiliatesOverdue: number
  affiliatesWithoutMembership: number
  periodCommissions: number
  periodCurrency: string
  periodStart: string
  periodStart_Display?: string | null
  periodEnd: string
  periodEnd_Display?: string | null
  leaderboardPosition: number | null
  portfolio: PromoterMemberRow[]
}

/**
 * One row of GET /v1/admin/promoters/{uuid}/commissions/summary — commissions
 * aggregated by period. `periodStrategy`/`periodStart`/`periodEnd` carry a
 * `_Display` sibling; `totalAmount` does NOT (same MONEY→VES case).
 */
export interface CommissionPeriodSummaryDto {
  periodStrategy: CommissionPeriodStrategy
  periodStrategy_Display?: string | null
  periodStart: string
  periodStart_Display?: string | null
  periodEnd: string
  periodEnd_Display?: string | null
  commissionCount: number
  totalAmount: number
  currency: string
}

/** Body de POST /v1/admin/promoters (crea un promotor HUMANO; la fila INSTITUCION no se crea aquí). */
export interface PromoterCreateRequest {
  displayName: string
  description?: string
  /** patrón ^[A-Z0-9-]{4,20}$ */
  referralCode: string
  userUuid: string
  email?: string
  phone?: string
  promoterTypeUuid?: string
}

/**
 * Body de PUT /v1/admin/promoters/{uuid} (PATCH semantics).
 * `referralCode`, `userUuid`, `personUuid`, `system` y los contadores NO son editables.
 */
export interface PromoterUpdateRequest {
  displayName?: string
  description?: string
  email?: string
  phone?: string
  promoterTypeUuid?: string
  active?: boolean
  status?: PromoterStatus
}

// ---- Comisiones ----

/**
 * Row of the commission ledger (DTO with @JsonInclude(NON_NULL): nulls are
 * omitted). Scalars carry a `_Display` sibling (hub ADR 0014).
 * `amount`/`calculationBasis`/`flatAmount` are NOT consumed via `_Display` —
 * same known MONEY→VES vs. real USD amounts case (see `PromoterDto`);
 * `commissionPct` is (it's `NUMBER`, currency-independent).
 */
export interface CommissionDto {
  uuid: string
  promoter_Uuid?: string | null
  promoter_Display?: string | null
  /** Referral code of the promoter (FK triple `_Code`, hub ADR 0014). */
  promoter_Code?: string | null
  payment_Uuid?: string | null
  payment_Display?: string | null
  member_Uuid?: string | null
  member_Display?: string | null
  // Money (ADR 0015 — currency/exchange-rate conversion on `amount` only;
  // conversion fields are null together when no rate is available — degrade
  // gracefully, never assume presence). `calculationBasis`/`flatAmount` are
  // NOT covered — same known MONEY→VES case noted above.
  amount?: number
  currency?: string
  amount_Display?: string | null
  currency_Code?: string | null
  amountConverted?: number | string | null
  amountConverted_Display?: string | null
  convertedCurrency_Code?: string | null
  exchangeRateUsed?: number | string | null
  exchangeRateDate?: string | null
  calculationBasis?: number
  /** XOR con flatAmount */
  commissionPct?: number
  commissionPct_Display?: string | null
  /** XOR con commissionPct */
  flatAmount?: number
  tierNameSnapshot?: string
  appliesTo?: CommissionAppliesTo
  appliesTo_Display?: string | null
  periodStrategy?: CommissionPeriodStrategy
  periodStrategy_Display?: string | null
  periodStart?: string
  periodStart_Display?: string | null
  periodEnd?: string
  periodEnd_Display?: string | null
  earnedAt?: string
  earnedAt_Display?: string | null
  payoutReference?: string
  paidAt?: string
  paidAt_Display?: string | null
  voidedAt?: string
  voidedAt_Display?: string | null
  voidReason?: string
  adminNotes?: string
  active: boolean
  active_Display?: string | null
  status: CommissionStatus
  status_Display?: string | null
  createdAt?: string
  createdAt_Display?: string | null
  updatedAt?: string
  updatedAt_Display?: string | null
}

/** Body de POST /v1/admin/commissions/payout (cierre de período; `dryRun` previsualiza sin escribir). */
export interface CommissionPayoutRequest {
  periodStart: string
  periodEnd: string
  payoutReference: string
  dryRun?: boolean
}

/** Per-promoter breakdown inside the payout response. `emailDispatched` carries a `_Display` sibling. */
export interface CommissionPayoutPerPromoter {
  promoterUuid: string
  promoterCode: string
  promoterDisplayName: string
  commissionCount: number
  totalAmount: number
  currency: string
  /** Desglose CSV (también enviado por correo). */
  csv: string
  emailDispatched: boolean
  emailDispatched_Display?: string | null
  emailFailureReason?: string
}

/**
 * Response of POST /v1/admin/commissions/payout (@JsonInclude(NON_NULL)).
 * `periodStart`/`periodEnd`/`dryRun`/`executedAt` carry a `_Display` sibling;
 * `totalAmount` does NOT (same MONEY→VES case, see `PromoterDto`).
 */
export interface CommissionPayoutResponse {
  periodStart: string
  periodStart_Display?: string | null
  periodEnd: string
  periodEnd_Display?: string | null
  payoutReference: string
  dryRun: boolean
  dryRun_Display?: string | null
  totalPromoters: number
  totalCommissions: number
  totalAmount: number
  currency: string
  executedAt: string
  executedAt_Display?: string | null
  perPromoter: CommissionPayoutPerPromoter[]
}

/** Body de POST /v1/admin/commissions/re-rate (`dryRun` previsualiza sin escribir). */
export interface CommissionReRatingRequest {
  periodStart: string
  periodEnd: string
  dryRun?: boolean
}

/** Detalle por promotor dentro de la respuesta de re-rating. */
export interface CommissionReRatingPerPromoter {
  promoterUuid: string
  promoterCode: string
  promoterDisplayName: string
  inscriptionCount: number
  targetTierUuid: string
  targetTierName: string
  commissionsChanged: number
  deltaAmount: number
}

/**
 * Response of POST /v1/admin/commissions/re-rate (@JsonInclude(NON_NULL)).
 * `periodStart`/`periodEnd`/`dryRun`/`executedAt` carry a `_Display` sibling;
 * `totalDeltaAmount` does NOT (same MONEY→VES case, see `PromoterDto`).
 */
export interface CommissionReRatingResponse {
  periodStart: string
  periodStart_Display?: string | null
  periodEnd: string
  periodEnd_Display?: string | null
  dryRun: boolean
  dryRun_Display?: string | null
  totalPromoters: number
  commissionsUpdated: number
  totalDeltaAmount: number
  currency: string
  executedAt: string
  executedAt_Display?: string | null
  perPromoter: CommissionReRatingPerPromoter[]
}

/**
 * Body de POST /v1/admin/hierarchy-overrides/re-rate (hub plan §2, PR3).
 * Mismo shape que `CommissionReRatingRequest`, aplicado a
 * `promoter_hierarchy_overrides` en vez de `commissions`.
 */
export interface HierarchyOverrideReRatingRequest {
  periodStart: string
  periodEnd: string
  dryRun?: boolean
}

/** Detalle por beneficiario (Supervisor/Coordinador) dentro de la respuesta. */
export interface HierarchyOverrideReRatingPerBeneficiary {
  promoterUuid: string
  promoterCode: string
  promoterDisplayName: string
  category: string
  teamVolumeCount: number
  targetTierUuid: string
  targetTierName: string
  overridesChanged: number
  deltaAmount: number
}

/** Response of POST /v1/admin/hierarchy-overrides/re-rate (@JsonInclude(NON_NULL)). */
export interface HierarchyOverrideReRatingResponse {
  periodStart: string
  periodStart_Display?: string | null
  periodEnd: string
  periodEnd_Display?: string | null
  dryRun: boolean
  dryRun_Display?: string | null
  totalBeneficiaries: number
  overridesUpdated: number
  totalDeltaAmount: number
  currency: string
  executedAt: string
  executedAt_Display?: string | null
  perBeneficiary: HierarchyOverrideReRatingPerBeneficiary[]
}

/**
 * Body de POST /v1/admin/commissions/retroactive-topups (hub plan §3, PR4).
 * Corre DESPUÉS de `/re-rate` (directo y su sibling de overrides) — esos
 * ajustan filas aún PENDING; este cubre lo que ya quedó PAID en los cortes
 * parciales.
 */
export interface CommissionRetroactiveTopUpRequest {
  periodStart: string
  periodEnd: string
  dryRun?: boolean
}

/** Un top-up individual dentro de la respuesta (ledger genérico, ver `ledgerType`). */
export interface CommissionRetroactiveTopUpOutcome {
  promoterUuid: string
  promoterCode: string
  promoterDisplayName: string
  ledgerType: string
  basisAmount: number
  targetAmount: number
  alreadyPaidAmount: number
  retroAmount: number
  targetTierName: string
}

/** Response of POST /v1/admin/commissions/retroactive-topups (@JsonInclude(NON_NULL)). */
export interface CommissionRetroactiveTopUpResponse {
  periodStart: string
  periodStart_Display?: string | null
  periodEnd: string
  periodEnd_Display?: string | null
  dryRun: boolean
  dryRun_Display?: string | null
  totalTopUps: number
  totalRetroAmount: number
  currency: string
  executedAt: string
  executedAt_Display?: string | null
  topUps: CommissionRetroactiveTopUpOutcome[]
}

// ---- Aprobación comercial (V107, gate entre cálculo y pago) ----

/**
 * Una fila individual dentro del nodo de un promotor en
 * GET /v1/admin/commissions/approval-queue — nivel 2 de la tabla expandible.
 * `locked` = true para todo lo que no sea PENDING (el cliente lo pinta
 * marcado-y-deshabilitado, o desmarcado-y-deshabilitado si es
 * REJECTED/VOIDED) y nunca debe ser tocado por el checkbox "todo" del
 * nivel 1. `checked` es el estado inicial del checkbox.
 */
export interface CommissionApprovalRowDto {
  uuid: string
  appliesTo?: CommissionAppliesTo | null
  appliesTo_Display?: string | null
  amount: number
  amount_Display?: string | null
  currencyCode: string | null
  earnedAt: string
  earnedAt_Display?: string | null
  status: CommissionStatus
  status_Display?: string | null
  locked: boolean
  locked_Display?: string | null
  checked: boolean
  checked_Display?: string | null
}

/**
 * Un nodo de promotor (nivel 1, colapsado) de GET
 * /v1/admin/commissions/approval-queue — `periodTotal` solo suma las filas
 * `checked` (PENDING/APPROVED/PAID); una fila REJECTED/VOIDED aparece en
 * `rows` mostrando "el todo" del período pero no cuenta en el total.
 */
export interface CommissionApprovalGroupDto {
  promoterUuid: string
  promoterCode: string
  promoterDisplayName: string
  periodTotal: number
  periodTotal_Display?: string | null
  currencyCode: string | null
  rows: CommissionApprovalRowDto[]
}

/** Body de POST /v1/admin/commissions/approve — granularidad por fila, nunca bulk por promotor. */
export interface ApproveCommissionsRequest {
  commissionUuids: string[]
}

/** Body de POST /v1/admin/commissions/reject — `reason` es obligatorio y cascada a los overrides jerárquicos dependientes. */
export interface RejectCommissionsRequest {
  commissionUuids: string[]
  reason: string
}

/** Respuesta de approve/reject. `cascadedOverridesVoided` siempre es 0 para una aprobación. */
export interface CommissionApprovalActionResponse {
  commissionUuids: string[]
  cascadedOverridesVoided: number
}

// ---- Referidos ----

/** Body de POST /v1/admin/referral-codes (emite o regenera el código de referido de un afiliado). */
export interface ReferralCodeIssueRequest {
  memberUuid: string
  /** patrón ^[A-Z0-9-]{4,20}$; null/vacío = auto-generar. */
  customCode?: string
}

/** Respuesta de POST /v1/admin/referral-codes (@JsonInclude(NON_NULL)). */
export interface ReferralCodeIssueResponse {
  memberUuid: string
  memberFullName: string
  previousCode?: string
  referralCode: string
  /** true = auto-generado, false = custom/vanity. */
  generated: boolean
  issuedAt: string
}

/** Color de badge (Nuxt UI) para el estado de un referido. */
export function referralStatusColor(status?: ReferralStatus | string | null) {
  switch (status) {
    case 'REWARD_GRANTED': return 'success' as const
    case 'REGISTERED': return 'info' as const
    case 'PENDING_ENROLLMENT': return 'warning' as const
    case 'VOIDED': return 'error' as const
    default: return 'neutral' as const // EXPIRED / desconocido
  }
}

// ---- Jerarquía de promotores (V101/V104, hub plan hierarchical-commissions) ----

/**
 * One node of GET /v1/admin/promoters/hierarchy-tree — feeds the org-chart
 * view directly. Editing (move under another rank, or detach to become a
 * root) goes through `assign-supervisor`/`change-rank`, never a separate
 * write endpoint; `supervisorUuid` is carried here precisely so the client
 * knows the current value before firing one of those.
 */
export interface PromoterHierarchyNodeDto {
  uuid: string
  displayName: string
  referralCode: string
  rankCode: string | null
  rankName: string | null
  supervisorUuid: string | null
  children: PromoterHierarchyNodeDto[]
}

/** Body de POST /v1/admin/promoters/{uuid}/assign-supervisor. `supervisorUuid: null` = desasignar (tope de su propia cadena). */
export interface AssignSupervisorRequest {
  supervisorUuid: string | null
  reason: string
}

/** Body de POST /v1/admin/promoters/{uuid}/change-rank. `newSupervisorUuid` requerido salvo que `newRankUuid` sea el rango más alto. */
export interface ChangeRankRequest {
  newRankUuid: string
  newSupervisorUuid: string | null
  reason: string
}

/**
 * Resultado de una (re)asignación de supervisor — respuesta de
 * assign-supervisor y de GET .../supervisor-history (@JsonInclude(NON_NULL)).
 * `fromSupervisor*` es `null` cuando no tenía supervisor antes.
 */
export interface PromoterSupervisorAssignmentDto {
  uuid: string
  promoterUuid: string
  promoterName: string
  fromSupervisorUuid?: string | null
  fromSupervisorName?: string | null
  toSupervisorUuid?: string | null
  toSupervisorName?: string | null
  actorUserUuid?: string | null
  reason: string
  assignedAt: string
  assignedAt_Display?: string | null
}

/**
 * Row of the authenticated affiliate's referral history (@JsonInclude(NON_NULL)).
 * Scalars carry a `_Display` sibling (hub ADR 0014); `rewardFlatAmount` does
 * NOT — same known MONEY→VES vs. real USD amounts case (see `PromoterDto`);
 * `rewardPct` does (it's `NUMBER`).
 */
export interface MyReferralDto {
  uuid: string
  status: ReferralStatus
  status_Display?: string | null
  referralCode: string
  referredMemberUuid?: string
  referredMemberName?: string
  enrolledAt?: string
  enrolledAt_Display?: string | null
  expiresAt?: string
  expiresAt_Display?: string | null
  /** XOR con rewardFlatAmount */
  rewardPct?: number
  rewardPct_Display?: string | null
  /** XOR con rewardPct */
  rewardFlatAmount?: number
  rewardCurrency?: string
  rewardPaymentUuid?: string
  rewardGrantedAt?: string
  rewardGrantedAt_Display?: string | null
  createdAt?: string
  createdAt_Display?: string | null
}
