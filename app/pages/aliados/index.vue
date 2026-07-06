<script setup lang="ts">
import type { CatalogItem } from '~/types/catalogs'
import type { PublicAllyDto } from '~/types/allies'

// Directorio PÚBLICO de aliados (sin login). Solo muestra aliados PUBLISHED+ACTIVE
// con datos sanitizados por el backend (/v1/public/allies).
definePageMeta({ layout: 'default' })

useSeoMeta({
  title: 'Red de aliados — OptiBienestar 360',
  description: 'Directorio de clínicas, farmacias y profesionales aliados de OptiBienestar 360.',
})

const publicAllies = usePublicAllies()

// ---- Listado + filtros ----
const data = ref<PublicAllyDto[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1) // UPagination es 1-based; la API es 0-based
const size = ref(12)
const search = ref('')
const cityUuid = ref<string | undefined>(undefined)
const specialtyUuid = ref<string | undefined>(undefined)

async function load() {
  loading.value = true
  try {
    const res = await publicAllies.list({
      page: page.value - 1,
      size: size.value,
      q: search.value.trim() || undefined,
      cityUuid: cityUuid.value,
      specialtyUuid: specialtyUuid.value,
    })
    data.value = res.content ?? []
    total.value = res.totalElements ?? 0
  }
  catch {
    // useApi ya muestra el toast del error
    data.value = []
    total.value = 0
  }
  finally {
    loading.value = false
  }
}

watch(page, load)
watch([cityUuid, specialtyUuid], () => {
  page.value = 1
  load()
})
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    load()
  }, 400)
})

// ---- Catálogos para los filtros ----
type Option = { label: string, value: string }
const specialtyOptions = ref<Option[]>([])
const stateOptions = ref<Option[]>([])
const cityOptions = ref<Option[]>([])

function toOptions(items: CatalogItem[]): Option[] {
  return items
    .filter(i => i.active !== false)
    .map(i => ({ label: i.name, value: i.uuid }))
}

async function loadCatalogs() {
  const safeList = async (resource: string, query?: Record<string, string>) => {
    try {
      return await usePublicCatalog(resource).list({ size: '-1', ...query })
    }
    catch {
      return [] as CatalogItem[]
    }
  }
  const [specialties, states] = await Promise.all([
    safeList('medical-specialties'),
    safeList('states', { country: 'VE' }),
  ])
  specialtyOptions.value = toOptions(specialties)
  stateOptions.value = toOptions(states)
}

// Ciudades en cascada según el estado seleccionado.
const selectedStateUuid = ref<string | undefined>(undefined)
watch(selectedStateUuid, async (stateUuid) => {
  cityOptions.value = []
  cityUuid.value = undefined
  if (!stateUuid) return
  try {
    const cities = await usePublicCatalog('cities').list({ stateUuid, size: '-1' })
    cityOptions.value = toOptions(cities)
  }
  catch {
    cityOptions.value = []
  }
})

function clearFilters() {
  search.value = ''
  selectedStateUuid.value = undefined
  cityUuid.value = undefined
  specialtyUuid.value = undefined
}

const hasFilters = computed(() =>
  Boolean(search.value.trim() || selectedStateUuid.value || cityUuid.value || specialtyUuid.value),
)

onMounted(async () => {
  await Promise.all([load(), loadCatalogs()])
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
          <UIcon name="i-lucide-handshake" class="w-4 h-4 text-lime-300" />
          Red de aliados
        </div>
        <h1 class="text-3xl md:text-5xl font-extrabold leading-tight tracking-tight max-w-2xl">
          Encuentra tu centro de atención
          <span class="text-lime-300">más cercano.</span>
        </h1>
        <p class="mt-4 text-prohealth-100/90 max-w-xl">
          Clínicas, farmacias y profesionales con atención preferencial para afiliados de OptiBienestar 360.
        </p>
      </div>
    </section>

    <!-- Filtros -->
    <section class="max-w-7xl mx-auto px-6 lg:px-10 -mt-8 relative z-10">
      <div class="bg-white rounded-2xl border border-prohealth-100 shadow-sm p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <UInput
          v-model="search"
          placeholder="Buscar por nombre…"
          icon="i-lucide-search"
          size="lg"
        />
        <USelectMenu
          v-model="selectedStateUuid"
          :items="stateOptions"
          label-key="label"
          value-key="value"
          placeholder="Estado"
          size="lg"
        />
        <USelectMenu
          v-model="cityUuid"
          :items="cityOptions"
          label-key="label"
          value-key="value"
          :disabled="!selectedStateUuid"
          placeholder="Ciudad"
          size="lg"
        />
        <div class="flex items-center gap-2">
          <USelectMenu
            v-model="specialtyUuid"
            :items="specialtyOptions"
            label-key="label"
            value-key="value"
            placeholder="Especialidad"
            size="lg"
            class="flex-1"
          />
          <UTooltip v-if="hasFilters" text="Limpiar filtros">
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-x"
              size="lg"
              square
              @click="clearFilters"
            />
          </UTooltip>
        </div>
      </div>
    </section>

    <!-- Resultados -->
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

      <!-- Vacío -->
      <div v-else-if="data.length === 0" class="bg-white rounded-2xl border border-prohealth-100 py-16 text-center">
        <UIcon name="i-lucide-search-x" class="w-10 h-10 mx-auto mb-3 text-prohealth-300" />
        <p class="text-prohealth-700 font-semibold">No encontramos aliados</p>
        <p class="text-sm text-prohealth-500 mt-1">Prueba con otros filtros o términos de búsqueda.</p>
        <UButton v-if="hasFilters" color="primary" variant="soft" size="sm" class="mt-4" @click="clearFilters">
          Limpiar filtros
        </UButton>
      </div>

      <!-- Grid de aliados -->
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <NuxtLink
          v-for="a in data"
          :key="a.uuid"
          :to="`/aliados/${a.uuid}`"
          class="group bg-white rounded-2xl border border-prohealth-100 p-5 hover:border-cyan-300 hover:shadow-md transition-all"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <h3 class="font-bold text-prohealth-900 group-hover:text-cyan-700 transition-colors truncate">
                {{ a.name }}
              </h3>
              <p class="text-xs text-prohealth-500 mt-0.5">
                {{ a.allyType?.name || 'Aliado' }}
                <template v-if="a.city?.name"> · {{ a.city.name }}</template>
              </p>
            </div>
            <span class="shrink-0 w-10 h-10 rounded-xl bg-cyan-50 grid place-items-center">
              <UIcon name="i-lucide-handshake" class="w-5 h-5 text-cyan-600" />
            </span>
          </div>

          <p v-if="a.description" class="text-sm text-prohealth-600 mt-3 line-clamp-2">
            {{ a.description }}
          </p>

          <div v-if="a.specialties?.length" class="flex flex-wrap gap-1.5 mt-4">
            <UBadge
              v-for="s in a.specialties.slice(0, 3)"
              :key="s.uuid"
              color="primary"
              variant="subtle"
              size="sm"
            >
              {{ s.name }}
            </UBadge>
            <UBadge v-if="a.specialties.length > 3" color="neutral" variant="subtle" size="sm">
              +{{ a.specialties.length - 3 }}
            </UBadge>
          </div>

          <div class="flex items-center gap-1 mt-4 text-sm font-medium text-cyan-700">
            Ver detalle
            <UIcon name="i-lucide-arrow-right" class="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </NuxtLink>
      </div>

      <!-- Paginación -->
      <div v-if="total > size" class="flex justify-center mt-8">
        <UPagination
          v-model:page="page"
          :total="total"
          :items-per-page="size"
        />
      </div>
    </section>
  </div>
</template>
