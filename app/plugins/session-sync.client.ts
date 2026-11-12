import type { Pinia } from 'pinia'
import { REFRESH_STORAGE_KEY } from '~/stores/auth'
import { authChannel, type AuthSyncMessage } from '~/utils/authChannel'

/**
 * Keeps every open tab on the same session. All tabs share ONE backend session (one refresh
 * token in localStorage, one `sid`): the same user and the same active role everywhere.
 *
 * - `storage` on the refresh token:
 *   - rotated by another tab → this tab adopts it, so its next refresh doesn't send a revoked token
 *     (before this, opening a second tab logged the first one out);
 *   - removed by another tab (logout, password change, expired session) → this tab ends its
 *     session too and goes to the login screen. No "session expired" toast: it may have been a
 *     deliberate logout.
 * - `BroadcastChannel('op-auth')`:
 *   - `session-changed` (sign-in / active-role switch elsewhere): same user → renew this tab's
 *     token (new role + permissions) and reload the profile; another user → reload the tab;
 *   - `user-updated` (profile, photo, locale edited elsewhere) → apply it here.
 */
export default defineNuxtPlugin((nuxtApp) => {
  const auth = useAuthStore(nuxtApp.$pinia as Pinia)
  const router = useRouter()

  const toLogin = () => nuxtApp.runWithContext(async () => {
    const route = router.currentRoute.value
    if (isPublicPath(route.path)) return
    await navigateTo({ path: currentLoginPath(), query: { redirect: route.fullPath } }, { replace: true })
  })

  window.addEventListener('storage', (event) => {
    // `key === null` is a `localStorage.clear()` — re-read the key either way.
    if (event.storageArea !== localStorage) return
    if (event.key !== null && event.key !== REFRESH_STORAGE_KEY) return
    const token = localStorage.getItem(REFRESH_STORAGE_KEY)

    if (token) {
      auth.adoptRefreshToken(token)
      return
    }
    if (!auth.accessToken && !auth.refreshToken && !auth.user) return
    auth.clearSession()
    void toLogin()
  })

  authChannel()?.addEventListener('message', (event: MessageEvent<AuthSyncMessage>) => {
    const message = event.data
    if (!auth.isAuthenticated) return

    if (message.type === 'user-updated') {
      if (message.user.uuid === auth.user?.uuid) auth.setUser(message.user, { broadcast: false })
      return
    }

    if (message.type === 'session-changed') {
      if (message.userUuid !== auth.user?.uuid) {
        // Another user signed in on this browser: never keep showing the previous one's data.
        window.location.reload()
        return
      }
      void nuxtApp.runWithContext(async () => {
        const previousRole = auth.activeRole
        // The shared refresh token already belongs to the new session (adopted via `storage`).
        if (!(await auth.tryRefresh())) return
        // A refresh may reissue a token without `role_name` (backend#411): trust the sender's role.
        if (message.activeRole && message.activeRole !== auth.activeRole) {
          auth.activeRole = message.activeRole
          auth.persist()
        }
        await auth.fetchUser()
        if (auth.activeRole !== previousRole) await navigateTo(roleHome(auth.activeRole), { replace: true })
      })
    }
  })
})
