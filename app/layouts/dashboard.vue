<script setup lang="ts">
import type { Permission } from '~/types/permissions'
import type { UserRole } from '~/types/auth'

const auth = useAuthStore()
const { logout } = useAuth()
const { can, hasAnyRole } = usePermissions()

// El menú es un ESPEJO de los permisos: cada ítem declara la llave que exige.
// Algunas áreas sin permiso dedicado (catálogos) se gatean por rol.
interface NavItem {
  label: string
  to: string
  icon: string
  requires?: Permission | Permission[]
  roles?: UserRole[]
}

const allNav: NavItem[] = [
  { label: 'Panel', to: '/dashboard', icon: 'i-lucide-layout-dashboard' },
  { label: 'Afiliados', to: '/dashboard/members', icon: 'i-lucide-users', requires: 'MEMBER_VIEW_ALL' },
  { label: 'Aliados', to: '/dashboard/allies', icon: 'i-lucide-handshake', requires: 'ALLY_VIEW_ALL' },
  { label: 'Planes', to: '/dashboard/plans', icon: 'i-lucide-package', requires: 'PLAN_VIEW_ALL' },
  { label: 'Membresías', to: '/dashboard/memberships', icon: 'i-lucide-badge-check', requires: 'MEMBERSHIP_VIEW_ALL' },
  { label: 'Pagos', to: '/dashboard/payments', icon: 'i-lucide-credit-card', requires: 'PAYMENT_VIEW_ALL' },
  { label: 'Promotores', to: '/dashboard/promoters', icon: 'i-lucide-megaphone', requires: 'PROMOTER_VIEW_ALL' },
  { label: 'Comisiones', to: '/dashboard/commissions', icon: 'i-lucide-percent', requires: ['COMMISSION_VIEW_ALL', 'COMMISSION_VIEW_OWN'] },
  { label: 'Usuarios', to: '/dashboard/users', icon: 'i-lucide-shield-user', requires: 'USER_VIEW_ALL' },
  { label: 'Roles', to: '/dashboard/roles', icon: 'i-lucide-shield-check', requires: 'USER_CHANGE_ROLE' },
  { label: 'Catálogos', to: '/dashboard/catalogs', icon: 'i-lucide-database', roles: ['SYSTEM', 'ADMINISTRADOR'] },
  { label: 'Reportes', to: '/dashboard/reports', icon: 'i-lucide-bar-chart-3', requires: 'REPORT_VIEW_DASHBOARD' },
]

const otherNav: NavItem[] = [
  { label: 'Cambiar contraseña', to: '/dashboard/change-password', icon: 'i-lucide-key-round' },
]

const navItems = computed<NavItem[]>(() =>
  allNav.filter((i) => {
    if (i.roles?.length) return hasAnyRole(...i.roles)
    if (!i.requires) return true
    return Array.isArray(i.requires) ? i.requires.some(can) : can(i.requires)
  }),
)

// Mientras se hidrata/carga el perfil mostramos skeletons en el menú y el footer.
const ready = ref<boolean>(false)
onMounted(() => {
  ready.value = true
})

const isSidebarOpen = ref<boolean>(false)
</script>

<template>
  <div class="min-h-screen bg-prohealth-50/50">
    <!-- Sidebar -->
    <aside
      :class="[
        'fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-prohealth-100 flex flex-col transition-transform lg:translate-x-0',
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full',
      ]"
    >
      <div class="h-16 px-5 flex items-center gap-2 border-b border-prohealth-100">
        <span class="w-8 h-8 rounded-full bg-prohealth-600 grid place-items-center text-white font-bold">+</span>
        <span class="font-extrabold text-prohealth-900">
          OptiSalud<span class="text-cyan-600"> Plus</span>
        </span>
      </div>

      <nav class="flex-1 px-3 py-5 overflow-y-auto">
        <p class="px-3 text-xs font-semibold uppercase tracking-wider text-prohealth-400 mb-2">
          Menú principal
        </p>
        <!-- Skeleton mientras carga el perfil/permisos -->
        <ul v-if="!ready" class="space-y-1">
          <li v-for="i in 8" :key="i" class="flex items-center gap-3 px-3 py-2.5">
            <USkeleton class="w-5 h-5 rounded" />
            <USkeleton class="h-4 rounded flex-1" :class="i % 2 ? 'max-w-28' : 'max-w-20'" />
          </li>
        </ul>
        <ul v-else class="space-y-1">
          <li v-for="item in navItems" :key="item.to">
            <NuxtLink
              :to="item.to"
              active-class="bg-prohealth-50 text-prohealth-700 font-semibold"
              class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-prohealth-900/80 hover:bg-prohealth-50 hover:text-prohealth-700 transition-colors"
            >
              <UIcon :name="item.icon" class="w-5 h-5" />
              {{ item.label }}
            </NuxtLink>
          </li>
        </ul>

        <p class="mt-6 px-3 text-xs font-semibold uppercase tracking-wider text-prohealth-400 mb-2">
          Otros
        </p>
        <ul class="space-y-1">
          <li v-for="item in otherNav" :key="item.to">
            <NuxtLink
              :to="item.to"
              active-class="bg-prohealth-50 text-prohealth-700 font-semibold"
              class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-prohealth-900/80 hover:bg-prohealth-50 hover:text-prohealth-700 transition-colors"
            >
              <UIcon :name="item.icon" class="w-5 h-5" />
              {{ item.label }}
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
          Cerrar sesión
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
    <div class="lg:pl-64 flex flex-col min-h-screen">
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
          <div class="hidden md:flex items-center gap-2 flex-1 max-w-md bg-prohealth-50 px-3 py-2 rounded-lg">
            <UIcon name="i-lucide-search" class="w-4 h-4 text-prohealth-400" />
            <input
              type="text"
              placeholder="Buscar afiliados, planes…"
              class="bg-transparent text-sm w-full outline-none placeholder:text-prohealth-400"
            >
            <kbd class="text-[10px] text-prohealth-500 bg-white border border-prohealth-200 rounded px-1.5 py-0.5">⌘K</kbd>
          </div>
          <div class="ml-auto flex items-center gap-2">
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
