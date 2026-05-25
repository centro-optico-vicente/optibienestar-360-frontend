import type { FetchOptions } from 'ofetch'
import type { ApiErrorBody } from '~/types/auth'

interface UseApiOptions extends FetchOptions {
  skipAuth?: boolean
}

/**
 * Wrapper de $fetch con:
 * - baseURL desde runtimeConfig.public.apiBaseUrl
 * - interceptor de Authorization Bearer
 * - normalización de errores
 *
 * Uso:
 *   const data = await useApi<User>('/users/me')
 *   const created = await useApi<Plan>('/plans', { method: 'POST', body: dto })
 */
export const useApi = <T = unknown>(
  url: string,
  options: UseApiOptions = {},
): Promise<T> => {
  const config = useRuntimeConfig()
  const auth = useAuthStore()
  const { skipAuth = false, headers, ...rest } = options

  const baseURL = config.public.apiBaseUrl
  if (!baseURL) {
    console.warn('[useApi] NUXT_PUBLIC_API_BASE_URL no está configurado.')
  }

  const finalHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...(headers as Record<string, string> | undefined),
  }

  if (!skipAuth && auth.accessToken) {
    finalHeaders.Authorization = `Bearer ${auth.accessToken}`
  }

  return $fetch<T>(url, {
    baseURL,
    headers: finalHeaders,
    ...rest,
    onResponseError({ response }) {
      const body = response._data as ApiErrorBody | undefined
      const message = body?.message || body?.error || response.statusText || 'Error de servidor'

      if (response.status === 401 && !skipAuth) {
        auth.clearSession()
      }

      throw new Error(message)
    },
  })
}
