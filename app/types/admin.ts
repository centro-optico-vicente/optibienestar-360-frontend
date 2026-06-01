// Tipos de administración (Usuarios y Roles), alineados con el OpenAPI del backend.
// Usuarios: CRUD completo (/v1/admin/users). Roles: solo lectura + gestión de permisos
// (/v1/admin/roles, /v1/admin/roles/{uuid}/permissions, /v1/admin/permissions).

/** Página estándar de Spring Data (camelCase). */
export interface Page<T> {
  content: T[]
  totalElements: number
  totalPages: number
  size: number
  number: number
  numberOfElements: number
  first: boolean
  last: boolean
  empty: boolean
}

export interface RoleDto {
  uuid: string
  name: string
  description?: string
}

export interface UserDto {
  uuid: string
  email: string
  fullName: string
  documentType?: string
  documentNumber?: string
  phone?: string
  status?: string
  active?: boolean
  lastLoginAt?: string | null
  roles: RoleDto[]
}

export interface AdminCreateUserRequest {
  email: string
  fullName: string
  password: string
  documentType?: string
  documentNumber?: string
  phone?: string
  roleIds: string[]
}

export interface AdminUpdateUserRequest {
  fullName?: string
  documentType?: string
  documentNumber?: string
  phone?: string
  status?: string
  active?: boolean
  roleIds?: string[]
}

// --- Roles / Permisos ---
// Los roles son de solo lectura (definidos por el seed del backend). Lo único editable
// son los permisos asignados a cada rol, vía PUT /v1/admin/roles/{uuid}/permissions.

/** Permiso individual (llave de acción). */
export interface PermissionDto {
  uuid: string
  name: string
  description?: string
}

/** Catálogo de permisos agrupado por dominio (GET /v1/admin/permissions). */
export interface PermissionDomainDto {
  uuid: string
  code: string
  name: string
  icon?: string
  description?: string
  displayOrder: number
  permissions: PermissionDto[]
}

/** Body de PUT /v1/admin/roles/{uuid}/permissions (requiere al menos 1 permiso). */
export interface UpdateRolePermissionsRequest {
  permissionUuids: string[]
}

/** Normaliza una respuesta que puede venir como Page<T> o como T[] plano. */
export function toItems<T>(res: Page<T> | T[] | null | undefined): T[] {
  if (!res) return []
  return Array.isArray(res) ? res : res.content ?? []
}
