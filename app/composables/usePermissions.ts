import type { Permission } from '~/types/permissions'
import type { UserRole } from '~/types/auth'

/**
 * Control de permisos en la UI. SOLO comodidad/experiencia — la seguridad real
 * vive en el `@PreAuthorize` del backend (responde 403 sin la llave).
 *
 * Uso:
 *   const { can } = usePermissions()
 *   const canDelete = computed(() => can('MEMBER_DELETE'))
 */
export const usePermissions = () => {
  const auth = useAuthStore()

  const can = (permission: Permission | string): boolean =>
    auth.permissions.includes(permission)

  const canAny = (...permissions: Array<Permission | string>): boolean =>
    permissions.some(can)

  const canAll = (...permissions: Array<Permission | string>): boolean =>
    permissions.every(can)

  const hasRole = (role: UserRole): boolean =>
    auth.roleNames.includes(role)

  const hasAnyRole = (...roles: UserRole[]): boolean =>
    roles.some(hasRole)

  return { can, canAny, canAll, hasRole, hasAnyRole }
}
