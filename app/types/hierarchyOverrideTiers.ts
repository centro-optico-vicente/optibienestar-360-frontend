// Types for the hierarchy-override-tiers vertical (/v1/admin/hierarchy-override-tiers,
// V102/V108, hub plan §2), aligned with the backend (HierarchyOverrideTierDto /
// HierarchyOverrideTierCreateRequest / HierarchyOverrideTierUpdateRequest).
//
// A HierarchyOverrideTier is a volume-threshold band the hierarchy-override
// engine matches against a Supervisor/Coordinador's team volume, scoped by
// (rank, category) instead of (planType, promoterType) like CommissionTier.
// Exactly one of overridePct / flatAmount is set. PUT uses PATCH semantics.

import type { PeriodStrategy } from './commissionTiers'

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
  thresholdCount: number
  overridePct?: number | string | null
  flatAmount?: number | string | null
  flatAmountCurrency_Uuid?: string | null
  flatAmountCurrency_Display?: string | null
  flatAmountCurrency_Code?: string | null
  periodStrategy: PeriodStrategy
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
  thresholdCount?: number
  overridePct?: string | null
  flatAmount?: string | null
  flatAmountCurrencyUuid?: string | null
  periodStrategy: PeriodStrategy
  /** Sets the owning campaign when created from the campaign ficha's "Add rule" flow. Not yet a real backend field on HierarchyOverrideTierCreateRequest (see report) — sent as a harmless no-op until the backend wires campaignUuid/startsAt/endsAt into the DTO. */
  campaignUuid?: string | null
}

/** PUT with PATCH semantics: only the fields present are applied. */
export interface UpdateHierarchyOverrideTierRequest extends Partial<CreateHierarchyOverrideTierRequest> {
  active?: boolean
}
