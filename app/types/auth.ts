// Contrato alineado con el backend real (optisalud-plus-backend).
// Ver: "OptiSalud Plus Backend — Guía de integración Frontend".
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

export interface AuthUser {
  uuid: string
  email: string
  fullName: string
  documentType?: string
  documentNumber?: string
  phone?: string
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

export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
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
  exp?: number
  [key: string]: unknown
}
