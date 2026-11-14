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
