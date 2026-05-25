import type {
  LoginRequest,
  LoginResponse,
  ChangePasswordRequest,
} from '~/types/auth'

/**
 * Composable de autenticación.
 * Encapsula login, logout y change-password sobre el cliente useApi.
 */
export const useAuth = () => {
  const store = useAuthStore()
  const router = useRouter()

  const login = async (payload: LoginRequest): Promise<LoginResponse> => {
    const data = await useApi<LoginResponse>('/auth/login', {
      method: 'POST',
      body: payload,
      skipAuth: true,
    })
    store.setSession(data.accessToken, data.user, data.mustChangePassword)
    return data
  }

  const logout = async (): Promise<void> => {
    try {
      if (store.accessToken) {
        await useApi('/auth/logout', { method: 'POST' }).catch(() => null)
      }
    } finally {
      store.clearSession()
      await router.push('/login')
    }
  }

  const changePassword = async (payload: ChangePasswordRequest): Promise<void> => {
    await useApi('/auth/change-password', {
      method: 'POST',
      body: payload,
    })
    store.mustChangePassword = false
  }

  return {
    login,
    logout,
    changePassword,
    isAuthenticated: computed<boolean>(() => store.isAuthenticated),
    user: computed(() => store.user),
    role: computed(() => store.role),
    mustChangePassword: computed<boolean>(() => store.mustChangePassword),
  }
}
