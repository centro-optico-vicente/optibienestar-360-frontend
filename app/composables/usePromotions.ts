import type {
  AssignPromotionRequest,
  MembershipPromotionDto,
  MembershipPromotionStatusDto,
  PromotionDto,
  PromotionRequest,
} from '~/types/promotions'

/**
 * Promotions (hub ADR 0018). Backend permissions per action:
 * - campaign promotions: list/get → PROMOTION_VIEW_ALL · create/update/delete → PROMOTION_CREATE/UPDATE/DELETE
 * - membership promotion: current → MEMBERSHIP_VIEW_ALL or PROMOTION_VIEW_ALL · options/assign/cancel → PROMOTION_ASSIGN
 * - offeredForEnrollment → MEMBERSHIP_CREATE or PROMOTION_ASSIGN · mine → MEMBER_VIEW_OWN
 */
export function usePromotions() {
  const listForCampaign = (campaignUuid: string) =>
    useApi<PromotionDto[]>(`/v1/admin/campaigns/${campaignUuid}/promotions`)

  const create = (campaignUuid: string, body: PromotionRequest) =>
    useApi<PromotionDto>(`/v1/admin/campaigns/${campaignUuid}/promotions`, { method: 'POST', body })

  const update = (uuid: string, body: PromotionRequest) =>
    useApi<PromotionDto>(`/v1/admin/promotions/${uuid}`, { method: 'PUT', body })

  const remove = (uuid: string) =>
    useApi<void>(`/v1/admin/promotions/${uuid}`, { method: 'DELETE' })

  /** ACQUISITION promotions currently offered for a new enrollment on the plan. */
  const offeredForEnrollment = (planUuid: string) =>
    useApi<PromotionDto[]>('/v1/admin/promotions/offered', { query: { planUuid } })

  const currentForMembership = (membershipUuid: string) =>
    useApi<MembershipPromotionStatusDto>(`/v1/admin/memberships/${membershipUuid}/promotion`)

  const optionsForMembership = (membershipUuid: string) =>
    useApi<PromotionDto[]>(`/v1/admin/memberships/${membershipUuid}/promotion/options`)

  const assign = (membershipUuid: string, body: AssignPromotionRequest) =>
    useApi<MembershipPromotionDto>(`/v1/admin/memberships/${membershipUuid}/promotion`, { method: 'POST', body })

  const cancel = (membershipUuid: string, reason: string) =>
    useApi<MembershipPromotionDto>(`/v1/admin/memberships/${membershipUuid}/promotion/cancel`, { method: 'POST', body: { reason } })

  const mine = () =>
    useApi<MembershipPromotionStatusDto>('/v1/me/promotion')

  return { listForCampaign, create, update, remove, offeredForEnrollment, currentForMembership, optionsForMembership, assign, cancel, mine }
}
