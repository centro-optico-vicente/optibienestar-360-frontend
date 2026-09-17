// Contrato alineado con el backend real (optibienestar-360-backend).
// Ver: "OptiBienestar 360 Backend — Guía de integración Frontend".
// La API responde y espera camelCase; fechas en ISO-8601; IDs uuid.

export type UserRole =
  | 'SYSTEM'
  | 'ADMINISTRADOR'
  | 'OPERADOR'
  | 'OPERADOR_MEDICO'
  | 'ALIADO'
  | 'AFILIADO'
  | 'PROMOTOR'

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'LOCKED' | 'PENDING' | (string & {})

export interface Role {
  uuid: string
  name: UserRole
  description?: string
}

/** One role selectable as the caller's active session role — GET /v1/me/roles. */
export interface MyRole {
  uuid: string
  name: UserRole
  description?: string
  isDefault: boolean
}

export interface AuthUser {
  uuid: string
  email: string
  fullName: string
  documentType?: string
  documentNumber?: string
  phone?: string
  /** Persisted UI/locale preference (es | es-VE | en). Source of truth for the UI language. */
  locale?: string
  status?: UserStatus
  active?: boolean
  lastLoginAt?: string | null
  roles: Role[]
}

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  accessToken: string
  refreshToken: string
  tokenType: string
  expiresIn: number
  user: AuthUser
}

export interface RefreshResponse {
  accessToken: string
  refreshToken: string
  tokenType: string
  expiresIn: number
}

/**
 * Response for endpoints that reissue an access token WITHOUT rotating the
 * refresh token (e.g. POST /v1/me/locale). Only the access token is replaced;
 * the previous one is blacklisted server-side, so the client must swap it in.
 */
export interface AccessTokenResponse {
  accessToken: string
  tokenType: string
  expiresIn: number
  user: AuthUser
}

export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
}

/** POST /v1/me/active-role — switches the caller's active session role. */
export interface SwitchActiveRoleRequest {
  roleUuid: string
  refreshToken: string
}

/**
 * Error en formato RFC 7807 (application/problem+json) que devuelve el backend.
 * `errors` aparece en validaciones de campo (400); `lockedUntil` en bloqueo de cuenta (423).
 */
export interface ProblemDetail {
  type?: string
  title?: string
  status?: number
  detail?: string
  instance?: string
  errors?: Array<{ field: string, message: string }>
  lockedUntil?: string
  [key: string]: unknown
}

/** Error normalizado que lanza `useApi` al consumidor. */
export interface ApiError {
  status: number
  problem: ProblemDetail | null
  message: string
}

/**
 * Payload del JWT. SOLO para experiencia de usuario (menú/botones).
 * El frontend no verifica la firma; la autorización real la hace el backend.
 */
export interface JwtPayload {
  sub?: string
  permissions?: string[]
  type?: string
  /** Locale claim; updated by POST /v1/me/locale so the backend localizes ProblemDetail/emails. */
  locale?: string
  /** Active-role claims (role-switch feature) — absent on tokens minted before this existed. */
  role_uuid?: string
  role_name?: UserRole
  exp?: number
  [key: string]: unknown
}
