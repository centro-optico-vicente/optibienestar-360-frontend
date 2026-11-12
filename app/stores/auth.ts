import { defineStore } from 'pinia'
import type { AccessTokenResponse, AuthUser, JwtPayload, LoginResponse, RefreshResponse, UserRole } from '~/types/auth'
import { ROLES } from '~/types/auth'
import { postAuthSync } from '~/utils/authChannel'

// Política de almacenamiento (Guía de integración §9):
// accessToken en sessionStorage (corto, 15 min), refreshToken en localStorage
// ("recordar sesión"). El backend NO emite cookies httpOnly.
const ACCESS_KEY = 'op_access_token'
/** localStorage key of the refresh token — shared by every tab (the `session-sync` plugin watches it). */
export const REFRESH_STORAGE_KEY = 'op_refresh_token'
const REFRESH_KEY = REFRESH_STORAGE_KEY
const USER_KEY = 'op_user'
// Active role of the session, kept next to the access token: `/v1/auth/refresh` may reissue a token without the
// `role_name` claim (backend#411), and a reload must not lose the role the session started with.
const ROLE_KEY = 'op_active_role'

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

// TEMPORARY alias (remove once every pre-V185 token has expired — refresh
// tokens live 30 days): backend V185 renamed the advisor role PROMOTOR → ASESOR,
// but access/refresh tokens and the cached user minted before the deploy still
// carry `PROMOTOR`. Treat it as ROLES.ADVISOR so advisors keep their portal.
const LEGACY_ROLE_ALIASES: Record<string, UserRole> = {
  PROMOTOR: ROLES.ADVISOR,
}

function normalizeRole(name: string | null | undefined): UserRole | null {
  if (!name) return null
  return LEGACY_ROLE_ALIASES[name] ?? (name as UserRole)
}

/** Reads the `role_name` claim (session's active role) from the accessToken. */
function activeRoleFromToken(token: string | null): UserRole | null {
  if (!token) return null
  return normalizeRole(decodeJwt(token)?.role_name)
}

/** The user's first assigned role: last resort when neither the token nor the session knows the active one. */
function firstRoleOf(user: AuthUser | null): UserRole | null {
  return normalizeRole(user?.roles?.[0]?.name)
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
// Retry delay when the refresh fails for a reason other than a rejected token (network, 5xx, backend restarting).
const REFRESH_RETRY_MS = 30_000

/**
 * The refresh token every tab shares. The backend rotates it on each refresh, so a tab's
 * in-memory copy goes stale as soon as another tab refreshes — always refresh with this one.
 */
function sharedRefreshToken(): string | null {
  if (!import.meta.client) return null
  try {
    return localStorage.getItem(REFRESH_KEY)
  }
  catch {
    return null
  }
}

/**
 * Runs the refresh holding a lock shared by every tab of the origin, so two tabs never rotate
 * the same refresh token at once (one of them would get 401). Browsers without the Web Locks
 * API run it unlocked — `tryRefresh` then recovers from the race by retrying with the token
 * the other tab left in localStorage.
 */
async function withRefreshLock<T>(fn: () => Promise<T>): Promise<T> {
  const locks = import.meta.client ? navigator.locks : undefined
  // `request` resolves with the callback's (awaited) result; typed Promise<Promise<T>>, so await it.
  if (locks) return await locks.request('op-auth-refresh', fn)
  return fn()
}

/** Refresh answers that mean the refresh token itself was rejected — the session is over. */
function isRejectedRefresh(err: unknown): boolean {
  const status = (err as { response?: { status?: number } })?.response?.status ?? 0
  return status === 400 || status === 401 || status === 403
}

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: AuthUser | null
  permissions: string[]
  /** Active session role (JWT `role_name` claim) — null on tokens minted before this existed. */
  activeRole: UserRole | null
  isHydrated: boolean
  /**
   * When the session ended on its own (refresh token rejected), not by a logout. The
   * `session-expiry` plugin watches it to send the user to the login screen — without it a
   * failed background refresh leaves the page mounted with no user and no permissions.
   */
  sessionExpiredAt: number | null
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    accessToken: null,
    refreshToken: null,
    user: null,
    permissions: [],
    activeRole: null,
    isHydrated: false,
    sessionExpiredAt: null,
  }),

  getters: {
    isAuthenticated: (state): boolean => Boolean(state.accessToken && state.user),
    roleNames: (state): UserRole[] => state.user?.roles?.map(r => normalizeRole(r.name) as UserRole) ?? [],
    /** The session's active role when known, falling back to the user's first assigned role (older tokens). */
    primaryRole: (state): UserRole | null => state.activeRole ?? normalizeRole(state.user?.roles?.[0]?.name),
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
    /**
     * Restaura la sesión desde el almacenamiento del navegador.
     *
     * El accessToken vive en sessionStorage (tab-scoped): una pestaña nueva o
     * recargada no lo hereda aunque haya sesión activa en otra pestaña. El
     * refreshToken sí vive en localStorage (compartido). Por eso, si falta el
     * accessToken pero hay refreshToken, se intenta un refresh antes de dar
     * por no autenticado — así una segunda pestaña recupera la sesión en vez
     * de mandar al login.
     */
    async hydrate(): Promise<void> {
      if (this.isHydrated || !import.meta.client) return
      this.accessToken = sessionStorage.getItem(ACCESS_KEY)
      this.refreshToken = localStorage.getItem(REFRESH_KEY)
      const rawUser = sessionStorage.getItem(USER_KEY)
      this.user = rawUser ? (JSON.parse(rawUser) as AuthUser) : null
      this.permissions = permissionsFromToken(this.accessToken)
      this.activeRole = activeRoleFromToken(this.accessToken)
        ?? normalizeRole(sessionStorage.getItem(ROLE_KEY))
        ?? firstRoleOf(this.user)

      if (!this.accessToken && this.refreshToken) {
        const refreshed = await this.tryRefresh()
        // RefreshResponse no incluye el user (sessionStorage tampoco lo tenía
        // en esta pestaña) — hay que reconstruirlo desde /v1/me.
        if (refreshed && !this.user) {
          await this.fetchUser()
        }
        // A new tab only has the refresh token: if the reissued token carries no role, use the user's.
        if (refreshed && !this.activeRole) {
          this.activeRole = firstRoleOf(this.user)
          this.persist()
        }
      }

      this.isHydrated = true
      this.scheduleRefresh()
    },

    setSession(res: LoginResponse): void {
      this.accessToken = res.accessToken
      this.refreshToken = res.refreshToken
      this.user = res.user
      this.permissions = permissionsFromToken(res.accessToken)
      this.activeRole = activeRoleFromToken(res.accessToken)
      this.sessionExpiredAt = null
      this.persist()
      this.scheduleRefresh()
      // Sign-in or active-role switch: the other tabs pick up the same session (role, permissions, menu).
      if (res.user) postAuthSync({ type: 'session-changed', userUuid: res.user.uuid, activeRole: this.activeRole })
    },

    setTokens(accessToken: string, refreshToken: string): void {
      this.accessToken = accessToken
      this.refreshToken = refreshToken
      this.permissions = permissionsFromToken(accessToken)
      // A silent refresh never changes the active role: keep it when the reissued token omits it (backend#411).
      this.activeRole = activeRoleFromToken(accessToken) ?? this.activeRole ?? firstRoleOf(this.user)
      this.persist()
      this.scheduleRefresh()
    },

    /**
     * Actualiza el perfil del usuario (p.ej. tras GET /v1/me) sin tocar los tokens.
     * `broadcast: false` when the update itself came from another tab (no echo).
     */
    setUser(user: AuthUser, { broadcast = true }: { broadcast?: boolean } = {}): void {
      this.user = user
      this.persist()
      if (broadcast) postAuthSync({ type: 'user-updated', user })
    },

    /**
     * Another tab rotated (or set) the shared refresh token: keep this tab's copy current so its
     * own next refresh — or the logout body — doesn't send a revoked token.
     */
    adoptRefreshToken(token: string): void {
      if (token === this.refreshToken) return
      this.refreshToken = token
      // A tab that had no refresh token left (retry timer cleared) can renew again.
      if (!refreshTimer) this.scheduleRefresh()
    },

    /**
     * Swaps in a reissued access token (POST /v1/me/locale) keeping the current
     * refresh token. The backend blacklists the previous access token, so this
     * must run synchronously after the response and refresh the derived state.
     */
    applyAccessToken(res: AccessTokenResponse): void {
      this.accessToken = res.accessToken
      this.user = res.user
      this.permissions = permissionsFromToken(res.accessToken)
      this.activeRole = activeRoleFromToken(res.accessToken) ?? this.activeRole ?? firstRoleOf(res.user)
      this.persist()
      this.scheduleRefresh()
      // The locale lives on the user: the other tabs switch language too.
      postAuthSync({ type: 'user-updated', user: res.user })
    },

    persist(): void {
      if (!import.meta.client) return
      if (this.accessToken) sessionStorage.setItem(ACCESS_KEY, this.accessToken)
      if (this.refreshToken) localStorage.setItem(REFRESH_KEY, this.refreshToken)
      if (this.user) sessionStorage.setItem(USER_KEY, JSON.stringify(this.user))
      if (this.activeRole) sessionStorage.setItem(ROLE_KEY, this.activeRole)
      else sessionStorage.removeItem(ROLE_KEY)
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

    /** Re-tries the refresh later — the token is still good, the backend just didn't answer. */
    scheduleRefreshRetry(): void {
      if (!import.meta.client || !this.refreshToken) return
      if (refreshTimer) clearTimeout(refreshTimer)
      refreshTimer = setTimeout(() => { void this.tryRefresh() }, REFRESH_RETRY_MS)
    },

    /**
     * Renueva el par de tokens. Comparte la promesa entre llamadas concurrentes de esta pestaña,
     * y un lock entre pestañas (`withRefreshLock`) para que las pestañas se turnen.
     *
     * Always refreshes with the SHARED token (localStorage), read inside the lock: another tab may
     * have rotated it a moment ago, and the in-memory copy would be revoked already.
     *
     * Only a rejected refresh token (400/401/403) ends the session — and marks it as expired so
     * the user is sent to the login screen. A network error or a 5xx (backend restarting, gateway
     * 502) keeps the session and retries later: dropping it there would log everyone out on a blip.
     */
    async tryRefresh(): Promise<boolean> {
      if (!this.refreshToken && !sharedRefreshToken()) return false
      if (refreshing) return refreshing

      refreshing = withRefreshLock(() => this.refreshWith(sharedRefreshToken() ?? this.refreshToken, true))

      try {
        return await refreshing
      }
      finally {
        refreshing = null
      }
    },

    /** One `/v1/auth/refresh` call with `token`; on a lost race, one retry with the newer shared token. */
    async refreshWith(token: string | null, canRetry: boolean): Promise<boolean> {
      if (!token) return false
      this.refreshToken = token
      const config = useRuntimeConfig()
      try {
        const data = await $fetch<RefreshResponse>('/v1/auth/refresh', {
          baseURL: config.public.apiBaseUrl,
          method: 'POST',
          body: { refreshToken: token },
        })
        this.setTokens(data.accessToken, data.refreshToken)
        return true
      }
      catch (err) {
        if (!isRejectedRefresh(err)) {
          this.scheduleRefreshRetry()
          return false
        }
        // Rejected — but if another tab rotated the token while this call was in flight (no Web
        // Locks), ours was simply superseded: retry once with theirs instead of logging out.
        const latest = sharedRefreshToken()
        if (canRetry && latest && latest !== token) return this.refreshWith(latest, false)
        this.expireSession()
        return false
      }
    },

    /**
     * Recupera el perfil desde GET /v1/me (sin pasar por `useApi` para evitar
     * el ciclo store → composable → store). Solo se usa en `hydrate()`,
     * cuando el refresh trajo un accessToken nuevo pero no un `user`.
     */
    async fetchUser(): Promise<void> {
      if (!this.accessToken) return
      const config = useRuntimeConfig()
      try {
        const user = await $fetch<AuthUser>('/v1/me', {
          baseURL: config.public.apiBaseUrl,
          headers: { Authorization: `Bearer ${this.accessToken}` },
        })
        this.setUser(user)
      }
      catch {
        this.clearSession()
      }
    },

    /**
     * Ends a session the backend no longer accepts and flags it as expired (see `sessionExpiredAt`).
     * No-op when there is no session left, so several failing requests flag it only once.
     */
    expireSession(): void {
      if (!this.accessToken && !this.refreshToken && !this.user) return
      this.clearSession()
      this.sessionExpiredAt = Date.now()
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
      this.activeRole = null
      clearCatalogOptionsCache()
      if (import.meta.client) {
        sessionStorage.removeItem(ACCESS_KEY)
        sessionStorage.removeItem(USER_KEY)
        sessionStorage.removeItem(ROLE_KEY)
        localStorage.removeItem(REFRESH_KEY)
      }
    },
  },
})
