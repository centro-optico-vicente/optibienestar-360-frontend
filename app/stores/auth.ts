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

/** Lee el claim `exp` (en ms) del accessToken; null si no se puede decodificar. */
function accessExpMs(token: string | null): number | null {
  const exp = token ? decodeJwt(token)?.exp : null
  return exp ? exp * 1000 : null
}

// Promesa compartida: evita disparar varios /v1/auth/refresh en paralelo.
let refreshing: Promise<boolean> | null = null

// Timer del refresh proactivo (módulo, no reactivo): renueva antes de expirar.
let refreshTimer: ReturnType<typeof setTimeout> | null = null
// Margen para renovar antes del `exp`: cubre el reloj del cliente y la latencia.
const REFRESH_MARGIN_MS = 60_000

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
      this.scheduleRefresh()
    },

    setSession(res: LoginResponse): void {
      this.accessToken = res.accessToken
      this.refreshToken = res.refreshToken
      this.user = res.user
      this.permissions = permissionsFromToken(res.accessToken)
      this.persist()
      this.scheduleRefresh()
    },

    setTokens(accessToken: string, refreshToken: string): void {
      this.accessToken = accessToken
      this.refreshToken = refreshToken
      this.permissions = permissionsFromToken(accessToken)
      this.persist()
      this.scheduleRefresh()
    },

    /** Actualiza el perfil del usuario (p.ej. tras GET /v1/me) sin tocar los tokens. */
    setUser(user: AuthUser): void {
      this.user = user
      this.persist()
    },

    persist(): void {
      if (!import.meta.client) return
      if (this.accessToken) sessionStorage.setItem(ACCESS_KEY, this.accessToken)
      if (this.refreshToken) localStorage.setItem(REFRESH_KEY, this.refreshToken)
      if (this.user) sessionStorage.setItem(USER_KEY, JSON.stringify(this.user))
    },

    /**
     * Programa un refresh proactivo ~60s antes de que expire el accessToken.
     * Se re-arma solo: cada `setTokens` exitoso vuelve a llamar aquí.
     * Si el token ya está por vencer (o vencido), refresca en el próximo tick.
     */
    scheduleRefresh(): void {
      if (!import.meta.client) return
      if (refreshTimer) {
        clearTimeout(refreshTimer)
        refreshTimer = null
      }
      const expMs = accessExpMs(this.accessToken)
      if (!expMs || !this.refreshToken) return
      const delay = expMs - Date.now() - REFRESH_MARGIN_MS
      if (delay <= 0) {
        void this.tryRefresh()
        return
      }
      refreshTimer = setTimeout(() => { void this.tryRefresh() }, delay)
    },

    /** ¿El accessToken expira dentro del margen? Usado por el pre-flight de useApi. */
    isAccessExpiringSoon(): boolean {
      const expMs = accessExpMs(this.accessToken)
      if (!expMs) return false
      return expMs - Date.now() <= REFRESH_MARGIN_MS
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
      if (refreshTimer) {
        clearTimeout(refreshTimer)
        refreshTimer = null
      }
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
