import type { Page } from '~/types/admin'
import type { Option } from '~/types/options'
import type {
  CreatePlanRequest,
  PlanDto,
  UpdatePlanRequest,
} from '~/types/plans'

interface ListParams {
  page?: number
  size?: number
  /** Multi-column sort, e.g. `['code,asc']` — repeated as `sort=` query params. */
  sort?: string[]
  filter?: string
  q?: string
  includeInactive?: boolean
}

interface OptionsParams {
  q?: string
  limit?: number
  currentValues?: string[]
}

/**
 * Acceso al vertical de Planes (/v1/admin/plans).
 * Permisos del backend por acción:
 * - list/get → PLAN_VIEW_ALL
 * - create → PLAN_CREATE · update → PLAN_UPDATE · remove → PLAN_DELETE
 * DELETE es soft-delete (active=false + published=false).
 */
export const usePlans = () => {
  const list = (params: ListParams = {}) =>
    useApi<Page<PlanDto>>('/v1/admin/plans', {
      query: {
        page: params.page ?? 0,
        size: params.size ?? 20,
        ...(params.sort?.length ? { sort: params.sort } : {}),
        ...(params.filter ? { filter: params.filter } : {}),
        ...(params.q ? { q: params.q } : {}),
        ...(params.includeInactive ? { includeInactive: 'true' } : {}),
      },
    })

  /** Proyección liviana para selects (`GET /v1/admin/plans/options`), sin paginar. */
  const options = (params: OptionsParams = {}) =>
    useApi<Option[]>('/v1/admin/plans/options', {
      query: {
        ...(params.q ? { q: params.q } : {}),
        ...(params.limit ? { limit: params.limit } : {}),
        ...(params.currentValues?.length ? { currentValues: params.currentValues } : {}),
      },
    })

  const get = (uuid: string) =>
    useApi<PlanDto>(`/v1/admin/plans/${uuid}`)

  const create = (body: CreatePlanRequest) =>
    useApi<PlanDto>('/v1/admin/plans', { method: 'POST', body })

  const update = (uuid: string, body: UpdatePlanRequest) =>
    useApi<PlanDto>(`/v1/admin/plans/${uuid}`, { method: 'PUT', body })

  const remove = (uuid: string, physical = false) =>
    useApi<null>(`/v1/admin/plans/${uuid}`, { method: 'DELETE', query: physical ? { physical: true } : {} })

  /** "Ping" of FK usage before deleting: lets the UI offer a physical delete vs. a deactivation. */
  const usage = (uuid: string) =>
    useApi<{ inUse: boolean, count: number }>(`/v1/admin/plans/${uuid}/usage`)

  return { list, options, get, create, update, remove, usage }
}
