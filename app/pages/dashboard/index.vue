<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })

useSeoMeta({ title: 'Panel — OptiSalud Plus' })

const auth = useAuthStore()

interface Kpi {
  label: string
  value: string
  delta: string
  trend: 'up' | 'down'
  icon: string
  accent: string
}

const kpis: Kpi[] = [
  { label: 'Afiliados activos', value: '12,480', delta: '+5.2%', trend: 'up', icon: 'i-lucide-users', accent: 'bg-prohealth-50 text-prohealth-700' },
  { label: 'Recaudación mensual', value: '$48,250', delta: '+12.4%', trend: 'up', icon: 'i-lucide-banknote', accent: 'bg-lime-50 text-lime-700' },
  { label: 'Usos en aliados', value: '1,820', delta: '-1.8%', trend: 'down', icon: 'i-lucide-handshake', accent: 'bg-cyan-50 text-cyan-700' },
  { label: 'Pagos pendientes', value: '64', delta: '+3', trend: 'up', icon: 'i-lucide-clock', accent: 'bg-orange-50 text-orange-700' },
]

interface RecentActivity {
  id: number
  who: string
  what: string
  when: string
  status: 'success' | 'pending' | 'error'
}

const activity: RecentActivity[] = [
  { id: 1, who: 'Mia Torres', what: 'Pago confirmado — Plan Familiar', when: 'hace 5 min', status: 'success' },
  { id: 2, who: 'Centro Óptico Vicente', what: 'Uso registrado: lentes', when: 'hace 18 min', status: 'success' },
  { id: 3, who: 'Carlos Rivas', what: 'Pago en revisión — Plan Individual', when: 'hace 42 min', status: 'pending' },
  { id: 4, who: 'Laura Pérez', what: 'Solicitud de cambio de plan', when: 'hace 1 h', status: 'pending' },
  { id: 5, who: 'Soporte', what: 'Reintento de validación fallido', when: 'hace 2 h', status: 'error' },
]

const statusColor: Record<RecentActivity['status'], 'success' | 'warning' | 'error'> = {
  success: 'success',
  pending: 'warning',
  error: 'error',
}

const greeting = computed<string>(() => {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl md:text-3xl font-extrabold text-prohealth-900">
          {{ greeting }}, {{ auth.user?.fullName || auth.user?.email }} 👋
        </h1>
        <p class="text-sm text-prohealth-700/70 mt-1">
          Resumen del programa en tiempo real.
        </p>
      </div>
      <div class="flex items-center gap-2">
        <UButton color="neutral" variant="outline" icon="i-lucide-calendar" size="sm">
          Este mes
        </UButton>
        <UButton color="primary" variant="solid" icon="i-lucide-plus" size="sm">
          Nuevo afiliado
        </UButton>
      </div>
    </div>

    <!-- KPIs -->
    <section class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <div
        v-for="k in kpis"
        :key="k.label"
        class="bg-white rounded-2xl border border-prohealth-100 p-5 hover:shadow-md transition-shadow"
      >
        <div class="flex items-center justify-between">
          <span :class="['w-10 h-10 rounded-xl grid place-items-center', k.accent]">
            <UIcon :name="k.icon" class="w-5 h-5" />
          </span>
          <span
            :class="[
              'text-xs font-semibold inline-flex items-center gap-1',
              k.trend === 'up' ? 'text-lime-700' : 'text-red-600',
            ]"
          >
            <UIcon
              :name="k.trend === 'up' ? 'i-lucide-trending-up' : 'i-lucide-trending-down'"
              class="w-3.5 h-3.5"
            />
            {{ k.delta }}
          </span>
        </div>
        <p class="mt-4 text-2xl font-extrabold text-prohealth-900">{{ k.value }}</p>
        <p class="text-xs text-prohealth-500 mt-0.5">{{ k.label }}</p>
      </div>
    </section>

    <!-- Charts row -->
    <section class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <!-- Chart placeholder -->
      <div class="lg:col-span-2 bg-white rounded-2xl border border-prohealth-100 p-6">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h3 class="font-bold text-prohealth-900">Recaudación últimos 6 meses</h3>
            <p class="text-xs text-prohealth-500">Comparativo de planes y pagos confirmados</p>
          </div>
          <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-more-horizontal" square />
        </div>

        <!-- Mock chart -->
        <div class="h-56 flex items-end gap-3 pt-4 border-t border-prohealth-100">
          <div
            v-for="(h, i) in [40, 65, 55, 80, 72, 95]"
            :key="i"
            class="flex-1 flex flex-col items-center gap-1.5"
          >
            <div class="w-full flex flex-col items-center gap-1">
              <div
                class="w-full bg-prohealth-600 rounded-t-md"
                :style="{ height: `${h * 1.4}px` }"
              />
              <div
                class="w-full bg-lime-400 rounded-b-md opacity-80"
                :style="{ height: `${h * 0.5}px` }"
              />
            </div>
            <span class="text-[10px] text-prohealth-500 font-medium">
              {{ ['Dic', 'Ene', 'Feb', 'Mar', 'Abr', 'May'][i] }}
            </span>
          </div>
        </div>

        <div class="flex items-center gap-6 mt-4 text-xs">
          <span class="inline-flex items-center gap-2 text-prohealth-700">
            <span class="w-3 h-3 rounded-sm bg-prohealth-600" /> Planes
          </span>
          <span class="inline-flex items-center gap-2 text-prohealth-700">
            <span class="w-3 h-3 rounded-sm bg-lime-400" /> Servicios aliados
          </span>
        </div>
      </div>

      <!-- Distribution -->
      <div class="bg-white rounded-2xl border border-prohealth-100 p-6">
        <h3 class="font-bold text-prohealth-900">Distribución de planes</h3>
        <p class="text-xs text-prohealth-500 mb-5">Suscripciones activas por tipo</p>

        <div class="relative w-40 h-40 mx-auto">
          <div class="absolute inset-0 rounded-full bg-gradient-conic from-prohealth-600 via-cyan-500 to-lime-400" />
          <div class="absolute inset-3 rounded-full bg-white grid place-items-center text-center">
            <div>
              <p class="text-2xl font-extrabold text-prohealth-900">12.4K</p>
              <p class="text-[10px] text-prohealth-500 uppercase tracking-wide">total</p>
            </div>
          </div>
        </div>

        <ul class="mt-5 space-y-2 text-sm">
          <li class="flex items-center justify-between">
            <span class="inline-flex items-center gap-2 text-prohealth-700">
              <span class="w-2.5 h-2.5 rounded-full bg-prohealth-600" /> Individual
            </span>
            <span class="font-semibold text-prohealth-900">58%</span>
          </li>
          <li class="flex items-center justify-between">
            <span class="inline-flex items-center gap-2 text-prohealth-700">
              <span class="w-2.5 h-2.5 rounded-full bg-cyan-500" /> Familiar
            </span>
            <span class="font-semibold text-prohealth-900">31%</span>
          </li>
          <li class="flex items-center justify-between">
            <span class="inline-flex items-center gap-2 text-prohealth-700">
              <span class="w-2.5 h-2.5 rounded-full bg-lime-400" /> Empresarial
            </span>
            <span class="font-semibold text-prohealth-900">11%</span>
          </li>
        </ul>
      </div>
    </section>

    <!-- Activity + saving plans -->
    <section class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div class="lg:col-span-2 bg-white rounded-2xl border border-prohealth-100">
        <div class="p-6 pb-3 flex items-center justify-between">
          <div>
            <h3 class="font-bold text-prohealth-900">Actividad reciente</h3>
            <p class="text-xs text-prohealth-500">Últimas operaciones del sistema</p>
          </div>
          <UButton size="xs" color="neutral" variant="ghost">Ver todo</UButton>
        </div>
        <ul class="divide-y divide-prohealth-100">
          <li
            v-for="a in activity"
            :key="a.id"
            class="px-6 py-3 flex items-center gap-4"
          >
            <span class="w-9 h-9 rounded-full bg-prohealth-50 text-prohealth-600 grid place-items-center text-sm font-bold">
              {{ a.who[0] }}
            </span>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold text-prohealth-900 truncate">{{ a.who }}</p>
              <p class="text-xs text-prohealth-500 truncate">{{ a.what }}</p>
            </div>
            <span class="text-xs text-prohealth-500 hidden sm:inline">{{ a.when }}</span>
            <UBadge :color="statusColor[a.status]" variant="subtle" size="sm">
              {{ a.status }}
            </UBadge>
          </li>
        </ul>
      </div>

      <div class="bg-white rounded-2xl border border-prohealth-100 p-6">
        <h3 class="font-bold text-prohealth-900">Tu sesión</h3>
        <p class="text-xs text-prohealth-500 mb-5">Información de la cuenta activa</p>

        <dl class="space-y-3 text-sm">
          <div class="flex items-center justify-between">
            <dt class="text-prohealth-500">Email</dt>
            <dd class="font-semibold text-prohealth-900 truncate max-w-[60%]">{{ auth.user?.email }}</dd>
          </div>
          <div class="flex items-center justify-between">
            <dt class="text-prohealth-500">Roles</dt>
            <dd class="flex flex-wrap gap-1 justify-end">
              <UBadge
                v-for="r in auth.roleNames"
                :key="r"
                color="primary"
                variant="subtle"
              >
                {{ r }}
              </UBadge>
            </dd>
          </div>
        </dl>

        <UButton
          to="/dashboard/change-password"
          block
          color="primary"
          variant="soft"
          icon="i-lucide-key-round"
          class="mt-6"
        >
          Cambiar contraseña
        </UButton>
      </div>
    </section>
  </div>
</template>

<style scoped>
.bg-gradient-conic {
  background: conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops));
}
</style>
