import type { Page } from '~/types/admin'
import type {
  CreateHierarchyOverrideTierRequest,
  HierarchyOverrideTierDto,
  UpdateHierarchyOverrideTierRequest,
} from '~/types/hierarchyOverrideTiers'

interface ListParams {
  page?: number
  size?: number
  /** Multi-column sort — repeated as `sort=` query params. */
  sort?: string[]
  filter?: string
  q?: string
  includeInactive?: boolean
  rankUuid?: string
  /** Filters rules linked to a commission campaign — used by the campaign ficha's "Rules" tab. Not yet a real backend filter param (see report); harmless no-op query param until the backend adds it. */
  campaignUuid?: string
}

/**
 * Acceso a las bandas de override jerárquico (/v1/admin/hierarchy-override-tiers,
 * V102/V108, hub plan §2). Granular per V79: VIEW_ALL/CREATE/UPDATE/DELETE.
 * DELETE es soft-delete (active=false) salvo `physical=true` sin uso.
 */
export const useHierarchyOverrideTiers = () => {
  const list = (params: ListParams = {}) =>
    useApi<Page<HierarchyOverrideTierDto>>('/v1/admin/hierarchy-override-tiers', {
      query: {
        page: params.page ?? 0,
        size: params.size ?? 50,
        ...(params.sort?.length ? { sort: params.sort } : {}),
        ...(params.filter ? { filter: params.filter } : {}),
        ...(params.q ? { q: params.q } : {}),
        ...(params.includeInactive ? { includeInactive: 'true' } : {}),
        ...(params.rankUuid ? { rankUuid: params.rankUuid } : {}),
        ...(params.campaignUuid ? { campaignUuid: params.campaignUuid } : {}),
      },
    })

  const get = (uuid: string) =>
    useApi<HierarchyOverrideTierDto>(`/v1/admin/hierarchy-override-tiers/${uuid}`)

  const create = (body: CreateHierarchyOverrideTierRequest) =>
    useApi<HierarchyOverrideTierDto>('/v1/admin/hierarchy-override-tiers', { method: 'POST', body })

  const update = (uuid: string, body: UpdateHierarchyOverrideTierRequest) =>
    useApi<HierarchyOverrideTierDto>(`/v1/admin/hierarchy-override-tiers/${uuid}`, { method: 'PUT', body })

  const remove = (uuid: string, physical = false) =>
    useApi<null>(`/v1/admin/hierarchy-override-tiers/${uuid}`, { method: 'DELETE', query: physical ? { physical: true } : {} })

  /** "Ping" of FK usage before deleting: lets the UI offer a physical delete vs. a deactivation. */
  const usage = (uuid: string) =>
    useApi<{ inUse: boolean, count: number }>(`/v1/admin/hierarchy-override-tiers/${uuid}/usage`)

  return { list, get, create, update, remove, usage }
}
