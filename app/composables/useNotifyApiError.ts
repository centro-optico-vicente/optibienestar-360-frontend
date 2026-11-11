import type { ApiError } from '~/types/auth'

/**
 * Shows the reason of a failed request that `useApi` leaves to the component: it toasts every error except
 * 400 / 404 (and the network failure, status 0), which reach the caller untold. Steps that used to swallow
 * them with `catch {}` ("useApi toasted the reason") left the person stuck with no message (#311).
 *
 * Errors useApi already toasted are not repeated.
 */
export const useNotifyApiError = () => {
  const toast = useToast()
  const { t } = useI18n()

  return (err: unknown) => {
    const error = err as ApiError | undefined
    const status = error?.status ?? 0
    if (status !== 0 && status !== 400 && status !== 404) return
    toast.add({
      title: status === 0 ? t('errors.network') : (error?.message || t('errors.unexpected')),
      color: 'error',
      icon: 'i-lucide-circle-alert',
    })
  }
}
