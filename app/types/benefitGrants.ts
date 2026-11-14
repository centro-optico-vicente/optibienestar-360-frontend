// Campaign vouchers redeemable at an ally (hub ADR 0038, phase 3): a confirmed
// ALLY_BENEFIT promotion grants the membership N units of an ally's product,
// free or with a percentage / fixed amount off.
import type { AllyBenefitValueFields } from '~/types/promotions'
import type { CampaignQuotaTrigger } from '~/types/campaign'

/**
 * PENDING_CONFIRMATION is not a stored status: GET /v1/me/benefit-grants?includePending=true adds a
 * pseudo-entry (uuid null, expiresAt = slot deadline) for each ally-benefit slot still waiting for its
 * confirmation (hub ADR 0038 point 9). It cannot be redeemed.
 */
export type BenefitGrantStatus = 'AVAILABLE' | 'REDEEMED' | 'EXPIRED' | 'CANCELED' | 'PENDING_CONFIRMATION'

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

/** Item of GET /v1/me/benefit-grants (member portal). `uuid` is null on PENDING_CONFIRMATION pseudo-entries. */
export interface MembershipBenefitGrantDto extends Omit<BenefitGrantDto, 'uuid'> {
  uuid: string | null
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
  PENDING_CONFIRMATION: 'warning',
}

/**
 * Ally benefit whose campaign slot is still PENDING (validator `pendingBenefits`, hub ADR 0038 point 9):
 * information only — it becomes a redeemable voucher once the slot is confirmed.
 */
export interface PendingBenefitDto extends AllyBenefitValueFields {
  promotion_Uuid?: string | null
  promotion_Display?: string | null
  campaign_Uuid?: string | null
  campaign_Display?: string | null
  allyProduct_Uuid?: string | null
  allyProduct_Display?: string | null
  quantity?: number | null
  quotaTrigger?: CampaignQuotaTrigger | null
  quotaTrigger_Display?: string | null
  effectiveDeadline?: string | null
  effectiveDeadline_Display?: string | null
  deadlineFrozen?: boolean | null
}
