import type { Pinia } from 'pinia'
import { ROLES } from '~/types/auth'
import { COMPLETE_REGISTRATION_PATH, roleHome } from '~/utils/roleHome'

const POLL_MS = 60_000
const MIN_GAP_MS = 15_000

/** Pending role → the role an approval grants (hub ADR 0036 / 0037). */
const APPROVED_ROLE: Readonly<Record<string, string>> = {
  [ROLES.ALLY_PENDING]: ROLES.ALLY,
  [ROLES.MEMBER_PENDING]: ROLES.MEMBER,
}

/**
 * No new sign-in after an approval (hub ADR 0037 §5). While the session runs a pending role, re-check the profile
 * (`GET /v1/me`, which does not rotate the tokens — #308) when the window gets the focus back and every minute while
 * the tab is visible. Once the user holds the approved role, renew the tokens so the permissions and the menu follow;
 * if the renewed token still carries the pending role, switch to the new one explicitly. Leaves the wizard when it no
 * longer applies. The welcome itself is the `REGISTRATION_APPROVED` notification (notifications plugin).
 */
export default defineNuxtPlugin((nuxtApp) => {
  const auth = useAuthStore(nuxtApp.$pinia as Pinia)
  const router = useRouter()

  let lastCheck = 0
  let running = false

  async function check(force = false) {
    const pending = auth.activeRole
    const approved = pending ? APPROVED_ROLE[pending] : undefined
    if (!auth.isAuthenticated || !approved || running) return
    const now = Date.now()
    if (!force && now - lastCheck < MIN_GAP_MS) return
    lastCheck = now
    running = true
    try {
      await nuxtApp.runWithContext(async () => {
        const { fetchMe, refreshSession, switchActiveRole } = useAuth()
        const me = await fetchMe()
        const granted = me?.roles?.find(r => r.name === approved)
        if (!granted) return

        await refreshSession()
        if (auth.activeRole === pending) {
          try {
            await switchActiveRole(granted.uuid)
          }
          catch {
            // The ally portal keeps its "sign in again" banner as the last resort.
            return
          }
        }
        if (auth.activeRole === pending) return

        const registration = useRegistrationProgress()
        await registration.load(true)
        const path = router.currentRoute.value.path
        const onWizard = path === COMPLETE_REGISTRATION_PATH || path === '/complete-registration'
        if (onWizard && !registration.showCompletionPortal.value) {
          await navigateTo(roleHome(auth.activeRole, false), { replace: true })
        }
      })
    }
    finally {
      running = false
    }
  }

  const visibility = useDocumentVisibility()
  useEventListener(window, 'focus', () => void check())
  watch(visibility, (state) => {
    if (state === 'visible') void check()
  })
  useIntervalFn(() => {
    if (visibility.value === 'visible') void check()
  }, POLL_MS)

  // Landing on the app with a pending role (sign-in, reload, role switch): check right away — the approval may have
  // happened while the person was away.
  watch(() => [auth.isAuthenticated, auth.activeRole] as const, ([isAuthenticated, role]) => {
    if (isAuthenticated && role && APPROVED_ROLE[role]) void check(true)
  })
  nuxtApp.hook('app:mounted', () => void check(true))
})
