import type { Page } from '~/types/admin'
import type { BonusRuleDto, BonusRuleRequest } from '~/types/bonusRules'

interface ListParams {
  page?: number
  size?: number
  sort?: string
  filter?: string
  q?: string
}

/**
 * Acceso a las reglas de bono por escala (/v1/admin/bonus-rules, V37, ADR 0013
 * §2). Todas las operaciones requieren BONUS_RULE_MANAGE. PUT es reemplazo
 * completo (no PATCH). DELETE es soft-delete (active=false).
 */
export const useBonusRules = () => {
  const list = (params: ListParams = {}) =>
    useApi<Page<BonusRuleDto>>('/v1/admin/bonus-rules', {
      query: {
        page: params.page ?? 0,
        size: params.size ?? 50,
        sort: params.sort ?? 'createdAt,desc',
        ...(params.filter ? { filter: params.filter } : {}),
        ...(params.q ? { q: params.q } : {}),
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
