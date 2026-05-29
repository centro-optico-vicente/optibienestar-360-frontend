import type {
  Page,
  PermissionDto,
  RoleCreateRequest,
  RoleDetailDto,
  RoleDto,
  RoleUpdateRequest,
} from '~/types/admin'

/**
 * Acceso a Roles y Permisos. ⚠️ Contrato REST ASUMIDO: el backend todavía no expone
 * estos endpoints (el OpenAPI actual solo tiene /v1/admin/users). Mientras no existan,
 * estas llamadas devolverán 404 y la UI lo informa con un mensaje claro.
 * En la UI se protege con el permiso USER_CHANGE_ROLE.
 */
export const useRoles = () => {
  const list = () =>
    useApi<Page<RoleDto> | RoleDto[]>('/v1/admin/roles', {
      query: { page: 0, size: 100, sort: 'name,asc' },
    })

  const get = (uuid: string) =>
    useApi<RoleDetailDto>(`/v1/admin/roles/${uuid}`)

  const create = (body: RoleCreateRequest) =>
    useApi<RoleDto>('/v1/admin/roles', { method: 'POST', body })

  const update = (uuid: string, body: RoleUpdateRequest) =>
    useApi<RoleDto>(`/v1/admin/roles/${uuid}`, { method: 'PUT', body })

  const remove = (uuid: string) =>
    useApi<null>(`/v1/admin/roles/${uuid}`, { method: 'DELETE' })

  const permissions = () =>
    useApi<Page<PermissionDto> | PermissionDto[]>('/v1/admin/permissions', {
      query: { page: 0, size: 200, sort: 'domain,asc' },
    })

  return { list, get, create, update, remove, permissions }
}
