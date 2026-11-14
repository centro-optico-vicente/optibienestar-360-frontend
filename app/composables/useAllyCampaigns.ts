import type { AllyPartnershipCampaignDto } from '~/types/campaign'
import type { AllyPromotionRequest, PromotionDto } from '~/types/promotions'

/**
 * Ally portal side of campaign partnership (hub ADR 0038, phase 3): active
 * campaigns that accept allies, and the calling ally's own benefits in them.
 * The ally is resolved from the session, never sent. Backend permissions:
 * - list / promotions → ALLY_CAMPAIGN_VIEW
 * - createPromotion → ALLY_CAMPAIGN_PROMOTION_CREATE
 * - updatePromotion / removePromotion → ALLY_CAMPAIGN_PROMOTION_UPDATE / _DELETE
 *   (only own promotions with no redemptions; 409 otherwise)
 */
export function useAllyCampaigns() {
  const list = () =>
    useApi<AllyPartnershipCampaignDto[]>('/v1/me/allies/campaigns')

  const promotions = (campaignUuid: string) =>
    useApi<PromotionDto[]>(`/v1/me/allies/campaigns/${campaignUuid}/promotions`)

  const createPromotion = (campaignUuid: string, body: AllyPromotionRequest) =>
    useApi<PromotionDto>(`/v1/me/allies/campaigns/${campaignUuid}/promotions`, { method: 'POST', body })

  const updatePromotion = (uuid: string, body: AllyPromotionRequest) =>
    useApi<PromotionDto>(`/v1/me/allies/promotions/${uuid}`, { method: 'PUT', body })

  const removePromotion = (uuid: string) =>
    useApi<void>(`/v1/me/allies/promotions/${uuid}`, { method: 'DELETE' })

  return { list, promotions, createPromotion, updatePromotion, removePromotion }
}
