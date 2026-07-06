<script setup lang="ts">
import imgHero from '~/assets/img/Gemini_Generated_Image_3w6wwq3w6wwq3w6w.png'
import imgEyeTest from '~/assets/img/260c06e4612a1bcca2ebc97cbe1ef392.jpg'
import img1 from '~/assets/img/104f493a124416e8cec5195e449b3d0f.jpg'
import img2 from '~/assets/img/2cebb4172b5f4801ec4037d48736b911.jpg'
import img3 from '~/assets/img/85e129d7a660b545b497d9e65b47b3a4.jpg'
import img4 from '~/assets/img/c08baae430a8d168d93847b175f3d6ec.jpg'

definePageMeta({ layout: 'dashboard' })

useSeoMeta({ title: 'Panel — OptiBienestar 360' })

const auth = useAuthStore()

interface GalleryItem {
  src: string
  alt: string
}

const gallery: GalleryItem[] = [
  { src: imgEyeTest, alt: 'Examen visual con optometrista' },
  { src: img1, alt: 'Atención en óptica' },
  { src: img2, alt: 'Servicios ópticos' },
  { src: img3, alt: 'Selección de monturas' },
  { src: img4, alt: 'Centro óptico' },
]

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

    <!-- Banner destacado -->
    <section class="relative overflow-hidden rounded-2xl border border-prohealth-100 bg-hero-prohealth text-white">
      <div class="absolute inset-0 opacity-20">
        <div class="absolute -top-20 -left-20 w-80 h-80 rounded-full bg-cyan-400/40 blur-3xl" />
        <div class="absolute bottom-0 right-0 w-96 h-96 rounded-full bg-lime-400/30 blur-3xl" />
      </div>
      <div class="relative grid md:grid-cols-2 items-center gap-6">
        <div class="p-8">
          <span class="inline-flex items-center gap-2 text-xs font-semibold bg-white/15 backdrop-blur rounded-full px-3 py-1">
            <UIcon name="i-lucide-eye" class="w-4 h-4" /> Centro Óptico Vicente
          </span>
          <h2 class="mt-4 text-2xl xl:text-3xl font-extrabold leading-tight max-w-md">
            Cuidamos tu visión con la mejor atención.
          </h2>
          <p class="mt-3 text-prohealth-100/90 max-w-md text-sm">
            Exámenes visuales, monturas y lentes para todos tus afiliados,
            respaldados por la red OptiBienestar 360.
          </p>
          <UButton
            to="/dashboard/users"
            color="neutral"
            variant="solid"
            icon="i-lucide-arrow-right"
            trailing
            class="mt-6"
          >
            Gestionar afiliados
          </UButton>
        </div>
        <div class="h-56 md:h-full min-h-[16rem]">
          <img
            :src="imgHero"
            alt="Atención óptica OptiBienestar 360"
            class="h-full w-full object-cover"
          >
        </div>
      </div>
    </section>

    <!-- Galería de servicios -->
    <section class="bg-white rounded-2xl border border-prohealth-100 p-6">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h3 class="font-bold text-prohealth-900">Galería de servicios</h3>
          <p class="text-xs text-prohealth-500">Conoce la experiencia OptiBienestar 360</p>
        </div>
        <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-images">
          Ver todo
        </UButton>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div
          v-for="g in gallery"
          :key="g.src"
          class="group relative aspect-square overflow-hidden rounded-xl border border-prohealth-100"
        >
          <img
            :src="g.src"
            :alt="g.alt"
            loading="lazy"
            class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          >
          <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
            <p class="text-[11px] font-medium text-white truncate">{{ g.alt }}</p>
          </div>
        </div>
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
