<script setup lang="ts">
import { buildPageSizeItems, DEFAULT_PAGE_SIZE, UNPAGED_PAGE_SIZE } from '~/utils/pagination'
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { SelectItem } from '~/types/options'
import { toSelectItems } from '~/types/options'
import type {
  AllyDto,
  AllyListItemDto,
  CreateAllyRequest,
  UpdateAllyRequest,
} from '~/types/allies'
import type { SortDirection } from '~/composables/useTableSort'

// The admin table renders AllyListItemDto rows; openEdit / openDelete are also
// reachable from openFromQuery with a full AllyDto loaded by GET /{uuid}.
type AllyRow = AllyListItemDto | AllyDto

definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'ALLY_VIEW_ALL',
})

const { t } = useI18n()

useSeoMeta({ title: () => t('common.seoTitle', { page: t('allies.title') }) })

const allies = useAllies()
const { can } = usePermissions()
const toast = useToast()

const canCreate = computed(() => can('ALLY_CREATE'))
const canUpdate = computed(() => can('ALLY_UPDATE'))
const canDelete = computed(() => can('ALLY_DELETE'))
const canViewAuditChanges = computed(() => can('AUDIT_VIEW_ALL') || can('ALLY_RECORD_AUDIT_VIEW'))
const canViewAuditReports = computed(() => can('REPORT_AUDIT_VIEW_ALL') || can('ALLY_REPORT_AUDIT_VIEW'))
const canViewAudit = computed(() => canViewAuditChanges.value || canViewAuditReports.value)

const auditOpen = ref(false)
const auditTarget = ref<AllyRow | null>(null)

function openAudit(a: AllyRow) {
  auditTarget.value = a
  auditOpen.value = true
}

// ---- List + pagination + search ----
const data = ref<AllyListItemDto[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1) // UPagination is 1-based; the API is 0-based
const size = ref(DEFAULT_PAGE_SIZE)
const pageSizeItems = buildPageSizeItems(t)
const search = ref('')
const includeInactive = ref(false)
// Empty by default: no `sort=` is sent until the user clicks a column, so the
// backend's own default-sort fallback (entity_config → system_configs →
// createdAt DESC) applies. A pre-loaded entry here would never clear — this
// table has no "Creado" header to toggle it off — so it would silently stick
// as a phantom secondary sort behind whatever column the user picks.
const sort = useTableSort([])
const hasActiveSort = computed(() => sort.hasActiveSort.value)
const isMultiSort = computed(() => sort.orders.value.length > 1)

async function load() {
  loading.value = true
  try {
    const res = await allies.list({
      page: page.value - 1,
      size: size.value,
      sort: sort.sortParam.value,
      q: search.value.trim() || undefined,
      includeInactive: includeInactive.value,
    })
    data.value = res.content ?? []
    total.value = res.totalElements ?? 0
    // No column clicked yet → reflect the server's own default (entity_config
    // → system_configs → createdAt DESC) in the header arrows, so the table
    // never looks "unsorted" when it actually isn't. Guarded by `resetting`
    // so this assignment doesn't re-trigger `watch(sort.orders, ...)` below —
    // once populated, sort.orders is non-empty and this branch simply stops
    // running, so a later user click is never overwritten by it.
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

// Set while resetFilters() clears several refs at once, so their watchers don't
// each fire a redundant load() before the single explicit one.
const resetting = ref(false)

watch(size, () => { if (!resetting.value) page.value = 1 })
watch([page, size], () => { if (!resetting.value) load() })
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, () => {
  if (resetting.value) return
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    load()
  }, 400)
})
watch(includeInactive, () => { if (!resetting.value) { page.value = 1; load() } })
watch(sort.orders, () => { if (!resetting.value) load() }, { deep: true })

// "Limpiar filtros y actualizar" from the list refresh menu.
async function resetFilters() {
  resetting.value = true
  search.value = ''
  includeInactive.value = false
  sort.reset()
  size.value = DEFAULT_PAGE_SIZE
  page.value = 1
  await nextTick()
  resetting.value = false
  load()
}

// Partner status badge/select label; falls back to the raw value.
function statusLabel(status?: string | null): string {
  return status ? t(`allies.status.${status}`, status) : t('common.empty')
}

// Effective status label for the table row: `active` (soft-delete flag) wins over the
// business `status` field, so a soft-deleted record always reads "Inactivo" instead of
// whatever business status it happened to have (or "Sin información" when status is null).
function effectiveStatusLabel(a: AllyRow): string {
  if (a.active === false) return t('allies.status.INACTIVE')
  // Prefer the server-resolved `_Display` (ADR 0014); fall back to the local
  // label map for a full AllyDto loaded via GET /{uuid} (no `_Display` there).
  const display = 'status_Display' in a ? a.status_Display : null
  return display ?? (a.status ? statusLabel(a.status) : t('common.empty'))
}

// ---- Catalogs for the form selects ----
const allyTypeOptions = ref<SelectItem[]>([])
const specialtyOptions = ref<SelectItem[]>([])
const stateOptions = ref<SelectItem[]>([])
const cityOptions = ref<SelectItem[]>([])
const { options: documentTypeOptions, load: loadDocumentTypes } = useDocumentTypes()

// Fetched lazily (only when the create/edit form is opened, guarded by this
// flag) rather than on page mount — these selects are only ever seen inside
// that form, so loading them eagerly for every list visit wastes requests.
const catalogsLoaded = ref(false)

async function loadCatalogs() {
  if (catalogsLoaded.value) return
  const safeOptions = async (resource: string, limit = 200) => {
    try {
      return await useCatalogOptions(resource).options({ limit })
    }
    catch {
      return []
    }
  }
  const [types, specialties, states] = await Promise.all([
    safeOptions('ally-types'),
    safeOptions('medical-specialties'),
    safeOptions('states'),
  ])
  allyTypeOptions.value = toSelectItems(types)
  specialtyOptions.value = toSelectItems(specialties)
  stateOptions.value = toSelectItems(states)
  await loadDocumentTypes()
  catalogsLoaded.value = true
}

// Cities cascade based on the selected state. `pendingCityUuid` lets openEdit
// preselect a city once its state's cities finish loading — otherwise the watcher's
// reset below would wipe the value the instant `selectedStateUuid` is set.
const selectedStateUuid = ref<string | undefined>(undefined)
const pendingCityUuid = ref<string | undefined>(undefined)
watch(selectedStateUuid, async (stateUuid) => {
  const keepCityUuid = pendingCityUuid.value
  pendingCityUuid.value = undefined
  cityOptions.value = []
  state.cityUuid = undefined
  if (!stateUuid) return
  try {
    const cities = await useCatalogOptions('cities').options({ parentUuid: stateUuid, limit: 200 })
    cityOptions.value = toSelectItems(cities)
    if (keepCityUuid) state.cityUuid = keepCityUuid
  }
  catch {
    cityOptions.value = []
  }
})

onMounted(async () => {
  await load()
  await openFromQuery()
})

// Lets the ally detail page deep-link into this page's edit/delete modals
// (they have no standalone equivalent on the detail page itself).
const route = useRoute()
const router = useRouter()
async function openFromQuery() {
  const editUuid = route.query.edit as string | undefined
  const deleteUuid = route.query.delete as string | undefined
  const targetUuid = editUuid || deleteUuid
  if (!targetUuid) return
  await router.replace({ query: {} })
  try {
    const full = await allies.get(targetUuid)
    if (editUuid) await openEdit(full)
    else openDelete(full)
  }
  catch {
    // useApi already notified (e.g. 404); nothing else to do.
  }
}

// ---- Create/edit form ----
const formOpen = ref(false)
const mode = ref<'create' | 'edit'>('create')
const editingUuid = ref<string | null>(null)
const editingItem = ref<AllyRow | null>(null)
const isSubmitting = ref(false)
// The list returns a compact projection (AllyListItemDto) with flat fields; on edit
// the full detail is loaded, and this flag shows the loading state in the modal.
const editLoading = ref(false)

const STATUS_OPTIONS = ['ACTIVE', 'INACTIVE', 'SUSPENDED']
const statusOptions = computed(() => STATUS_OPTIONS.map(s => ({ label: statusLabel(s), value: s })))

interface FormState {
  name: string
  allyTypeUuid: string | undefined
  taxDocumentType: string | undefined
  taxDocumentNumber: string
  email: string
  phone: string
  website: string
  address: string
  cityUuid: string | undefined
  description: string
  joinedAt: string
  published: boolean
  status: string
  specialtyUuids: string[]
}

const state = reactive<FormState>({
  name: '',
  allyTypeUuid: undefined,
  taxDocumentType: undefined,
  taxDocumentNumber: '',
  email: '',
  phone: '',
  website: '',
  address: '',
  cityUuid: undefined,
  description: '',
  joinedAt: '',
  published: false,
  status: 'ACTIVE',
  specialtyUuids: [],
})

// Locale-reactive schema so validation messages follow the UI locale.
const schema = computed(() => {
  const base = {
    name: z.string().min(3, t('validation.minChars', { n: 3 })),
    allyTypeUuid: z.string({ message: t('validation.required') }).min(1, t('validation.required')),
    taxDocumentType: z.string().optional(),
    taxDocumentNumber: z.string().regex(/^\d*$/, t('validation.digitsOnly')).optional(),
    email: z.string().email(t('validation.emailInvalid')).optional().or(z.literal('')),
    phone: z.string().optional(),
    website: z.string().url(t('validation.invalidUrl')).optional().or(z.literal('')),
    address: z.string().optional(),
    description: z.string().optional(),
    joinedAt: z.string().optional(),
  }
  return mode.value === 'create' ? z.object(base) : z.object({ ...base, status: z.string() })
})

function resetForm() {
  state.name = ''
  state.allyTypeUuid = undefined
  state.taxDocumentType = undefined
  state.taxDocumentNumber = ''
  state.email = ''
  state.phone = ''
  state.website = ''
  state.address = ''
  state.cityUuid = undefined
  state.description = ''
  state.joinedAt = ''
  state.published = false
  state.status = 'ACTIVE'
  state.specialtyUuids = []
  selectedStateUuid.value = undefined
  pendingCityUuid.value = undefined
}

function openCreate() {
  mode.value = 'create'
  editingUuid.value = null
  resetForm()
  formOpen.value = true
  loadCatalogs()
}

// Serialized snapshot of the edit form right after it was populated from the
// server, used to detect unsaved changes before a manual refresh discards them.
const editSnapshot = ref('')
function snapshotEditState() {
  return JSON.stringify({ ...state, selectedStateUuid: selectedStateUuid.value })
}
const isEditDirty = computed(() => editSnapshot.value !== '' && snapshotEditState() !== editSnapshot.value)
const discardConfirmOpen = ref(false)

// Maps a full AllyDto (GET /{uuid}) into the reactive form state.
function populateEditForm(full: AllyDto) {
  state.name = full.name ?? ''
  state.allyTypeUuid = full.allyType?.uuid
  state.taxDocumentType = full.taxDocumentType || undefined
  state.taxDocumentNumber = full.taxDocumentNumber ?? ''
  state.email = full.email ?? ''
  state.phone = full.phone ?? ''
  state.website = full.website ?? ''
  state.address = full.address ?? ''
  // The city select is populated by a cascade that keys off the selected state; set the
  // state first (from the embedded CityDto's own stateUuid) and stash the city so the
  // cascade watcher can apply it once that state's cities finish loading.
  pendingCityUuid.value = full.city?.uuid
  selectedStateUuid.value = full.city?.state_Uuid ?? undefined
  state.description = full.description ?? ''
  state.joinedAt = full.joinedAt ?? ''
  state.published = full.published ?? false
  state.status = full.status || 'ACTIVE'
  state.specialtyUuids = (full.specialties ?? []).map(s => s.uuid)
  editSnapshot.value = snapshotEditState()
}

async function openEdit(a: AllyRow) {
  mode.value = 'edit'
  editingUuid.value = a.uuid
  editingItem.value = a
  resetForm()
  editSnapshot.value = ''
  formOpen.value = true
  loadCatalogs()
  // The list row (AllyListItemDto) carries flat fields (allyTypeUuid, etc.) and omits
  // email, tax ID, website, specialties…; the form also expects the nested shape
  // (allyType.uuid). The full detail is loaded to populate reliably.
  editLoading.value = true
  try {
    populateEditForm(await allies.get(a.uuid))
  }
  catch {
    // The detail failed to load (useApi already notified); close the modal.
    formOpen.value = false
  }
  finally {
    editLoading.value = false
  }
}

// Re-fetches the ally and repopulates the form, discarding any local edits.
async function reloadEditForm() {
  if (!editingUuid.value) return
  discardConfirmOpen.value = false
  editLoading.value = true
  try {
    populateEditForm(await allies.get(editingUuid.value))
  }
  catch {
    // useApi already notified; keep the modal open with the current values.
  }
  finally {
    editLoading.value = false
  }
}

// "Actualizar" button in the edit modal: confirm first if there are unsaved edits.
function onEditRefresh() {
  if (isEditDirty.value) discardConfirmOpen.value = true
  else reloadEditForm()
}

async function onSubmit(_event: FormSubmitEvent<Record<string, unknown>>) {
  isSubmitting.value = true
  try {
    if (mode.value === 'create') {
      const body: CreateAllyRequest = {
        name: state.name,
        allyTypeUuid: state.allyTypeUuid!,
        taxDocumentType: state.taxDocumentType || undefined,
        taxDocumentNumber: state.taxDocumentNumber || undefined,
        email: state.email || undefined,
        phone: state.phone || undefined,
        website: state.website || undefined,
        address: state.address || undefined,
        cityUuid: state.cityUuid,
        description: state.description || undefined,
        joinedAt: state.joinedAt || undefined,
        published: state.published,
        specialtyUuids: state.specialtyUuids.length ? state.specialtyUuids : undefined,
      }
      await allies.create(body)
      toast.add({ title: t('allies.createdToast'), color: 'success', icon: 'i-lucide-check-circle' })
    }
    else if (editingUuid.value) {
      const body: UpdateAllyRequest = {
        name: state.name,
        allyTypeUuid: state.allyTypeUuid,
        taxDocumentType: state.taxDocumentType || undefined,
        taxDocumentNumber: state.taxDocumentNumber || undefined,
        email: state.email || undefined,
        phone: state.phone || undefined,
        website: state.website || undefined,
        address: state.address || undefined,
        cityUuid: state.cityUuid,
        description: state.description || undefined,
        joinedAt: state.joinedAt || undefined,
        published: state.published,
        status: state.status,
        // Replaces the full specialties set.
        specialtyUuids: state.specialtyUuids,
      }
      await allies.update(editingUuid.value, body)
      toast.add({ title: t('allies.updatedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    }
    formOpen.value = false
    await load()
  }
  catch {
    // useApi already notified the error (409 duplicate tax ID, 422, etc.)
  }
  finally {
    isSubmitting.value = false
  }
}

// ---- Delete ----
const deleteOpen = ref(false)
const deleting = ref(false)
const target = ref<AllyRow | null>(null)

function openDelete(a: AllyRow) {
  target.value = a
  deleteOpen.value = true
}

// Shortcut from the edit modal so the user doesn't have to close it first
// and hunt for the row's trash icon. Closes the edit modal so the two
// dialogs never stack.
function openDeleteFromEdit() {
  if (!editingItem.value) return
  formOpen.value = false
  openDelete(editingItem.value)
}

// ---- Restore (undo soft-delete) ----
const restoring = ref(false)

async function restoreAlly(a: AllyRow) {
  restoring.value = true
  try {
    await allies.restore(a.uuid)
    toast.add({ title: t('allies.restoredToast'), color: 'success', icon: 'i-lucide-check-circle' })
    formOpen.value = false
    await load()
  }
  catch {
    // toast handled by useApi
  }
  finally {
    restoring.value = false
  }
}

async function confirmDelete() {
  if (!target.value) return
  deleting.value = true
  try {
    await allies.remove(target.value.uuid)
    toast.add({ title: t('allies.deletedToast'), color: 'success', icon: 'i-lucide-check-circle' })
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
        <h1 class="text-2xl font-extrabold text-prohealth-900">{{ t('allies.title') }}</h1>
        <p class="text-sm text-prohealth-700/70 mt-1">
          {{ t('allies.subtitle') }}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <ListRefreshMenu variant="ghost" :loading="loading" @refresh="load" @reset="resetFilters" />
        <ReportPrintButton variant="ghost" :search-query="search" :include-inactive="includeInactive" />
        <UTooltip :text="canCreate ? t('allies.createTooltip') : t('allies.noPermissionCreate')">
          <UButton
            color="primary"
            variant="outline"
            icon="i-lucide-plus"
            :disabled="!canCreate"
            @click="openCreate"
          >
            {{ t('allies.new') }}
          </UButton>
        </UTooltip>
      </div>
    </div>

    <!-- Search -->
    <div class="bg-white rounded-2xl border border-prohealth-100 p-4 flex flex-wrap items-center gap-3">
      <UInput
        v-model="search"
        :placeholder="t('allies.searchPlaceholder')"
        icon="i-lucide-search"
        size="lg"
        class="w-full max-w-md"
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
                {{ t('allies.columns.ally') }}
                <SortIndicator :state="sort.stateOf('name')" :multi-active="isMultiSort" @clear="sort.remove('name')" />
              </th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('allyType_Display')">
                {{ t('allies.columns.type') }}
                <SortIndicator :state="sort.stateOf('allyType_Display')" :multi-active="isMultiSort" @clear="sort.remove('allyType_Display')" />
              </th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('taxDocumentNumber')">
                {{ t('allies.columns.taxId') }}
                <SortIndicator :state="sort.stateOf('taxDocumentNumber')" :multi-active="isMultiSort" @clear="sort.remove('taxDocumentNumber')" />
              </th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('city_Display')">
                {{ t('allies.columns.city') }}
                <SortIndicator :state="sort.stateOf('city_Display')" :multi-active="isMultiSort" @clear="sort.remove('city_Display')" />
              </th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('published')">
                {{ t('allies.columns.published') }}
                <SortIndicator :state="sort.stateOf('published')" :multi-active="isMultiSort" @clear="sort.remove('published')" />
              </th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('status')">
                {{ t('allies.columns.status') }}
                <SortIndicator :state="sort.stateOf('status')" :multi-active="isMultiSort" @clear="sort.remove('status')" />
              </th>
              <th class="px-5 py-3 font-semibold text-right">{{ t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-prohealth-100">
            <TableSkeleton v-if="loading" :rows="8" :cols="7" />
            <tr v-else-if="data.length === 0">
              <td colspan="7" class="px-5 py-12 text-center text-prohealth-500">
                <UIcon name="i-lucide-handshake" class="w-8 h-8 mx-auto mb-2 text-prohealth-300" />
                {{ t('allies.empty') }}
              </td>
            </tr>
            <tr
              v-for="a in data"
              v-else
              :key="a.uuid"
              class="hover:bg-prohealth-50/50 cursor-pointer"
              @click="navigateTo(`/dashboard/allies/${a.uuid}`)"
              @dblclick="navigateTo(`/dashboard/allies/${a.uuid}`)"
            >
              <td class="px-5 py-3">
                <div class="font-semibold text-prohealth-900">{{ a.name }}</div>
              </td>
              <td class="px-5 py-3 text-prohealth-700">{{ a.allyType_Display ?? t('common.empty') }}</td>
              <td class="px-5 py-3 text-prohealth-700">
                <span v-if="a.taxDocumentNumber">{{ a.taxDocumentType }}-{{ a.taxDocumentNumber }}</span>
                <span v-else class="text-prohealth-400">{{ t('common.empty') }}</span>
              </td>
              <td class="px-5 py-3 text-prohealth-700">{{ a.city_Display ?? t('common.empty') }}</td>
              <td class="px-5 py-3">
                <UBadge :color="a.published ? 'success' : 'neutral'" variant="subtle" size="sm">
                  {{ a.published ? t('allies.published') : t('allies.draft') }}
                </UBadge>
              </td>
              <td class="px-5 py-3">
                <UBadge
                  :color="a.active === false ? 'neutral' : (a.status === 'ACTIVE' ? 'success' : 'warning')"
                  variant="subtle"
                  size="sm"
                >
                  {{ effectiveStatusLabel(a) }}
                </UBadge>
              </td>
              <td class="px-5 py-3" @click.stop>
                <div class="flex items-center justify-end gap-1">
                  <!-- Primary actions -->
                  <UTooltip :text="t('allies.viewDetailTooltip')">
                    <UButton
                      color="neutral"
                      variant="ghost"
                      icon="i-lucide-eye"
                      size="sm"
                      :to="`/dashboard/allies/${a.uuid}`"
                    />
                  </UTooltip>
                  <UTooltip :text="canUpdate ? t('common.edit') : t('allies.noPermissionEdit')">
                    <UButton
                      color="info"
                      variant="ghost"
                      icon="i-lucide-pencil"
                      size="sm"
                      :disabled="!canUpdate"
                      @click="openEdit(a)"
                    />
                  </UTooltip>

                  <!-- Read-only tools -->
                  <ReportPrintButton
                    table-name="allies"
                    :record-uuid="a.uuid"
                    icon-only
                    variant="ghost"
                    size="sm"
                  />
                  <UTooltip v-if="canViewAudit" :text="t('audit.trigger')">
                    <UButton
                      color="neutral"
                      variant="ghost"
                      icon="i-lucide-history"
                      size="sm"
                      @click="openAudit(a)"
                    />
                  </UTooltip>

                  <!-- Destructive action, separated from the rest -->
                  <RestoreButton
                    v-if="a.active === false"
                    :active="a.active"
                    :allowed="canDelete"
                    :loading="restoring"
                    size="sm"
                    icon-only
                    class="ms-2"
                    @restore="restoreAlly(a)"
                  />
                  <UTooltip v-else :text="canDelete ? t('common.delete') : t('allies.noPermissionDelete')">
                    <UButton
                      color="error"
                      variant="ghost"
                      icon="i-lucide-trash-2"
                      size="sm"
                      class="ms-2"
                      :disabled="!canDelete"
                      @click="openDelete(a)"
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
          {{ t('allies.paginationSummary', { shown: data.length, total }) }}
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
    <UModal
      v-model:open="formOpen"
      :title="mode === 'create' ? t('allies.form.createTitle') : t('allies.form.editTitle')"
      :description="mode === 'create' ? t('allies.form.createDescription') : t('allies.form.editDescription')"
      :ui="{ content: 'max-w-2xl' }"
    >
      <template #body>
        <div v-if="editLoading" class="py-12 flex flex-col items-center justify-center gap-2 text-prohealth-500">
          <UIcon name="i-lucide-loader-circle" class="w-6 h-6 animate-spin" />
          <span class="text-sm">{{ t('allies.form.loadingDetail') }}</span>
        </div>
        <UForm
          v-else
          :schema="schema"
          :state="state"
          class="space-y-4"
          @submit="onSubmit"
        >
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField :label="t('allies.form.fields.name')" name="name" required>
              <UInput v-model="state.name" class="w-full" />
            </UFormField>
            <UFormField :label="t('allies.form.fields.allyType')" name="allyTypeUuid" required>
              <USelectMenu
                v-model="state.allyTypeUuid"
                :items="allyTypeOptions"
                label-key="label"
                value-key="value"
                :placeholder="t('common.select')"
                class="w-full"
              />
            </UFormField>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField :label="t('allies.form.fields.taxDocumentType')" name="taxDocumentType">
              <USelectMenu
                v-model="state.taxDocumentType"
                :items="documentTypeOptions"
                label-key="label"
                value-key="value"
                :placeholder="t('common.select')"
                class="w-full"
              />
            </UFormField>
            <UFormField :label="t('allies.form.fields.taxDocumentNumber')" name="taxDocumentNumber">
              <UInput v-model="state.taxDocumentNumber" class="w-full" />
            </UFormField>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField :label="t('allies.form.fields.email')" name="email">
              <UInput v-model="state.email" type="email" class="w-full" />
            </UFormField>
            <UFormField :label="t('allies.form.fields.phone')" name="phone">
              <UInput v-model="state.phone" class="w-full" />
            </UFormField>
          </div>

          <UFormField :label="t('allies.form.fields.website')" name="website">
            <UInput v-model="state.website" placeholder="https://…" class="w-full" />
          </UFormField>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField :label="t('allies.form.fields.state')" name="stateUuid">
              <USelectMenu
                v-model="selectedStateUuid"
                :items="stateOptions"
                label-key="label"
                value-key="value"
                :placeholder="t('common.select')"
                class="w-full"
              />
            </UFormField>
            <UFormField :label="t('allies.form.fields.city')" name="cityUuid">
              <USelectMenu
                v-model="state.cityUuid"
                :items="cityOptions"
                label-key="label"
                value-key="value"
                :disabled="!selectedStateUuid"
                :placeholder="t('allies.form.selectCityFirst')"
                class="w-full"
              />
            </UFormField>
          </div>

          <UFormField :label="t('allies.form.fields.address')" name="address">
            <UInput v-model="state.address" class="w-full" />
          </UFormField>

          <UFormField :label="t('allies.form.fields.description')" name="description">
            <UTextarea v-model="state.description" :rows="2" class="w-full" />
          </UFormField>

          <UFormField :label="t('allies.form.fields.specialties')" name="specialtyUuids">
            <USelectMenu
              v-model="state.specialtyUuids"
              :items="specialtyOptions"
              label-key="label"
              value-key="value"
              multiple
              icon="i-lucide-list-checks"
              :placeholder="t('allies.form.selectMultiple')"
              class="w-full"
            />
          </UFormField>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <UFormField :label="t('allies.form.fields.joinedAt')" name="joinedAt">
              <UInput v-model="state.joinedAt" type="date" class="w-full" />
            </UFormField>
            <UFormField :label="t('allies.form.fields.published')" name="published">
              <USwitch v-model="state.published" />
            </UFormField>
            <UFormField v-if="mode === 'edit'" :label="t('allies.form.fields.status')" name="status">
              <USelectMenu
                v-model="state.status"
                :items="statusOptions"
                label-key="label"
                value-key="value"
                class="w-full"
              />
              <!-- `status` is the business state; `active === false` means the record
                   is soft-deleted. Clarify the distinction next to Restaurar. -->
              <template v-if="editingItem?.active === false" #help>
                <span class="text-amber-600">{{ t('allies.form.softDeletedHint') }}</span>
              </template>
            </UFormField>
          </div>

          <p class="text-xs text-prohealth-500">{{ t('common.requiredFieldsHint') }}</p>

          <div class="flex items-center justify-between gap-3 pt-2">
            <div v-if="mode === 'edit' && editingItem" class="flex items-center gap-2">
              <RestoreButton
                v-if="editingItem.active === false"
                :active="editingItem.active"
                :allowed="canDelete"
                :loading="restoring"
                :disabled="isSubmitting"
                @restore="restoreAlly(editingItem)"
              />
              <UTooltip v-else :text="canDelete ? t('common.delete') : t('allies.noPermissionDelete')">
                <UButton
                  color="error"
                  variant="ghost"
                  icon="i-lucide-trash-2"
                  size="sm"
                  :label="t('common.delete')"
                  :disabled="isSubmitting || !canDelete"
                  @click="openDeleteFromEdit"
                />
              </UTooltip>
            </div>
            <div v-else />

            <div class="flex items-center gap-3">
              <RefreshButton
                v-if="mode === 'edit'"
                :loading="editLoading"
                :disabled="isSubmitting"
                :icon-only="false"
                :label="t('common.refresh')"
                :title="t('common.refresh')"
                @refresh="onEditRefresh"
              />
              <UButton color="neutral" variant="ghost" :disabled="isSubmitting" @click="formOpen = false">
                {{ t('common.cancel') }}
              </UButton>
              <UButton type="submit" :color="mode === 'create' ? 'primary' : 'info'" variant="outline" :loading="isSubmitting" icon="i-lucide-save">
                {{ mode === 'create' ? t('common.saveNew') : t('common.saveChanges') }}
              </UButton>
            </div>
          </div>
        </UForm>
      </template>
    </UModal>

    <!-- Delete confirmation modal -->
    <UModal v-model:open="deleteOpen" :title="t('allies.delete.title')">
      <template #body>
        <i18n-t keypath="allies.delete.confirm" tag="p" class="text-sm text-prohealth-700" scope="global">
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

    <!-- Discard-unsaved-changes confirmation for the edit modal's refresh button -->
    <UModal v-model:open="discardConfirmOpen" :title="t('common.discardChangesTitle')">
      <template #body>
        <p class="text-sm text-prohealth-700">{{ t('common.discardChangesBody') }}</p>
        <div class="flex items-center justify-end gap-3 pt-5">
          <UButton color="neutral" variant="ghost" @click="discardConfirmOpen = false">
            {{ t('common.cancel') }}
          </UButton>
          <UButton color="warning" icon="i-lucide-refresh-cw" @click="reloadEditForm">
            {{ t('common.discardAndRefresh') }}
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Audit modal -->
    <AuditModal
      v-if="auditTarget"
      v-model:open="auditOpen"
      entity-key="ally"
      :entity-uuid="auditTarget.uuid"
      :entity-label="auditTarget.name"
      :can-view-changes="canViewAuditChanges"
      :can-view-reports="canViewAuditReports"
    />
  </div>
</template>
