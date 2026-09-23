// Types for the Bonus Rules vertical (/v1/admin/bonus-rules), aligned with the
// backend (V37, CommissionBonusRule / BonusRuleDto / BonusRuleRequest).
//
// A BonusRule rewards a promoter for crossing a subscriber-count goal within a
// window (ADR 0013 §2) — additive to the per-payment commissions. PUT is a full
// replace (BonusRuleRequest is used for both create and update).

// AMOUNT_COLLECTED (Part I) — speculative addition, mirroring the contract
// described in the hub plan (2026-09-22): the backend side (I-BE) had not
// landed yet at the time this FE change was made — verify the real field
// names/enum value against the backend once it ships.
export type BonusMetric = 'NEW_SUBSCRIBERS' | 'ACTIVE_SUBSCRIBERS' | 'AMOUNT_COLLECTED'
export type AccrualMode = 'PER_BLOCK' | 'THRESHOLD'
export type WindowStrategy = 'LIFETIME' | 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'ANNUAL' | 'CAMPAIGN'
export type RewardType = 'FLAT' | 'PERCENTAGE'

export const BONUS_METRIC_OPTIONS: { label: string, value: BonusMetric, labelKey: string }[] = [
  { label: 'Nuevos suscriptores', value: 'NEW_SUBSCRIBERS', labelKey: 'commissionRules.bonusMetrics.NEW_SUBSCRIBERS' },
  { label: 'Suscriptores activos', value: 'ACTIVE_SUBSCRIBERS', labelKey: 'commissionRules.bonusMetrics.ACTIVE_SUBSCRIBERS' },
  { label: 'Monto recaudado', value: 'AMOUNT_COLLECTED', labelKey: 'commissionRules.bonusMetrics.AMOUNT_COLLECTED' },
]

/** Metrics measured by subscriber count (`thresholdCount`) vs. by collected amount (`thresholdAmount`+`thresholdCurrencyUuid`) — mutually exclusive per rule. */
export function isAmountCollectedMetric(metric: BonusMetric | undefined): boolean {
  return metric === 'AMOUNT_COLLECTED'
}

export const ACCRUAL_MODE_OPTIONS: { label: string, value: AccrualMode, labelKey: string }[] = [
  { label: 'Por bloque (repite)', value: 'PER_BLOCK', labelKey: 'commissionRules.accrualModes.PER_BLOCK' },
  { label: 'Umbral (una vez)', value: 'THRESHOLD', labelKey: 'commissionRules.accrualModes.THRESHOLD' },
]

export const WINDOW_STRATEGY_OPTIONS: { label: string, value: WindowStrategy, labelKey: string }[] = [
  { label: 'De por vida', value: 'LIFETIME', labelKey: 'commissionRules.windowStrategies.LIFETIME' },
  { label: 'Diario', value: 'DAILY', labelKey: 'commissionRules.windowStrategies.DAILY' },
  { label: 'Semanal', value: 'WEEKLY', labelKey: 'commissionRules.windowStrategies.WEEKLY' },
  { label: 'Quincenal', value: 'BIWEEKLY', labelKey: 'commissionRules.windowStrategies.BIWEEKLY' },
  { label: 'Mensual', value: 'MONTHLY', labelKey: 'commissionRules.windowStrategies.MONTHLY' },
  { label: 'Trimestral', value: 'QUARTERLY', labelKey: 'commissionRules.windowStrategies.QUARTERLY' },
  { label: 'Semestral', value: 'SEMIANNUAL', labelKey: 'commissionRules.windowStrategies.SEMIANNUAL' },
  { label: 'Anual', value: 'ANNUAL', labelKey: 'commissionRules.windowStrategies.ANNUAL' },
  { label: 'Campaña (rango fijo)', value: 'CAMPAIGN', labelKey: 'commissionRules.windowStrategies.CAMPAIGN' },
]

export const REWARD_TYPE_OPTIONS: { label: string, value: RewardType, labelKey: string }[] = [
  { label: 'Monto fijo', value: 'FLAT', labelKey: 'commissionRules.rewardTypes.FLAT' },
  { label: 'Porcentaje', value: 'PERCENTAGE', labelKey: 'commissionRules.rewardTypes.PERCENTAGE' },
]

/**
 * The 3 new settlement axes (partial/final/retroactive) never offer CAMPAIGN —
 * that value is meaningful only for `accrualPeriodStrategy` (legacy
 * WindowStrategy.CAMPAIGN fixed-range accrual). Unified 4-axis settlement model,
 * same contract as CommissionTier / CollectionCommissionTier.
 */
export type SettlementPeriodStrategy = Exclude<WindowStrategy, 'CAMPAIGN'>

export const SETTLEMENT_PERIOD_STRATEGY_OPTIONS: { label: string, value: SettlementPeriodStrategy, labelKey: string }[] =
  WINDOW_STRATEGY_OPTIONS.filter((o): o is { label: string, value: SettlementPeriodStrategy, labelKey: string } => o.value !== 'CAMPAIGN')

import type { DisplayRefItem } from './options'

export interface BonusRuleDto {
  uuid: string
  name: string
  description?: string | null
  /** M:N promoter-type scope (V137, hub plan Part F) — empty = applies to every promoter type. */
  promoterTypes: DisplayRefItem[]
  metric: BonusMetric
  accrual: AccrualMode
  /** Required when metric is NEW_SUBSCRIBERS/ACTIVE_SUBSCRIBERS; null when metric is AMOUNT_COLLECTED. */
  thresholdCount: number | null
  /** Required when metric is AMOUNT_COLLECTED; null otherwise. Compared with the sum of collected payments, converted to `thresholdCurrency`. */
  thresholdAmount?: number | string | null
  thresholdCurrency_Uuid?: string | null
  thresholdCurrency_Display?: string | null
  /** Accrual frequency — renamed from `windowStrategy` (unified 4-axis settlement model). Only this axis may be CAMPAIGN. */
  accrualPeriodStrategy: WindowStrategy
  /** Anchor day for `accrualPeriodStrategy` — 1-7 (weekday) if WEEKLY/BIWEEKLY, 1-31 (day of month) if MONTHLY or coarser; null = default. */
  accrualPeriodAnchor?: number | null
  /** Partial-settlement frequency — new axis, defaults to `accrualPeriodStrategy`'s value on create. Never CAMPAIGN. */
  partialSettlementPeriodStrategy?: SettlementPeriodStrategy | null
  partialSettlementPeriodAnchor?: number | null
  /** Final-settlement frequency — new axis. Never CAMPAIGN. */
  finalSettlementPeriodStrategy?: SettlementPeriodStrategy | null
  finalSettlementPeriodAnchor?: number | null
  /** Retroactive-settlement frequency — new axis. Never CAMPAIGN. */
  retroactiveSettlementPeriodStrategy?: SettlementPeriodStrategy | null
  retroactiveSettlementPeriodAnchor?: number | null
  /** Legacy WindowStrategy.CAMPAIGN fixed range — a DIFFERENT, older mechanism than the campaign/startsAt/endsAt anchor below. Do not conflate. */
  campaignStart?: string | null
  campaignEnd?: string | null
  rewardType: RewardType
  flatAmount?: number | string | null
  rewardPct?: number | string | null
  rewardCurrency: string
  rewardCurrencyRef_Uuid?: string | null
  rewardCurrencyRef_Display?: string | null
  includeSystemPromoters: boolean
  /** Owning campaign when this rule is campaign-anchored; null for a standing (non-campaign) rule. */
  campaign_Uuid?: string | null
  campaign_Display?: string | null
  /** Rule's own effective window — snapshotted from the campaign at creation but independently editable. */
  startsAt: string | null
  endsAt: string | null
  active: boolean
  createdAt?: string
}

/** Used for both create (POST) and replace (PUT) — the backend does a full replace, not a PATCH. */
export interface BonusRuleRequest {
  name: string
  description?: string
  metric: BonusMetric
  accrual: AccrualMode
  thresholdCount?: number | null
  thresholdAmount?: string | null
  thresholdCurrencyUuid?: string | null
  accrualPeriodStrategy: WindowStrategy
  accrualPeriodAnchor?: number | null
  partialSettlementPeriodStrategy?: SettlementPeriodStrategy | null
  partialSettlementPeriodAnchor?: number | null
  finalSettlementPeriodStrategy?: SettlementPeriodStrategy | null
  finalSettlementPeriodAnchor?: number | null
  retroactiveSettlementPeriodStrategy?: SettlementPeriodStrategy | null
  retroactiveSettlementPeriodAnchor?: number | null
  campaignStart?: string | null
  campaignEnd?: string | null
  rewardType: RewardType
  flatAmount?: string | null
  rewardPct?: string | null
  rewardCurrency?: string
  rewardCurrencyUuid?: string | null
  includeSystemPromoters?: boolean
  /** Empty/omitted = applies to every promoter type (M:N, V137, hub plan Part F). */
  promoterTypeUuids?: string[] | null
  /** Sets the owning campaign, e.g. when created from the campaign ficha's "Add rule" flow. Omit/null = standing (non-campaign) rule. Distinct from the legacy campaignStart/campaignEnd (WindowStrategy.CAMPAIGN) above. */
  campaignUuid?: string | null
  /** Rule's own effective window — defaults from the selected campaign's dates but stays independently editable. */
  startsAt?: string | null
  endsAt?: string | null
}
