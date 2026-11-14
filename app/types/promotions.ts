// Promotions (hub ADR 0018): discounts defined inside a campaign and applied
// to a membership at enrollment or later. A discount is a percentage or a
// fixed amount in a currency (hub ADR 0038, phase 1).
import type { DisplayRefItem } from '~/types/options'
import type { CampaignQuotaTrigger } from '~/types/campaign'

export type PromotionKind = 'ACQUISITION' | 'RECOVERY'
export type PromotionAppliesTo = 'INSCRIPTION' | 'MONTHLY' | 'BOTH'
/** DISCOUNT lowers the membership fees; ALLY_BENEFIT grants a voucher redeemable at an ally (hub ADR 0038, phase 3). */
export type PromotionBenefitKind = 'DISCOUNT' | 'ALLY_BENEFIT'
/** Value of an ally benefit: free, a percentage off, or a fixed amount off the ally's product. */
export type AllyBenefitType = 'FREE' | 'PERCENTAGE' | 'FLAT'

/** Ally-benefit fields shared by promotions and benefit grants. */
export interface AllyBenefitValueFields {
  benefitType?: AllyBenefitType | null
  benefitType_Display?: string | null
  benefitPct?: number | string | null
  benefitPct_Display?: string | null
  benefitAmount?: number | string | null
  benefitAmount_Display?: string | null
  benefitCurrency_Uuid?: string | null
  benefitCurrency_Display?: string | null
  benefitCurrency_Code?: string | null
}

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

export interface PromotionDto extends PromotionDiscountFields, AllyBenefitValueFields {
  uuid: string
  campaign_Uuid?: string | null
  campaign_Display?: string | null
  name: string
  description?: string | null
  kind: PromotionKind
  kind_Display?: string | null
  /** Only DISCOUNT promotions have it (null for ALLY_BENEFIT). */
  appliesTo?: PromotionAppliesTo | null
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
  // ---- Ally benefits (hub ADR 0038, phase 3) ----
  /** Missing on rows from before phase 3 ⇒ DISCOUNT. */
  benefitKind?: PromotionBenefitKind | null
  benefitKind_Display?: string | null
  ally_Uuid?: string | null
  ally_Display?: string | null
  /** The ally's offer (ally_products) the voucher is redeemed on. */
  allyProduct_Uuid?: string | null
  allyProduct_Display?: string | null
  benefitQuantity?: number | null
  /** Proposed by the ally from its portal (campaign partnership). */
  createdByAlly?: boolean | null
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
  /** Required for DISCOUNT, null for ALLY_BENEFIT. */
  appliesTo: PromotionAppliesTo | null
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
  // ---- Ally benefits (hub ADR 0038, phase 3) ----
  /** null ⇒ DISCOUNT. */
  benefitKind?: PromotionBenefitKind | null
  /** Forced to the campaign's ally when the campaign is ally-exclusive. */
  allyUuid?: string | null
  allyProductUuid?: string | null
  benefitType?: AllyBenefitType | null
  benefitPct?: number | null
  benefitAmount?: number | null
  benefitCurrencyUuid?: string | null
  benefitQuantity?: number | null
}

/**
 * Body of POST /v1/me/allies/campaigns/{uuid}/promotions and PUT /v1/me/allies/promotions/{uuid}:
 * an ALLY_BENEFIT proposed by the calling ally (ally resolved from the session).
 */
export interface AllyPromotionRequest {
  name: string
  description?: string | null
  allyProductUuid: string
  benefitType: AllyBenefitType
  benefitPct?: number | null
  benefitAmount?: number | null
  benefitCurrencyUuid?: string | null
  benefitQuantity: number
  ownQuota: boolean
  maxRedemptions?: number | null
  planUuids?: string[]
}

export type MembershipPromotionStatus = 'ACTIVE' | 'CONSUMED' | 'CANCELED'

/** Slot of the campaign quota held by a membership promotion (hub ADR 0038, phase 2b). */
export type PromotionRedemptionStatus = 'PENDING' | 'CONFIRMED' | 'EXPIRED' | 'RELEASED'

export const REDEMPTION_STATUS_COLORS: Record<PromotionRedemptionStatus, 'warning' | 'success' | 'error' | 'neutral'> = {
  PENDING: 'warning',
  CONFIRMED: 'success',
  EXPIRED: 'error',
  RELEASED: 'neutral',
}

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
  benefitKind?: PromotionBenefitKind | null
  redemptionStatus?: PromotionRedemptionStatus | null
  redemptionStatus_Display?: string | null
  /** Deadline of a PENDING slot. */
  redemptionExpiresAt?: string | null
  redemptionExpiresAt_Display?: string | null
  /** Last day the confirmed promotion can be used; null ⇒ no limit. */
  usageEndsAt?: string | null
  usageEndsAt_Display?: string | null
  /** What confirms the slot (the campaign's quota trigger, hub ADR 0038 point 9). */
  quotaTrigger?: CampaignQuotaTrigger | null
  quotaTrigger_Display?: string | null
  /** A payment in review was registered before the deadline: the slot does not expire until it is reviewed. */
  deadlineFrozen?: boolean | null
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
