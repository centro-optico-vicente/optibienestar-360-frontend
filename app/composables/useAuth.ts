import type {
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

  return {
    login,
    logout,
    changePassword,
    isAuthenticated: computed<boolean>(() => store.isAuthenticated),
    user: computed(() => store.user),
    roleNames: computed(() => store.roleNames),
    primaryRole: computed(() => store.primaryRole),
  }
}
