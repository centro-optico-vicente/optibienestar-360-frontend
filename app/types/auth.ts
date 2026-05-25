export type UserRole =
  | 'SYSTEM'
  | 'ADMINISTRADOR'
  | 'OPERADOR'
  | 'ALIADO_USER'
  | 'AFILIADO_USER'
  | 'PROMOTOR'

export interface AuthUser {
  id: string | number
  email: string
  firstName?: string
  lastName?: string
  role: UserRole
  permissions?: string[]
  mustChangePassword?: boolean
}

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  accessToken: string
  refreshToken?: string
  expiresIn?: number
  user: AuthUser
  mustChangePassword?: boolean
}

export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
}

export interface ApiErrorBody {
  message?: string
  error?: string
  statusCode?: number
  errors?: Record<string, string[]>
}
