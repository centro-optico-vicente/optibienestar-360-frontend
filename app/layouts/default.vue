<script setup lang="ts">
const auth = useAuthStore()
// Links between public screens stay in the active language (hub URL convention).
const publicPath = usePublicPath()

const navLinks = [
  { labelKey: 'layout.public.nav.catalog', to: '/catalogo' },
  { labelKey: 'layout.public.nav.allies', to: '/aliados' },
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
        <NuxtLink :to="publicPath('/')" class="flex items-center">
          <BrandLogo variant="horizontal" :width="160" />
        </NuxtLink>

        <nav class="hidden md:flex items-center gap-7">
          <NuxtLink
            v-for="link in navLinks"
            :key="link.to"
            :to="publicPath(link.to)"
            class="text-sm font-medium text-prohealth-900/80 hover:text-prohealth-600 transition-colors"
          >
            {{ $t(link.labelKey) }}
          </NuxtLink>
        </nav>

        <div class="flex items-center gap-3">
          <LocaleSwitcher />
          <UButton
            v-if="!auth.isAuthenticated"
            :to="publicPath('/')"
            color="primary"
            variant="solid"
            size="sm"
            icon="i-lucide-log-in"
          >
            {{ $t('layout.public.signIn') }}
          </UButton>
          <UButton
            v-else
            to="/dashboard"
            color="primary"
            variant="solid"
            size="sm"
            icon="i-lucide-layout-dashboard"
          >
            {{ $t('layout.public.myPanel') }}
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
          <div class="mb-3 -ml-2">
            <BrandLogo variant="negativo" :width="180" />
          </div>
          <p class="text-sm text-prohealth-200/80 max-w-md">
            {{ $t('layout.footer.description') }}
          </p>
        </div>
        <div>
          <h4 class="font-semibold text-white mb-3">{{ $t('layout.footer.productHeading') }}</h4>
          <ul class="space-y-2 text-sm text-prohealth-200/80">
            <li>{{ $t('layout.footer.product.plans') }}</li>
            <li>{{ $t('layout.footer.product.allies') }}</li>
            <li>{{ $t('layout.footer.product.digitalCard') }}</li>
          </ul>
        </div>
        <div>
          <h4 class="font-semibold text-white mb-3">{{ $t('layout.footer.contactHeading') }}</h4>
          <ul class="space-y-2 text-sm text-prohealth-200/80">
            <li>info@optibienestar360.com</li>
            <li>+58 412 000 0000</li>
          </ul>
        </div>
      </div>
      <div class="border-t border-white/10">
        <div class="max-w-7xl mx-auto px-6 lg:px-10 py-4 text-xs text-prohealth-200/60 flex flex-wrap items-center justify-between gap-2">
          <span>{{ $t('layout.copyrightFull', { year: new Date().getFullYear() }) }}</span>
          <span v-if="version" class="opacity-70">{{ version }}</span>
        </div>
      </div>
    </footer>
  </div>
</template>
