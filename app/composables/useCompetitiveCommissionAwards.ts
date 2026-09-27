import type { Page } from '~/types/admin'
import type {
  AwardStatus,
  CompetitiveAwardDto,
  CompetitiveAwardSettlementDto,
} from '~/types/competitiveCommissions'

interface ListParams {
  page?: number
  size?: number
  /** RSQL filter string — e.g. `rule.uuid==...;status==PENDING`. */
  filter?: string
}

/** Acceso a premios de comisión competitiva (/v1/admin/competitive-commission-awards, Fase 2b). */
export const useCompetitiveCommissionAwards = () => {
  const list = (params: ListParams = {}) =>
    useApi<Page<CompetitiveAwardDto>>('/v1/admin/competitive-commission-awards', {
      query: {
        page: params.page ?? 0,
        size: params.size ?? 50,
        ...(params.filter ? { filter: params.filter } : {}),
      },
    })

  const get = (uuid: string) =>
    useApi<CompetitiveAwardDto>(`/v1/admin/competitive-commission-awards/${uuid}`)

  const settlements = (uuid: string) =>
    useApi<CompetitiveAwardSettlementDto[]>(`/v1/admin/competitive-commission-awards/${uuid}/settlements`)

  /** Pays one settlement cut. */
  const paySettlement = (settlementUuid: string, payoutReference: string, payoutPaymentUuid?: string | null) =>
    useApi<null>(`/v1/admin/competitive-commission-awards/settlements/${settlementUuid}/pay`, {
      method: 'PUT',
      body: { payoutReference, payoutPaymentUuid },
    })

  /** Shortcut: pays every PENDING settlement of the award with the same reference. */
  const pay = (uuid: string, payoutReference: string, payoutPaymentUuid?: string | null) =>
    useApi<{ settlementsPaid: number }>(`/v1/admin/competitive-commission-awards/${uuid}/pay`, {
      method: 'PUT',
      body: { payoutReference, payoutPaymentUuid },
    })

  const voidAward = (uuid: string, reason: string) =>
    useApi<null>(`/v1/admin/competitive-commission-awards/${uuid}/void`, { method: 'POST', body: { reason } })

  return { list, get, settlements, paySettlement, pay, voidAward }
}

export type { AwardStatus }
