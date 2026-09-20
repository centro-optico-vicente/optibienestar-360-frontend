import type { Page } from '~/types/admin'
import type { BonusRuleDto, BonusRuleRequest } from '~/types/bonusRules'

interface ListParams {
  page?: number
  size?: number
  /** Multi-column sort — repeated as `sort=` query params. */
  sort?: string[]
  filter?: string
  q?: string
  includeInactive?: boolean
  promoterTypeUuid?: string
  /** ASSUMPTION: filters rules linked to a commission campaign — used by the campaign ficha's "Rules" tab. */
  campaignUuid?: string
}

/**
 * Acceso a las reglas de bono por escala (/v1/admin/bonus-rules, V37, ADR 0013
 * §2). Granular per V79: VIEW_ALL/CREATE/UPDATE/DELETE instead of one combined permission. PUT es reemplazo
 * completo (no PATCH). DELETE es soft-delete (active=false).
 */
export const useBonusRules = () => {
  const list = (params: ListParams = {}) =>
    useApi<Page<BonusRuleDto>>('/v1/admin/bonus-rules', {
      query: {
        page: params.page ?? 0,
        size: params.size ?? 50,
        ...(params.sort?.length ? { sort: params.sort } : {}),
        ...(params.filter ? { filter: params.filter } : {}),
        ...(params.q ? { q: params.q } : {}),
        ...(params.includeInactive ? { includeInactive: 'true' } : {}),
        ...(params.promoterTypeUuid ? { promoterTypeUuid: params.promoterTypeUuid } : {}),
        ...(params.campaignUuid ? { campaignUuid: params.campaignUuid } : {}),
      },
    })

  const get = (uuid: string) =>
    useApi<BonusRuleDto>(`/v1/admin/bonus-rules/${uuid}`)

  const create = (body: BonusRuleRequest) =>
    useApi<BonusRuleDto>('/v1/admin/bonus-rules', { method: 'POST', body })

  const update = (uuid: string, body: BonusRuleRequest) =>
    useApi<BonusRuleDto>(`/v1/admin/bonus-rules/${uuid}`, { method: 'PUT', body })

  const remove = (uuid: string) =>
    useApi<null>(`/v1/admin/bonus-rules/${uuid}`, { method: 'DELETE' })

  return { list, get, create, update, remove }
}
