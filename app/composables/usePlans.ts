import type { Page } from '~/types/admin'
import type {
  CreatePlanRequest,
  PlanDto,
  UpdatePlanRequest,
} from '~/types/plans'

interface ListParams {
  page?: number
  size?: number
  sort?: string
  filter?: string
  q?: string
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
        sort: params.sort ?? 'code,asc',
        ...(params.filter ? { filter: params.filter } : {}),
        ...(params.q ? { q: params.q } : {}),
      },
    })

  const get = (uuid: string) =>
    useApi<PlanDto>(`/v1/admin/plans/${uuid}`)

  const create = (body: CreatePlanRequest) =>
    useApi<PlanDto>('/v1/admin/plans', { method: 'POST', body })

  const update = (uuid: string, body: UpdatePlanRequest) =>
    useApi<PlanDto>(`/v1/admin/plans/${uuid}`, { method: 'PUT', body })

  const remove = (uuid: string) =>
    useApi<null>(`/v1/admin/plans/${uuid}`, { method: 'DELETE' })

  return { list, get, create, update, remove }
}
