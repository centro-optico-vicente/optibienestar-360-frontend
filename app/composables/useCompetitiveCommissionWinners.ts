import type { Page } from '~/types/admin'
import type {
  CompetitiveEvaluationOutcome,
  CompetitiveManualDecisionDto,
  CompetitiveManualDecisionRequest,
  CompetitiveTieDto,
  CompetitiveTieResolveRequest,
} from '~/types/competitiveCommissions'

interface ListTiesParams {
  page?: number
  size?: number
  /** RSQL filter string — e.g. `status==OPEN;rule.uuid==...`. */
  filter?: string
}

/** D16 — tablero de ganadores (/v1/admin/competitive-commission-winners, Fase 2c). */
export const useCompetitiveCommissionWinners = () => {
  const listTies = (params: ListTiesParams = {}) =>
    useApi<Page<CompetitiveTieDto>>('/v1/admin/competitive-commission-winners/ties', {
      query: {
        page: params.page ?? 0,
        size: params.size ?? 50,
        ...(params.filter ? { filter: params.filter } : {}),
      },
    })

  const getTie = (uuid: string) =>
    useApi<CompetitiveTieDto>(`/v1/admin/competitive-commission-winners/ties/${uuid}`)

  const listDecisions = (ruleUuid: string, periodStart: string) =>
    useApi<CompetitiveManualDecisionDto[]>(
      `/v1/admin/competitive-commission-winners/${ruleUuid}/periods/${periodStart}/decisions`)

  const resolveTie = (uuid: string, body: CompetitiveTieResolveRequest, dryRun = true) =>
    useApi<CompetitiveEvaluationOutcome>(`/v1/admin/competitive-commission-winners/ties/${uuid}/resolve`, {
      method: 'POST',
      query: { dryRun },
      body,
    })

  const decide = (ruleUuid: string, periodStart: string, body: CompetitiveManualDecisionRequest, dryRun = true) =>
    useApi<CompetitiveEvaluationOutcome>(
      `/v1/admin/competitive-commission-winners/${ruleUuid}/periods/${periodStart}/decisions`, {
        method: 'POST',
        query: { dryRun },
        body,
      })

  const revert = (uuid: string, reason: string) =>
    useApi<CompetitiveEvaluationOutcome>(`/v1/admin/competitive-commission-winners/decisions/${uuid}/revert`, {
      method: 'POST',
      body: { reason },
    })

  return { listTies, getTie, listDecisions, resolveTie, decide, revert }
}
