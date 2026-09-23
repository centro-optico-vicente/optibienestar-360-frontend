// Types for the Commission Tiers vertical (/v1/admin/commission-tiers), aligned
// with the backend (V42__commission_tiers_and_leaderboard.sql, CommissionTierDto /
// CommissionTierCreateRequest / CommissionTierUpdateRequest).
//
// A CommissionTier is a volume-threshold band the commission engine matches
// against a promoter's monthly new-subscriber count (ADR 0013 §1). Exactly one
// of commissionPct / flatAmount is set. PUT uses PATCH semantics.

import type { PlanType } from './plans'
import type { DisplayRefItem } from './options'

export type PeriodStrategy = 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'ANNUAL'
export type AppliesTo = 'INSCRIPTION' | 'MONTHLY' | 'BOTH'
/** Threshold basis — count of events (default, current behavior) vs. a money amount. */
export type ThresholdBasis = 'COUNT' | 'AMOUNT'

export const PERIOD_STRATEGY_OPTIONS: { label: string, value: PeriodStrategy, labelKey: string }[] = [
  { label: 'Diario', value: 'DAILY', labelKey: 'commissionRules.periodStrategies.DAILY' },
  { label: 'Semanal', value: 'WEEKLY', labelKey: 'commissionRules.periodStrategies.WEEKLY' },
  { label: 'Quincenal', value: 'BIWEEKLY', labelKey: 'commissionRules.periodStrategies.BIWEEKLY' },
  { label: 'Mensual', value: 'MONTHLY', labelKey: 'commissionRules.periodStrategies.MONTHLY' },
  { label: 'Trimestral', value: 'QUARTERLY', labelKey: 'commissionRules.periodStrategies.QUARTERLY' },
  { label: 'Semestral', value: 'SEMIANNUAL', labelKey: 'commissionRules.periodStrategies.SEMIANNUAL' },
  { label: 'Anual', value: 'ANNUAL', labelKey: 'commissionRules.periodStrategies.ANNUAL' },
]

export const APPLIES_TO_OPTIONS: { label: string, value: AppliesTo, labelKey: string }[] = [
  { label: 'Inscripción', value: 'INSCRIPTION', labelKey: 'commissionRules.appliesTo.INSCRIPTION' },
  { label: 'Mensualidad', value: 'MONTHLY', labelKey: 'commissionRules.appliesTo.MONTHLY' },
  { label: 'Ambas', value: 'BOTH', labelKey: 'commissionRules.appliesTo.BOTH' },
]

export interface CommissionTierDto {
  uuid: string
  name: string
  description?: string | null
  planType?: PlanType | string | null
  /** Threshold basis — 'COUNT' (default, uses thresholdCount) or 'AMOUNT' (uses thresholdAmount + thresholdAmountCurrency). */
  basis?: ThresholdBasis | null
  thresholdCount: number
  thresholdAmount?: number | string | null
  thresholdAmountCurrency_Uuid?: string | null
  thresholdAmountCurrency_Display?: string | null
  thresholdAmountCurrency_Code?: string | null
  commissionPct?: number | string | null
  flatAmount?: number | string | null
  flatAmountCurrency_Uuid?: string | null
  flatAmountCurrency_Display?: string | null
  flatAmountCurrency_Code?: string | null
  /** Accrual frequency — renamed from `periodStrategy` (unified 4-axis settlement model). */
  accrualPeriodStrategy: PeriodStrategy
  /** Anchor day for `accrualPeriodStrategy` — 1-7 (weekday) if WEEKLY/BIWEEKLY, 1-31 (day of month) if MONTHLY or coarser; null = default. */
  accrualPeriodAnchor?: number | null
  /** Partial-settlement frequency — new axis, defaults to `accrualPeriodStrategy`'s value on create. */
  partialSettlementPeriodStrategy?: PeriodStrategy | null
  partialSettlementPeriodAnchor?: number | null
  /** Final-settlement frequency — new axis. */
  finalSettlementPeriodStrategy?: PeriodStrategy | null
  finalSettlementPeriodAnchor?: number | null
  /** Retroactive-settlement frequency — new axis. */
  retroactiveSettlementPeriodStrategy?: PeriodStrategy | null
  retroactiveSettlementPeriodAnchor?: number | null
  appliesTo: AppliesTo
  /** M:N promoter-type scope (V137, hub plan Part F) — empty = applies to every promoter type. */
  promoterTypes: DisplayRefItem[]
  /** Owning campaign when this tier is campaign-anchored; null for a standing (non-campaign) rule. */
  campaign_Uuid?: string | null
  campaign_Display?: string | null
  /** Rule's own effective window — snapshotted from the campaign at creation but independently editable. */
  startsAt: string | null
  endsAt: string | null
  active: boolean
  status?: string
  createdAt?: string
  updatedAt?: string
}

export interface CreateCommissionTierRequest {
  name: string
  description?: string | null
  planType?: PlanType | null
  basis?: ThresholdBasis | null
  thresholdCount?: number | null
  thresholdAmount?: string | null
  thresholdAmountCurrencyUuid?: string | null
  commissionPct?: string | null
  flatAmount?: string | null
  flatAmountCurrencyUuid?: string | null
  accrualPeriodStrategy: PeriodStrategy
  accrualPeriodAnchor?: number | null
  partialSettlementPeriodStrategy?: PeriodStrategy | null
  partialSettlementPeriodAnchor?: number | null
  finalSettlementPeriodStrategy?: PeriodStrategy | null
  finalSettlementPeriodAnchor?: number | null
  retroactiveSettlementPeriodStrategy?: PeriodStrategy | null
  retroactiveSettlementPeriodAnchor?: number | null
  appliesTo: AppliesTo
  /** Empty/omitted = applies to every promoter type (M:N, V137, hub plan Part F). */
  promoterTypeUuids?: string[] | null
  /** Sets the owning campaign, e.g. when created from the campaign ficha's "Add rule" flow. Omit/null = standing (non-campaign) rule. */
  campaignUuid?: string | null
  /** Rule's own effective window — defaults from the selected campaign's dates but stays independently editable. */
  startsAt?: string | null
  endsAt?: string | null
}

/** PUT with PATCH semantics: only the fields present are applied. */
export interface UpdateCommissionTierRequest extends Partial<CreateCommissionTierRequest> {
  active?: boolean
}
