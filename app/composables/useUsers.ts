import type {
  AdminCreateUserRequest,
  AdminUpdateUserRequest,
  Page,
  UserDto,
} from '~/types/admin'

interface ListParams {
  page?: number
  size?: number
  sort?: string
  filter?: string
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
        sort: params.sort ?? 'createdAt,desc',
        ...(params.filter ? { filter: params.filter } : {}),
      },
    })

  const get = (uuid: string) =>
    useApi<UserDto>(`/v1/admin/users/${uuid}`)

  const create = (body: AdminCreateUserRequest) =>
    useApi<UserDto>('/v1/admin/users', { method: 'POST', body })

  const update = (uuid: string, body: AdminUpdateUserRequest) =>
    useApi<UserDto>(`/v1/admin/users/${uuid}`, { method: 'PUT', body })

  const remove = (uuid: string) =>
    useApi<null>(`/v1/admin/users/${uuid}`, { method: 'DELETE' })

  return { list, get, create, update, remove }
}
