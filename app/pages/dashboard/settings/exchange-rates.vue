<script setup lang="ts">
import { buildPageSizeItems, DEFAULT_PAGE_SIZE, UNPAGED_PAGE_SIZE } from '~/utils/pagination'
import type { ExchangeRateDto, ExchangeRateSource, IngestionSummaryDto } from '~/types/currencies'
import { EXCHANGE_RATE_SOURCE_OPTIONS } from '~/types/currencies'
import type { SortDirection } from '~/composables/useTableSort'

definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'EXCHANGE_RATE_VIEW_ALL',
})

const { t } = useI18n()
const { formatDate } = useFormatters()

useSeoMeta({ title: () => t('common.seoTitle', { page: t('nav.items.exchangeRates.label') }) })

const exchangeRates = useExchangeRates()
const { can } = usePermissions()
const toast = useToast()

const canCreate = computed(() => can('EXCHANGE_RATE_CREATE'))
const canUpdate = computed(() => can('EXCHANGE_RATE_UPDATE'))
const canDelete = computed(() => can('EXCHANGE_RATE_DELETE'))

// ---- List + pagination + filters ----
const data = ref<ExchangeRateDto[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1) // UPagination is 1-based; the API is 0-based
const size = ref(DEFAULT_PAGE_SIZE)
const pageSizeItems = buildPageSizeItems(t)
const base = ref('')
const quote = ref('')
// Empty by default: no `sort=` is sent until the user clicks a column, so the
// backend's own default (validFrom DESC) applies.
const sort = useTableSort([])
const hasActiveSort = computed(() => sort.hasActiveSort.value)
const isMultiSort = computed(() => sort.orders.value.length > 1)

async function load() {
  loading.value = true
  try {
    const res = await exchangeRates.list({
      page: page.value - 1,
      size: size.value,
      sort: sort.sortParam.value,
      base: base.value.trim().toUpperCase() || undefined,
      quote: quote.value.trim().toUpperCase() || undefined,
    })
    data.value = res.content ?? []
    total.value = res.totalElements ?? 0
    if (sort.orders.value.length === 0 && res.appliedSort?.length) {
      resetting.value = true
      sort.seedServerDefault(res.appliedSort.map(o => ({ field: o.field, direction: o.direction.toLowerCase() as SortDirection })))
      await nextTick()
      resetting.value = false
    }
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

// Guards the filter watchers so "clear filters and refresh" fires a single reload.
const resetting = ref(false)

watch(size, () => { if (!resetting.value) page.value = 1 })
watch([page, size], () => { if (!resetting.value) load() })
let filterTimer: ReturnType<typeof setTimeout> | undefined
watch([base, quote], () => {
  if (resetting.value) return
  clearTimeout(filterTimer)
  filterTimer = setTimeout(() => {
    page.value = 1
    load()
  }, 400)
})
watch(sort.orders, () => { if (!resetting.value) load() }, { deep: true })

async function resetFilters() {
  resetting.value = true
  base.value = ''
  quote.value = ''
  sort.reset()
  size.value = DEFAULT_PAGE_SIZE
  page.value = 1
  await nextTick()
  resetting.value = false
  load()
}

onMounted(load)

// ---- Presentation helpers ----
function sourceColor(sourceValue: ExchangeRateSource): 'neutral' | 'info' | 'success' {
  return sourceValue === 'MANUAL' ? 'info' : 'neutral'
}

function sourceLabel(sourceValue: ExchangeRateSource): string {
  const opt = EXCHANGE_RATE_SOURCE_OPTIONS.find(o => o.value === sourceValue)
  return t(`exchangeRates.source.${sourceValue}`, opt?.label ?? sourceValue)
}

// ---- "Actualizar ahora" (fetch-latest quick action) ----
const fetching = ref(false)

async function fetchLatest() {
  fetching.value = true
  try {
    const summary: IngestionSummaryDto = await exchangeRates.fetchLatest()
    const fetched = summary.currencies.filter(c => c.status === 'FETCHED').length
    const failed = summary.currencies.filter(c => c.status === 'FETCH_FAILED' || c.status === 'PARSE_FAILED').length
    if (failed === 0) {
      toast.add({ title: t('exchangeRates.fetchLatest.successToast', { count: fetched }), color: 'success', icon: 'i-lucide-check-circle' })
    }
    else {
      toast.add({ title: t('exchangeRates.fetchLatest.partialToast', { fetched, failed }), color: 'warning', icon: 'i-lucide-alert-triangle' })
    }
    page.value = 1
    await load()
  }
  catch {
    // useApi already shows the error toast
  }
  finally {
    fetching.value = false
  }
}

// ---- Create/edit (shared modal) ----
const formOpen = ref(false)
const editingRate = ref<ExchangeRateDto | null>(null)

function openCreate() {
  editingRate.value = null
  formOpen.value = true
}

function openEdit(r: ExchangeRateDto) {
  editingRate.value = r
  formOpen.value = true
}

async function onSaved() {
  await load()
}

// ---- Delete ----
const deleteOpen = ref(false)
const deleting = ref(false)
const target = ref<ExchangeRateDto | null>(null)

function openDelete(r: ExchangeRateDto) {
  target.value = r
  deleteOpen.value = true
}

async function confirmDelete() {
  if (!target.value) return
  deleting.value = true
  try {
    await exchangeRates.remove(target.value.uuid)
    toast.add({ title: t('exchangeRates.deletedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    deleteOpen.value = false
    // If the page is left empty after deleting, step back one.
    if (data.value.length === 1 && page.value > 1) page.value -= 1
    else await load()
  }
  catch {
    // toast handled by useApi
  }
  finally {
    deleting.value = false
  }
}
</script>

<template>
  <div class="space-y-5">
    <!-- Header -->
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-extrabold text-prohealth-900">{{ t('exchangeRates.title') }}</h1>
        <p class="text-sm text-prohealth-700/70 mt-1">
          {{ t('exchangeRates.subtitle') }}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <ListRefreshMenu :loading="loading" variant="ghost" @refresh="load" @reset="resetFilters" />
        <UTooltip :text="canCreate ? t('exchangeRates.fetchLatest.button') : t('exchangeRates.noPermissionCreate')">
          <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-refresh-cw"
            :loading="fetching"
            :disabled="!canCreate"
            @click="fetchLatest"
          >
            {{ t('exchangeRates.fetchLatest.button') }}
          </UButton>
        </UTooltip>
        <UTooltip :text="canCreate ? t('exchangeRates.new') : t('exchangeRates.noPermissionCreate')">
          <UButton
            color="primary"
            variant="outline"
            icon="i-lucide-plus"
            :disabled="!canCreate"
            @click="openCreate"
          >
            {{ t('common.new') }}
          </UButton>
        </UTooltip>
      </div>
    </div>

    <!-- Filters -->
    <div class="bg-white rounded-2xl border border-prohealth-100 p-4 flex flex-wrap items-center gap-3">
      <UInput
        v-model="base"
        :placeholder="t('exchangeRates.filters.basePlaceholder')"
        icon="i-lucide-search"
        class="w-32 font-mono uppercase"
      />
      <UInput
        v-model="quote"
        :placeholder="t('exchangeRates.filters.quotePlaceholder')"
        icon="i-lucide-search"
        class="w-32 font-mono uppercase"
      />
      <UButton
        v-if="hasActiveSort"
        variant="link"
        color="neutral"
        size="sm"
        icon="i-lucide-list-restart"
        :title="t('common.clearSortHint')"
        @click="sort.reset()"
      >
        {{ t('common.clearSort') }}
      </UButton>
    </div>

    <!-- Table -->
    <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden flex flex-col h-[calc(100vh-19rem)] min-h-[24rem]">
      <div class="overflow-auto flex-1">
        <table class="w-full text-sm">
          <thead class="sticky top-0 bg-white z-10">
            <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
              <th class="px-5 py-3 font-semibold">{{ t('exchangeRates.columns.pair') }}</th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('rate')">
                {{ t('exchangeRates.columns.rate') }}
                <SortIndicator :state="sort.stateOf('rate')" :multi-active="isMultiSort" @clear="sort.remove('rate')" />
              </th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('operationDate')">
                {{ t('exchangeRates.columns.operationDate') }}
                <SortIndicator :state="sort.stateOf('operationDate')" :multi-active="isMultiSort" @clear="sort.remove('operationDate')" />
              </th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('validFrom')">
                {{ t('exchangeRates.columns.validFrom') }}
                <SortIndicator :state="sort.stateOf('validFrom')" :multi-active="isMultiSort" @clear="sort.remove('validFrom')" />
              </th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('source')">
                {{ t('exchangeRates.columns.source') }}
                <SortIndicator :state="sort.stateOf('source')" :multi-active="isMultiSort" @clear="sort.remove('source')" />
              </th>
              <th class="px-5 py-3 font-semibold text-right">{{ t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-prohealth-100">
            <TableSkeleton v-if="loading" :rows="8" :cols="6" />
            <tr v-else-if="data.length === 0">
              <td colspan="6" class="px-5 py-12 text-center text-prohealth-500">
                <UIcon name="i-lucide-banknote" class="w-8 h-8 mx-auto mb-2 text-prohealth-300" />
                {{ t('exchangeRates.empty') }}
              </td>
            </tr>
            <tr
              v-for="r in data"
              v-else
              :key="r.uuid"
              class="hover:bg-prohealth-50/50"
              :class="{ 'opacity-60': !r.active }"
            >
              <td class="px-5 py-3">
                <span class="font-mono font-semibold text-prohealth-900">{{ r.baseCurrency_Code }} → {{ r.quoteCurrency_Code }}</span>
              </td>
              <td class="px-5 py-3 font-mono text-prohealth-800">{{ r.rate_Display ?? r.rate }}</td>
              <td class="px-5 py-3 text-prohealth-700">{{ r.operationDate_Display ?? formatDate(r.operationDate, 'short') }}</td>
              <td class="px-5 py-3 text-prohealth-700">{{ r.validFrom_Display ?? formatDate(r.validFrom, 'datetime') }}</td>
              <td class="px-5 py-3">
                <UBadge :color="sourceColor(r.source)" variant="subtle" size="sm">
                  {{ r.source_Display ?? sourceLabel(r.source) }}
                </UBadge>
              </td>
              <td class="px-5 py-3">
                <div class="flex items-center justify-end gap-1">
                  <template v-if="r.source === 'MANUAL'">
                    <UTooltip :text="canUpdate ? t('common.edit') : t('exchangeRates.noPermissionUpdate')">
                      <UButton
                        color="info"
                        variant="ghost"
                        icon="i-lucide-pencil"
                        size="sm"
                        :disabled="!canUpdate"
                        @click="openEdit(r)"
                      />
                    </UTooltip>
                    <UTooltip :text="canDelete ? t('common.delete') : t('exchangeRates.noPermissionDelete')">
                      <UButton
                        color="error"
                        variant="ghost"
                        icon="i-lucide-trash-2"
                        size="sm"
                        :disabled="!canDelete"
                        @click="openDelete(r)"
                      />
                    </UTooltip>
                  </template>
                  <span v-else class="text-xs text-prohealth-300">{{ t('exchangeRates.immutable') }}</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="flex items-center flex-wrap justify-between gap-3 px-5 py-3 border-t border-prohealth-100 shrink-0">
        <p class="text-xs text-prohealth-500">
          {{ t('exchangeRates.paginationSummary', { shown: data.length, total }) }}
        </p>
        <div class="flex items-center gap-3">
          <UPagination
            v-if="size !== UNPAGED_PAGE_SIZE"
            v-model:page="page"
            :total="total"
            :items-per-page="size"
          />
          <UTooltip :text="$t('catalogs.pageSizeLabel')">
            <USelectMenu
              v-model="size"
              :items="pageSizeItems"
              label-key="label"
              value-key="value"
              icon="i-lucide-list"
              :search-input="false"
              :aria-label="$t('catalogs.pageSizeLabel')"
              class="w-40"
            />
          </UTooltip>
        </div>
      </div>
    </div>

    <!-- Create/edit modal -->
    <ExchangeRateFormModal v-model:open="formOpen" :rate="editingRate" @saved="onSaved" />

    <!-- Delete confirmation modal -->
    <UModal v-model:open="deleteOpen" :title="t('exchangeRates.deleteTitle')">
      <template #body>
        <p class="text-sm text-prohealth-700">
          {{ t('exchangeRates.deleteConfirm', {
            pair: target ? `${target.baseCurrency_Code} → ${target.quoteCurrency_Code}` : '',
          }) }}
        </p>
        <div class="flex items-center justify-end gap-3 pt-5">
          <UButton color="neutral" variant="ghost" :disabled="deleting" @click="deleteOpen = false">
            {{ t('common.cancel') }}
          </UButton>
          <UButton color="error" :loading="deleting" icon="i-lucide-trash-2" @click="confirmDelete">
            {{ t('common.delete') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
