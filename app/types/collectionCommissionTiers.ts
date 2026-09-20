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
  maxDays: number
  commissionPct: number | string
  promoterType_Uuid?: string | null
  promoterType_Display?: string | null
  promoterType_Code?: string | null
  /** ASSUMPTION: optional link to a commission campaign (campaign_id FK) — not yet confirmed by backend. */
  campaign_Uuid?: string | null
  campaign_Display?: string | null
  active: boolean
  status?: string
  createdAt?: string
  updatedAt?: string
}

export interface CreateCollectionCommissionTierRequest {
  name: string
  maxDays: number
  commissionPct: string
  promoterTypeUuid?: string | null
  /** ASSUMPTION: sets the owning campaign when created from the campaign ficha's "Add rule" flow. */
  campaignUuid?: string | null
}

/** PUT with PATCH semantics: only the fields present are applied. */
export interface UpdateCollectionCommissionTierRequest extends Partial<CreateCollectionCommissionTierRequest> {
  active?: boolean
}
