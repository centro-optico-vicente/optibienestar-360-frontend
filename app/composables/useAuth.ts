import type {
  AccessTokenResponse,
  AuthUser,
  ChangePasswordRequest,
  LoginRequest,
  LoginResponse,
} from '~/types/auth'

/**
 * Composable de autenticación. Encapsula login, logout y change-password
 * sobre el cliente `useApi`. Rutas alineadas con el backend (/v1/...).
 */
export const useAuth = () => {
  const store = useAuthStore()
  const router = useRouter()

  const login = async (payload: LoginRequest): Promise<LoginResponse> => {
    // silent: el componente login maneja 423 (bloqueo) y errores por campo.
    const data = await useApi<LoginResponse>('/v1/auth/login', {
      method: 'POST',
      body: payload,
      skipAuth: true,
      silent: true,
    })
    store.setSession(data)
    return data
  }

  const logout = async (): Promise<void> => {
    try {
      if (store.accessToken) {
        await useApi('/v1/auth/logout', {
          method: 'POST',
          body: store.refreshToken ? { refreshToken: store.refreshToken } : undefined,
          silent: true,
        }).catch(() => null)
      }
    }
    finally {
      store.clearSession()
      await router.push('/login')
    }
  }

  const changePassword = async (payload: ChangePasswordRequest): Promise<void> => {
    await useApi('/v1/me/change-password', {
      method: 'POST',
      body: payload,
      silent: true,
    })
    // El backend invalida las sesiones previas → forzar re-login.
    store.clearSession()
    await router.push('/login')
  }

  /**
   * Refresca el perfil del usuario actual desde el backend y lo guarda en el store.
   * Útil al cargar la app para reflejar cambios de datos/roles sin re-login.
   * Nota: los permisos provienen del claim del accessToken, no de /v1/me.
   */
  const fetchMe = async (): Promise<AuthUser | null> => {
    try {
      const me = await useApi<AuthUser>('/v1/me', { silent: true })
      store.setUser(me)
      return me
    }
    catch {
      return null
    }
  }

  /**
   * Persists the user's preferred locale (es | es-VE | en). The backend reissues
   * an access token with the new `locale` claim and blacklists the old one, so we
   * swap the token in immediately; the refresh token is left untouched (a
   * preference change is not a security event). Localizes the user's future
   * ProblemDetail responses and emails across devices.
   */
  const updateLocale = async (locale: string): Promise<void> => {
    const res = await useApi<AccessTokenResponse>('/v1/me/locale', {
      method: 'POST',
      body: { locale },
      silent: true,
    })
    store.applyAccessToken(res)
  }

  /** Solicita el correo de recuperación de contraseña. */
  const recoverPassword = async (email: string): Promise<void> => {
    await useApi('/v1/auth/recover-password', {
      method: 'POST',
      body: { email },
      skipAuth: true,
      silent: true,
    })
  }

  /** Establece una nueva contraseña usando el token recibido por correo. */
  const resetPassword = async (token: string, newPassword: string): Promise<void> => {
    await useApi('/v1/auth/reset-password', {
      method: 'POST',
      body: { token, newPassword },
      skipAuth: true,
      silent: true,
    })
  }

  return {
    login,
    logout,
    changePassword,
    fetchMe,
    updateLocale,
    recoverPassword,
    resetPassword,
    isAuthenticated: computed<boolean>(() => store.isAuthenticated),
    user: computed(() => store.user),
    roleNames: computed(() => store.roleNames),
    primaryRole: computed(() => store.primaryRole),
  }
}
