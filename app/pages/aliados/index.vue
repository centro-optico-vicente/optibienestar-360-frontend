<script setup lang="ts">
import type { PublicAllyListItemDto } from '~/types/allies'

// PUBLIC partner directory (no login). Only shows PUBLISHED+ACTIVE partners with
// data sanitized by the backend (/v1/public/allies). Filters take plain words, as
// a lead would type them (hub ADR 0026): `q` over name, RIF, ally number, city and
// state; a city/state name; names of rubros (ally types), professions and product
// categories; days of the week. They are mirrored to the URL
// (?q=&ciudad=&tipo=&horario=&rubro=&profesion=&categoria=&dia=) so a search can be
// shared; the multi-select ones repeat the key per choice (?rubro=a&rubro=b).
// English pair of this public screen (hub URL convention): same page, rendered
// in English by middleware/public-locale.global.ts. The fixed `key` keeps the
// component (and any typed input) when the switcher jumps between the two URLs.
definePageMeta({ layout: 'default', alias: ['/en/allies'], key: 'public-allies' })

const { t } = useI18n()

// Hub ADR 0037: hide the self-registration entry point while it is switched off.
const { load: loadOnboardingPolicy, allySelfRegistrationEnabled } = usePublicOnboardingPolicy()
onMounted(() => { void loadOnboardingPolicy() })
const publicPath = usePublicPath()
const route = useRoute()
const router = useRouter()

useSeoMeta({
  title: () => t('allies.public.seoTitle'),
  description: () => t('allies.public.seoDescription'),
  ogTitle: () => t('allies.public.seoTitle'),
  ogDescription: () => t('allies.public.seoDescription'),
})

const publicAllies = usePublicAllies()

function queryString(key: string): string {
  const v = route.query[key]
  return typeof v === 'string' ? v : ''
}

/** A multi-select filter from the URL: a repeated key (?rubro=a&rubro=b) or a single one. */
function queryList(key: string): string[] {
  const raw = route.query[key]
  return (Array.isArray(raw) ? raw : [raw])
    .filter((v): v is string => typeof v === 'string' && v.trim() !== '')
    .map(v => v.trim())
}

// ---- List + filters ----
const data = ref<PublicAllyListItemDto[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1) // UPagination is 1-based; the API is 0-based
const size = ref(12)
const search = ref(queryString('q'))
const city = ref(queryString('ciudad'))
// Commercial (B2B) and/or professional (B2P) allies — `?tipo=comercial&tipo=profesional` in the URL.
// The API takes one segment: both picked is the same as none.
const SEGMENT_BY_SLUG: Record<string, string> = { comercial: 'B2B', profesional: 'B2P' }
const SLUG_BY_SEGMENT: Record<string, string> = { B2B: 'comercial', B2P: 'profesional' }
const segments = ref<string[]>(queryList('tipo').map(slug => SEGMENT_BY_SLUG[slug]).filter((v): v is string => !!v))
// Opening hours (hub ADR 0031 §7) — `?horario=ahora|hoy` in the URL. One choice: "now" is part of "today".
const availability = ref<string | undefined>(['ahora', 'hoy'].includes(queryString('horario')) ? queryString('horario') : undefined)
const availabilityOptions = computed(() => [
  { label: t('allies.public.filters.openNow'), value: 'ahora' },
  { label: t('allies.public.filters.openToday'), value: 'hoy' },
])
const segmentOptions = computed(() => [
  { label: t('allies.public.filters.segmentB2B'), value: 'B2B' },
  { label: t('allies.public.filters.segmentB2P'), value: 'B2P' },
])
// Days the ally opens — `?dia=lunes&dia=sabado`; the API takes the same words.
const DAYS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'] as const
const days = ref<string[]>(queryList('dia').filter(d => (DAYS as readonly string[]).includes(d)))
const dayOptions = computed(() => DAYS.map(d => ({ label: t(`allies.public.filters.days.${d}`), value: d as string })))
// Rubros (ally types), professions and product categories by NAME, several at once.
const allyTypes = ref<string[]>(queryList('rubro'))
const professions = ref<string[]>(queryList('profesion'))
const categories = ref<string[]>(queryList('categoria'))

function syncUrl() {
  const query: Record<string, string | string[]> = {}
  if (search.value.trim()) query.q = search.value.trim()
  if (city.value.trim()) query.ciudad = city.value.trim()
  if (segments.value.length) query.tipo = segments.value.map(s => SLUG_BY_SEGMENT[s] ?? s)
  if (availability.value) query.horario = availability.value
  if (allyTypes.value.length) query.rubro = allyTypes.value
  if (professions.value.length) query.profesion = professions.value
  if (categories.value.length) query.categoria = categories.value
  if (days.value.length) query.dia = days.value
  router.replace({ query })
}

// Dropdown options load the first time they open; typing searches the server (`q`).
const catalogOptions = (resource: string) => async (q: string) =>
  (await usePublicCatalog(resource).list({ q: q || undefined }))
    .filter(i => i.active !== false)
    .map(i => ({ label: i.name, value: i.name, uuid: i.uuid }))
const allyTypeOptions = useLazyOptions(catalogOptions('ally-types'))
const professionOptions = useLazyOptions(catalogOptions('professions'))
const categoryOptions = useLazyOptions(catalogOptions('product-categories'))
// The API filters professions by id; the page and the URL speak in names.
const knownProfessions = new Map<string, string>()
watch(professionOptions.items, items => items.forEach(i => knownProfessions.set(i.value, i.uuid)), { immediate: true })

async function load() {
  loading.value = true
  try {
    // A profession preset from the URL needs its id before the first search.
    if (professions.value.some(name => !knownProfessions.has(name))) await professionOptions.ensureLoaded()
    const res = await publicAllies.list({
      page: page.value - 1,
      size: size.value,
      q: search.value.trim() || undefined,
      city: city.value.trim() || undefined,
      category: categories.value,
      allyType: allyTypes.value,
      professionUuid: professions.value.map(name => knownProfessions.get(name)).filter((id): id is string => !!id),
      segment: segments.value.length === 1 ? segments.value[0] : undefined,
      openNow: availability.value === 'ahora',
      openToday: availability.value === 'hoy',
      day: days.value,
    })
    data.value = res.content ?? []
    total.value = res.totalElements ?? 0
  }
  catch {
    // useApi already shows the error toast
    data.value = []
    total.value = 0
  }
  finally {
    loading.value = false
  }
}

function reloadFromFirstPage() {
  syncUrl()
  if (page.value !== 1) page.value = 1
  else load()
}

watch(page, load)
watch([segments, availability, allyTypes, professions, categories, days], reloadFromFirstPage, { deep: true })
const debouncedSearchLoad = useTableFilterDebounce(reloadFromFirstPage)
watch([search, city], () => {
  debouncedSearchLoad()
})

function clearFilters() {
  search.value = ''
  city.value = ''
  segments.value = []
  availability.value = undefined
  allyTypes.value = []
  professions.value = []
  categories.value = []
  days.value = []
}

const hasFilters = computed(() =>
  Boolean(search.value.trim() || city.value.trim() || availability.value)
  || [segments, allyTypes, professions, categories, days].some(list => list.value.length > 0),
)

onMounted(load)
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
          <UIcon name="i-lucide-handshake" class="w-4 h-4 text-lime-300" />
          {{ t('allies.public.heroBadge') }}
        </div>
        <h1 class="text-3xl md:text-5xl font-extrabold leading-tight tracking-tight max-w-2xl">
          {{ t('allies.public.heroTitle1') }}
          <span class="text-lime-300">{{ t('allies.public.heroTitle2') }}</span>
        </h1>
        <p class="mt-4 text-prohealth-100/90 max-w-xl">
          {{ t('allies.public.heroLead') }}
        </p>
      </div>
    </section>

    <!-- Filters: every dropdown is typeable and clearable; all but "horario" take several choices -->
    <section class="max-w-7xl mx-auto px-6 lg:px-10 -mt-8 relative z-10">
      <div class="bg-white rounded-2xl border border-prohealth-100 shadow-sm p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <UInput
          v-model="search"
          :placeholder="t('allies.public.filters.search')"
          icon="i-lucide-search"
          size="lg"
          class="sm:col-span-2"
        />
        <UInput
          v-model="city"
          :placeholder="t('allies.public.filters.cityOrState')"
          icon="i-lucide-map-pin"
          size="lg"
        />
        <USelectMenu
          v-model="segments"
          multiple
          clear
          :items="segmentOptions"
          value-key="value"
          label-key="label"
          :placeholder="t('allies.public.filters.segment')"
          icon="i-lucide-layers"
          size="lg"
        />
        <USelectMenu
          v-model="allyTypes"
          multiple
          clear
          :items="allyTypeOptions.items.value"
          :loading="allyTypeOptions.loading.value"
          v-model:search-term="allyTypeOptions.searchTerm.value"
          ignore-filter
          value-key="value"
          label-key="label"
          :placeholder="t('allies.public.filters.allyType')"
          icon="i-lucide-store"
          size="lg"
          @update:open="allyTypeOptions.onOpen"
          @update:model-value="allyTypeOptions.remember($event)"
        />
        <USelectMenu
          v-model="professions"
          multiple
          clear
          :items="professionOptions.items.value"
          :loading="professionOptions.loading.value"
          v-model:search-term="professionOptions.searchTerm.value"
          ignore-filter
          value-key="value"
          label-key="label"
          :placeholder="t('allies.public.filters.profession')"
          icon="i-lucide-stethoscope"
          size="lg"
          @update:open="professionOptions.onOpen"
          @update:model-value="professionOptions.remember($event)"
        />
        <USelectMenu
          v-model="categories"
          multiple
          clear
          :items="categoryOptions.items.value"
          :loading="categoryOptions.loading.value"
          v-model:search-term="categoryOptions.searchTerm.value"
          ignore-filter
          value-key="value"
          label-key="label"
          :placeholder="t('allies.public.filters.category')"
          icon="i-lucide-tag"
          size="lg"
          @update:open="categoryOptions.onOpen"
          @update:model-value="categoryOptions.remember($event)"
        />
        <USelectMenu
          v-model="availability"
          clear
          :items="availabilityOptions"
          value-key="value"
          label-key="label"
          :placeholder="t('allies.public.filters.anyTime')"
          icon="i-lucide-clock"
          size="lg"
        />
        <div class="flex items-center gap-2 sm:col-span-2 lg:col-span-1">
          <USelectMenu
            v-model="days"
            multiple
            clear
            :items="dayOptions"
            value-key="value"
            label-key="label"
            :placeholder="t('allies.public.filters.anyDay')"
            icon="i-lucide-calendar-days"
            size="lg"
            class="flex-1 min-w-0"
          />
          <UTooltip v-if="hasFilters" :text="t('allies.public.filters.clear')">
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-x"
              size="lg"
              square
              :aria-label="t('allies.public.filters.clear')"
              @click="clearFilters"
            />
          </UTooltip>
        </div>
      </div>
    </section>

    <!-- Results -->
    <section class="max-w-7xl mx-auto px-6 lg:px-10 py-10">
      <!-- Skeleton -->
      <div v-if="loading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <div v-for="i in 6" :key="i" class="bg-white rounded-2xl border border-prohealth-100 p-5 space-y-3">
          <USkeleton class="h-5 w-3/4 rounded" />
          <USkeleton class="h-4 w-1/2 rounded" />
          <div class="flex gap-2">
            <USkeleton class="h-6 w-20 rounded-full" />
            <USkeleton class="h-6 w-24 rounded-full" />
          </div>
        </div>
      </div>

      <!-- Empty -->
      <div v-else-if="data.length === 0" class="bg-white rounded-2xl border border-prohealth-100 py-16 text-center">
        <UIcon name="i-lucide-search-x" class="w-10 h-10 mx-auto mb-3 text-prohealth-300" />
        <p class="text-prohealth-700 font-semibold">{{ t('allies.public.emptyTitle') }}</p>
        <p class="text-sm text-prohealth-500 mt-1">{{ t('allies.public.emptyBody') }}</p>
        <UButton v-if="hasFilters" color="primary" variant="soft" size="sm" class="mt-4" @click="clearFilters">
          {{ t('allies.public.filters.clear') }}
        </UButton>
      </div>

      <!-- Partners grid -->
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <NuxtLink
          v-for="a in data"
          :key="a.uuid"
          :to="publicPath(`/aliados/${a.uuid}`)"
          class="group bg-white rounded-2xl border border-prohealth-100 p-5 hover:border-cyan-300 hover:shadow-md transition-all"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <h3 class="font-bold text-prohealth-900 group-hover:text-cyan-700 transition-colors truncate">
                {{ a.name }}
              </h3>
              <p v-if="a.segment || a.allySegments?.length" class="text-[11px] font-semibold uppercase tracking-wide text-cyan-700 mt-0.5">
                {{ a.segment
                  ? (a.segment_Display || t(`allies.segments.${a.segment}`, a.segment))
                  : a.allySegments!.map(seg => t(`allies.segments.${seg}`, seg)).join(' · ') }}
              </p>
              <p v-if="a.hostName" class="text-xs text-prohealth-500 mt-0.5 truncate">
                <UIcon name="i-lucide-hospital" class="w-3.5 h-3.5 inline -mt-0.5" />
                {{ a.hostName }}<template v-if="a.officeNumber"> · {{ t('allies.public.office', { number: a.officeNumber }) }}</template>
              </p>
              <p class="text-xs text-prohealth-500 mt-0.5">
                <template v-if="a.allyTypeNames?.length">{{ a.allyTypeNames.join(', ') }}</template>
                <template v-else>{{ t('allies.fallbackName') }}</template>
                <template v-if="a.cityName"> · {{ a.cityName }}</template>
              </p>
              <RatingStars :model-value="a.ratingAvg" :count="a.ratingCount" show-value size="xs" class="mt-1.5" />
            </div>
            <span class="shrink-0 w-10 h-10 rounded-xl bg-cyan-50 grid place-items-center">
              <UIcon name="i-lucide-handshake" class="w-5 h-5 text-cyan-600" />
            </span>
          </div>

          <p v-if="a.description" class="text-sm text-prohealth-600 mt-3 line-clamp-2">
            {{ a.description }}
          </p>

          <div class="flex items-center gap-1 mt-4 text-sm font-medium text-cyan-700">
            {{ t('allies.public.viewDetail') }}
            <UIcon name="i-lucide-arrow-right" class="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </NuxtLink>
      </div>

      <!-- Pagination -->
      <div v-if="total > size" class="flex justify-center mt-8">
        <UPagination
          v-model:page="page"
          :total="total"
          :items-per-page="size"
        />
      </div>

      <!-- Become an ally (hub ADR 0036): public ally request -->
      <div v-if="allySelfRegistrationEnabled" class="mt-12 rounded-3xl bg-prohealth-900 text-white p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
        <div>
          <h2 class="text-xl font-extrabold">{{ t('allies.public.becomeAllyTitle') }}</h2>
          <p class="text-sm text-prohealth-100 mt-1 max-w-xl">{{ t('allies.public.becomeAllyBody') }}</p>
        </div>
        <UButton :to="publicPath('/solicitar-alianza')" color="secondary" variant="solid" size="lg" icon="i-lucide-handshake" class="text-prohealth-950 shrink-0">
          {{ t('allies.public.becomeAllyCta') }}
        </UButton>
      </div>
    </section>
  </div>
</template>
