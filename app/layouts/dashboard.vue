<script setup lang="ts">
import logoUrl from '~/assets/centro-optico-vicente-logo.png'
import { OTHER_NAV } from '~/utils/nav'

const auth = useAuthStore()
const { logout } = useAuth()
const route = useRoute()

// Menú de dos niveles (módulo → vista), filtrado por permisos en useNav().
const { visibleNav, groupKeyOfPath, navLabel } = useNav()

// Acordeón: un solo grupo abierto a la vez. Se abre automáticamente el grupo que
// contiene la ruta activa y se recuerda al navegar dentro de él.
const openGroup = ref<string | null>(null)
watch(
  () => route.path,
  (path) => {
    const key = groupKeyOfPath(path)
    if (key) openGroup.value = key
  },
  { immediate: true },
)

function toggleGroup(key: string): void {
  openGroup.value = openGroup.value === key ? null : key
}

// El encabezado del grupo se resalta cuando alguna de sus vistas es la ruta activa.
const activeGroupKey = computed<string | null>(() => groupKeyOfPath(route.path))

// Clases compartidas por los enlaces del menú (ítem raíz e hijos).
const ACTIVE_LINK = 'bg-prohealth-50 text-prohealth-700 font-semibold'

// Mientras se hidrata/carga el perfil mostramos skeletons en el menú y el footer.
const ready = ref<boolean>(false)
onMounted(() => {
  ready.value = true
})

const isSidebarOpen = ref<boolean>(false)

// Colapso del sidebar en escritorio. Persistido para que la elección sobreviva
// a una recarga de página.
const isSidebarCollapsed = useLocalStorage<boolean>('dashboard-sidebar-collapsed', false)
</script>

<template>
  <div class="min-h-screen bg-prohealth-50/50">
    <!-- Sidebar -->
    <aside
      :class="[
        'fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-prohealth-100 flex flex-col transition-transform',
        (isSidebarOpen || !isSidebarCollapsed) ? 'translate-x-0' : '-translate-x-full',
      ]"
    >
      <div class="h-16 px-5 flex items-center gap-2 border-b border-prohealth-100">
        <img :src="logoUrl" alt="Centro Óptico Vicente" class="w-8 h-8 rounded-full object-contain">
        <span class="font-extrabold text-prohealth-900">
          OptiBienestar<span class="text-cyan-600"> 360</span>
        </span>
      </div>

      <nav class="flex-1 px-3 py-5 overflow-y-auto">
        <p class="px-3 text-xs font-semibold uppercase tracking-wider text-prohealth-400 mb-2">
          {{ $t('nav.mainMenu') }}
        </p>
        <!-- Skeleton mientras carga el perfil/permisos -->
        <ul v-if="!ready" class="space-y-1">
          <li v-for="i in 8" :key="i" class="flex items-center gap-3 px-3 py-2.5">
            <USkeleton class="w-5 h-5 rounded" />
            <USkeleton class="h-4 rounded flex-1" :class="i % 2 ? 'max-w-28' : 'max-w-20'" />
          </li>
        </ul>
        <ul v-else class="space-y-1">
          <li v-for="(entry, i) in visibleNav" :key="i">
            <AppNavItem
              :entry="entry"
              :open-group="openGroup"
              :active-group-key="activeGroupKey"
              @toggle="toggleGroup"
              @navigate="isSidebarOpen = false"
            />
          </li>
        </ul>

        <p class="mt-6 px-3 text-xs font-semibold uppercase tracking-wider text-prohealth-400 mb-2">
          {{ $t('nav.otherSection') }}
        </p>
        <ul class="space-y-1">
          <li v-for="item in OTHER_NAV" :key="item.to">
            <NuxtLink
              :to="item.to"
              :active-class="ACTIVE_LINK"
              class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-prohealth-900/80 hover:bg-prohealth-50 hover:text-prohealth-700 transition-colors"
              @click="isSidebarOpen = false"
            >
              <UIcon :name="item.icon" class="w-5 h-5" />
              {{ navLabel(item) }}
            </NuxtLink>
          </li>
        </ul>
      </nav>

      <div class="p-4 border-t border-prohealth-100">
        <div v-if="!ready || !auth.user" class="flex items-center gap-3 mb-3">
          <USkeleton class="w-9 h-9 rounded-full" />
          <div class="min-w-0 flex-1 space-y-1.5">
            <USkeleton class="h-3.5 w-28 rounded" />
            <USkeleton class="h-3 w-20 rounded" />
          </div>
        </div>
        <div v-else class="flex items-center gap-3 mb-3">
          <span class="w-9 h-9 rounded-full bg-prohealth-600 grid place-items-center text-white text-sm font-bold">
            {{ auth.initials }}
          </span>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold text-prohealth-900 truncate">{{ auth.fullName }}</p>
            <p class="text-xs text-prohealth-500 truncate">{{ auth.primaryRole }}</p>
          </div>
        </div>
        <UButton
          block
          color="neutral"
          variant="soft"
          icon="i-lucide-log-out"
          size="sm"
          @click="logout"
        >
          {{ $t('auth.logout') }}
        </UButton>
      </div>
    </aside>

    <!-- Overlay móvil -->
    <div
      v-if="isSidebarOpen"
      class="fixed inset-0 z-30 bg-prohealth-950/40 lg:hidden"
      @click="isSidebarOpen = false"
    />

    <!-- Contenido -->
    <div class="flex flex-col min-h-screen transition-all" :class="isSidebarCollapsed ? 'lg:pl-0' : 'lg:pl-64'">
      <header class="sticky top-0 z-20 h-16 bg-white/80 backdrop-blur border-b border-prohealth-100">
        <div class="h-full px-4 lg:px-8 flex items-center gap-4">
          <UButton
            class="lg:hidden"
            color="neutral"
            variant="ghost"
            icon="i-lucide-menu"
            square
            @click="isSidebarOpen = true"
          />
          <UButton
            class="hidden lg:inline-flex"
            color="neutral"
            variant="ghost"
            :icon="isSidebarCollapsed ? 'i-lucide-panel-left-open' : 'i-lucide-panel-left-close'"
            square
            @click="isSidebarCollapsed = !isSidebarCollapsed"
          />
          <div class="hidden md:flex items-center gap-2 flex-1 max-w-md bg-prohealth-50 px-3 py-2 rounded-lg">
            <UIcon name="i-lucide-search" class="w-4 h-4 text-prohealth-400" />
            <input
              type="text"
              :placeholder="$t('nav.searchPlaceholder')"
              class="bg-transparent text-sm w-full outline-none placeholder:text-prohealth-400"
            >
            <kbd class="text-[10px] text-prohealth-500 bg-white border border-prohealth-200 rounded px-1.5 py-0.5">⌘K</kbd>
          </div>
          <div class="ml-auto flex items-center gap-2">
            <LocaleSwitcher />
            <UButton color="neutral" variant="ghost" icon="i-lucide-bell" square />
            <UButton color="neutral" variant="ghost" icon="i-lucide-message-square" square />
          </div>
        </div>
      </header>

      <main class="flex-1 p-4 lg:p-8">
        <slot />
      </main>
    </div>
  </div>
</template>
