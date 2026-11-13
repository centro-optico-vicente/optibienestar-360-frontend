import type {
  AdminCreateUserRequest,
  AdminUpdateUserRequest,
  Page,
  UserDto,
} from '~/types/admin'
import type { Option } from '~/types/options'

interface ListParams {
  page?: number
  size?: number
  /** Multi-column sort, e.g. `['createdAt,desc']` — repeated as `sort=` query params. */
  sort?: string[]
  filter?: string
  /** Free-text, accent/case-insensitive (backend `?q=`). */
  q?: string
  includeInactive?: boolean
  /** Master-table filters (query-param name → value), see `utils/listFilters.ts`. */
  extra?: Record<string, string>
}

interface OptionsParams {
  q?: string
  limit?: number
  currentValues?: string[]
}

/**
 * Acceso a /v1/admin/users. Cada acción exige un permiso en el backend:
 * list/get → USER_VIEW_ALL · create → USER_CREATE · update → USER_UPDATE · delete → USER_DELETE.
 */
export const useUsers = () => {
  const list = (params: ListParams = {}) =>
    useApi<Page<UserDto>>('/v1/admin/users', {
      query: {
        page: params.page ?? 0,
        size: params.size ?? 20,
        ...(params.sort?.length ? { sort: params.sort } : {}),
        ...(params.filter ? { filter: params.filter } : {}),
        ...(params.q ? { q: params.q } : {}),
        ...(params.includeInactive ? { includeInactive: 'true' } : {}),
        ...(params.extra ?? {}),
      },
    })

  /** Proyección liviana para selects/typeahead (`GET /v1/admin/users/options`), sin paginar. */
  const options = (params: OptionsParams = {}) =>
    useApi<Option[]>('/v1/admin/users/options', {
      query: {
        ...(params.q ? { q: params.q } : {}),
        limit: params.limit ?? DROPDOWN_PAGE_SIZE,
        ...(params.currentValues?.length ? { currentValues: params.currentValues } : {}),
      },
    })

  const get = (uuid: string) =>
    useApi<UserDto>(`/v1/admin/users/${uuid}`)

  const create = (body: AdminCreateUserRequest) =>
    useApi<UserDto>('/v1/admin/users', { method: 'POST', body })

  const update = (uuid: string, body: AdminUpdateUserRequest) =>
    useApi<UserDto>(`/v1/admin/users/${uuid}`, { method: 'PUT', body })

  const remove = (uuid: string, physical = false) =>
    useApi<null>(`/v1/admin/users/${uuid}`, { method: 'DELETE', query: physical ? { physical: true } : {} })

  /** "Ping" of FK usage before deleting: lets the UI offer a physical delete vs. a deactivation. */
  const usage = (uuid: string) =>
    useApi<{ inUse: boolean, count: number }>(`/v1/admin/users/${uuid}/usage`)

  return { list, options, get, create, update, remove, usage }
}
