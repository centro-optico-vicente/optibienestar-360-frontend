<script setup lang="ts">
import logoUrl from '~/assets/centro-optico-vicente-logo.png'

const auth = useAuthStore()

const navLinks = [
  { label: 'Inicio', to: '/' },
  { label: 'Sobre nosotros', to: '/#about' },
  { label: 'Departamentos', to: '/#departments' },
  { label: 'Aliados', to: '/aliados' },
  { label: 'Contacto', to: '/#contact' },
]

const scrolled = ref<boolean>(false)
if (import.meta.client) {
  useEventListener(window, 'scroll', () => {
    scrolled.value = window.scrollY > 24
  })
}

// Versión del backend para el footer (no bloqueante).
const { get: getSystemInfo } = useSystemInfo()
const version = ref<string>('')
onMounted(async () => {
  const info = await getSystemInfo().catch(() => null)
  if (info) version.value = `v${info.version}`
})
</script>

<template>
  <div class="min-h-screen flex flex-col bg-white">
    <header
      :class="[
        'sticky top-0 z-30 w-full transition-all duration-300',
        scrolled
          ? 'bg-white/90 backdrop-blur border-b border-prohealth-100 shadow-sm'
          : 'bg-transparent',
      ]"
    >
      <div class="max-w-7xl mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
        <NuxtLink to="/" class="flex items-center gap-2">
          <img :src="logoUrl" alt="Centro Óptico Vicente" class="w-8 h-8 rounded-full object-contain">
          <span class="font-extrabold text-lg text-prohealth-900">
            OptiBienestar<span class="text-cyan-600"> 360</span>
          </span>
        </NuxtLink>

        <nav class="hidden md:flex items-center gap-7">
          <NuxtLink
            v-for="link in navLinks"
            :key="link.to"
            :to="link.to"
            class="text-sm font-medium text-prohealth-900/80 hover:text-prohealth-600 transition-colors"
          >
            {{ link.label }}
          </NuxtLink>
        </nav>

        <div class="flex items-center gap-3">
          <UButton
            v-if="!auth.isAuthenticated"
            to="/login"
            color="primary"
            variant="solid"
            size="sm"
            icon="i-lucide-log-in"
          >
            Ingresar
          </UButton>
          <UButton
            v-else
            to="/dashboard"
            color="primary"
            variant="solid"
            size="sm"
            icon="i-lucide-layout-dashboard"
          >
            Mi panel
          </UButton>
        </div>
      </div>
    </header>

    <main class="flex-1">
      <slot />
    </main>

    <footer class="bg-prohealth-950 text-prohealth-100">
      <div class="max-w-7xl mx-auto px-6 lg:px-10 py-12 grid md:grid-cols-4 gap-8">
        <div class="md:col-span-2">
          <div class="flex items-center gap-2 mb-3">
            <span class="w-8 h-8 rounded-full bg-lime-500 grid place-items-center text-prohealth-950 font-bold">+</span>
            <span class="font-extrabold text-lg text-white">OptiBienestar 360</span>
          </div>
          <p class="text-sm text-prohealth-200/80 max-w-md">
            Programa integral de salud y bienestar. Atención preferencial en centros aliados,
            cobertura familiar y portal digital para gestionar tu plan.
          </p>
        </div>
        <div>
          <h4 class="font-semibold text-white mb-3">Producto</h4>
          <ul class="space-y-2 text-sm text-prohealth-200/80">
            <li>Planes</li>
            <li>Aliados</li>
            <li>Carnet digital</li>
          </ul>
        </div>
        <div>
          <h4 class="font-semibold text-white mb-3">Contacto</h4>
          <ul class="space-y-2 text-sm text-prohealth-200/80">
            <li>info@optibienestar360.com</li>
            <li>+58 412 000 0000</li>
          </ul>
        </div>
      </div>
      <div class="border-t border-white/10">
        <div class="max-w-7xl mx-auto px-6 lg:px-10 py-4 text-xs text-prohealth-200/60 flex flex-wrap items-center justify-between gap-2">
          <span>© {{ new Date().getFullYear() }} OptiBienestar 360. Todos los derechos reservados.</span>
          <span v-if="version" class="opacity-70">{{ version }}</span>
        </div>
      </div>
    </footer>
  </div>
</template>
