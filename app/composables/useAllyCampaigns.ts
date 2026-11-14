import type { AllyPartnershipCampaignDto } from '~/types/campaign'
import type { AllyPromotionRequest, PromotionDto } from '~/types/promotions'

/**
 * Ally portal side of campaign partnership (hub ADR 0038, phase 3): active
 * campaigns that accept allies, and the calling ally's own benefits in them.
 * `allyUuid` picks which of the caller's allies acts (users who operate
 * several); omitted, the backend uses the caller's primary ally. Backend permissions:
 * - list / promotions → ALLY_CAMPAIGN_VIEW
 * - createPromotion → ALLY_CAMPAIGN_PROMOTION_CREATE
 * - updatePromotion / removePromotion → ALLY_CAMPAIGN_PROMOTION_UPDATE / _DELETE
 *   (only own promotions with no redemptions; 422 otherwise)
 */
export function useAllyCampaigns() {
  const allyQuery = (allyUuid?: string | null) => (allyUuid ? { allyUuid } : undefined)

  const list = (allyUuid?: string | null) =>
    useApi<AllyPartnershipCampaignDto[]>('/v1/me/allies/campaigns', { query: allyQuery(allyUuid) })

  const promotions = (campaignUuid: string, allyUuid?: string | null) =>
    useApi<PromotionDto[]>(`/v1/me/allies/campaigns/${campaignUuid}/promotions`, { query: allyQuery(allyUuid) })

  const createPromotion = (campaignUuid: string, body: AllyPromotionRequest, allyUuid?: string | null) =>
    useApi<PromotionDto>(`/v1/me/allies/campaigns/${campaignUuid}/promotions`, {
      method: 'POST', body, query: allyQuery(allyUuid),
    })

  const updatePromotion = (uuid: string, body: AllyPromotionRequest, allyUuid?: string | null) =>
    useApi<PromotionDto>(`/v1/me/allies/promotions/${uuid}`, { method: 'PUT', body, query: allyQuery(allyUuid) })

  const removePromotion = (uuid: string, allyUuid?: string | null) =>
    useApi<void>(`/v1/me/allies/promotions/${uuid}`, { method: 'DELETE', query: allyQuery(allyUuid) })

  return { list, promotions, createPromotion, updatePromotion, removePromotion }
}
