import { roleHome } from '~/utils/roleHome'

/**
 * "Completar registro" exists only while the registration progress says `showCompletionPortal` (hub ADR 0037 §3):
 * otherwise the person goes to the home of their role. Declared per page with
 * `definePageMeta({ middleware: 'registration-portal' })`. UX layer only; the backend is the wall.
 */
export default defineNuxtRouteMiddleware(async () => {
  const auth = useAuthStore()
  if (import.meta.client) await auth.hydrate()
  if (!auth.isAuthenticated) return

  const progress = useRegistrationProgress()
  await progress.load()
  if (!progress.showCompletionPortal.value) return navigateTo(roleHome(auth.activeRole, false), { replace: true })
})
