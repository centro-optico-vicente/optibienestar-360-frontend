// Public screens (hub URL convention): the canonical Spanish paths (`/`,
// `/aliados`, `/aliados/{uuid}`, `/catalogo`, `/catalogo/{uuid}`, `/afiliarse`, `/recuperar-clave`,
// `/restablecer-clave`) and their English pairs under `/en` (see
// utils/publicRoutes.ts). The old /recover-password and /reset-password 301 to the
// Spanish ones (nuxt.config.ts routeRules + docker/default.conf). Matching is exact
// or `base/`, so the authenticated ally portal (/allies) and the legacy /aliado
// path are never public; only /en/allies is.
export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuthStore()
  if (import.meta.client) await auth.hydrate()

  const isPublic = isPublicPath(to.path)
  const isAuthed = auth.isAuthenticated

  if (!isPublic && !isAuthed) {
    return navigateTo({ path: currentLoginPath(), query: { redirect: to.fullPath } })
  }

  // The login screen (`/` or `/en`) sends an open session straight to the panel.
  if (isAuthed && isPublic && localizePublicPath(to.path, 'es') === '/') {
    return navigateTo('/dashboard')
  }
})
