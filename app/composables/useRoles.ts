import {
  toItems,
  type CreateRoleRequest,
  type Page,
  type PermissionDomainDto,
  type RoleDto,
  type UpdateRoleRequest,
} from '~/types/admin'
import type { Option } from '~/types/options'

interface OptionsParams {
  q?: string
  limit?: number
  currentValues?: string[]
}

/**
 * Acceso a Roles y Permisos.
 *
 * Lectura con `USER_VIEW_ALL`; gestión (CRUD de roles y permisos por rol) con
 * `ROLE_PERMISSION_EDIT`. El rol SYSTEM es inmutable y el DELETE es smart delete.
 *
 * - `GET /v1/admin/roles` → `RoleDto[]` (no paginado).
 * - `GET /v1/admin/roles/{uuid}` → `RoleDto`.
 * - `POST /v1/admin/roles` → `{ name, description }` (nombre UPPER_SNAKE_CASE).
 * - `PUT /v1/admin/roles/{uuid}` · `DELETE /v1/admin/roles/{uuid}` (204).
 * - `GET /v1/admin/roles/{uuid}/permissions` → `string[]` (UUIDs de permisos del rol).
 * - `PUT /v1/admin/roles/{uuid}/permissions` → `{ permissionUuids: string[] }` (mín. 1).
 * - `GET /v1/admin/permissions` → `PermissionDomainDto[]` (catálogo agrupado por dominio).
 *
 * Roles y permisos son las excepciones que el backend mantiene como array plano. Aun así
 * normalizamos con `toItems` por si en el futuro pasan a respuesta paginada (`Page<T>`).
 */
interface ListParams {
  q?: string
  includeInactive?: boolean
}

export const useRoles = () => {
  const list = async (params: ListParams = {}): Promise<RoleDto[]> =>
    toItems(await useApi<Page<RoleDto> | RoleDto[]>('/v1/admin/roles', {
      query: {
        ...(params.q ? { q: params.q } : {}),
        ...(params.includeInactive ? { includeInactive: 'true' } : {}),
      },
    }))

  /** Proyección liviana para selects (`GET /v1/admin/roles/options`), sin paginar. */
  const options = (params: OptionsParams = {}) =>
    useApi<Option[]>('/v1/admin/roles/options', {
      query: {
        ...(params.q ? { q: params.q } : {}),
        ...(params.limit ? { limit: params.limit } : {}),
        ...(params.currentValues?.length ? { currentValues: params.currentValues } : {}),
      },
    })

  const get = (uuid: string) =>
    useApi<RoleDto>(`/v1/admin/roles/${uuid}`)

  const create = (body: CreateRoleRequest) =>
    useApi<RoleDto>('/v1/admin/roles', { method: 'POST', body })

  const update = (uuid: string, body: UpdateRoleRequest) =>
    useApi<RoleDto>(`/v1/admin/roles/${uuid}`, { method: 'PUT', body })

  const remove = (uuid: string) =>
    useApi<null>(`/v1/admin/roles/${uuid}`, { method: 'DELETE' })

  /** UUIDs de los permisos actualmente asignados al rol. */
  const getRolePermissions = (uuid: string) =>
    useApi<string[]>(`/v1/admin/roles/${uuid}/permissions`)

  /** Reemplaza el conjunto de permisos del rol (requiere al menos 1). */
  const updateRolePermissions = (uuid: string, permissionUuids: string[]) =>
    useApi<string[]>(`/v1/admin/roles/${uuid}/permissions`, {
      method: 'PUT',
      body: { permissionUuids },
    })

  /** Catálogo completo de permisos agrupado por dominio. */
  const permissions = async (): Promise<PermissionDomainDto[]> =>
    toItems(await useApi<Page<PermissionDomainDto> | PermissionDomainDto[]>('/v1/admin/permissions'))

  return { list, options, get, create, update, remove, getRolePermissions, updateRolePermissions, permissions }
}
