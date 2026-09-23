import type { PendingTermDto } from '~/types/terms'

/**
 * Self-service pending-acceptance state (/v1/me/terms/*), singleton across the
 * app via useState so app.vue's watcher and TermsAcceptanceModal share one
 * source of truth without prop drilling.
 */
export const usePendingTerms = () => {
  const pending = useState<PendingTermDto[]>('pending-terms:list', () => [])
  const checked = useState<boolean>('pending-terms:checked', () => false)

  const checkPending = async () => {
    try {
      pending.value = await useApi<PendingTermDto[]>('/v1/me/terms/pending', { silent: true })
    }
    catch {
      // Not authenticated yet, or transient error — leave pending empty; the
      // caller (app.vue) re-triggers this on the next auth state change.
      pending.value = []
    }
    finally {
      checked.value = true
    }
  }

  const acceptAll = async (termsVersionUuids: string[]) => {
    await useApi<null>('/v1/me/terms/accept', { method: 'POST', body: { termsVersionUuids } })
    pending.value = []
  }

  return { pending, checked, checkPending, acceptAll }
}
