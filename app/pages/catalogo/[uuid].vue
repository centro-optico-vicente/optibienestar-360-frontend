<script setup lang="ts">
import type { ApiError } from '~/types/auth'
import type { PublicProductDetailDto } from '~/types/products'

// PUBLIC product comparison (no login — hub ADR 0026): one product of the general
// catalog with every ally offering it publicly, best final price first
// (GET /v1/public/products/{uuid}?city=). The city filter takes plain words
// (city or state name) and lives in the URL (?ciudad=). 404 = nobody offers it
// publicly (or nobody in that city), rendered as a friendly empty state.
// English pair (hub URL convention): /en/catalog/{uuid}.
definePageMeta({
  layout: 'default',
  alias: ['/en/catalog/:uuid'],
  key: route => `public-product-${String(route.params.uuid)}`,
})

const { t } = useI18n()
const publicPath = usePublicPath()
const { formatCurrency } = useFormatters()
const route = useRoute()
const router = useRouter()
const productUuid = route.params.uuid as string

const publicProducts = usePublicProducts()

const product = ref<PublicProductDetailDto | null>(null)
const loading = ref(true)
const notFound = ref(false)
const city = ref(typeof route.query.ciudad === 'string' ? route.query.ciudad : '')
// The city the last result was filtered by (the typed one may still be pending).
const appliedCity = ref('')

useSeoMeta({
  title: () => (product.value ? t('catalog.public.detail.seoTitle', { name: product.value.name }) : t('catalog.public.seoTitle')),
  description: () => product.value?.description || t('catalog.public.seoDescription'),
  ogTitle: () => (product.value ? t('catalog.public.detail.seoTitle', { name: product.value.name }) : t('catalog.public.seoTitle')),
  ogImage: () => product.value?.imageUrl || undefined,
})

async function load() {
  loading.value = true
  notFound.value = false
  const filter = city.value.trim()
  try {
    product.value = await publicProducts.get(productUuid, filter || undefined)
  }
  catch (err) {
    product.value = null
    if ((err as ApiError).status === 404) notFound.value = true
  }
  finally {
    appliedCity.value = filter
    loading.value = false
  }
}

let cityTimer: ReturnType<typeof setTimeout> | undefined
watch(city, () => {
  clearTimeout(cityTimer)
  cityTimer = setTimeout(() => {
    const value = city.value.trim()
    router.replace({ query: value ? { ciudad: value } : {} })
    load()
  }, 400)
})

function money(v?: number | string | null): string {
  if (v === null || v === undefined || v === '') return t('common.empty')
  return formatCurrency(Number(v), 'USD')
}

function hasDiscount(v?: number | string | null): boolean {
  return v !== null && v !== undefined && v !== '' && Number(v) > 0
}

function whatsappHref(phone: string): string {
  return `https://wa.me/${phone.replace(/\D/g, '')}`
}

const typeLabel = computed(() => {
  const p = product.value
  if (!p) return ''
  return p.productType_Display ?? (p.productType ? t(`products.types.${p.productType}`, String(p.productType)) : '')
})

onMounted(load)
</script>

<template>
  <div class="max-w-6xl mx-auto px-6 lg:px-10 py-10">
    <UButton
      color="neutral"
      variant="ghost"
      icon="i-lucide-arrow-left"
      :to="publicPath('/catalogo')"
      size="sm"
      class="mb-5"
    >
      {{ t('catalog.public.detail.back') }}
    </UButton>

    <!-- Loading (first load only) -->
    <div v-if="loading && !product && !notFound" class="bg-white rounded-2xl border border-prohealth-100 p-6 space-y-3">
      <USkeleton class="h-7 w-64 rounded" />
      <USkeleton class="h-4 w-40 rounded" />
      <USkeleton class="h-4 w-full max-w-lg rounded" />
    </div>

    <!-- Not offered (anywhere, or in the filtered city) -->
    <div v-else-if="notFound || !product" class="bg-white rounded-2xl border border-prohealth-100 p-12 text-center">
      <UIcon name="i-lucide-search-x" class="w-10 h-10 mx-auto mb-3 text-prohealth-300" />
      <template v-if="appliedCity">
        <p class="text-prohealth-700 font-semibold">{{ t('catalog.public.detail.notInCityTitle', { city: appliedCity }) }}</p>
        <p class="text-sm text-prohealth-500 mt-1">{{ t('catalog.public.detail.notInCityBody') }}</p>
        <UButton color="primary" variant="soft" size="sm" class="mt-4" @click="city = ''">
          {{ t('catalog.public.detail.anyCity') }}
        </UButton>
      </template>
      <template v-else>
        <p class="text-prohealth-700 font-semibold">{{ t('catalog.public.detail.notFoundTitle') }}</p>
        <p class="text-sm text-prohealth-500 mt-1">{{ t('catalog.public.detail.notFoundBody') }}</p>
        <UButton :to="publicPath('/catalogo')" color="primary" variant="soft" size="sm" class="mt-4">
          {{ t('catalog.public.detail.backToCatalog') }}
        </UButton>
      </template>
    </div>

    <template v-else>
      <!-- Product -->
      <div class="bg-white rounded-2xl border border-prohealth-100 p-6 lg:p-8">
        <PublicImageGallery
          :images="product.images"
          :fallback-url="product.imageUrl"
          :alt="product.name"
          class="mb-6 max-w-xl"
        />
        <div class="flex flex-col sm:flex-row items-start gap-5">
          <span v-if="!product.imageUrl && !product.images?.length" class="shrink-0 w-20 h-20 rounded-2xl bg-cyan-50 grid place-items-center">
            <UIcon
              :name="product.productType === 'PRODUCT' ? 'i-lucide-package' : 'i-lucide-briefcase-medical'"
              class="w-9 h-9 text-cyan-600"
            />
          </span>
          <div class="min-w-0 flex-1">
            <p class="text-xs font-semibold uppercase tracking-wide text-cyan-700">
              {{ [typeLabel, product.categoryName].filter(Boolean).join(' · ') }}
            </p>
            <h1 class="text-2xl lg:text-3xl font-extrabold text-prohealth-900 mt-1">{{ product.name }}</h1>
            <RatingStars :model-value="product.ratingAvg" :count="product.ratingCount" show-value show-empty size="md" class="mt-2" />
            <p v-if="product.description" class="text-prohealth-700 mt-3 whitespace-pre-line">{{ product.description }}</p>
            <div v-if="product.requiresAppointment" class="flex items-center gap-1.5 mt-3 text-sm text-cyan-700">
              <UIcon name="i-lucide-calendar-check" class="w-4 h-4" />
              {{ t('allies.public.detail.requiresAppointment') }}
            </div>
          </div>
        </div>

        <!-- Summary: "Desde $X · hasta Y%" -->
        <div class="mt-6 pt-6 border-t border-prohealth-100 flex flex-wrap items-center gap-x-6 gap-y-2">
          <p class="text-lg font-bold text-prohealth-900">
            {{ t('catalog.public.detail.from', { price: money(product.minFinalPrice) }) }}
            <template v-if="hasDiscount(product.maxDiscountPct)">
              · <span class="text-lime-700">{{ t('catalog.public.detail.upTo', { pct: product.maxDiscountPct }) }}</span>
            </template>
          </p>
          <p class="text-sm text-prohealth-500">
            {{ t('catalog.public.detail.offersCount', { n: product.offersCount }, product.offersCount) }}
          </p>
        </div>
      </div>

      <!-- Comparison -->
      <div class="mt-6">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 class="text-lg font-bold text-prohealth-900">{{ t('catalog.public.detail.compareTitle') }}</h2>
          <UInput
            v-model="city"
            :placeholder="t('catalog.public.filters.city')"
            icon="i-lucide-map-pin"
            :loading="loading"
            class="w-full sm:w-72"
          />
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div
            v-for="(o, i) in product.offers"
            :key="o.offerUuid"
            class="bg-white rounded-2xl border p-5"
            :class="i === 0 ? 'border-lime-300 ring-1 ring-lime-200' : 'border-prohealth-100'"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-start gap-3 min-w-0">
                <img
                  v-if="o.allyLogoUrl"
                  :src="o.allyLogoUrl"
                  :alt="o.allyName"
                  class="w-10 h-10 rounded-xl object-cover border border-prohealth-100 shrink-0"
                >
                <span v-else class="shrink-0 w-10 h-10 rounded-xl bg-cyan-50 grid place-items-center">
                  <UIcon name="i-lucide-handshake" class="w-5 h-5 text-cyan-600" />
                </span>
                <div class="min-w-0">
                  <NuxtLink :to="publicPath(`/aliados/${o.allyUuid}`)" class="font-semibold text-prohealth-900 hover:text-cyan-700">
                    {{ o.allyName }}
                  </NuxtLink>
                  <p class="text-xs text-prohealth-500">
                    {{ [o.allyTypeNames?.join(', '), o.allyCityName].filter(Boolean).join(' · ') }}
                  </p>
                  <div v-if="o.ratingAvg != null || o.allyRatingAvg != null" class="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-prohealth-500">
                    <span v-if="o.ratingAvg != null" class="inline-flex items-center gap-1">
                      {{ t('rating.offerPrefix') }}
                      <RatingStars :model-value="o.ratingAvg" :count="o.ratingCount" show-value size="xs" :label="t('rating.offerPrefix')" />
                    </span>
                    <span v-if="o.allyRatingAvg != null" class="inline-flex items-center gap-1">
                      {{ t('rating.allyPrefix') }}
                      <RatingStars :model-value="o.allyRatingAvg" :count="o.allyRatingCount" show-value size="xs" :label="t('rating.allyPrefix')" />
                    </span>
                  </div>
                </div>
              </div>
              <UBadge v-if="i === 0 && product.offers.length > 1" color="success" variant="subtle" size="sm">
                {{ t('catalog.public.detail.bestPrice') }}
              </UBadge>
            </div>

            <PublicImageGallery
              v-if="o.images?.length"
              :images="o.images"
              :alt="o.allyName"
              class="mt-4"
            />

            <dl class="grid grid-cols-3 gap-3 mt-4 text-sm">
              <div>
                <dt class="text-xs text-prohealth-500">{{ t('catalog.public.detail.price') }}</dt>
                <dd class="text-prohealth-700">{{ money(o.priceAmount) }}</dd>
              </div>
              <div>
                <dt class="text-xs text-prohealth-500">{{ t('catalog.public.detail.discountLabel') }}</dt>
                <dd class="text-lime-700 font-semibold">{{ hasDiscount(o.discountPct) ? `${o.discountPct}%` : t('common.empty') }}</dd>
              </div>
              <div>
                <dt class="text-xs text-prohealth-500">{{ t('catalog.public.detail.finalPrice') }}</dt>
                <dd class="text-prohealth-900 font-extrabold">{{ money(o.finalPrice) }}</dd>
              </div>
            </dl>

            <div v-if="o.exclusions" class="flex items-start gap-1.5 mt-3 text-xs text-amber-700">
              <UIcon name="i-lucide-circle-alert" class="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{{ t('allies.public.detail.exclusions', { exclusions: o.exclusions }) }}</span>
            </div>

            <div class="flex flex-wrap items-center gap-2 mt-4">
              <UButton
                v-if="o.allyWhatsapp"
                :href="whatsappHref(o.allyWhatsapp)"
                target="_blank"
                rel="noopener"
                color="success"
                variant="soft"
                size="xs"
                icon="i-lucide-message-circle"
              >
                {{ t('catalog.public.detail.whatsapp') }}
              </UButton>
              <UButton
                v-if="o.allyPhone"
                :href="`tel:${o.allyPhone}`"
                color="neutral"
                variant="soft"
                size="xs"
                icon="i-lucide-phone"
              >
                {{ o.allyPhone }}
              </UButton>
              <UButton
                :to="publicPath(`/aliados/${o.allyUuid}`)"
                color="primary"
                variant="link"
                size="xs"
                trailing-icon="i-lucide-arrow-right"
              >
                {{ t('catalog.public.detail.viewAlly') }}
              </UButton>
            </div>
          </div>
        </div>
      </div>

      <!-- CTA -->
      <div class="mt-8 rounded-2xl bg-hero-prohealth text-white p-6 lg:p-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 class="font-bold text-lg">{{ t('allies.public.detail.ctaTitle') }}</h3>
          <p class="text-sm text-prohealth-100/90 mt-1">{{ t('allies.public.detail.ctaBody') }}</p>
        </div>
        <UButton :to="publicPath('/afiliarse')" color="secondary" variant="solid" class="text-prohealth-950">
          {{ t('allies.public.detail.ctaButton') }}
        </UButton>
      </div>
    </template>
  </div>
</template>
