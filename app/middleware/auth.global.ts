const PUBLIC_ROUTES = new Set<string>(['/', '/login', '/recover-password'])

export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore()
  if (import.meta.client) auth.hydrate()

  const isPublic = PUBLIC_ROUTES.has(to.path)
  const isAuthed = auth.isAuthenticated

  if (!isPublic && !isAuthed) {
    return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
  }

  if (to.path === '/login' && isAuthed) {
    return navigateTo('/dashboard')
  }
})
