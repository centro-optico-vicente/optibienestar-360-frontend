<script setup lang="ts">
import imgHero from '~/assets/img/Gemini_Generated_Image_3w6wwq3w6wwq3w6w.png'
import imgEyeTest from '~/assets/img/260c06e4612a1bcca2ebc97cbe1ef392.jpg'
import img1 from '~/assets/img/104f493a124416e8cec5195e449b3d0f.jpg'
import img2 from '~/assets/img/2cebb4172b5f4801ec4037d48736b911.jpg'
import img3 from '~/assets/img/85e129d7a660b545b497d9e65b47b3a4.jpg'
import img4 from '~/assets/img/c08baae430a8d168d93847b175f3d6ec.jpg'

definePageMeta({ layout: 'dashboard' })

const { t } = useI18n()
const auth = useAuthStore()
// Figures keep the VE convention regardless of UI locale (ADR 0010).
const { formatNumber, formatCurrency } = useFormatters()

useSeoMeta({ title: () => t('common.seoTitle', { page: t('nav.items.panel.label') }) })

interface GalleryItem {
  src: string
  alt: string
}

const gallery = computed<GalleryItem[]>(() => [
  { src: imgEyeTest, alt: t('dashboard.gallery.items.eyeTest') },
  { src: img1, alt: t('dashboard.gallery.items.care') },
  { src: img2, alt: t('dashboard.gallery.items.services') },
  { src: img3, alt: t('dashboard.gallery.items.frames') },
  { src: img4, alt: t('dashboard.gallery.items.center') },
])

interface Kpi {
  label: string
  value: string
  delta: string
  trend: 'up' | 'down'
  icon: string
  accent: string
}

// Placeholder metrics (mockup — wired to real data when the dashboard is rebuilt).
const kpis = computed<Kpi[]>(() => [
  { label: t('dashboard.kpis.activeMembers'), value: formatNumber(12480), delta: '+5.2%', trend: 'up', icon: 'i-lucide-users', accent: 'bg-prohealth-50 text-prohealth-700' },
  { label: t('dashboard.kpis.monthlyRevenue'), value: formatCurrency(48250), delta: '+12.4%', trend: 'up', icon: 'i-lucide-banknote', accent: 'bg-lime-50 text-lime-700' },
  { label: t('dashboard.kpis.allyUsage'), value: formatNumber(1820), delta: '-1.8%', trend: 'down', icon: 'i-lucide-handshake', accent: 'bg-cyan-50 text-cyan-700' },
  { label: t('dashboard.kpis.pendingPayments'), value: formatNumber(64), delta: '+3', trend: 'up', icon: 'i-lucide-clock', accent: 'bg-orange-50 text-orange-700' },
])

interface RecentActivity {
  id: number
  who: string
  what: string
  when: string
  status: 'success' | 'pending' | 'error'
}

// Placeholder feed; person names are literal, the system actor is localized.
const activity = computed<RecentActivity[]>(() => [
  { id: 1, who: 'Mia Torres', what: t('dashboard.activity.items.i1.what'), when: t('dashboard.activity.items.i1.when'), status: 'success' },
  { id: 2, who: 'Centro Óptico Vicente', what: t('dashboard.activity.items.i2.what'), when: t('dashboard.activity.items.i2.when'), status: 'success' },
  { id: 3, who: 'Carlos Rivas', what: t('dashboard.activity.items.i3.what'), when: t('dashboard.activity.items.i3.when'), status: 'pending' },
  { id: 4, who: 'Laura Pérez', what: t('dashboard.activity.items.i4.what'), when: t('dashboard.activity.items.i4.when'), status: 'pending' },
  { id: 5, who: t('dashboard.activity.support'), what: t('dashboard.activity.items.i5.what'), when: t('dashboard.activity.items.i5.when'), status: 'error' },
])

const statusColor: Record<RecentActivity['status'], 'success' | 'warning' | 'error'> = {
  success: 'success',
  pending: 'warning',
  error: 'error',
}

// Time-of-day greeting key resolved against the `dashboard.greeting.*` bundle.
const greetingKey = computed<'morning' | 'afternoon' | 'evening'>(() => {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 19) return 'afternoon'
  return 'evening'
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl md:text-3xl font-extrabold text-prohealth-900">
          {{ t(`dashboard.greeting.${greetingKey}`) }}, {{ auth.user?.fullName || auth.user?.email }} 👋
        </h1>
        <p class="text-sm text-prohealth-700/70 mt-1">
          {{ t('dashboard.subtitle') }}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <UButton color="neutral" variant="outline" icon="i-lucide-calendar" size="sm">
          {{ t('dashboard.thisMonth') }}
        </UButton>
        <UButton color="primary" variant="solid" icon="i-lucide-plus" size="sm">
          {{ t('members.new') }}
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
            {{ t('dashboard.banner.title') }}
          </h2>
          <p class="mt-3 text-prohealth-100/90 max-w-md text-sm">
            {{ t('dashboard.banner.description') }}
          </p>
          <UButton
            to="/dashboard/users"
            color="neutral"
            variant="solid"
            icon="i-lucide-arrow-right"
            trailing
            class="mt-6"
          >
            {{ t('dashboard.banner.cta') }}
          </UButton>
        </div>
        <div class="h-56 md:h-full min-h-[16rem]">
          <img
            :src="imgHero"
            :alt="t('dashboard.banner.imageAlt')"
            class="h-full w-full object-cover"
          >
        </div>
      </div>
    </section>

    <!-- Galería de servicios -->
    <section class="bg-white rounded-2xl border border-prohealth-100 p-6">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h3 class="font-bold text-prohealth-900">{{ t('dashboard.gallery.title') }}</h3>
          <p class="text-xs text-prohealth-500">{{ t('dashboard.gallery.subtitle') }}</p>
        </div>
        <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-images">
          {{ t('common.viewAll') }}
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
            <h3 class="font-bold text-prohealth-900">{{ t('dashboard.activity.title') }}</h3>
            <p class="text-xs text-prohealth-500">{{ t('dashboard.activity.subtitle') }}</p>
          </div>
          <UButton size="xs" color="neutral" variant="ghost">{{ t('common.viewAll') }}</UButton>
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
              {{ t(`dashboard.activity.status.${a.status}`) }}
            </UBadge>
          </li>
        </ul>
      </div>

      <div class="bg-white rounded-2xl border border-prohealth-100 p-6">
        <h3 class="font-bold text-prohealth-900">{{ t('dashboard.session.title') }}</h3>
        <p class="text-xs text-prohealth-500 mb-5">{{ t('dashboard.session.subtitle') }}</p>

        <dl class="space-y-3 text-sm">
          <div class="flex items-center justify-between">
            <dt class="text-prohealth-500">{{ t('dashboard.session.email') }}</dt>
            <dd class="font-semibold text-prohealth-900 truncate max-w-[60%]">{{ auth.user?.email }}</dd>
          </div>
          <div class="flex items-center justify-between">
            <dt class="text-prohealth-500">{{ t('dashboard.session.roles') }}</dt>
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
          {{ t('auth.changePassword.heading') }}
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
