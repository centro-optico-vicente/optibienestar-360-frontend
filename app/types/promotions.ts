// Promotions (hub ADR 0018): discounts defined inside a campaign and applied
// to a membership at enrollment or later. A discount is a percentage or a
// fixed amount in a currency (hub ADR 0038, phase 1).
import type { DisplayRefItem } from '~/types/options'

export type PromotionKind = 'ACQUISITION' | 'RECOVERY'
export type PromotionAppliesTo = 'INSCRIPTION' | 'MONTHLY' | 'BOTH'
/** PERCENTAGE uses `discountPct`; FLAT uses `discountAmount` + its currency. */
export type PromotionDiscountType = 'PERCENTAGE' | 'FLAT'

/** Discount fields shared by every promotion summary the API exposes. */
export interface PromotionDiscountFields {
  /** Missing on rows saved before ADR 0038 ⇒ PERCENTAGE. */
  discountType?: PromotionDiscountType | null
  discountType_Display?: string | null
  discountPct?: number | string | null
  discountPct_Display?: string | null
  discountAmount?: number | string | null
  discountAmount_Display?: string | null
  discountCurrency_Uuid?: string | null
  discountCurrency_Display?: string | null
  discountCurrency_Code?: string | null
}

export interface PromotionDto extends PromotionDiscountFields {
  uuid: string
  campaign_Uuid?: string | null
  campaign_Display?: string | null
  name: string
  description?: string | null
  kind: PromotionKind
  kind_Display?: string | null
  appliesTo: PromotionAppliesTo
  appliesTo_Display?: string | null
  cycles?: number | null
  coversExtraBeneficiaries: boolean
  /** true ⇒ `maxRedemptions` is this promotion's own limit (still within the campaign's). */
  ownQuota?: boolean | null
  maxRedemptions?: number | null
  redemptionsCount: number
  confirmedCount?: number | null
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
  /** null ⇒ PERCENTAGE. */
  discountType?: PromotionDiscountType | null
  /** Required when PERCENTAGE (0.01..100). */
  discountPct?: number | null
  /** Required when FLAT (>= 0.01). */
  discountAmount?: number | null
  /** Required when FLAT. */
  discountCurrencyUuid?: string | null
  appliesTo: PromotionAppliesTo
  cycles?: number | null
  coversExtraBeneficiaries: boolean
  /** false ⇒ consumes only the campaign quota; `maxRedemptions` must be null. */
  ownQuota: boolean
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

export interface MembershipPromotionDto extends PromotionDiscountFields {
  uuid: string
  promotion_Uuid?: string | null
  promotion_Display?: string | null
  campaign_Uuid?: string | null
  campaign_Display?: string | null
  kind: PromotionKind
  kind_Display?: string | null
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
