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

  // Compares against the session's ACTIVE role, not the full roleNames list —
  // consistent with `can()`, which already reads permissions scoped to the
  // active role. A multi-role user viewing under a non-active role should not
  // see nav leaves gated by `roles:` for a role they hold but isn't using now.
  const hasRole = (role: UserRole): boolean =>
    auth.activeRole === role

  const hasAnyRole = (...roles: UserRole[]): boolean =>
    roles.some(hasRole)

  return { can, canAny, canAll, hasRole, hasAnyRole }
}
