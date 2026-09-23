// Types for the hierarchy-override-tiers vertical (/v1/admin/hierarchy-override-tiers,
// V102/V108, hub plan §2), aligned with the backend (HierarchyOverrideTierDto /
// HierarchyOverrideTierCreateRequest / HierarchyOverrideTierUpdateRequest).
//
// A HierarchyOverrideTier is a volume-threshold band the hierarchy-override
// engine matches against a Supervisor/Coordinador's team volume, scoped by
// (rank, category) instead of (planType, promoterType) like CommissionTier.
// Exactly one of overridePct / flatAmount is set. PUT uses PATCH semantics.

import type { PeriodStrategy, ThresholdBasis } from './commissionTiers'

export type OverrideCategory = 'INSCRIPTION' | 'COLLECTION'

export const OVERRIDE_CATEGORY_OPTIONS: { label: string, value: OverrideCategory, labelKey: string }[] = [
  { label: 'Inscripción', value: 'INSCRIPTION', labelKey: 'hierarchyOverrideTiers.category.INSCRIPTION' },
  { label: 'Cobranza', value: 'COLLECTION', labelKey: 'hierarchyOverrideTiers.category.COLLECTION' },
]

export interface HierarchyOverrideTierDto {
  uuid: string
  name: string
  description?: string | null
  rank_Uuid?: string | null
  rank_Display?: string | null
  category: OverrideCategory
  /** Threshold basis — 'COUNT' (default, uses thresholdCount) or 'AMOUNT' (uses thresholdAmount + thresholdAmountCurrency). */
  basis?: ThresholdBasis | null
  thresholdCount: number
  thresholdAmount?: number | string | null
  thresholdAmountCurrency_Uuid?: string | null
  thresholdAmountCurrency_Display?: string | null
  thresholdAmountCurrency_Code?: string | null
  overridePct?: number | string | null
  flatAmount?: number | string | null
  flatAmountCurrency_Uuid?: string | null
  flatAmountCurrency_Display?: string | null
  flatAmountCurrency_Code?: string | null
  /** Accrual frequency — renamed from `periodStrategy` (unified 4-axis settlement model). */
  accrualPeriodStrategy: PeriodStrategy
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

export interface CreateHierarchyOverrideTierRequest {
  name: string
  description?: string | null
  rankUuid: string
  category: OverrideCategory
  basis?: ThresholdBasis | null
  thresholdCount?: number | null
  thresholdAmount?: string | null
  thresholdAmountCurrencyUuid?: string | null
  overridePct?: string | null
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
  /** Sets the owning campaign, e.g. when created from the campaign ficha's "Add rule" flow. Omit/null = standing (non-campaign) rule. */
  campaignUuid?: string | null
  /** Rule's own effective window — defaults from the selected campaign's dates but stays independently editable. */
  startsAt?: string | null
  endsAt?: string | null
}

/** PUT with PATCH semantics: only the fields present are applied. */
export interface UpdateHierarchyOverrideTierRequest extends Partial<CreateHierarchyOverrideTierRequest> {
  active?: boolean
}
