import type {
  PermissionDomainDto,
  RoleDto,
} from '~/types/admin'

/**
 * Acceso a Roles y Permisos.
 *
 * Los roles son de **solo lectura** (los define el seed del backend): solo se listan.
 * Lo editable son los permisos asignados a cada rol, vía
 * `PUT /v1/admin/roles/{uuid}/permissions`. En la UI se protege con `USER_CHANGE_ROLE`.
 *
 * - `GET /v1/admin/roles` → `RoleDto[]` (array plano).
 * - `GET /v1/admin/roles/{uuid}` → `RoleDto`.
 * - `GET /v1/admin/roles/{uuid}/permissions` → `string[]` (UUIDs de permisos del rol).
 * - `PUT /v1/admin/roles/{uuid}/permissions` → `{ permissionUuids: string[] }` (mín. 1).
 * - `GET /v1/admin/permissions` → `PermissionDomainDto[]` (catálogo agrupado por dominio).
 */
export const useRoles = () => {
  const list = () =>
    useApi<RoleDto[]>('/v1/admin/roles')

  const get = (uuid: string) =>
    useApi<RoleDto>(`/v1/admin/roles/${uuid}`)

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
  const permissions = () =>
    useApi<PermissionDomainDto[]>('/v1/admin/permissions')

  return { list, get, getRolePermissions, updateRolePermissions, permissions }
}
