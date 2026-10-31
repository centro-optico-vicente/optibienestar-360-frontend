<script setup lang="ts">
import type { ApiError } from '~/types/auth'
import type { PublicAllyDetailDto } from '~/types/allies'

// PUBLIC partner detail (no login). The backend only exposes PUBLISHED+ACTIVE
// partners and their APPROVED/PUBLISHED/ACTIVE offers (/v1/public/allies/{uuid},
// `products` — hub ADR 0026). Offers of a product published in the general
// catalog (`inCatalog`) link to their cross-ally comparison /catalogo/{productUuid}.
// English pair of this public screen (hub URL convention): same page, rendered
// in English by middleware/public-locale.global.ts. The fixed `key` keeps the
// component (and any typed input) when the switcher jumps between the two URLs.
definePageMeta({
  layout: 'default',
  alias: ['/en/allies/:uuid'],
  key: route => `public-ally-${String(route.params.uuid)}`,
})

const { t } = useI18n()
const publicPath = usePublicPath()
const { formatCurrency } = useFormatters()

const route = useRoute()
const allyUuid = route.params.uuid as string

const publicAllies = usePublicAllies()

const ally = ref<PublicAllyDetailDto | null>(null)
const loading = ref(true)
const notFound = ref(false)

useSeoMeta({
  title: () => (ally.value ? t('allies.public.detail.seoTitle', { name: ally.value.name }) : ''),
  description: () => ally.value?.description || t('allies.public.seoDescription'),
  ogTitle: () => (ally.value ? t('allies.public.detail.seoTitle', { name: ally.value.name }) : ''),
  ogImage: () => ally.value?.logoUrl || undefined,
})

// `products` replaces the deprecated `services` (hub ADR 0026).
const offers = computed(() => ally.value?.products ?? [])

/** "Ver todo lo que ofrece" → the general catalog filtered by this ally's name. */
const catalogLink = computed(() =>
  ally.value ? `${publicPath('/catalogo')}?aliado=${encodeURIComponent(ally.value.name)}` : publicPath('/catalogo'))

function typeLabel(type?: string | null, display?: string | null): string {
  return display ?? (type ? t(`products.types.${type}`, type) : '')
}

function hasDiscount(v?: number | string | null): boolean {
  return v !== null && v !== undefined && v !== '' && Number(v) > 0
}

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
function money(v?: number | string | null): string {
  if (v == null || v === '') return ''
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
      :to="publicPath('/aliados')"
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
      <UButton :to="publicPath('/aliados')" color="primary" variant="soft" size="sm" class="mt-4">
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
            <div v-if="ally.allySegments?.length" class="flex flex-wrap gap-1.5 mt-1.5">
              <UBadge v-for="seg in ally.allySegments" :key="seg" color="info" variant="subtle" size="sm">
                {{ t(`allies.segments.${seg}`, seg) }}
              </UBadge>
            </div>
            <p class="text-sm text-prohealth-500 mt-1">
              <template v-if="ally.allyTypeNames?.length">{{ ally.allyTypeNames.join(', ') }}</template>
              <template v-else>{{ t('allies.fallbackName') }}</template>
              <template v-if="ally.cityName"> · {{ ally.cityName }}</template>
            </p>
            <RatingStars :model-value="ally.ratingAvg" :count="ally.ratingCount" show-value show-empty size="md" class="mt-2" />
          </div>
        </div>

        <PublicImageGallery
          :images="ally.images"
          :fallback-url="ally.logoUrl"
          :alt="ally.name"
          class="mt-5"
        />

        <p v-if="ally.description" class="text-prohealth-700 mt-5">
          {{ ally.description }}
        </p>

        <div v-if="ally.professionNames?.length" class="flex flex-wrap gap-2 mt-5">
          <UBadge
            v-for="p in ally.professionNames"
            :key="p"
            color="primary"
            variant="subtle"
          >
            {{ p }}
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
          <div v-if="ally.whatsapp" class="flex items-center gap-2.5">
            <UIcon name="i-lucide-message-circle" class="w-4.5 h-4.5 text-cyan-600 shrink-0" />
            <a :href="`https://wa.me/${ally.whatsapp.replace(/\D/g, '')}`" target="_blank" rel="noopener" class="text-prohealth-700 hover:text-cyan-700">{{ ally.whatsapp }}</a>
          </div>
          <div v-if="ally.website" class="flex items-center gap-2.5">
            <UIcon name="i-lucide-globe" class="w-4.5 h-4.5 text-cyan-600 shrink-0" />
            <a :href="ally.website" target="_blank" rel="noopener" class="text-cyan-700 hover:underline truncate">
              {{ ally.website }}
            </a>
          </div>
        </div>
      </div>

      <!-- Products and services -->
      <div class="mt-6">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 class="text-lg font-bold text-prohealth-900">{{ t('allies.public.detail.productsTitle') }}</h2>
          <UButton
            v-if="offers.some(o => o.inCatalog)"
            :to="catalogLink"
            color="primary"
            variant="link"
            size="sm"
            trailing-icon="i-lucide-arrow-right"
          >
            {{ t('allies.public.detail.viewAllInCatalog') }}
          </UButton>
        </div>

        <div v-if="!offers.length" class="bg-white rounded-2xl border border-prohealth-100 py-10 text-center">
          <UIcon name="i-lucide-package" class="w-8 h-8 mx-auto mb-2 text-prohealth-300" />
          <p class="text-sm text-prohealth-500">{{ t('allies.public.detail.productsEmpty') }}</p>
        </div>

        <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div
            v-for="s in offers"
            :key="s.uuid"
            class="bg-white rounded-2xl border border-prohealth-100 p-5 flex flex-col"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="text-[11px] font-semibold uppercase tracking-wide text-cyan-700">
                  {{ [typeLabel(s.productType, s.productType_Display), s.categoryName].filter(Boolean).join(' · ') }}
                </p>
                <h3 class="font-semibold text-prohealth-900">{{ s.name }}</h3>
                <RatingStars :model-value="s.ratingAvg" :count="s.ratingCount" show-value size="xs" class="mt-1" />
              </div>
              <div v-if="s.finalPrice != null && s.finalPrice !== ''" class="text-right shrink-0">
                <p class="font-bold text-prohealth-900">
                  <CurrencyConverterDisplay :amount="s.finalPrice" currency="USD" v-slot="{ result }">
                    <span class="inline-flex items-center justify-end gap-1">
                      {{ money(s.finalPrice) }}
                      <CurrencyConverterTrigger :result="result" />
                    </span>
                  </CurrencyConverterDisplay>
                </p>
                <p v-if="hasDiscount(s.discountPct) && s.priceAmount != null" class="text-xs text-prohealth-400 line-through">
                  {{ money(s.priceAmount) }}
                </p>
                <p v-if="hasDiscount(s.discountPct)" class="text-xs font-semibold text-lime-700">
                  {{ t('allies.public.detail.discountAffiliates', { pct: s.discountPct }) }}
                </p>
              </div>
            </div>
            <PublicImageGallery
              :images="s.images"
              :fallback-url="s.imageUrl"
              :alt="s.name"
              class="mb-3"
            />
            <p v-if="s.description" class="text-sm text-prohealth-600 mt-2 line-clamp-2">
              {{ s.description }}
            </p>
            <!-- Where the preferential rate does not apply — affiliates must see it before going. -->
            <div v-if="s.exclusions" class="flex items-start gap-1.5 mt-3 text-xs text-amber-700">
              <UIcon name="i-lucide-circle-alert" class="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{{ t('allies.public.detail.exclusions', { exclusions: s.exclusions }) }}</span>
            </div>
            <div v-if="s.requiresAppointment" class="flex items-center gap-1.5 mt-3 text-xs text-cyan-700">
              <UIcon name="i-lucide-calendar-check" class="w-3.5 h-3.5" />
              {{ t('allies.public.detail.requiresAppointment') }}
            </div>
            <!-- Comparison only exists for products published in the general catalog. -->
            <NuxtLink
              v-if="s.inCatalog && s.productUuid"
              :to="publicPath(`/catalogo/${s.productUuid}`)"
              class="mt-auto pt-3 text-xs font-medium text-cyan-700 hover:underline inline-flex items-center gap-1"
            >
              {{ t('allies.public.detail.compareOthers') }}
              <UIcon name="i-lucide-arrow-right" class="w-3.5 h-3.5" />
            </NuxtLink>
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
        <UButton :to="publicPath('/#contact')" color="secondary" variant="solid" class="text-prohealth-950">
          {{ t('allies.public.detail.ctaButton') }}
        </UButton>
      </div>
    </template>
  </div>
</template>
