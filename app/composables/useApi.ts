import type { FetchError } from 'ofetch'
import type { ApiError, ProblemDetail } from '~/types/auth'

type ApiFetchOptions = NonNullable<Parameters<typeof $fetch>[1]>

interface UseApiOptions extends ApiFetchOptions {
  /** No adjuntar el header Authorization (login, refresh, contacto público). */
  skipAuth?: boolean
  /** No emitir toasts globales; el componente maneja el error (login, formularios). */
  silent?: boolean
  /** Interno: marca el reintento tras refresh para no entrar en bucle. */
  _retried?: boolean
}

/** Construye el mensaje de usuario a partir del problem+json. */
function problemMessage(status: number, problem: ProblemDetail | null): string | null {
  if (status === 423 && problem?.lockedUntil) {
    const until = new Date(problem.lockedUntil)
    const hh = until.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
    return `Cuenta bloqueada hasta las ${hh}.`
  }
  if (problem?.errors?.length) {
    return problem.errors.map(e => e.message).join(' · ')
  }
  return problem?.detail || problem?.title || null
}

const FALLBACK: Record<number, string> = {
  403: 'No tienes permiso para realizar esta acción.',
  409: 'Conflicto: el recurso ya existe o cambió.',
  422: 'No se pudo completar por una regla de negocio.',
  423: 'Cuenta bloqueada temporalmente.',
  500: 'Error interno. Intenta nuevamente.',
}

/**
 * Cliente HTTP central. Único punto de comunicación con el backend.
 * - Inyecta `Authorization: Bearer <accessToken>`.
 * - Ante 401 refresca el token UNA vez (promesa compartida en el store) y reintenta.
 * - Mapea errores RFC 7807 (problem+json) a toasts; propaga 400/404 al componente.
 *
 * Uso:
 *   const me = await useApi<AuthUser>('/v1/me')
 *   const page = await useApi<Page<UserDto>>('/v1/admin/users', { query: { page: 0 } })
 */
export const useApi = async <T = unknown>(
  url: string,
  options: UseApiOptions = {},
): Promise<T> => {
  const config = useRuntimeConfig()
  const auth = useAuthStore()
  const toast = useToast()
  const { skipAuth = false, silent = false, _retried = false, headers, ...rest } = options

  const baseURL = config.public.apiBaseUrl
  if (!baseURL) {
    console.warn('[useApi] NUXT_PUBLIC_API_BASE_URL no está configurado.')
  }

  // Pre-flight: si el accessToken está por expirar, renueva ANTES de enviar.
  // Cubre el caso de pestaña en segundo plano (el timer del store se ralentiza).
  // Single-flight: peticiones concurrentes comparten la misma promesa de refresh.
  if (!skipAuth && !_retried && auth.refreshToken && auth.isAccessExpiringSoon()) {
    await auth.tryRefresh()
  }

  const finalHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...(headers as Record<string, string> | undefined),
  }
  if (!skipAuth && auth.accessToken) {
    finalHeaders.Authorization = `Bearer ${auth.accessToken}`
  }

  try {
    return await $fetch<T>(url, { baseURL, headers: finalHeaders, ...rest })
  }
  catch (err) {
    const fetchError = err as FetchError
    const status = fetchError.response?.status ?? 0
    const problem = (fetchError.response?._data ?? null) as ProblemDetail | null

    // 401 → refresca el token una sola vez y reintenta la petición original.
    if (status === 401 && !skipAuth && !_retried) {
      const refreshed = await auth.tryRefresh()
      if (refreshed) {
        return useApi<T>(url, { ...options, _retried: true })
      }
      auth.clearSession()
      if (import.meta.client) await navigateTo('/login')
    }

    // Notificación global (salvo silenciados y errores que maneja el componente).
    if (!silent && status !== 400 && status !== 404 && status !== 401 && status !== 0) {
      toast.add({
        title: problemMessage(status, problem) || FALLBACK[status] || 'Error inesperado',
        color: 'error',
        icon: 'i-lucide-circle-alert',
      })
    }

    const apiError: ApiError = {
      status,
      problem,
      message: problemMessage(status, problem) ?? fetchError.message ?? 'Error de red',
    }
    throw apiError
  }
}
