import type { Pinia } from 'pinia'

/**
 * Sends the user to the login screen when the session ends on its own (the backend rejected the
 * refresh token — e.g. it restarted and lost its token store) instead of leaving the page mounted
 * with no user and no permissions: empty menu, skeleton user card and `v-can` buttons gone.
 *
 * Reacts to `auth.sessionExpiredAt` (set by `expireSession()`), so it covers both the proactive
 * background refresh — no request in flight, nothing else would notice — and a 401 on a request.
 * A deliberate logout uses `clearSession()` and navigates by itself, so it never lands here.
 */
export default defineNuxtPlugin((nuxtApp) => {
  const auth = useAuthStore(nuxtApp.$pinia as Pinia)
  const router = useRouter()

  watch(() => auth.sessionExpiredAt, (expiredAt) => {
    // Before hydration the `auth.global` middleware is still deciding the route and redirects itself.
    if (!expiredAt || !auth.isHydrated) return
    const route = router.currentRoute.value
    if (isPublicPath(route.path)) return

    void nuxtApp.runWithContext(async () => {
      const { t } = useNuxtApp().$i18n
      useToast().add({
        title: t('auth.sessionExpired.title'),
        description: t('auth.sessionExpired.description'),
        color: 'warning',
        icon: 'i-lucide-log-out',
      })
      // `redirect` brings the user back to the same screen after signing in again.
      await navigateTo({ path: currentLoginPath(), query: { redirect: route.fullPath } }, { replace: true })
    })
  })
})
