// Public URLs are Spanish (hub URL convention). The old /recover-password and
// /reset-password 301 to these (nuxt.config.ts routeRules + docker/default.conf).
const PUBLIC_ROUTES = new Set<string>(['/', '/recuperar-contrasena', '/restablecer-contrasena', '/afiliarse'])
// Prefijos públicos (rutas dinámicas): directorio de aliados (/aliados, /aliados/{uuid}).
// Ojo: NO confundir con /aliado (panel autenticado del aliado).
const PUBLIC_PREFIXES = ['/aliados']

export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuthStore()
  if (import.meta.client) await auth.hydrate()

  const isPublic = PUBLIC_ROUTES.has(to.path)
    || PUBLIC_PREFIXES.some(p => to.path === p || to.path.startsWith(`${p}/`))
  const isAuthed = auth.isAuthenticated

  if (!isPublic && !isAuthed) {
    return navigateTo({ path: '/', query: { redirect: to.fullPath } })
  }

  if (to.path === '/' && isAuthed) {
    return navigateTo('/dashboard')
  }
})
