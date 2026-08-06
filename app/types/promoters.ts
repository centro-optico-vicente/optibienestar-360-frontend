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

/** Estado de una comisión en el ledger. */
export type CommissionStatus = 'PENDING' | 'PAID' | 'VOIDED' | 'DISPUTED'

export const COMMISSION_STATUS_OPTIONS: { label: string, value: CommissionStatus, labelKey: string }[] = [
  { label: 'Pendiente', value: 'PENDING', labelKey: 'commissions.status.PENDING' },
  { label: 'Pagada', value: 'PAID', labelKey: 'commissions.status.PAID' },
  { label: 'Anulada', value: 'VOIDED', labelKey: 'commissions.status.VOIDED' },
  { label: 'En disputa', value: 'DISPUTED', labelKey: 'commissions.status.DISPUTED' },
]

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

export interface PromoterDto {
  uuid: string
  displayName: string
  description?: string
  referralCode: string
  /** true en la fila del sistema INSTITUCION (no editable ni eliminable). */
  system: boolean
  userUuid?: string | null
  personUuid?: string | null
  promoterTypeUuid?: string | null
  promoterTypeName?: string | null
  email?: string
  phone?: string
  totalReferrals: number
  totalCommissionPaid: number
  active: boolean
  status: PromoterStatus
  createdAt: string
  updatedAt: string
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

/** Fila del ledger de comisiones (DTO con @JsonInclude(NON_NULL): los null se omiten). */
export interface CommissionDto {
  uuid: string
  promoterUuid?: string
  promoterCode?: string
  promoterDisplayName?: string
  paymentUuid?: string
  memberUuid?: string
  amount?: number
  currency?: string
  calculationBasis?: number
  /** XOR con flatAmount */
  commissionPct?: number
  /** XOR con commissionPct */
  flatAmount?: number
  tierNameSnapshot?: string
  appliesTo?: CommissionAppliesTo
  periodStrategy?: CommissionPeriodStrategy
  periodStart?: string
  periodEnd?: string
  earnedAt?: string
  payoutReference?: string
  paidAt?: string
  voidedAt?: string
  voidReason?: string
  adminNotes?: string
  active: boolean
  status: CommissionStatus
  createdAt?: string
  updatedAt?: string
}

/** Body de POST /v1/admin/commissions/payout (cierre de período; `dryRun` previsualiza sin escribir). */
export interface CommissionPayoutRequest {
  periodStart: string
  periodEnd: string
  payoutReference: string
  dryRun?: boolean
}

/** Detalle por promotor dentro de la respuesta de payout. */
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
  emailFailureReason?: string
}

/** Respuesta de POST /v1/admin/commissions/payout (@JsonInclude(NON_NULL)). */
export interface CommissionPayoutResponse {
  periodStart: string
  periodEnd: string
  payoutReference: string
  dryRun: boolean
  totalPromoters: number
  totalCommissions: number
  totalAmount: number
  currency: string
  executedAt: string
  perPromoter: CommissionPayoutPerPromoter[]
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

/** Fila del histórico de referidos del afiliado autenticado (@JsonInclude(NON_NULL)). */
export interface MyReferralDto {
  uuid: string
  status: ReferralStatus
  referralCode: string
  referredMemberUuid?: string
  referredMemberName?: string
  enrolledAt?: string
  expiresAt?: string
  /** XOR con rewardFlatAmount */
  rewardPct?: number
  /** XOR con rewardPct */
  rewardFlatAmount?: number
  rewardCurrency?: string
  rewardPaymentUuid?: string
  rewardGrantedAt?: string
  createdAt?: string
}
