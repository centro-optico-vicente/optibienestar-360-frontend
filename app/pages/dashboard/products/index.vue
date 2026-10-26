<script setup lang="ts">
import { buildPageSizeItems, DEFAULT_PAGE_SIZE, UNPAGED_PAGE_SIZE } from '~/utils/pagination'
import type { SelectItem } from '~/types/options'
import type { SortDirection } from '~/composables/useTableSort'
import {
  PRODUCT_TYPE_OPTIONS,
  type ProductDto,
  type ProductListItemDto,
  type ProductType,
} from '~/types/products'

// Products catalog master (hub ADR 0026): what the allies can offer. A GENERAL
// product (no owner ally) can be offered by any ally; an EXCLUSIVE one only by
// its owner. Each ally's price/discount lives in its offer (ally detail →
// "Productos y servicios"); the detail modal lists every ally offering it.
type ProductRow = ProductListItemDto | ProductDto

definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'PRODUCT_VIEW_ALL',
})

const { t } = useI18n()

useSeoMeta({ title: () => t('common.seoTitle', { page: t('products.title') }) })

const productsApi = useProducts()
const { can } = usePermissions()
const toast = useToast()

const canCreate = computed(() => can('PRODUCT_CREATE'))
const canUpdate = computed(() => can('PRODUCT_UPDATE'))
const canDelete = computed(() => can('PRODUCT_DELETE'))
const canViewAuditChanges = computed(() => can('AUDIT_VIEW_ALL') || can('PRODUCT_RECORD_AUDIT_VIEW'))
const canViewAuditReports = computed(() => can('REPORT_AUDIT_VIEW_ALL') || can('PRODUCT_REPORT_AUDIT_VIEW'))
const canViewAudit = computed(() => canViewAuditChanges.value || canViewAuditReports.value)

// ---- Filters ----
const typeOptions = computed(() => PRODUCT_TYPE_OPTIONS.map(o => ({ label: t(o.labelKey), value: o.value })))
const scopeOptions = computed(() => [
  { label: t('products.filters.general'), value: 'general' },
  { label: t('products.filters.exclusive'), value: 'exclusive' },
])
const categoryOptions = ref<SelectItem[]>([])

async function loadCategories() {
  try {
    const items = await usePublicCatalog('product-categories').list()
    categoryOptions.value = items.map(i => ({ label: i.name, value: i.uuid }))
  }
  catch {
    categoryOptions.value = []
  }
}

// ---- List + pagination + search ----
const data = ref<ProductListItemDto[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1) // UPagination is 1-based; the API is 0-based
const size = ref(DEFAULT_PAGE_SIZE)
const pageSizeItems = buildPageSizeItems(t)
const search = ref('')
const typeFilter = ref<ProductType | undefined>(undefined)
const categoryFilter = ref<string | undefined>(undefined)
const scopeFilter = ref<'general' | 'exclusive' | undefined>(undefined)
const publishedFilter = ref<'yes' | 'no' | undefined>(undefined)
const publishedOptions = computed(() => [
  { label: t('products.filters.published'), value: 'yes' },
  { label: t('products.filters.unpublished'), value: 'no' },
])

/** RSQL `filter` from the filters without a dedicated query param (allowed fields only). */
function buildFilter(): string | undefined {
  const parts: string[] = []
  if (categoryFilter.value) parts.push(`productCategory.uuid==${categoryFilter.value}`)
  if (publishedFilter.value) parts.push(`published==${publishedFilter.value === 'yes'}`)
  return parts.length ? parts.join(';') : undefined
}
const includeInactive = ref(false)
const sort = useTableSort([])
const hasActiveSort = computed(() => sort.hasActiveSort.value)
const isMultiSort = computed(() => sort.orders.value.length > 1)
// Set while several refs change at once, so their watchers don't each reload.
const resetting = ref(false)

async function load() {
  loading.value = true
  try {
    const res = await productsApi.list({
      page: page.value - 1,
      size: size.value,
      sort: sort.sortParam.value,
      q: search.value.trim() || undefined,
      type: typeFilter.value,
      exclusive: scopeFilter.value ? scopeFilter.value === 'exclusive' : undefined,
      filter: buildFilter(),
      includeInactive: includeInactive.value,
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
    data.value = []
    total.value = 0
  }
  finally {
    loading.value = false
  }
}

function reloadFromFirstPage() {
  if (resetting.value) return
  if (page.value !== 1) page.value = 1
  else load()
}

watch(size, () => { if (!resetting.value) page.value = 1 })
watch([page, size], () => { if (!resetting.value) load() })
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, () => {
  if (resetting.value) return
  clearTimeout(searchTimer)
  searchTimer = setTimeout(reloadFromFirstPage, 400)
})
watch([typeFilter, categoryFilter, scopeFilter, publishedFilter, includeInactive], reloadFromFirstPage)
watch(sort.orders, () => { if (!resetting.value) load() }, { deep: true })

async function resetFilters() {
  resetting.value = true
  search.value = ''
  typeFilter.value = undefined
  categoryFilter.value = undefined
  scopeFilter.value = undefined
  publishedFilter.value = undefined
  includeInactive.value = false
  sort.reset()
  size.value = DEFAULT_PAGE_SIZE
  page.value = 1
  await nextTick()
  resetting.value = false
  load()
}

function typeLabel(p: ProductRow): string {
  return p.productType_Display ?? t(`products.types.${p.productType}`, String(p.productType))
}

// ---- Detail (data, image, allies that offer it) ----
const detailOpen = ref(false)
const detailUuid = ref<string | null>(null)

function openDetail(p: { uuid: string }) {
  detailUuid.value = p.uuid
  detailOpen.value = true
}

// ---- Create / edit (ProductFormModal loads the detail by uuid) ----
const formOpen = ref(false)
const mode = ref<'create' | 'edit'>('create')
const editingUuid = ref<string | null>(null)

function openCreate() {
  mode.value = 'create'
  editingUuid.value = null
  formOpen.value = true
}

function openEdit(uuid: string) {
  mode.value = 'edit'
  editingUuid.value = uuid
  formOpen.value = true
}

// ---- Delete (soft) ----
const deleteOpen = ref(false)
const deleting = ref(false)
const target = ref<ProductRow | null>(null)

function openDelete(p: ProductRow) {
  target.value = p
  deleteOpen.value = true
}

async function confirmDelete() {
  if (!target.value) return
  deleting.value = true
  try {
    await productsApi.remove(target.value.uuid)
    toast.add({ title: t('products.deletedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    deleteOpen.value = false
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

// ---- Audit ----
const auditOpen = ref(false)
const auditTarget = ref<ProductRow | null>(null)

function openAudit(p: ProductRow) {
  auditTarget.value = p
  auditOpen.value = true
}

// Deep links: `?view=<uuid>` (audit quick-link) and `?edit=<uuid>`.
const route = useRoute()
const router = useRouter()
async function openFromQuery() {
  const viewUuid = route.query.view as string | undefined
  const editUuid = route.query.edit as string | undefined
  if (!viewUuid && !editUuid) return
  await router.replace({ query: {} })
  if (editUuid) openEdit(editUuid)
  else if (viewUuid) openDetail({ uuid: viewUuid })
}

onMounted(async () => {
  loadCategories()
  await load()
  await openFromQuery()
})
</script>

<template>
  <div class="space-y-5">
    <!-- Header -->
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-extrabold text-prohealth-900">{{ t('products.title') }}</h1>
        <p class="text-sm text-prohealth-700/70 mt-1">{{ t('products.subtitle') }}</p>
      </div>
      <div class="flex items-center gap-2">
        <ListRefreshMenu variant="ghost" :loading="loading" @refresh="load" @reset="resetFilters" />
        <UTooltip :text="canCreate ? t('products.createTooltip') : t('products.noPermission')">
          <UButton
            color="primary"
            variant="outline"
            icon="i-lucide-plus"
            :disabled="!canCreate"
            @click="openCreate"
          >
            {{ t('products.new') }}
          </UButton>
        </UTooltip>
      </div>
    </div>

    <!-- Search + filters -->
    <div class="bg-white rounded-2xl border border-prohealth-100 p-4 flex flex-wrap items-center gap-3">
      <UInput
        v-model="search"
        :placeholder="t('products.searchPlaceholder')"
        icon="i-lucide-search"
        size="lg"
        class="w-full max-w-md"
      />
      <USelectMenu
        clear
        v-model="typeFilter"
        :items="typeOptions"
        label-key="label"
        value-key="value"
        :search-input="false"
        :placeholder="t('products.filters.allTypes')"
        class="w-40"
      />
      <USelectMenu
        clear
        v-model="categoryFilter"
        :items="categoryOptions"
        label-key="label"
        value-key="value"
        :placeholder="t('products.filters.allCategories')"
        class="w-56"
      />
      <USelectMenu
        clear
        v-model="scopeFilter"
        :items="scopeOptions"
        label-key="label"
        value-key="value"
        :search-input="false"
        :placeholder="t('products.filters.allScopes')"
        class="w-48"
      />
      <USelectMenu
        clear
        v-model="publishedFilter"
        :items="publishedOptions"
        label-key="label"
        value-key="value"
        :search-input="false"
        :placeholder="t('products.filters.allPublication')"
        class="w-52"
      />
      <UCheckbox v-model="includeInactive" :label="$t('catalogs.includeInactive')" class="self-center" />
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
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('name')">
                {{ t('products.columns.name') }}
                <SortIndicator :state="sort.stateOf('name')" :multi-active="isMultiSort" @clear="sort.remove('name')" />
              </th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('productType')">
                {{ t('products.columns.type') }}
                <SortIndicator :state="sort.stateOf('productType')" :multi-active="isMultiSort" @clear="sort.remove('productType')" />
              </th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('productCategory_Display')">
                {{ t('products.columns.category') }}
                <SortIndicator :state="sort.stateOf('productCategory_Display')" :multi-active="isMultiSort" @clear="sort.remove('productCategory_Display')" />
              </th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('ownerAlly_Display')">
                {{ t('products.columns.scope') }}
                <SortIndicator :state="sort.stateOf('ownerAlly_Display')" :multi-active="isMultiSort" @clear="sort.remove('ownerAlly_Display')" />
              </th>
              <th class="px-5 py-3 font-semibold">{{ t('products.columns.appointment') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('products.columns.image') }}</th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('published')">
                {{ t('products.columns.published') }}
                <SortIndicator :state="sort.stateOf('published')" :multi-active="isMultiSort" @clear="sort.remove('published')" />
              </th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('active')">
                {{ t('products.columns.status') }}
                <SortIndicator :state="sort.stateOf('active')" :multi-active="isMultiSort" @clear="sort.remove('active')" />
              </th>
              <th class="px-5 py-3 font-semibold text-right">{{ t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-prohealth-100">
            <TableSkeleton v-if="loading" :rows="8" :cols="9" />
            <tr v-else-if="data.length === 0">
              <td colspan="9" class="px-5 py-12 text-center text-prohealth-500">
                <UIcon name="i-lucide-package-search" class="w-8 h-8 mx-auto mb-2 text-prohealth-300" />
                {{ t('products.empty') }}
              </td>
            </tr>
            <tr
              v-for="p in data"
              v-else
              :key="p.uuid"
              class="hover:bg-prohealth-50/50 cursor-pointer"
              @click="openDetail(p)"
            >
              <td class="px-5 py-3">
                <div class="font-semibold text-prohealth-900">{{ p.name }}</div>
                <div v-if="p.code" class="text-xs text-prohealth-500">{{ p.code }}</div>
              </td>
              <td class="px-5 py-3 text-prohealth-700">{{ typeLabel(p) }}</td>
              <td class="px-5 py-3 text-prohealth-700">{{ p.productCategory_Display ?? t('common.empty') }}</td>
              <td class="px-5 py-3">
                <UBadge v-if="p.exclusive" color="info" variant="subtle" size="sm">
                  {{ t('products.scope.exclusiveOf', { ally: p.ownerAlly_Display ?? t('common.empty') }) }}
                </UBadge>
                <UBadge v-else color="neutral" variant="subtle" size="sm">{{ t('products.scope.general') }}</UBadge>
              </td>
              <td class="px-5 py-3">
                <UIcon
                  :name="p.requiresAppointment ? 'i-lucide-calendar-check' : 'i-lucide-minus'"
                  class="w-4 h-4"
                  :class="p.requiresAppointment ? 'text-cyan-600' : 'text-prohealth-300'"
                />
              </td>
              <td class="px-5 py-3">
                <img v-if="p.imageUrl" :src="p.imageUrl" :alt="p.name" class="w-9 h-9 rounded-lg object-cover border border-prohealth-100">
                <UIcon v-else name="i-lucide-image-off" class="w-4 h-4 text-prohealth-300" />
              </td>
              <td class="px-5 py-3">
                <UBadge :color="p.published ? 'success' : 'neutral'" variant="subtle" size="sm" :title="t('products.form.publishedHelp')">
                  {{ p.published_Display ?? (p.published ? t('common.yes') : t('common.no')) }}
                </UBadge>
              </td>
              <td class="px-5 py-3">
                <UBadge :color="p.active ? 'success' : 'neutral'" variant="subtle" size="sm">
                  {{ p.active ? t('products.active') : t('products.inactive') }}
                </UBadge>
              </td>
              <td class="px-5 py-3" @click.stop>
                <div class="flex items-center justify-end gap-1">
                  <UTooltip :text="t('products.viewTooltip')">
                    <UButton color="neutral" variant="ghost" icon="i-lucide-eye" size="sm" @click="openDetail(p)" />
                  </UTooltip>
                  <UTooltip :text="canUpdate ? t('common.edit') : t('products.noPermission')">
                    <UButton
                      color="info"
                      variant="ghost"
                      icon="i-lucide-pencil"
                      size="sm"
                      :disabled="!canUpdate"
                      @click="openEdit(p.uuid)"
                    />
                  </UTooltip>
                  <UTooltip v-if="canViewAudit" :text="t('audit.trigger')">
                    <UButton color="neutral" variant="ghost" icon="i-lucide-history" size="sm" @click="openAudit(p)" />
                  </UTooltip>
                  <UTooltip :text="canDelete ? t('common.delete') : t('products.noPermission')">
                    <UButton
                      color="error"
                      variant="ghost"
                      icon="i-lucide-trash-2"
                      size="sm"
                      class="ms-2"
                      :disabled="!canDelete || !p.active"
                      @click="openDelete(p)"
                    />
                  </UTooltip>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="flex items-center flex-wrap justify-between gap-3 px-5 py-3 border-t border-prohealth-100 shrink-0">
        <p class="text-xs text-prohealth-500">
          {{ t('products.paginationSummary', { shown: data.length, total }) }}
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

    <ProductDetailModal
      v-model:open="detailOpen"
      :product-uuid="detailUuid"
      @changed="load"
      @edit-requested="openEdit"
    />

    <ProductFormModal
      v-model:open="formOpen"
      :mode="mode"
      :product-uuid="editingUuid"
      :can-delete="canDelete"
      @saved="load"
      @delete-requested="openDelete"
    />

    <!-- Delete confirmation -->
    <UModal v-model:open="deleteOpen" :title="t('products.delete.title')">
      <template #body>
        <i18n-t keypath="products.delete.confirm" tag="p" class="text-sm text-prohealth-700" scope="global">
          <template #name>
            <span class="font-semibold">{{ target?.name }}</span>
          </template>
        </i18n-t>
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

    <AuditModal
      v-if="auditTarget"
      v-model:open="auditOpen"
      entity-key="product"
      :entity-uuid="auditTarget.uuid"
      :entity-label="auditTarget.name"
      :can-view-changes="canViewAuditChanges"
      :can-view-reports="canViewAuditReports"
    />
  </div>
</template>
