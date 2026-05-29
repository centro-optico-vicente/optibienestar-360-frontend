import type { Pinia } from 'pinia'

/**
 * Directiva `v-can` para OCULTAR elementos cuando el usuario no tiene el permiso.
 * Para "deshabilitar + tooltip" usa `usePermissions().can()` con `:disabled`.
 *
 *   <UButton v-can="'PAYMENT_APPROVE'" label="Aprobar pago" />
 *   <UButton v-can="['USER_VIEW_ALL', 'USER_VIEW_OWN']" ... />  (cualquiera de ellos)
 *
 * Recuerda: esto es UX. El backend revalida siempre.
 */
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.directive('can', {
    mounted(el: HTMLElement, binding) {
      const auth = useAuthStore(nuxtApp.$pinia as Pinia)
      const required = Array.isArray(binding.value) ? binding.value : [binding.value]
      const allowed = required.some((p: string) => auth.permissions.includes(p))
      if (!allowed) el.remove()
    },
  })
})
