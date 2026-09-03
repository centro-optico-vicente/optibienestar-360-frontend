// Tipos de administración (Usuarios y Roles), alineados con el OpenAPI del backend.
// Usuarios: CRUD completo (/v1/admin/users). Roles: CRUD (smart delete; el rol SYSTEM
// es inmutable) + gestión de permisos (/v1/admin/roles/{uuid}/permissions, /v1/admin/permissions).

import type { ConfigSortOrder } from '~/composables/useSystemConfig'

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
  /**
   * The sort actually applied — present only on endpoints backed by
   * `AppliedSortPage`. Lets the table reflect a server-side default
   * (entity_config/system_configs) in its header arrows even when the user
   * hasn't clicked any column.
   */
  appliedSort?: ConfigSortOrder[]
}

export interface RoleDto {
  uuid: string
  name: string
  description?: string
  active?: boolean
}

/**
 * Edit-response shape (person name parts + nested `roles` stay as-is). The
 * presentational scalars (`status`, `active`, `lastLoginAt`) carry a
 * localized `_Display` sibling (hub ADR 0014).
 */
export interface UserDto {
  uuid: string
  email: string
  // Name parts (LATAM convention) + derived fullName (read-only).
  firstName: string
  middleName?: string | null
  lastName: string
  secondLastName?: string | null
  fullName: string
  documentType?: string
  documentNumber?: string
  taxDocumentType?: string | null
  taxDocumentNumber?: string | null
  phone?: string | null
  locale?: string | null
  status?: string
  status_Display?: string | null
  active?: boolean
  active_Display?: string | null
  lastLoginAt?: string | null
  lastLoginAt_Display?: string | null
  roles: RoleDto[]
}

// v2 breaking change: fullName replaced by the 4 atomic name parts.
// firstName + lastName required; documentType + documentNumber required.
export interface AdminCreateUserRequest {
  email: string
  firstName: string
  middleName?: string
  lastName: string
  secondLastName?: string
  password: string
  documentType: string
  documentNumber: string
  taxDocumentType?: string
  taxDocumentNumber?: string
  phone?: string
  roleIds: string[]
}

// Partial update: only present fields are applied (PATCH-style under PUT).
export interface AdminUpdateUserRequest {
  firstName?: string
  middleName?: string
  lastName?: string
  secondLastName?: string
  documentType?: string
  documentNumber?: string
  taxDocumentType?: string
  taxDocumentNumber?: string
  phone?: string
  locale?: string
  status?: string
  active?: boolean
  roleIds?: string[]
}

// --- Roles / Permisos ---
// CRUD de roles vía POST/PUT/DELETE /v1/admin/roles (nombre UPPER_SNAKE_CASE; el rol
// SYSTEM no se puede modificar ni eliminar; DELETE es smart delete). Los permisos de
// cada rol se reemplazan como conjunto vía PUT /v1/admin/roles/{uuid}/permissions.

/** Body de POST /v1/admin/roles. El nombre debe ser UPPER_SNAKE_CASE. */
export interface CreateRoleRequest {
  name: string
  description?: string
}

/** Body de PUT /v1/admin/roles/{uuid} (no aplica al rol SYSTEM). */
export type UpdateRoleRequest = Partial<CreateRoleRequest> & { active?: boolean }

/** Permiso individual (llave de acción). */
export interface PermissionDto {
  uuid: string
  /** Código técnico (ej. USER_CREATE) — usado para agrupar/marcar por acción, nunca mostrado. */
  code: string
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

/**
 * A user membership under /v1/admin/roles/{roleUuid}/users.
 *
 * Mirrors AllyUserDto's flattening: the backend sends the User + Person fields
 * needed to render the table without a round-trip, not a nested `user` object.
 * `status`/`active` carry a localized `_Display` sibling (hub ADR 0014) —
 * render it directly instead of computing the badge label client-side.
 */
export interface RoleUserDto {
  userUuid: string
  email?: string
  fullName?: string
  status?: string
  status_Display?: string | null
  active: boolean
  active_Display?: string | null
}

/** Normaliza una respuesta que puede venir como Page<T> o como T[] plano. */
export function toItems<T>(res: Page<T> | T[] | null | undefined): T[] {
  if (!res) return []
  return Array.isArray(res) ? res : res.content ?? []
}
