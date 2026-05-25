import { defineStore } from 'pinia'
import type { AuthUser } from '~/types/auth'

interface AuthState {
  accessToken: string | null
  user: AuthUser | null
  mustChangePassword: boolean
  isHydrated: boolean
}

const ACCESS_TOKEN_COOKIE = 'op_access_token'
const USER_COOKIE = 'op_user'

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    accessToken: null,
    user: null,
    mustChangePassword: false,
    isHydrated: false,
  }),

  getters: {
    isAuthenticated: (state): boolean => Boolean(state.accessToken && state.user),
    role: (state): string | null => state.user?.role ?? null,
    fullName: (state): string => {
      if (!state.user) return ''
      const fn = state.user.firstName ?? ''
      const ln = state.user.lastName ?? ''
      return [fn, ln].filter(Boolean).join(' ').trim() || state.user.email
    },
    initials: (state): string => {
      if (!state.user) return '?'
      const fn = (state.user.firstName ?? '').trim()
      const ln = (state.user.lastName ?? '').trim()
      if (fn || ln) return `${fn[0] ?? ''}${ln[0] ?? ''}`.toUpperCase() || '?'
      return state.user.email[0]?.toUpperCase() ?? '?'
    },
  },

  actions: {
    hydrate(): void {
      if (this.isHydrated) return
      const tokenCookie = useCookie<string | null>(ACCESS_TOKEN_COOKIE, { default: () => null })
      const userCookie = useCookie<AuthUser | null>(USER_COOKIE, { default: () => null })
      this.accessToken = tokenCookie.value
      this.user = userCookie.value
      this.isHydrated = true
    },

    setSession(token: string, user: AuthUser, mustChangePassword = false): void {
      this.accessToken = token
      this.user = user
      this.mustChangePassword = mustChangePassword || user.mustChangePassword === true

      const tokenCookie = useCookie<string | null>(ACCESS_TOKEN_COOKIE, {
        maxAge: 60 * 60 * 8,
        sameSite: 'lax',
        secure: !import.meta.dev,
      })
      const userCookie = useCookie<AuthUser | null>(USER_COOKIE, {
        maxAge: 60 * 60 * 8,
        sameSite: 'lax',
        secure: !import.meta.dev,
      })
      tokenCookie.value = token
      userCookie.value = user
    },

    clearSession(): void {
      this.accessToken = null
      this.user = null
      this.mustChangePassword = false
      const tokenCookie = useCookie<string | null>(ACCESS_TOKEN_COOKIE)
      const userCookie = useCookie<AuthUser | null>(USER_COOKIE)
      tokenCookie.value = null
      userCookie.value = null
    },
  },
})
