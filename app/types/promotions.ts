// Promotions (hub ADR 0018): % discounts defined inside a campaign and applied
// to a membership at enrollment or later.
import type { DisplayRefItem } from '~/types/options'

export type PromotionKind = 'ACQUISITION' | 'RECOVERY'
export type PromotionAppliesTo = 'INSCRIPTION' | 'MONTHLY' | 'BOTH'

export interface PromotionDto {
  uuid: string
  campaign_Uuid?: string | null
  campaign_Display?: string | null
  name: string
  description?: string | null
  kind: PromotionKind
  kind_Display?: string | null
  discountPct: number | string
  discountPct_Display?: string | null
  appliesTo: PromotionAppliesTo
  appliesTo_Display?: string | null
  cycles?: number | null
  coversExtraBeneficiaries: boolean
  maxRedemptions?: number | null
  redemptionsCount: number
  requiresCode: boolean
  acceptsPromoterCode: boolean
  acceptsMemberCode: boolean
  acceptsAllyCode: boolean
  referrerRewardPct?: number | string | null
  referrerRewardCycles?: number | null
  plans: DisplayRefItem[]
  active: boolean
  createdAt?: string
}

export interface PromotionRequest {
  name: string
  description?: string | null
  kind: PromotionKind
  discountPct: number
  appliesTo: PromotionAppliesTo
  cycles?: number | null
  coversExtraBeneficiaries: boolean
  maxRedemptions?: number | null
  requiresCode: boolean
  acceptsPromoterCode: boolean
  acceptsMemberCode: boolean
  acceptsAllyCode: boolean
  referrerRewardPct?: number | null
  referrerRewardCycles?: number | null
  planUuids?: string[]
}

export type MembershipPromotionStatus = 'ACTIVE' | 'CONSUMED' | 'CANCELED'

export interface MembershipPromotionDto {
  uuid: string
  promotion_Uuid?: string | null
  promotion_Display?: string | null
  campaign_Uuid?: string | null
  campaign_Display?: string | null
  kind: PromotionKind
  kind_Display?: string | null
  discountPct: number | string
  discountPct_Display?: string | null
  appliesTo: PromotionAppliesTo
  appliesTo_Display?: string | null
  cyclesRemaining?: number | null
  inscriptionApplied: boolean
  codeUsed?: string | null
  codeOwnerType?: 'PROMOTER' | 'MEMBER' | 'ALLY' | null
  codeOwner_Uuid?: string | null
  codeOwner_Display?: string | null
  origin: 'ENROLLMENT' | 'ADMIN'
  status: MembershipPromotionStatus
  status_Display?: string | null
  assignedAt?: string | null
  endedAt?: string | null
  endedReason?: string | null
}

/** 1:1 sub-resource of a membership — always 200 with `exists`. */
export interface MembershipPromotionStatusDto {
  exists: boolean
  promotion: MembershipPromotionDto | null
}

export interface AssignPromotionRequest {
  promotionUuid: string
  code?: string | null
}
