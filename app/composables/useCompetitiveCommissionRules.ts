import type { Page } from '~/types/admin'
import type {
  CompetitiveEvaluationOutcome,
  CompetitiveMetric,
  CompetitionType,
  CompetitiveRuleDto,
  CompetitiveRuleListItemDto,
  CompetitiveRuleRequest,
} from '~/types/competitiveCommissions'

interface ListParams {
  page?: number
  size?: number
  sort?: string[]
  filter?: string
  q?: string
  includeInactive?: boolean
  campaignUuid?: string
  campaignLinked?: boolean
  metric?: CompetitiveMetric
  competitionType?: CompetitionType
}

/**
 * Acceso a reglas de comisión competitivas (/v1/admin/competitive-commission-rules,
 * hub plan competitive-commission-rules, Fase 1-2). FIRST_TO_REACH / RANKING por
 * posición — no un tier/banda más. PUT es full-replace.
 */
export const useCompetitiveCommissionRules = () => {
  const list = (params: ListParams = {}) =>
    useApi<Page<CompetitiveRuleListItemDto>>('/v1/admin/competitive-commission-rules', {
      query: {
        page: params.page ?? 0,
        size: params.size ?? 50,
        ...(params.sort?.length ? { sort: params.sort } : {}),
        ...(params.filter ? { filter: params.filter } : {}),
        ...(params.q ? { q: params.q } : {}),
        ...(params.includeInactive ? { includeInactive: 'true' } : {}),
        ...(params.campaignUuid ? { campaignUuid: params.campaignUuid } : {}),
        ...(params.campaignLinked ? { campaignLinked: 'true' } : {}),
        ...(params.metric ? { metric: params.metric } : {}),
        ...(params.competitionType ? { competitionType: params.competitionType } : {}),
      },
    })

  const get = (uuid: string) =>
    useApi<CompetitiveRuleDto>(`/v1/admin/competitive-commission-rules/${uuid}`)

  const create = (body: CompetitiveRuleRequest) =>
    useApi<CompetitiveRuleDto>('/v1/admin/competitive-commission-rules', { method: 'POST', body })

  const update = (uuid: string, body: CompetitiveRuleRequest) =>
    useApi<CompetitiveRuleDto>(`/v1/admin/competitive-commission-rules/${uuid}`, { method: 'PUT', body })

  const remove = (uuid: string, physical = false) =>
    useApi<null>(`/v1/admin/competitive-commission-rules/${uuid}`, { method: 'DELETE', query: physical ? { physical: true } : {} })

  const usage = (uuid: string) =>
    useApi<{ inUse: boolean, count: number }>(`/v1/admin/competitive-commission-rules/${uuid}/usage`)

  /** Preview (`dryRun=true`, the default) or apply an evaluation run for the period containing `period`. */
  const recalculate = (uuid: string, params: { period?: string, dryRun?: boolean } = {}) =>
    useApi<CompetitiveEvaluationOutcome>(`/v1/admin/competitive-commission-rules/${uuid}/recalculate`, {
      method: 'POST',
      query: {
        ...(params.period ? { period: params.period } : {}),
        dryRun: params.dryRun ?? true,
      },
    })

  return { list, get, create, update, remove, usage, recalculate }
}
