const PUBLIC_ROUTES = new Set<string>(['/', '/login', '/recover-password', '/reset-password'])
// Prefijos públicos (rutas dinámicas): directorio de aliados (/aliados, /aliados/{uuid}).
// Ojo: NO confundir con /aliado (panel autenticado del aliado).
const PUBLIC_PREFIXES = ['/aliados']

export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore()
  if (import.meta.client) auth.hydrate()

  const isPublic = PUBLIC_ROUTES.has(to.path)
    || PUBLIC_PREFIXES.some(p => to.path === p || to.path.startsWith(`${p}/`))
  const isAuthed = auth.isAuthenticated

  if (!isPublic && !isAuthed) {
    return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
  }

  if (to.path === '/login' && isAuthed) {
    return navigateTo('/dashboard')
  }
})
