// Types for the Collection Commission Tiers vertical
// (/v1/admin/collection-commission-tiers), aligned with the backend
// (V44__collection_commission_tiers.sql, CollectionCommissionTierDto /
// CreateRequest / UpdateRequest).
//
// A CollectionCommissionTier is a decreasing-% bucket by how many days it took
// to collect the recurring (MONTHLY) payment (ADR 0013 §3), or (basis=AMOUNT)
// by a minimum collected-amount threshold — the engine picks the smallest
// qualifying maxDays bucket for DAYS, or the highest qualifying minAmount
// bucket for AMOUNT (amount converted to minAmountCurrency before comparing).
// PUT uses PATCH semantics.

import type { DisplayRefItem } from './options'

export interface CollectionCommissionTierDto {
  uuid: string
  name: string
  description?: string | null
  basis: 'DAYS' | 'AMOUNT'
  maxDays: number
  /** Only meaningful when basis=AMOUNT — minimum collected-amount threshold (engine picks the highest qualifying bucket). */
  minAmount?: number | string | null
  minAmountCurrency_Uuid?: string | null
  minAmountCurrency_Display?: string | null
  minAmountCurrency_Code?: string | null
  commissionPct: number | string
  flatAmount?: number | string | null
  flatAmountCurrency_Uuid?: string | null
  flatAmountCurrency_Display?: string | null
  flatAmountCurrency_Code?: string | null
  /** M:N promoter-type scope (V137, hub plan Part F) — empty = applies to every promoter type. */
  promoterTypes: DisplayRefItem[]
  /** Owning campaign when this tier is campaign-anchored; null for a standing (non-campaign) tier. */
  campaign_Uuid?: string | null
  campaign_Display?: string | null
  startsAt?: string | null
  endsAt?: string | null
  active: boolean
  status?: string
  createdAt?: string
  updatedAt?: string
}

export interface CreateCollectionCommissionTierRequest {
  name: string
  description?: string | null
  basis: 'DAYS' | 'AMOUNT'
  maxDays?: number | null
  minAmount?: string | null
  minAmountCurrencyUuid?: string | null
  commissionPct?: string | null
  flatAmount?: string | null
  flatAmountCurrencyUuid?: string | null
  /** Empty/omitted = applies to every promoter type (M:N, V137, hub plan Part F). */
  promoterTypeUuids?: string[] | null
  campaignUuid?: string | null
  startsAt?: string | null
  endsAt?: string | null
}

/** PUT with PATCH semantics: only the fields present are applied. */
export interface UpdateCollectionCommissionTierRequest extends Partial<CreateCollectionCommissionTierRequest> {
  active?: boolean
}
