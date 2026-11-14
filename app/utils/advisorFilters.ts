import type { SelectItem } from '~/types/options'

/**
 * Sentinel value of the "Sin asesor" option in the advisor filters of the members, allies,
 * ally-requests and affiliation-requests lists. It is never sent as a uuid: the lists map it to
 * `unassigned=true`, which the backend reads as "no advisor OR the INSTITUCION system advisor".
 */
export const UNASSIGNED_ADVISOR = '__unassigned__'

/** The "Sin asesor" option, listed first in an advisor filter. */
export function unassignedAdvisorItem(t: (key: string) => string): SelectItem {
  return { label: t('portfolioDistribution.unassigned'), value: UNASSIGNED_ADVISOR }
}

/** `promoterUuid` for a real advisor, `unassigned: true` for the sentinel, nothing when blank. */
export function advisorFilterParams(value?: string | null): { promoterUuid?: string, unassigned?: boolean } {
  if (!value) return {}
  return value === UNASSIGNED_ADVISOR ? { unassigned: true } : { promoterUuid: value }
}

/** Same mapping on a `listFilterQuery()` result (string params): the sentinel becomes `unassigned=true`. */
export function withUnassignedAdvisor(query: Record<string, string>, key = 'promoterUuid'): Record<string, string> {
  if (query[key] !== UNASSIGNED_ADVISOR) return query
  const rest = { ...query }
  delete rest[key]
  return { ...rest, unassigned: 'true' }
}
