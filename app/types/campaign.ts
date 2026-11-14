import type { Page } from '~/types/admin'

// Types for the commission-campaigns vertical (/v1/admin/campaigns — hub plan
// "commission campaigns"). A Campaign is a time-boxed promotion that can scope
// which promoters/rules it applies to and pre-fill the 4 commission-rule
// screens (bandas de inscripción, bonos por escala, comisión de cobranza,
// comisión jerárquica adicional) with its own start/end dates.
//
// Confirmed against the real backend contract (AdminCampaignController,
// CampaignDto/CampaignRequest/CampaignRelaunchRequest/CampaignExceptionRequest/
// CampaignExceptionDto/CampaignTransactionLinkDto/CampaignAudienceDto/
// CampaignAudienceRequest/CampaignEffectivenessDto — optibienestar-360-backend,
// modules/campaign/dto). DisplayRef fields (ADR 0014) are never emitted as a
// nested object — they're flattened into `<name>_Uuid` / `<name>_Display` /
// `<name>_Code` siblings by DisplayBeanSerializerModifier.

/** ALL: applies to every promoter. INCLUDE/EXCLUDE: applies the audience list below. */
export type CampaignScope = 'ALL' | 'INCLUDE' | 'EXCLUDE'

/** TARGETED: audience-limited promotion. GENERAL: open to everyone matching the rule criteria. */
export type CampaignMode = 'TARGETED' | 'GENERAL'

/**
 * Lifecycle of a campaign (hub ADR 0038). Only ACTIVE campaigns within their
 * dates offer promotions. SOLD_OUT = every slot occupied; CLOSED = finished
 * (by end date, by a filled quota, or manually).
 */
export type CampaignLifecycleStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'SOLD_OUT' | 'CLOSED'

/** Automatic closing conditions; a manual close is always available. Empty ⇒ only manual. */
export type CampaignCloseCondition = 'END_DATE' | 'QUOTA_FILLED'

export type CampaignClosedReason = 'END_DATE' | 'QUOTA_FILLED' | 'MANUAL'

/** When an assigned promotion takes a confirmed slot (hub ADR 0038, phase 2b); before that it is PENDING. */
export type CampaignQuotaTrigger = 'ON_ENROLLMENT' | 'ON_PAYMENT_REGISTERED' | 'ON_PAYMENT_CONFIRMED'

/** How long a confirmed promotion can be used: the campaign dates, or N days from its confirmation. */
export type CampaignUsageWindow = 'CAMPAIGN_DATES' | 'DAYS_AFTER_CONFIRMATION'

/** CampaignTransactionException.ExceptionAction. */
export type CampaignExceptionAction = 'INCLUDE' | 'EXCLUDE'

/** CampaignTransactionLink.LinkSource. */
export type CampaignTransactionSource = 'AUTO' | 'EXCEPTION_INCLUDE' | 'EXCEPTION_EXCLUDE'

export interface CampaignDto {
  uuid: string
  name: string
  description?: string | null
  startsAt: string
  /** null ⇒ open-ended campaign (hub ADR 0038). */
  endsAt?: string | null
  /** Raw enabled flag on the entity — `active` below is the resolved effective status. */
  enabled: boolean
  scope: CampaignScope
  mode: CampaignMode
  evaluateOnlyAtEnd: boolean
  payOnlyAtEnd: boolean
  targetAmount?: number | string | null
  /** Currency the goal amount is denominated in — speculative addition (Parte adicional, 2026-09-22): verify field name against the real backend DTO once it ships `goalAmountCurrency`/`goalAmountCurrencyUuid`. */
  targetAmountCurrency_Uuid?: string | null
  targetAmountCurrency_Display?: string | null
  targetCount?: number | null
  exclusivityGroup?: string | null
  priority?: number | null
  active: boolean
  promoterUuids?: string[] | null
  // ---- Lifecycle and shared quota (hub ADR 0038, phase 2a) ----
  lifecycleStatus?: CampaignLifecycleStatus | null
  lifecycleStatus_Display?: string | null
  closeConditions?: CampaignCloseCondition[] | null
  /** Slots shared by every promotion of the campaign; null ⇒ no limit. */
  maxRedemptions?: number | null
  /** Occupied slots. */
  redemptionsCount?: number | null
  confirmedCount?: number | null
  /** null when there is no max. */
  freeSlots?: number | null
  closedAt?: string | null
  closedAt_Display?: string | null
  closedReason?: CampaignClosedReason | null
  closedReason_Display?: string | null
  closedBy_Uuid?: string | null
  closedBy_Display?: string | null
  /** Grace to confirm pending slots after closing: a fixed date or N days (never both). */
  confirmGraceUntil?: string | null
  confirmGraceDays?: number | null
  // ---- Slot lifecycle (hub ADR 0038, phase 2b) ----
  quotaTrigger?: CampaignQuotaTrigger | null
  quotaTrigger_Display?: string | null
  /** Days a pending slot waits for its confirmation; null ⇒ it never expires by itself. */
  pendingTtlDays?: number | null
  usageWindow?: CampaignUsageWindow | null
  usageWindow_Display?: string | null
  usageWindowDays?: number | null
  pendingCount?: number | null
  // ---- Ally benefits (hub ADR 0038, phase 3) ----
  /** Ally-exclusive campaign: every promotion belongs to this ally. */
  ally_Uuid?: string | null
  ally_Display?: string | null
  ally_Code?: string | null
  /** Allies may add their own benefits while the campaign is active. */
  allowsAllyPartnership?: boolean | null
  createdAt?: string
  updatedAt?: string
  /** Client-only: populated locally after fetching the audience list, not returned by the backend. */
  audienceCount?: number
}

/** Shared create/update body — CampaignRequest (PUT is full-replace, not PATCH). */
export interface CreateCampaignRequest {
  name: string
  description?: string | null
  startsAt: string
  endsAt?: string | null
  enabled?: boolean | null
  scope: CampaignScope
  mode: CampaignMode
  evaluateOnlyAtEnd?: boolean
  payOnlyAtEnd?: boolean
  targetAmount?: string | null
  targetAmountCurrencyUuid?: string | null
  targetCount?: number | null
  exclusivityGroup?: string | null
  priority?: number | null
  promoterUuids?: string[] | null
  /** null ⇒ ["END_DATE"] when endsAt is set, else []. */
  closeConditions?: CampaignCloseCondition[] | null
  maxRedemptions?: number | null
  confirmGraceUntil?: string | null
  confirmGraceDays?: number | null
  /** Create only: true ⇒ the campaign starts as DRAFT. */
  draft?: boolean
  quotaTrigger?: CampaignQuotaTrigger | null
  pendingTtlDays?: number | null
  usageWindow?: CampaignUsageWindow | null
  /** Required when usageWindow = DAYS_AFTER_CONFIRMATION. */
  usageWindowDays?: number | null
  /** Ally-exclusive campaign; can only change while the campaign has no promotions. */
  allyUuid?: string | null
  allowsAllyPartnership?: boolean
}

/** Item of GET /v1/me/allies/campaigns — campaigns the calling ally may join with its own benefits. */
export interface AllyPartnershipCampaignDto {
  uuid: string
  name: string
  description?: string | null
  startsAt: string
  endsAt?: string | null
  lifecycleStatus?: CampaignLifecycleStatus | null
  lifecycleStatus_Display?: string | null
  maxRedemptions?: number | null
  freeSlots?: number | null
  /** The campaign is exclusive to the calling ally. */
  exclusive: boolean
}

/** Row of GET /v1/admin/campaigns/{uuid}/ally-benefits — reconciliation per ally and promotion. */
export interface CampaignAllyBenefitRowDto {
  ally_Uuid?: string | null
  ally_Display?: string | null
  promotion_Uuid?: string | null
  promotion_Display?: string | null
  granted: number
  available: number
  redeemed: number
  expired: number
  canceled: number
  redeemedUnits: number
}

export type UpdateCampaignRequest = CreateCampaignRequest

/** Body of POST /v1/admin/campaigns/{uuid}/relaunch — every other field is cloned from the source campaign. */
export interface CampaignRelaunchRequest {
  startsAt: string
  endsAt?: string | null
}

/** Body of POST /v1/admin/campaigns/{uuid}/close. */
export interface CampaignCloseRequest {
  /** Release the slots still pending confirmation (effective from phase 2b). */
  cancelPending: boolean
  note?: string | null
}

/** Body of POST /v1/admin/campaigns/{uuid}/reopen — must enlarge the max and/or move the end date later. */
export interface CampaignReopenRequest {
  maxRedemptions?: number | null
  endsAt?: string | null
}

/** Body of POST /v1/admin/campaigns/{uuid}/exceptions — exactly one of paymentUuid/membershipUuid must be set. */
export interface CampaignExceptionRequest {
  paymentUuid?: string | null
  membershipUuid?: string | null
  action: CampaignExceptionAction
  reason?: string | null
}

/** Output row for GET /v1/admin/campaigns/{uuid}/exceptions — exactly one of payment/membership is non-null. */
export interface CampaignExceptionDto {
  uuid: string
  action: CampaignExceptionAction
  action_Display?: string
  reason?: string | null
  createdByUuid: string
  createdAt: string
  createdAt_Display?: string
  payment_Uuid?: string | null
  payment_Display?: string | null
  membership_Uuid?: string | null
  membership_Display?: string | null
}

/** Body of POST /v1/admin/campaigns/{uuid}/audience. */
export interface CampaignAudienceRequest {
  promoterUuid: string
}

/** Output row for GET/POST /v1/admin/campaigns/{uuid}/audience — one CampaignPromoter bridge row. */
export interface CampaignAudienceDto {
  /** The bridge row's own uuid — deletion routes by promoterUuid instead. */
  uuid: string
  promoter_Uuid: string
  promoter_Display: string
  promoterType_Uuid?: string | null
  promoterType_Display?: string | null
  rank_Uuid?: string | null
  rank_Display?: string | null
}

/** Output row for GET /v1/admin/campaigns/{uuid}/transactions — a resolved campaign_transaction_links row. */
export interface CampaignTransactionLinkDto {
  uuid: string
  source: CampaignTransactionSource
  source_Display?: string
  resolvedAt: string
  resolvedAt_Display?: string
  payment_Uuid?: string | null
  payment_Display?: string | null
  membership_Uuid?: string | null
  membership_Display?: string | null
  /** Populated only for a payment-backed link (null for a membership/enrollment link). */
  amount?: number | string | null
  amount_Display?: string
  currency_Code?: string | null
}

/** GET /v1/admin/campaigns/{uuid}/effectiveness — plain JSON summary, not a report-engine download. */
export interface CampaignEffectivenessDto {
  campaignUuid: string
  campaignName: string
  totalCollected: number | string
  transactionCount: number
  targetAmount?: number | string | null
  targetCount?: number | null
  /** null when targetAmount is not set (nothing to compute a percentage against). */
  amountAchievedPct?: number | string | null
  /** null when targetCount is not set. */
  countAchievedPct?: number | string | null
  /** Currency both totalCollected and targetAmount were converted/expressed into (campaign's targetAmountCurrency, or USD). */
  currency_Uuid?: string | null
  currency_Display?: string | null
  currency_Code?: string | null
}

export const CAMPAIGN_SCOPE_OPTIONS: { value: CampaignScope, labelKey: string }[] = [
  { value: 'ALL', labelKey: 'campaigns.scope.ALL' },
  { value: 'INCLUDE', labelKey: 'campaigns.scope.INCLUDE' },
  { value: 'EXCLUDE', labelKey: 'campaigns.scope.EXCLUDE' },
]

export const CAMPAIGN_MODE_OPTIONS: { value: CampaignMode, labelKey: string }[] = [
  { value: 'TARGETED', labelKey: 'campaigns.mode.TARGETED' },
  { value: 'GENERAL', labelKey: 'campaigns.mode.GENERAL' },
]

/** Slot counters of one promotion inside GET /v1/admin/campaigns/{uuid}/quota. */
export interface CampaignPromotionQuotaDto {
  promotion_Uuid?: string | null
  promotion_Display?: string | null
  ownQuota: boolean
  maxRedemptions?: number | null
  confirmed: number
  pending: number
  /** null when neither the promotion nor the campaign has a max. */
  free?: number | null
  expired: number
  released: number
}

/** GET /v1/admin/campaigns/{uuid}/quota (hub ADR 0038, phase 2b). */
export interface CampaignQuotaDto {
  maxRedemptions?: number | null
  confirmed: number
  pending: number
  /** null when the campaign has no max. */
  free?: number | null
  expired: number
  released: number
  promotions: CampaignPromotionQuotaDto[]
}

/** Badge color per lifecycle status. */
export const CAMPAIGN_LIFECYCLE_COLORS: Record<CampaignLifecycleStatus, 'neutral' | 'success' | 'warning' | 'error' | 'info'> = {
  DRAFT: 'neutral',
  ACTIVE: 'success',
  PAUSED: 'warning',
  SOLD_OUT: 'info',
  CLOSED: 'error',
}

export const CAMPAIGN_EXCEPTION_ACTION_OPTIONS: { value: CampaignExceptionAction, labelKey: string }[] = [
  { value: 'INCLUDE', labelKey: 'campaigns.scope.INCLUDE' },
  { value: 'EXCLUDE', labelKey: 'campaigns.scope.EXCLUDE' },
]

// ---- Slot reconciliation with payments (hub ADR 0038 point 9, phase 4) ----

/** Slot status of a membership promotion; same values as `PromotionRedemptionStatus` in types/promotions. */
export type CampaignSlotStatus = 'PENDING' | 'CONFIRMED' | 'EXPIRED' | 'RELEASED'

/**
 * Row of GET /v1/admin/campaigns/{uuid}/slots — one slot of the campaign quota.
 * `deadlineFrozen`: a qualifying payment is in review and was registered before the deadline, so the
 * slot does not expire until that payment is approved (confirms it) or rejected.
 */
export interface CampaignSlotDto {
  uuid: string
  member_Uuid?: string | null
  member_Display?: string | null
  member_Code?: string | null
  membership_Uuid?: string | null
  membership_Display?: string | null
  membership_Code?: string | null
  promotion_Uuid?: string | null
  promotion_Display?: string | null
  promotion_Code?: string | null
  advisor_Uuid?: string | null
  advisor_Display?: string | null
  advisor_Code?: string | null
  benefitKind?: 'DISCOUNT' | 'ALLY_BENEFIT' | null
  benefitKind_Display?: string | null
  redemptionStatus: CampaignSlotStatus
  redemptionStatus_Display?: string | null
  quotaTrigger?: CampaignQuotaTrigger | null
  quotaTrigger_Display?: string | null
  reservedAt?: string | null
  reservedAt_Display?: string | null
  confirmedAt?: string | null
  confirmedAt_Display?: string | null
  effectiveDeadline?: string | null
  effectiveDeadline_Display?: string | null
  deadlineFrozen: boolean
  confirmedByPayment_Uuid?: string | null
  confirmedByPayment_Display?: string | null
  confirmedByPayment_Code?: string | null
  manualNote?: string | null
  manualBy_Uuid?: string | null
  manualBy_Display?: string | null
  manualBy_Code?: string | null
}

/** Body of POST /slots/{slotUuid}/confirm and /release — the note is required (non-blank). */
export interface CampaignSlotActionRequest {
  note: string
}

export type CampaignSlotIssueType = 'APPROVED_DISCOUNT_WITHOUT_SLOT' | 'PENDING_WITH_APPROVED_PAYMENT' | 'FROZEN_TOO_LONG'

/** Item of GET /v1/admin/campaigns/{uuid}/slot-issues. FROZEN_TOO_LONG = frozen for more than 7 days. */
export interface CampaignSlotIssueDto {
  type: CampaignSlotIssueType
  type_Display?: string | null
  member_Uuid?: string | null
  member_Display?: string | null
  member_Code?: string | null
  membership_Uuid?: string | null
  membership_Display?: string | null
  membership_Code?: string | null
  promotion_Uuid?: string | null
  promotion_Display?: string | null
  promotion_Code?: string | null
  payment_Uuid?: string | null
  payment_Display?: string | null
  payment_Code?: string | null
  slotUuid?: string | null
  redemptionStatus?: CampaignSlotStatus | null
  redemptionStatus_Display?: string | null
  since?: string | null
  since_Display?: string | null
}

/** Row of the campaign "Pagos" section: one per slot; `payment_*` is null while the slot has no payment yet. */
export interface CampaignPaymentRowDto {
  payment_Uuid?: string | null
  payment_Display?: string | null
  payment_Code?: string | null
  paymentReference?: string | null
  amount?: number | string | null
  amount_Display?: string | null
  amountCurrency_Code?: string | null
  paymentDate?: string | null
  paymentDate_Display?: string | null
  paymentStatus?: string | null
  paymentStatus_Display?: string | null
  member_Uuid?: string | null
  member_Display?: string | null
  member_Code?: string | null
  membership_Uuid?: string | null
  membership_Display?: string | null
  membership_Code?: string | null
  advisor_Uuid?: string | null
  advisor_Display?: string | null
  advisor_Code?: string | null
  promotion_Uuid?: string | null
  promotion_Display?: string | null
  promotion_Code?: string | null
  slotUuid: string
  redemptionStatus: CampaignSlotStatus
  redemptionStatus_Display?: string | null
  effectiveDeadline?: string | null
  effectiveDeadline_Display?: string | null
  deadlineFrozen: boolean
  /** Approving this payment confirms the slot. */
  confirmsOnApproval: boolean
  lastRemindedAt?: string | null
  lastRemindedAt_Display?: string | null
}

export interface CampaignPaymentTotalsDto {
  confirmed: number
  pendingInReview: number
  pendingWithoutPayment: number
  expired: number
}

/** GET /v1/admin/campaigns/{uuid}/payments (CAMPAIGN_PAYMENT_VIEW). */
export interface CampaignPaymentsDto {
  totals: CampaignPaymentTotalsDto
  page: Page<CampaignPaymentRowDto>
}

/** Body of the remind endpoints — the note is optional. */
export interface CampaignPaymentRemindRequest {
  note?: string | null
}

/** Response of POST /v1/admin/campaigns/{uuid}/payments/remind-pending. */
export interface CampaignRemindPendingResultDto {
  sent: number
  skipped: number
}

export const CAMPAIGN_SLOT_STATUSES: CampaignSlotStatus[] = ['PENDING', 'CONFIRMED', 'EXPIRED', 'RELEASED']
