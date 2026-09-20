// Types for the Commission Tiers vertical (/v1/admin/commission-tiers), aligned
// with the backend (V42__commission_tiers_and_leaderboard.sql, CommissionTierDto /
// CommissionTierCreateRequest / CommissionTierUpdateRequest).
//
// A CommissionTier is a volume-threshold band the commission engine matches
// against a promoter's monthly new-subscriber count (ADR 0013 §1). Exactly one
// of commissionPct / flatAmount is set. PUT uses PATCH semantics.

import type { PlanType } from './plans'
import type { CatalogRef } from './members'

export type PeriodStrategy = 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'ANNUAL'
export type AppliesTo = 'INSCRIPTION' | 'MONTHLY' | 'BOTH'

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
  thresholdCount: number
  commissionPct?: number | string | null
  flatAmount?: number | string | null
  periodStrategy: PeriodStrategy
  appliesTo: AppliesTo
  promoterType_Uuid?: string | null
  promoterType_Display?: string | null
  promoterType_Code?: string | null
  /** Owning campaign when this tier is campaign-anchored; null for a standing (non-campaign) rule. */
  campaign: CatalogRef | null
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
  thresholdCount?: number
  commissionPct?: string | null
  flatAmount?: string | null
  periodStrategy: PeriodStrategy
  appliesTo: AppliesTo
  promoterTypeUuid?: string | null
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
