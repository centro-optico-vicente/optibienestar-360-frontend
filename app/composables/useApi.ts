import type { FetchError } from 'ofetch'
import type { ApiError, ProblemDetail } from '~/types/auth'

type ApiFetchOptions = NonNullable<Parameters<typeof $fetch>[1]>

interface UseApiOptions extends ApiFetchOptions {
  /** Skip the Authorization header (login, refresh, public contact). */
  skipAuth?: boolean
  /** Suppress global toasts; the component handles the error itself (login, forms). */
  silent?: boolean
  /** Internal: marks the post-refresh retry so we don't loop. */
  _retried?: boolean
}

/** Translator surface we rely on (incl. the default-message overload `t(key, fallback)`). */
interface Translate {
  (key: string): string
  (key: string, named: Record<string, unknown>): string
  (key: string, defaultMsg: string): string
}

/**
 * Builds the user-facing message from the backend's problem+json. Business errors
 * arrive ALREADY localized (the backend resolves locale via the JWT claim or the
 * `Accept-Language` we send), so `detail`/`title`/field errors are shown verbatim —
 * only client-owned fallbacks (network, lockout time) are translated here.
 */
function problemMessage(
  status: number,
  problem: ProblemDetail | null,
  t: Translate,
  formatTime: (date: string) => string,
): string | null {
  if (status === 423 && problem?.lockedUntil) {
    return t('errors.locked', { time: formatTime(problem.lockedUntil) })
  }
  if (problem?.errors?.length) {
    return problem.errors.map(e => e.message).join(' · ')
  }
  return problem?.detail || problem?.title || null
}

/**
 * Central HTTP client. Single point of communication with the backend.
 * - Injects `Authorization: Bearer <accessToken>` and `Accept-Language: <active locale>`.
 * - On 401 refreshes the token ONCE (shared promise in the store) and retries.
 * - Maps RFC 7807 (problem+json) errors to toasts; propagates 400/404 to the component.
 *
 * Usage:
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
  const { $i18n } = useNuxtApp()
  const { formatTime } = useFormatters()
  // Global i18n instance: useApi runs from event handlers too, where useI18n()
  // has no active setup instance — read the translator/locale off nuxtApp.
  const t = $i18n.t as unknown as Translate
  const activeLocale = String(unref($i18n.locale) ?? 'es')
  const { skipAuth = false, silent = false, _retried = false, headers, ...rest } = options

  const baseURL = config.public.apiBaseUrl
  if (!baseURL) {
    console.warn('[useApi] NUXT_PUBLIC_API_BASE_URL is not configured.')
  }

  // Pre-flight: if the access token is about to expire, refresh BEFORE sending.
  // Covers backgrounded tabs (the store timer is throttled there).
  // Single-flight: concurrent requests share the same refresh promise.
  if (!skipAuth && !_retried && auth.refreshToken && auth.isAccessExpiringSoon()) {
    await auth.tryRefresh()
  }

  const finalHeaders: Record<string, string> = {
    'Accept': 'application/json',
    // Backend resolves locale as JWT claim > Accept-Language > es-VE. Sending it on
    // every request localizes public endpoints (login, contact, directory) that
    // have no JWT yet, and keeps anonymous ProblemDetail responses in the UI language.
    'Accept-Language': activeLocale,
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

    // 401 → refresh the token once and retry the original request.
    if (status === 401 && !skipAuth && !_retried) {
      const refreshed = await auth.tryRefresh()
      if (refreshed) {
        return useApi<T>(url, { ...options, _retried: true })
      }
      auth.clearSession()
      if (import.meta.client) await navigateTo('/login')
    }

    // Global notification (except silenced ones and errors the component handles).
    // The backend sends a localized ProblemDetail; when it's missing (network/timeout)
    // we fall back to `errors.byStatus.<code>` and finally `errors.unexpected` (i18n bundles).
    if (!silent && status !== 400 && status !== 404 && status !== 401 && status !== 0) {
      toast.add({
        title: problemMessage(status, problem, t, formatTime)
          || t(`errors.byStatus.${status}`, t('errors.unexpected')),
        color: 'error',
        icon: 'i-lucide-circle-alert',
      })
    }

    const apiError: ApiError = {
      status,
      problem,
      message: problemMessage(status, problem, t, formatTime)
        ?? fetchError.message
        ?? t('errors.network'),
    }
    throw apiError
  }
}
