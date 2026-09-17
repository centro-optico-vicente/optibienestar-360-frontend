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

  // Against the ACTIVE role, not the full roleNames list — a multi-role user
  // viewing under a non-active role shouldn't reach a page gated for a role
  // they hold but aren't currently using (same reasoning as usePermissions.hasRole).
  const allowed = required.some(r => r === auth.activeRole)
  if (!allowed) {
    return navigateTo('/403')
  }
})
