// Bloquea el acceso a una página completa cuando falta el permiso.
// Uso en la página:
//   definePageMeta({ layout: 'dashboard', middleware: 'can', permission: 'USER_VIEW_ALL' })
//   // o varios (basta cualquiera): permission: ['PAYMENT_VIEW_ALL', 'PAYMENT_VIEW_OWN']
//
// El menú no basta: alguien puede escribir la URL a mano. Aun así, el backend
// es el muro real (403). Esto es la capa de UX.
export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore()
  if (import.meta.client) auth.hydrate()

  const required = to.meta.permission as string | string[] | undefined
  if (!required) return

  const list = Array.isArray(required) ? required : [required]
  const allowed = list.some(p => auth.permissions.includes(p))
  if (!allowed) {
    return navigateTo('/403')
  }
})
