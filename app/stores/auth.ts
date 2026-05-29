import { defineStore } from 'pinia'
import type { AuthUser, JwtPayload, LoginResponse, RefreshResponse, UserRole } from '~/types/auth'

// Política de almacenamiento (Guía de integración §9):
// accessToken en sessionStorage (corto, 15 min), refreshToken en localStorage
// ("recordar sesión"). El backend NO emite cookies httpOnly.
const ACCESS_KEY = 'op_access_token'
const REFRESH_KEY = 'op_refresh_token'
const USER_KEY = 'op_user'

/** Decodifica el payload del JWT. SOLO para UI — no verifica la firma. */
function decodeJwt(token: string): JwtPayload | null {
  try {
    const part = token.split('.')[1]
    if (!part) return null
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(decodeURIComponent(escape(json))) as JwtPayload
  }
  catch {
    return null
  }
}

/** Lee el claim `permissions` del accessToken (Opción A de la doc). */
function permissionsFromToken(token: string | null): string[] {
  if (!token) return []
  return decodeJwt(token)?.permissions ?? []
}

// Promesa compartida: evita disparar varios /v1/auth/refresh en paralelo.
let refreshing: Promise<boolean> | null = null

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: AuthUser | null
  permissions: string[]
  isHydrated: boolean
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    accessToken: null,
    refreshToken: null,
    user: null,
    permissions: [],
    isHydrated: false,
  }),

  getters: {
    isAuthenticated: (state): boolean => Boolean(state.accessToken && state.user),
    roleNames: (state): UserRole[] => state.user?.roles?.map(r => r.name) ?? [],
    primaryRole: (state): UserRole | null => state.user?.roles?.[0]?.name ?? null,
    fullName: (state): string => state.user?.fullName?.trim() || state.user?.email || '',
    initials: (state): string => {
      if (!state.user) return '?'
      const name = (state.user.fullName ?? '').trim()
      if (name) {
        const parts = name.split(/\s+/)
        return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase() || '?'
      }
      return state.user.email?.[0]?.toUpperCase() ?? '?'
    },
  },

  actions: {
    /** Restaura la sesión desde el almacenamiento del navegador. */
    hydrate(): void {
      if (this.isHydrated || !import.meta.client) return
      this.accessToken = sessionStorage.getItem(ACCESS_KEY)
      this.refreshToken = localStorage.getItem(REFRESH_KEY)
      const rawUser = sessionStorage.getItem(USER_KEY)
      this.user = rawUser ? (JSON.parse(rawUser) as AuthUser) : null
      this.permissions = permissionsFromToken(this.accessToken)
      this.isHydrated = true
    },

    setSession(res: LoginResponse): void {
      this.accessToken = res.accessToken
      this.refreshToken = res.refreshToken
      this.user = res.user
      this.permissions = permissionsFromToken(res.accessToken)
      this.persist()
    },

    setTokens(accessToken: string, refreshToken: string): void {
      this.accessToken = accessToken
      this.refreshToken = refreshToken
      this.permissions = permissionsFromToken(accessToken)
      this.persist()
    },

    persist(): void {
      if (!import.meta.client) return
      if (this.accessToken) sessionStorage.setItem(ACCESS_KEY, this.accessToken)
      if (this.refreshToken) localStorage.setItem(REFRESH_KEY, this.refreshToken)
      if (this.user) sessionStorage.setItem(USER_KEY, JSON.stringify(this.user))
    },

    /** Renueva el par de tokens. Comparte la promesa entre llamadas concurrentes. */
    async tryRefresh(): Promise<boolean> {
      if (!this.refreshToken) return false
      if (refreshing) return refreshing

      const config = useRuntimeConfig()
      refreshing = (async (): Promise<boolean> => {
        try {
          const data = await $fetch<RefreshResponse>('/v1/auth/refresh', {
            baseURL: config.public.apiBaseUrl,
            method: 'POST',
            body: { refreshToken: this.refreshToken },
          })
          this.setTokens(data.accessToken, data.refreshToken)
          return true
        }
        catch {
          this.clearSession()
          return false
        }
      })()

      try {
        return await refreshing
      }
      finally {
        refreshing = null
      }
    },

    clearSession(): void {
      this.accessToken = null
      this.refreshToken = null
      this.user = null
      this.permissions = []
      if (import.meta.client) {
        sessionStorage.removeItem(ACCESS_KEY)
        sessionStorage.removeItem(USER_KEY)
        localStorage.removeItem(REFRESH_KEY)
      }
    },
  },
})
