<script setup lang="ts">
import type { PublicProductListItemDto } from '~/types/products'

// PUBLIC cross-ally catalog of products and services (no login — hub ADR 0026).
// Plain words end to end: the API reads "servicio"/"producto", category, city/state
// and ally names, and the page URL carries the same words
// (/catalogo?q=&tipo=&categoria=&ciudad=&aliado=) so a lead can read, share or type
// it without any id. Each card leads to the product comparison /catalogo/{uuid}.
// English pair (hub URL convention): /en/catalog, same page rendered in English by
// middleware/public-locale.global.ts; the fixed `key` keeps the typed filters when
// the switcher jumps between both URLs.
definePageMeta({ layout: 'default', alias: ['/en/catalog'], key: 'public-catalog' })

const { t } = useI18n()
const publicPath = usePublicPath()
const { formatCurrency } = useFormatters()
const route = useRoute()
const router = useRouter()

useSeoMeta({
  title: () => t('catalog.public.seoTitle'),
  description: () => t('catalog.public.seoDescription'),
  ogTitle: () => t('catalog.public.seoTitle'),
  ogDescription: () => t('catalog.public.seoDescription'),
})

const publicProducts = usePublicProducts()

// ---- Filters (seeded from the URL) ----
function queryString(key: string): string {
  const v = route.query[key]
  return typeof v === 'string' ? v : ''
}

const TYPE_VALUES = ['servicio', 'producto'] as const
const search = ref(queryString('q'))
const type = ref<string>(TYPE_VALUES.includes(queryString('tipo') as typeof TYPE_VALUES[number]) ? queryString('tipo') : '')
const category = ref<string | undefined>(queryString('categoria') || undefined)
const city = ref(queryString('ciudad'))
const ally = ref(queryString('aliado'))

const typeChips = computed(() => [
  { value: '', label: t('catalog.public.types.all') },
  { value: 'servicio', label: t('catalog.public.types.servicio') },
  { value: 'producto', label: t('catalog.public.types.producto') },
])

// Categories by NAME — the API filters by name or code, never by id here.
const categoryOptions = ref<string[]>([])
async function loadCategories() {
  try {
    const items = await usePublicCatalog('product-categories').list()
    categoryOptions.value = items.filter(i => i.active !== false).map(i => i.name)
  }
  catch {
    categoryOptions.value = []
  }
}

/** Mirrors the filters into the URL in plain words, so the search can be shared. */
function syncUrl() {
  const query: Record<string, string> = {}
  if (search.value.trim()) query.q = search.value.trim()
  if (type.value) query.tipo = type.value
  if (category.value) query.categoria = category.value
  if (city.value.trim()) query.ciudad = city.value.trim()
  if (ally.value.trim()) query.aliado = ally.value.trim()
  router.replace({ query })
}

// ---- List (load more) ----
const PAGE_SIZE = 12
const items = ref<PublicProductListItemDto[]>([])
const total = ref(0)
const page = ref(0)
const last = ref(true)
const loading = ref(true)
const loadingMore = ref(false)

async function fetchPage(target: number) {
  if (target === 0) loading.value = true
  else loadingMore.value = true
  try {
    const res = await publicProducts.search({
      page: target,
      size: PAGE_SIZE,
      q: search.value.trim() || undefined,
      type: type.value || undefined,
      category: category.value || undefined,
      city: city.value.trim() || undefined,
      ally: ally.value.trim() || undefined,
    })
    const content = res.content ?? []
    items.value = target === 0 ? content : [...items.value, ...content]
    total.value = res.totalElements ?? 0
    last.value = res.last ?? true
    page.value = target
  }
  catch {
    if (target === 0) {
      items.value = []
      total.value = 0
      last.value = true
    }
  }
  finally {
    loading.value = false
    loadingMore.value = false
  }
}

function reload() {
  syncUrl()
  fetchPage(0)
}

watch([type, category], reload)
let typingTimer: ReturnType<typeof setTimeout> | undefined
watch([search, city, ally], () => {
  clearTimeout(typingTimer)
  typingTimer = setTimeout(reload, 400)
})

const hasFilters = computed(() =>
  Boolean(search.value.trim() || type.value || category.value || city.value.trim() || ally.value.trim()))

function clearFilters() {
  search.value = ''
  type.value = ''
  category.value = undefined
  city.value = ''
  ally.value = ''
}

function money(v?: number | string | null): string {
  if (v === null || v === undefined || v === '') return ''
  return formatCurrency(Number(v), 'USD')
}

function hasDiscount(v?: number | string | null): boolean {
  return v !== null && v !== undefined && v !== '' && Number(v) > 0
}

function typeLabel(item: PublicProductListItemDto): string {
  return item.productType_Display ?? (item.productType ? t(`products.types.${item.productType}`, String(item.productType)) : '')
}

onMounted(() => {
  loadCategories()
  fetchPage(0)
})
</script>

<template>
  <div>
    <!-- Hero -->
    <section class="relative overflow-hidden bg-hero-prohealth text-white -mt-16 pt-16">
      <div class="absolute inset-0 opacity-30 pointer-events-none">
        <div class="absolute -top-20 -right-20 w-[28rem] h-[28rem] rounded-full bg-cyan-400/40 blur-3xl" />
      </div>
      <div class="relative max-w-7xl mx-auto px-6 lg:px-10 py-14 lg:py-20">
        <div class="inline-flex items-center gap-2 bg-white/10 backdrop-blur px-3 py-1.5 rounded-full text-xs font-medium mb-5">
          <UIcon name="i-lucide-package-search" class="w-4 h-4 text-lime-300" />
          {{ t('catalog.public.heroBadge') }}
        </div>
        <h1 class="text-3xl md:text-5xl font-extrabold leading-tight tracking-tight max-w-2xl">
          {{ t('catalog.public.heroTitle1') }}
          <span class="text-lime-300">{{ t('catalog.public.heroTitle2') }}</span>
        </h1>
        <p class="mt-4 text-prohealth-100/90 max-w-xl">{{ t('catalog.public.heroLead') }}</p>
      </div>
    </section>

    <!-- Filters -->
    <section class="max-w-7xl mx-auto px-6 lg:px-10 -mt-8 relative z-10">
      <div class="bg-white rounded-2xl border border-prohealth-100 shadow-sm p-4 space-y-3">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <UInput
            v-model="search"
            :placeholder="t('catalog.public.filters.search')"
            icon="i-lucide-search"
            size="lg"
            class="lg:col-span-2"
          />
          <USelectMenu
            clear
            v-model="category"
            :items="categoryOptions"
            :placeholder="t('catalog.public.filters.category')"
            size="lg"
          />
          <UInput
            v-model="city"
            :placeholder="t('catalog.public.filters.city')"
            icon="i-lucide-map-pin"
            size="lg"
          />
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <UButton
            v-for="chip in typeChips"
            :key="chip.value"
            :color="type === chip.value ? 'primary' : 'neutral'"
            :variant="type === chip.value ? 'solid' : 'soft'"
            size="sm"
            class="rounded-full"
            @click="type = chip.value"
          >
            {{ chip.label }}
          </UButton>
          <UInput
            v-model="ally"
            :placeholder="t('catalog.public.filters.ally')"
            icon="i-lucide-handshake"
            size="sm"
            class="w-full sm:w-72 sm:ms-auto"
          />
          <UTooltip v-if="hasFilters" :text="t('catalog.public.filters.clear')">
            <UButton color="neutral" variant="ghost" icon="i-lucide-x" size="sm" square @click="clearFilters" />
          </UTooltip>
        </div>
      </div>
    </section>

    <!-- Results -->
    <section class="max-w-7xl mx-auto px-6 lg:px-10 py-10">
      <p v-if="!loading && items.length" class="text-sm text-prohealth-500 mb-4">
        {{ t('catalog.public.resultsCount', { total }) }}
      </p>

      <div v-if="loading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <div v-for="i in 6" :key="i" class="bg-white rounded-2xl border border-prohealth-100 p-5 space-y-3">
          <USkeleton class="h-5 w-3/4 rounded" />
          <USkeleton class="h-4 w-1/2 rounded" />
          <USkeleton class="h-6 w-24 rounded" />
        </div>
      </div>

      <div v-else-if="items.length === 0" class="bg-white rounded-2xl border border-prohealth-100 py-16 text-center">
        <UIcon name="i-lucide-search-x" class="w-10 h-10 mx-auto mb-3 text-prohealth-300" />
        <p class="text-prohealth-700 font-semibold">{{ t('catalog.public.emptyTitle') }}</p>
        <p class="text-sm text-prohealth-500 mt-1">{{ t('catalog.public.emptyBody') }}</p>
        <UButton v-if="hasFilters" color="primary" variant="soft" size="sm" class="mt-4" @click="clearFilters">
          {{ t('catalog.public.filters.clear') }}
        </UButton>
      </div>

      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <article
          v-for="item in items"
          :key="item.uuid"
          class="group bg-white rounded-2xl border border-prohealth-100 overflow-hidden hover:border-cyan-300 hover:shadow-md transition-all flex flex-col"
        >
          <NuxtLink :to="publicPath(`/catalogo/${item.productUuid}`)" class="block p-5 flex-1">
            <div class="flex items-start gap-3">
              <img
                v-if="item.imageUrl"
                :src="item.imageUrl"
                :alt="item.name"
                class="w-14 h-14 rounded-xl object-cover border border-prohealth-100 shrink-0"
                loading="lazy"
              >
              <span v-else class="shrink-0 w-14 h-14 rounded-xl bg-cyan-50 grid place-items-center">
                <UIcon
                  :name="item.productType === 'PRODUCT' ? 'i-lucide-package' : 'i-lucide-briefcase-medical'"
                  class="w-6 h-6 text-cyan-600"
                />
              </span>
              <div class="min-w-0">
                <p class="text-[11px] font-semibold uppercase tracking-wide text-cyan-700">
                  {{ [typeLabel(item), item.categoryName].filter(Boolean).join(' · ') }}
                </p>
                <h3 class="font-bold text-prohealth-900 group-hover:text-cyan-700 transition-colors line-clamp-2">
                  {{ item.name }}
                </h3>
              </div>
            </div>

            <div class="mt-4 flex items-end justify-between gap-3">
              <div>
                <p v-if="item.finalPrice != null && item.finalPrice !== ''" class="text-lg font-extrabold text-prohealth-900">
                  {{ money(item.finalPrice) }}
                </p>
                <p v-if="hasDiscount(item.discountPct) && item.priceAmount != null" class="text-xs text-prohealth-400 line-through">
                  {{ money(item.priceAmount) }}
                </p>
              </div>
              <UBadge v-if="hasDiscount(item.discountPct)" color="success" variant="subtle">
                {{ t('catalog.public.discount', { pct: item.discountPct }) }}
              </UBadge>
            </div>
            <div v-if="item.requiresAppointment" class="flex items-center gap-1.5 mt-3 text-xs text-cyan-700">
              <UIcon name="i-lucide-calendar-check" class="w-3.5 h-3.5" />
              {{ t('allies.public.detail.requiresAppointment') }}
            </div>
          </NuxtLink>

          <div class="px-5 py-3 border-t border-prohealth-100 text-xs flex items-center justify-between gap-2">
            <NuxtLink :to="publicPath(`/aliados/${item.allyUuid}`)" class="text-prohealth-700 hover:text-cyan-700 truncate">
              <UIcon name="i-lucide-handshake" class="w-3.5 h-3.5 inline -mt-0.5 me-1 text-cyan-600" />
              {{ item.allyName }}<template v-if="item.allyCityName"> · {{ item.allyCityName }}</template>
            </NuxtLink>
            <NuxtLink :to="publicPath(`/catalogo/${item.productUuid}`)" class="shrink-0 font-medium text-cyan-700 hover:underline">
              {{ t('catalog.public.compare') }}
            </NuxtLink>
          </div>
        </article>
      </div>

      <div v-if="!loading && !last" class="flex justify-center mt-8">
        <UButton color="primary" variant="soft" :loading="loadingMore" icon="i-lucide-chevrons-down" @click="fetchPage(page + 1)">
          {{ t('catalog.public.loadMore') }}
        </UButton>
      </div>
    </section>
  </div>
</template>
