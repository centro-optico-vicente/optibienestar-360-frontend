// Campaign vouchers redeemable at an ally (hub ADR 0038, phase 3): a confirmed
// ALLY_BENEFIT promotion grants the membership N units of an ally's product,
// free or with a percentage / fixed amount off.
import type { AllyBenefitValueFields } from '~/types/promotions'

export type BenefitGrantStatus = 'AVAILABLE' | 'REDEEMED' | 'EXPIRED' | 'CANCELED'

/** Voucher as the validator shows it to the ally (AVAILABLE ones only). */
export interface BenefitGrantDto extends AllyBenefitValueFields {
  uuid: string
  promotion_Uuid?: string | null
  promotion_Display?: string | null
  campaign_Uuid?: string | null
  campaign_Display?: string | null
  /** The ally's offer the voucher is redeemed on. */
  allyProduct_Uuid?: string | null
  allyProduct_Display?: string | null
  quantity: number
  remainingQty: number
  expiresAt?: string | null
  expiresAt_Display?: string | null
  /** Covered person the grant belongs to, when it is not the holder's. */
  beneficiary_Uuid?: string | null
  beneficiary_Display?: string | null
}

/** Item of GET /v1/me/benefit-grants (member portal). */
export interface MembershipBenefitGrantDto extends BenefitGrantDto {
  ally_Uuid?: string | null
  ally_Display?: string | null
  ally_Code?: string | null
  grantStatus: BenefitGrantStatus
  grantStatus_Display?: string | null
  redeemedAt?: string | null
  redeemedAt_Display?: string | null
}

export const BENEFIT_GRANT_STATUS_COLORS: Record<BenefitGrantStatus, 'success' | 'neutral' | 'error' | 'warning'> = {
  AVAILABLE: 'success',
  REDEEMED: 'neutral',
  EXPIRED: 'warning',
  CANCELED: 'error',
}
