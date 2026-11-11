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
    // Not a useApi error (a bug in the code, a thrown TypeError…): a generic message, never "check your internet".
    if (!err || typeof err !== 'object' || typeof (err as ApiError).status !== 'number') {
      toast.add({ title: t('errors.unexpected'), color: 'error', icon: 'i-lucide-circle-alert' })
      return
    }
    const error = err as ApiError
    if (error.status !== 0 && error.status !== 400 && error.status !== 404) return
    toast.add({
      title: error.status === 0 ? t('errors.network') : (error.message || t('errors.unexpected')),
      color: 'error',
      icon: 'i-lucide-circle-alert',
    })
  }
}
