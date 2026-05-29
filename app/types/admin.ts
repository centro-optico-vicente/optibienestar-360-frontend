// Tipos de administración (Usuarios y Roles), alineados con el OpenAPI del backend.
// Usuarios: contrato real (/v1/admin/users). Roles/Permisos: contrato REST asumido
// (/v1/admin/roles, /v1/admin/permissions) que el backend aún debe exponer.

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

// --- Roles / Permisos (contrato REST asumido; backend pendiente) ---

export interface PermissionDto {
  uuid: string
  name: string
  domain?: string
  description?: string
}

export interface RoleDetailDto extends RoleDto {
  permissions?: PermissionDto[]
}

export interface RoleCreateRequest {
  name: string
  description?: string
  permissionIds: string[]
}

export interface RoleUpdateRequest {
  name?: string
  description?: string
  permissionIds?: string[]
}

/** Normaliza una respuesta que puede venir como Page<T> o como T[] plano. */
export function toItems<T>(res: Page<T> | T[] | null | undefined): T[] {
  if (!res) return []
  return Array.isArray(res) ? res : res.content ?? []
}
