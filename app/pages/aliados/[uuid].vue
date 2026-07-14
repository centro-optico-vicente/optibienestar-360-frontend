<script setup lang="ts">
import type { ApiError } from '~/types/auth'
import type { PublicAllyDto } from '~/types/allies'

// PUBLIC partner detail (no login). The backend only exposes PUBLISHED+ACTIVE
// partners and APPROVED/PUBLISHED/ACTIVE services (/v1/public/allies/{uuid}).
definePageMeta({ layout: 'default' })

const { t } = useI18n()
const { formatCurrency } = useFormatters()

const route = useRoute()
const allyUuid = route.params.uuid as string

const publicAllies = usePublicAllies()

const ally = ref<PublicAllyDto | null>(null)
const loading = ref(true)
const notFound = ref(false)

useSeoMeta({
  title: () => (ally.value ? t('allies.public.detail.seoTitle', { name: ally.value.name }) : ''),
})

onMounted(async () => {
  try {
    ally.value = await publicAllies.get(allyUuid)
  }
  catch (err) {
    if ((err as ApiError).status === 404) notFound.value = true
  }
  finally {
    loading.value = false
  }
})

// Amount in USD, formatted in the VE convention. Empty → '' (hidden by v-if).
function money(v?: string | null): string {
  if (!v) return ''
  return formatCurrency(Number(v), 'USD')
}
</script>

<template>
  <div class="max-w-5xl mx-auto px-6 lg:px-10 py-10">
    <!-- Back -->
    <UButton
      color="neutral"
      variant="ghost"
      icon="i-lucide-arrow-left"
      to="/aliados"
      size="sm"
      class="mb-5"
    >
      {{ t('allies.public.detail.back') }}
    </UButton>

    <!-- Loading -->
    <div v-if="loading" class="bg-white rounded-2xl border border-prohealth-100 p-6 space-y-3">
      <USkeleton class="h-7 w-64 rounded" />
      <USkeleton class="h-4 w-40 rounded" />
      <USkeleton class="h-4 w-full max-w-lg rounded" />
    </div>

    <!-- Not found -->
    <div v-else-if="notFound || !ally" class="bg-white rounded-2xl border border-prohealth-100 p-12 text-center">
      <UIcon name="i-lucide-search-x" class="w-10 h-10 mx-auto mb-3 text-prohealth-300" />
      <p class="text-prohealth-700 font-semibold">{{ t('allies.public.detail.notFoundTitle') }}</p>
      <p class="text-sm text-prohealth-500 mt-1">{{ t('allies.public.detail.notFoundBody') }}</p>
      <UButton to="/aliados" color="primary" variant="soft" size="sm" class="mt-4">
        {{ t('allies.public.detail.backToDirectory') }}
      </UButton>
    </div>

    <template v-else>
      <!-- Header -->
      <div class="bg-white rounded-2xl border border-prohealth-100 p-6 lg:p-8">
        <div class="flex items-start gap-4">
          <span class="shrink-0 w-14 h-14 rounded-2xl bg-cyan-50 grid place-items-center">
            <UIcon name="i-lucide-handshake" class="w-7 h-7 text-cyan-600" />
          </span>
          <div class="min-w-0">
            <h1 class="text-2xl lg:text-3xl font-extrabold text-prohealth-900">{{ ally.name }}</h1>
            <p class="text-sm text-prohealth-500 mt-1">
              {{ ally.allyType?.name || t('allies.fallbackName') }}
              <template v-if="ally.city?.name"> · {{ ally.city.name }}</template>
            </p>
          </div>
        </div>

        <p v-if="ally.description" class="text-prohealth-700 mt-5">
          {{ ally.description }}
        </p>

        <div v-if="ally.specialties?.length" class="flex flex-wrap gap-2 mt-5">
          <UBadge
            v-for="s in ally.specialties"
            :key="s.uuid"
            color="primary"
            variant="subtle"
          >
            {{ s.name }}
          </UBadge>
        </div>

        <!-- Contact data -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 pt-6 border-t border-prohealth-100 text-sm">
          <div v-if="ally.address" class="flex items-start gap-2.5">
            <UIcon name="i-lucide-map-pin" class="w-4.5 h-4.5 text-cyan-600 mt-0.5 shrink-0" />
            <span class="text-prohealth-700">{{ ally.address }}</span>
          </div>
          <div v-if="ally.phone" class="flex items-center gap-2.5">
            <UIcon name="i-lucide-phone" class="w-4.5 h-4.5 text-cyan-600 shrink-0" />
            <a :href="`tel:${ally.phone}`" class="text-prohealth-700 hover:text-cyan-700">{{ ally.phone }}</a>
          </div>
          <div v-if="ally.email" class="flex items-center gap-2.5">
            <UIcon name="i-lucide-mail" class="w-4.5 h-4.5 text-cyan-600 shrink-0" />
            <a :href="`mailto:${ally.email}`" class="text-prohealth-700 hover:text-cyan-700">{{ ally.email }}</a>
          </div>
          <div v-if="ally.website" class="flex items-center gap-2.5">
            <UIcon name="i-lucide-globe" class="w-4.5 h-4.5 text-cyan-600 shrink-0" />
            <a :href="ally.website" target="_blank" rel="noopener" class="text-cyan-700 hover:underline truncate">
              {{ ally.website }}
            </a>
          </div>
        </div>
      </div>

      <!-- Services -->
      <div class="mt-6">
        <h2 class="text-lg font-bold text-prohealth-900 mb-4">{{ t('allies.public.detail.servicesTitle') }}</h2>

        <div v-if="!ally.services?.length" class="bg-white rounded-2xl border border-prohealth-100 py-10 text-center">
          <UIcon name="i-lucide-briefcase-medical" class="w-8 h-8 mx-auto mb-2 text-prohealth-300" />
          <p class="text-sm text-prohealth-500">{{ t('allies.public.detail.servicesEmpty') }}</p>
        </div>

        <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div
            v-for="s in ally.services"
            :key="s.uuid"
            class="bg-white rounded-2xl border border-prohealth-100 p-5"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <h3 class="font-semibold text-prohealth-900">{{ s.name }}</h3>
                <p v-if="s.serviceCategory?.name" class="text-xs text-prohealth-500 mt-0.5">
                  {{ s.serviceCategory.name }}
                </p>
              </div>
              <div v-if="s.priceUsd" class="text-right shrink-0">
                <p class="font-bold text-prohealth-900">{{ money(s.priceUsd) }}</p>
                <p v-if="s.discountPct" class="text-xs font-semibold text-lime-600">
                  {{ t('allies.public.detail.discountAffiliates', { pct: s.discountPct }) }}
                </p>
              </div>
            </div>
            <p v-if="s.description" class="text-sm text-prohealth-600 mt-2 line-clamp-2">
              {{ s.description }}
            </p>
            <div v-if="s.requiresAppointment" class="flex items-center gap-1.5 mt-3 text-xs text-cyan-700">
              <UIcon name="i-lucide-calendar-check" class="w-3.5 h-3.5" />
              {{ t('allies.public.detail.requiresAppointment') }}
            </div>
          </div>
        </div>
      </div>

      <!-- CTA -->
      <div class="mt-8 rounded-2xl bg-hero-prohealth text-white p-6 lg:p-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 class="font-bold text-lg">{{ t('allies.public.detail.ctaTitle') }}</h3>
          <p class="text-sm text-prohealth-100/90 mt-1">
            {{ t('allies.public.detail.ctaBody') }}
          </p>
        </div>
        <UButton to="/#contact" color="secondary" variant="solid">
          {{ t('allies.public.detail.ctaButton') }}
        </UButton>
      </div>
    </template>
  </div>
</template>
