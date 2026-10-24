import { pendingTermKey, type PendingTermDto, type TermsAcceptItem, type TermType } from '~/types/terms'

/** How long "Recordar más tarde" hides the optional contracts. */
const SNOOZE_MS = 5 * 60 * 1000
const SNOOZE_STORAGE_KEY = 'pending-terms:snoozed-until'

function readSnooze(): number {
  try {
    return Number(sessionStorage.getItem(SNOOZE_STORAGE_KEY)) || 0
  }
  catch {
    return 0
  }
}

function writeSnooze(until: number) {
  try {
    if (until) sessionStorage.setItem(SNOOZE_STORAGE_KEY, String(until))
    else sessionStorage.removeItem(SNOOZE_STORAGE_KEY)
  }
  catch {
    // Storage blocked (private mode…) — the snooze just doesn't survive a reload.
  }
}

/**
 * Self-service pending-acceptance state (/v1/me/terms/*), singleton across the
 * app via useState so app.vue's watcher, TermsAcceptanceModal, the locked-module
 * notice and useApi's 403 handling share one source of truth.
 *
 * Mandatory items (AFILIADO, decided by the backend) are always shown. The
 * optional ones (ASESOR / ALIADO) can be postponed for SNOOZE_MS; they keep
 * their module locked meanwhile (`isBlocked`) and come back on their own.
 */
export const usePendingTerms = () => {
  const pending = useState<PendingTermDto[]>('pending-terms:list', () => [])
  const checked = useState<boolean>('pending-terms:checked', () => false)
  const snoozedUntil = useState<number>('pending-terms:snoozed-until', () => (import.meta.client ? readSnooze() : 0))
  // Ticks so `visible` re-evaluates when the snooze runs out.
  const now = useState<number>('pending-terms:now', () => Date.now())
  /** Contract kind to show first (set by "Aceptar ahora" from a locked module). */
  const focusType = useState<TermType | null>('pending-terms:focus', () => null)

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

  /** Items the modal must show now: mandatory first, then optional ones unless snoozed (focused kind first). */
  const visible = computed<PendingTermDto[]>(() => {
    const mandatory = pending.value.filter(term => term.mandatory)
    const optional = now.value >= snoozedUntil.value ? pending.value.filter(term => !term.mandatory) : []
    if (focusType.value) {
      const focus = focusType.value
      optional.sort((a, b) => Number(b.termType === focus) - Number(a.termType === focus))
    }
    return [...mandatory, ...optional]
  })

  /** Whether a contract of `type` is still pending (snoozed or not) — its module stays locked. */
  const isBlocked = (type: TermType | null) => type != null && pending.value.some(term => term.termType === type)

  const snooze = () => {
    snoozedUntil.value = Date.now() + SNOOZE_MS
    focusType.value = null
    writeSnooze(snoozedUntil.value)
  }

  /** Re-opens the modal right away (optionally on a contract kind), dropping the snooze. */
  const openNow = (type?: TermType | null) => {
    focusType.value = type ?? null
    snoozedUntil.value = 0
    now.value = Date.now()
    writeSnooze(0)
  }

  /**
   * Accepts one pending item — POST /v1/me/terms/{termsVersionUuid}/accept.
   * ALIADO items send their `allyAgreementUuid` (the same version may be
   * pending for several agreements, backend V189).
   */
  const acceptOne = async (term: PendingTermDto) => {
    await useApi<null>(`/v1/me/terms/${term.termsVersionUuid}/accept`, {
      method: 'POST',
      body: term.allyAgreementUuid ? { allyAgreementUuid: term.allyAgreementUuid } : {},
    })
    const key = pendingTermKey(term)
    pending.value = pending.value.filter(item => pendingTermKey(item) !== key)
    if (focusType.value && !isBlocked(focusType.value)) focusType.value = null
  }

  /** Accepts several items at once — POST /v1/me/terms/accept. */
  const acceptAll = async (items: TermsAcceptItem[]) => {
    await useApi<null>('/v1/me/terms/accept', { method: 'POST', body: { items } })
    pending.value = []
  }

  return { pending, checked, visible, snoozedUntil, now, checkPending, isBlocked, snooze, openNow, acceptOne, acceptAll }
}
