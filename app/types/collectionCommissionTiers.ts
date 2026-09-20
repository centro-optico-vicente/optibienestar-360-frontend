// Types for the Collection Commission Tiers vertical
// (/v1/admin/collection-commission-tiers), aligned with the backend
// (V44__collection_commission_tiers.sql, CollectionCommissionTierDto /
// CreateRequest / UpdateRequest).
//
// A CollectionCommissionTier is a decreasing-% bucket by how many days it took
// to collect the recurring (MONTHLY) payment (ADR 0013 §3). The engine picks
// the smallest qualifying maxDays bucket. PUT uses PATCH semantics.

export interface CollectionCommissionTierDto {
  uuid: string
  name: string
  description?: string | null
  basis: 'DAYS' | 'AMOUNT'
  maxDays: number
  maxAmount?: number | string | null
  commissionPct: number | string
  flatAmount?: number | string | null
  flatAmountCurrency_Uuid?: string | null
  flatAmountCurrency_Display?: string | null
  flatAmountCurrency_Code?: string | null
  promoterType_Uuid?: string | null
  promoterType_Display?: string | null
  promoterType_Code?: string | null
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
  maxAmount?: string | null
  commissionPct?: string | null
  flatAmount?: string | null
  flatAmountCurrencyUuid?: string | null
  promoterTypeUuid?: string | null
  campaignUuid?: string | null
  startsAt?: string | null
  endsAt?: string | null
}

/** PUT with PATCH semantics: only the fields present are applied. */
export interface UpdateCollectionCommissionTierRequest extends Partial<CreateCollectionCommissionTierRequest> {
  active?: boolean
}
