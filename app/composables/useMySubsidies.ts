import type { SubsidyDto } from '~/types/subsidies'

/**
 * Self-service view of the caller's own live subsidies (`GET /v1/me/subsidies`, SUBSIDY_VIEW_OWN) — read only,
 * for transparency. Silent: a non-affiliate gets 404 `me.member.not_enrolled`, which the card simply hides.
 */
export const useMySubsidies = () => {
  const list = () => useApi<SubsidyDto[]>('/v1/me/subsidies', { silent: true })
  return { list }
}
