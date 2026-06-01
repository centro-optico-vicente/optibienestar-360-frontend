import type { UserRole } from '~/types/auth'

// Bloquea el acceso a una página completa cuando el usuario no tiene ninguno de los
// roles requeridos. Útil para áreas sin un permiso dedicado (p.ej. catálogos).
// Uso en la página:
//   definePageMeta({ layout: 'dashboard', middleware: 'role', roles: ['SYSTEM', 'ADMINISTRADOR'] })
//
// El backend es el muro real (403); esto es la capa de UX.
export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore()
  if (import.meta.client) auth.hydrate()

  const required = to.meta.roles as UserRole[] | undefined
  if (!required || required.length === 0) return

  const allowed = required.some(r => auth.roleNames.includes(r))
  if (!allowed) {
    return navigateTo('/403')
  }
})
