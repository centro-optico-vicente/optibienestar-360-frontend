import { ROLES } from '~/types/auth'
import { isAllyRegistration, type RegistrationProgressDto } from '~/types/registration'

const NOTICE_DISMISSED_KEY = 'registration-notice:dismissed'

function readDismissed(): boolean {
  try {
    return sessionStorage.getItem(NOTICE_DISMISSED_KEY) === '1'
  }
  catch {
    return false
  }
}

function writeDismissed(value: boolean) {
  try {
    if (value) sessionStorage.setItem(NOTICE_DISMISSED_KEY, '1')
    else sessionStorage.removeItem(NOTICE_DISMISSED_KEY)
  }
  catch {
    // Storage blocked (private mode...): the notice just comes back on the next load.
  }
}

/** Roles that can have a registration to complete (pending ones, and approved ones whose optional data is still missing). */
const REGISTRATION_ROLES: readonly string[] = [ROLES.MEMBER_PENDING, ROLES.ALLY_PENDING, ROLES.MEMBER, ROLES.ALLY]

/**
 * Registration progress of the signed-in member or ally (hub ADR 0037 §3,
 * `GET /v1/me/registration-progress`), shared through `useState` by app.vue (login
 * notice), the menu and the `registration-portal` middleware.
 *
 * "Recordar luego" is kept in `sessionStorage`: the notice stays closed until the next session.
 */
export const useRegistrationProgress = () => {
  const progress = useState<RegistrationProgressDto | null>('registration-progress', () => null)
  const loaded = useState<boolean>('registration-progress-loaded', () => false)
  const dismissed = useState<boolean>('registration-notice-dismissed', () => (import.meta.client ? readDismissed() : false))

  /** Whether the active role can have a registration (avoids a request for staff and advisors). */
  const applies = (): boolean => {
    // primaryRole falls back to the user's role when the token carries none (refreshed tokens, backend#411).
    const role = useAuthStore().primaryRole
    return role != null && REGISTRATION_ROLES.includes(role)
  }

  async function load(force = false): Promise<RegistrationProgressDto | null> {
    if (!applies()) {
      progress.value = null
      loaded.value = true
      return null
    }
    if (loaded.value && !force) return progress.value
    try {
      progress.value = await useApi<RegistrationProgressDto>('/v1/me/registration-progress', { silent: true })
    }
    catch {
      progress.value = null
    }
    finally {
      loaded.value = true
    }
    return progress.value
  }

  /** Forgets the loaded progress; `endSession` also reopens the notice for the next session. */
  function reset(endSession = false) {
    progress.value = null
    loaded.value = false
    if (endSession) {
      dismissed.value = false
      writeDismissed(false)
    }
  }

  function dismissNotice() {
    dismissed.value = true
    writeDismissed(true)
  }

  const showCompletionPortal = computed(() => progress.value?.showCompletionPortal === true)
  const isAlly = computed(() => isAllyRegistration(progress.value?.kind))
  const percent = computed(() => Math.max(0, Math.min(100, Math.round(progress.value?.percent ?? 0))))
  /** Everything may be filled in, but "Enviar registro" was never pressed: the team has not received it (#313). */
  const notSubmitted = computed(() => progress.value?.submitted === false)
  /** The notice asks to complete something: the portal is open and the person has not finished or not sent it. */
  const hasPendingWork = computed(() => showCompletionPortal.value && (percent.value < 100 || notSubmitted.value))

  return { progress, loaded, dismissed, load, reset, dismissNotice, showCompletionPortal, isAlly, percent, notSubmitted, hasPendingWork }
}
