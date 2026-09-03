<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { CatalogDef, CatalogField, CatalogItem } from '~/types/catalogs'
import { toSelectItems } from '~/types/options'
import { getCatalogDef } from '~/utils/catalog-registry'
import { buildPageSizeItems, DEFAULT_PAGE_SIZE, UNPAGED_PAGE_SIZE } from '~/utils/pagination'
import type { SortDirection } from '~/composables/useTableSort'

definePageMeta({
  layout: 'dashboard',
  // Resolves the catalog's own view key from the route param (V78): reaching a
  // catalog screen only requires read access — create/edit/delete buttons are
  // gated individually below by their own granular permission.
  middleware: 'catalog-access',
})

const { t } = useI18n()
const route = useRoute()
const toast = useToast()
const { can } = usePermissions()
const canViewAuditChanges = computed(() => can('AUDIT_VIEW_ALL') || (def.value?.auditPermission ? can(def.value.auditPermission) : false))
const canViewAuditReports = computed(() => can('REPORT_AUDIT_VIEW_ALL') || (def.value?.auditReportPermission ? can(def.value.auditReportPermission) : false))
const canViewAudit = computed(() => canViewAuditChanges.value || canViewAuditReports.value)

// ---- Per-action permission gates (V78) ----
const canCreate = computed(() => (def.value ? can(def.value.createPermission) : false))
const canUpdate = computed(() => (def.value ? can(def.value.updatePermission) : false))
const canDelete = computed(() => (def.value ? can(def.value.deletePermission) : false))

// ---- Audit ----
const auditOpen = ref(false)
const auditTarget = ref<CatalogItem | null>(null)

function openAudit(item: CatalogItem) {
  auditTarget.value = item
  auditOpen.value = true
}

// Catalog definition from the route segment. Reactive: the component is reused
// when navigating between catalogs.
const def = computed(() => getCatalogDef(String(route.params.resource)))

// ---- i18n resolvers (registry carries `*Key`; literal label is the fallback) ----
function catLabel(d?: CatalogDef): string {
  return d ? (d.labelKey ? t(d.labelKey) : d.label) : ''
}
function catLabelSingular(d?: CatalogDef): string {
  return d ? (d.labelSingularKey ? t(d.labelSingularKey) : d.labelSingular) : ''
}
function fieldLabel(f: CatalogField): string {
  return f.labelKey ? t(f.labelKey) : f.label
}
function fieldRegexMsg(f: CatalogField): string {
  return f.regexMsgKey ? t(f.regexMsgKey, { n: f.max ?? 0 }) : (f.regexMsg ?? t('catalogs.validation.invalidFormat'))
}

useSeoMeta({
  title: () => t('common.seoTitle', { page: def.value ? catLabel(def.value) : t('catalogs.title') }),
})

const hasDescription = computed(() => def.value?.fields.some(f => f.name === 'description') ?? false)

// Table column count (for the skeleton and colspans).
const columnCount = computed(() => {
  let n = 2 // name + actions
  if (def.value?.codeField) n++
  if (def.value?.parentDisplayField) n++
  if (hasDescription.value) n++
  n++ // status
  return n
})

// ---- List ----
const items = ref<CatalogItem[]>([])
const total = ref(0)
const loading = ref(false)
const search = ref('')

// Parent filter (e.g. cities by state).
const filterValue = ref<string>('')
const includeInactive = ref(false)

// Server-side pagination. `page` is 1-based (UPagination); the API is 0-based.
// `pageSize === UNPAGED_PAGE_SIZE` (-1) is the backend's "return everything" sentinel.
const pageSize = ref<number>(DEFAULT_PAGE_SIZE)
const page = ref(1)
const pageSizeItems = buildPageSizeItems(t)

// Empty by default: no `sort=` is sent until the user clicks a column, so
// the backend's own default-sort fallback (entity_config → system_configs
// → `name` ASC) applies — same reasoning as the allies pilot.
const sort = useTableSort([])
const hasActiveSort = computed(() => sort.hasActiveSort.value)
const isMultiSort = computed(() => sort.orders.value.length > 1)

function api() {
  return useCatalog(def.value!.basePath)
}

async function load() {
  if (!def.value) return
  loading.value = true
  try {
    const parentFilter = def.value.listFilter && filterValue.value
      ? { [def.value.listFilter.param]: filterValue.value }
      : {}
    const searchTerm = search.value.trim()
    const query = {
      page: page.value - 1,
      size: pageSize.value,
      ...(sort.sortParam.value.length ? { sort: sort.sortParam.value } : {}),
      ...(includeInactive.value ? { includeInactive: 'true' } : {}),
      ...parentFilter,
      ...(searchTerm ? { q: searchTerm } : {}),
    }
    const res = await api().list(query)
    items.value = res.content ?? []
    total.value = res.totalElements ?? items.value.length
    // No column clicked yet → reflect the server's own default in the header
    // arrows (see allies/index.vue for the full rationale).
    if (sort.orders.value.length === 0 && res.appliedSort?.length) {
      resetting.value = true
      sort.seedServerDefault(res.appliedSort.map(o => ({ field: o.field, direction: o.direction.toLowerCase() as SortDirection })))
      await nextTick()
      resetting.value = false
    }
  }
  catch {
    items.value = []
    total.value = 0
  }
  finally {
    loading.value = false
  }
}

// Guards the filter watchers so "clear filters and refresh" fires a single
// reload instead of one per changed ref.
const resetting = ref(false)

let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, () => {
  if (resetting.value) return
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    load()
  }, 300)
})
watch(pageSize, () => { if (!resetting.value) { page.value = 1; load() } })
watch(page, () => { if (!resetting.value) load() })
watch(sort.orders, () => { if (!resetting.value) load() }, { deep: true })

async function resetFilters() {
  resetting.value = true
  search.value = ''
  filterValue.value = ''
  includeInactive.value = false
  sort.reset()
  pageSize.value = DEFAULT_PAGE_SIZE
  page.value = 1
  await nextTick()
  resetting.value = false
  load()
}

// ---- Parent catalog options (for FK selects and the filter) ----
const parentOptions = ref<Record<string, { label: string, value: string }[]>>({})

async function loadParents() {
  if (!def.value) return
  parentOptions.value = {}
  const parentFields = def.value.fields.filter(f => f.type === 'parent' && f.parentKey)
  await Promise.all(parentFields.map(async (f) => {
    const pdef = getCatalogDef(f.parentKey!)
    if (!pdef) return
    try {
      const list = await useCatalogOptions(pdef.key).options({ limit: 200 })
      parentOptions.value[f.name] = toSelectItems(list)
    }
    catch {
      parentOptions.value[f.name] = []
    }
  }))
}

// Options for the parent filter select (reuses the FK field's options).
const filterOptions = computed(() => {
  const field = def.value?.listFilter?.field
  return field ? (parentOptions.value[field as string] ?? []) : []
})

async function init() {
  if (!def.value) return
  resetting.value = true
  search.value = ''
  filterValue.value = ''
  includeInactive.value = false
  sort.reset()
  page.value = 1
  await nextTick()
  resetting.value = false
  await Promise.all([loadParents(), load()])
}

onMounted(init)
watch(() => route.params.resource, init)
watch(filterValue, () => { if (!resetting.value) { page.value = 1; load() } })
watch(includeInactive, () => { if (!resetting.value) { page.value = 1; load() } })

// ---- Create/edit form ----
const formOpen = ref(false)
const mode = ref<'create' | 'edit'>('create')
const editingUuid = ref<string | null>(null)
const editingItem = ref<CatalogItem | null>(null)
const isSubmitting = ref(false)
const state = reactive<Record<string, string>>({})
// Kept outside `state` (a Record<string, string>) so the boolean isn't coerced.
const isActive = ref(true)

// Fields visible in the current form (onlyCreate fields are hidden on edit).
const formFields = computed(() =>
  (def.value?.fields ?? []).filter(f => mode.value === 'create' || !f.onlyCreate),
)

const schema = computed(() => {
  const shape: Record<string, z.ZodTypeAny> = {}
  for (const f of formFields.value) {
    let s = z.string()
    if (f.max) s = s.max(f.max, t('validation.maxChars', { n: f.max }))
    if (f.regex) s = s.regex(f.regex, fieldRegexMsg(f))
    shape[f.name] = f.required ? s.min(1, t('validation.required')) : s.optional().or(z.literal(''))
  }
  return z.object(shape)
})

function resetForm() {
  for (const f of def.value?.fields ?? []) state[f.name] = ''
}

function openCreate() {
  mode.value = 'create'
  editingUuid.value = null
  resetForm()
  formOpen.value = true
}

// Snapshot of the last-loaded edit state, used to warn before a refresh
// discards unsaved changes.
const editSnapshot = ref('')
function snapEditState() { return JSON.stringify({ ...state, isActive: isActive.value }) }
const isEditDirty = computed(() => editSnapshot.value !== '' && snapEditState() !== editSnapshot.value)
const discardConfirmOpen = ref(false)
const editReloading = ref(false)

function populateEditForm(item: CatalogItem) {
  editingUuid.value = item.uuid
  editingItem.value = item
  resetForm()
  for (const f of def.value?.fields ?? []) {
    state[f.name] = String((item as unknown as Record<string, unknown>)[f.name] ?? '')
  }
  isActive.value = item.active
  editSnapshot.value = snapEditState()
}

function openEdit(item: CatalogItem) {
  mode.value = 'edit'
  populateEditForm(item)
  formOpen.value = true
}

async function reloadEditForm() {
  if (!def.value || !editingUuid.value) return
  editReloading.value = true
  try { populateEditForm(await api().get(editingUuid.value)) }
  catch { /* useApi already notified */ }
  finally { editReloading.value = false }
}
function onEditRefresh() {
  if (isEditDirty.value) discardConfirmOpen.value = true
  else reloadEditForm()
}
function discardAndRefresh() {
  discardConfirmOpen.value = false
  reloadEditForm()
}

function buildBody(forCreate: boolean): Record<string, unknown> {
  const body: Record<string, unknown> = {}
  for (const f of def.value?.fields ?? []) {
    if (!forCreate && f.onlyCreate) continue
    const v = (state[f.name] ?? '').trim()
    if (f.required) body[f.name] = v
    else if (v) body[f.name] = v
  }
  if (!forCreate) body.active = isActive.value
  return body
}

async function onSubmit(_e: FormSubmitEvent<Record<string, unknown>>) {
  if (!def.value) return
  isSubmitting.value = true
  try {
    if (mode.value === 'create') {
      await api().create(buildBody(true))
      toast.add({ title: t('catalogs.createdToast', { entity: catLabelSingular(def.value) }), color: 'success', icon: 'i-lucide-check-circle' })
    }
    else if (editingUuid.value) {
      await api().update(editingUuid.value, buildBody(false))
      toast.add({ title: t('catalogs.updatedToast', { entity: catLabelSingular(def.value) }), color: 'success', icon: 'i-lucide-check-circle' })
    }
    formOpen.value = false
    await load()
  }
  catch {
    // useApi already reported the error
  }
  finally {
    isSubmitting.value = false
  }
}

// ---- Delete ----
const deleteOpen = ref(false)
const deleting = ref(false)
const target = ref<CatalogItem | null>(null)
const usageChecking = ref(false)
const usageInfo = ref<{ inUse: boolean, count: number } | null>(null)

async function openDelete(item: CatalogItem) {
  target.value = item
  deleteOpen.value = true
  usageChecking.value = true
  usageInfo.value = null
  try {
    usageInfo.value = await api().usage(item.uuid)
  }
  catch {
    // Fallback: treat as "in use" for safety (soft-delete instead of physical).
    usageInfo.value = null
  }
  finally {
    usageChecking.value = false
  }
}

// Shortcut from the edit modal so the user doesn't have to close it first
// and hunt for the row's trash icon. Closes the edit modal so the two
// dialogs never stack.
function openDeleteFromEdit() {
  if (!editingItem.value) return
  formOpen.value = false
  openDelete(editingItem.value)
}

async function confirmDelete() {
  if (!target.value || !def.value) return
  deleting.value = true
  const wasPhysical = usageInfo.value?.inUse === false
  try {
    await api().remove(target.value.uuid, wasPhysical)
    toast.add({
      title: wasPhysical
        ? t('catalogs.deletedPermanentToast', { entity: catLabelSingular(def.value) })
        : t('catalogs.deactivatedToast', { entity: catLabelSingular(def.value) }),
      color: wasPhysical ? 'success' : 'info',
      icon: wasPhysical ? 'i-lucide-check-circle' : 'i-lucide-info',
    })
    deleteOpen.value = false
    await load()
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
  <div v-if="!def" class="bg-white rounded-2xl border border-prohealth-100 p-10 text-center">
    <UIcon name="i-lucide-search-x" class="w-8 h-8 mx-auto mb-2 text-prohealth-300" />
    <p class="text-prohealth-700">{{ $t('catalogs.notFound') }}</p>
    <UButton class="mt-4" color="primary" variant="soft" to="/dashboard/catalogs">{{ $t('catalogs.viewCatalogs') }}</UButton>
  </div>

  <div v-else class="space-y-5">
    <!-- Header -->
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <div class="flex items-center gap-2 text-xs text-prohealth-500 mb-1">
          <NuxtLink to="/dashboard/catalogs" class="hover:text-prohealth-700">{{ $t('catalogs.breadcrumb') }}</NuxtLink>
          <UIcon name="i-lucide-chevron-right" class="w-3.5 h-3.5" />
          <span>{{ catLabel(def) }}</span>
        </div>
        <h1 class="text-2xl font-extrabold text-prohealth-900 flex items-center gap-2">
          <UIcon :name="def.icon" class="w-6 h-6 text-prohealth-600" />
          {{ catLabel(def) }}
        </h1>
      </div>
      <div class="flex items-center gap-2">
        <ListRefreshMenu :loading="loading" variant="ghost" @refresh="load" @reset="resetFilters" />
        <ReportPrintButton :table-name="def.key" variant="ghost" />
        <UButton v-if="canCreate" color="primary" variant="outline" icon="i-lucide-plus" @click="openCreate">
          {{ $t('common.new') }}
        </UButton>
      </div>
    </div>

    <!-- Filters -->
    <div class="bg-white rounded-2xl border border-prohealth-100 p-4 flex flex-wrap gap-3">
      <UInput
        v-model="search"
        :placeholder="$t('catalogs.searchPlaceholder')"
        icon="i-lucide-search"
        size="lg"
        class="w-full max-w-md"
      />
      <USelectMenu
        v-if="def.listFilter"
        v-model="filterValue"
        :items="filterOptions"
        label-key="label"
        value-key="value"
        :placeholder="$t('catalogs.filterByParent')"
        class="w-full max-w-xs"
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

    <!-- Table: fixed-height card so the pagination footer stays pinned at the
         bottom (few rows) and only the row area scrolls (many rows). -->
    <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden flex flex-col h-[calc(100vh-19rem)] min-h-[24rem]">
      <div class="overflow-auto flex-1">
        <table class="w-full text-sm">
          <thead class="sticky top-0 bg-white z-10">
            <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
              <th
                v-if="def.codeField"
                class="px-5 py-3 font-semibold cursor-pointer select-none"
                @click="sort.toggle(def.codeField)"
              >
                {{ $t('catalogs.columns.code') }}
                <SortIndicator :state="sort.stateOf(def.codeField)" :multi-active="isMultiSort" @clear="sort.remove(def.codeField)" />
              </th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('name')">
                {{ $t('catalogs.columns.name') }}
                <SortIndicator :state="sort.stateOf('name')" :multi-active="isMultiSort" @clear="sort.remove('name')" />
              </th>
              <th
                v-if="def.parentDisplayField"
                class="px-5 py-3 font-semibold cursor-pointer select-none"
                @click="sort.toggle(def.parentDisplayField)"
              >
                {{ $t('catalogs.columns.parent') }}
                <SortIndicator :state="sort.stateOf(def.parentDisplayField)" :multi-active="isMultiSort" @clear="sort.remove(def.parentDisplayField)" />
              </th>
              <th v-if="hasDescription" class="px-5 py-3 font-semibold">{{ $t('catalogs.columns.description') }}</th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('active')">
                {{ $t('catalogs.columns.status') }}
                <SortIndicator :state="sort.stateOf('active')" :multi-active="isMultiSort" @clear="sort.remove('active')" />
              </th>
              <th class="px-5 py-3 font-semibold text-right">{{ $t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-prohealth-100">
            <TableSkeleton v-if="loading" :rows="6" :cols="columnCount" />
            <tr v-else-if="items.length === 0">
              <td :colspan="columnCount" class="px-5 py-12 text-center text-prohealth-500">
                <UIcon :name="def.icon" class="w-8 h-8 mx-auto mb-2 text-prohealth-300" />
                {{ $t('catalogs.empty') }}
              </td>
            </tr>
            <tr
              v-for="item in items"
              v-else
              :key="item.uuid"
              class="hover:bg-prohealth-50/50"
              :class="{ 'opacity-60': !item.active }"
            >
              <td v-if="def.codeField" class="px-5 py-3">
                <UBadge color="neutral" variant="subtle">{{ item[def.codeField] }}</UBadge>
              </td>
              <td class="px-5 py-3 font-medium text-prohealth-900">{{ item.name }}</td>
              <td v-if="def.parentDisplayField" class="px-5 py-3 text-prohealth-600">
                {{ item[def.parentDisplayField] || $t('common.empty') }}
              </td>
              <td v-if="hasDescription" class="px-5 py-3 text-prohealth-600">
                {{ item.description || $t('common.empty') }}
              </td>
              <td class="px-5 py-3">
                <UBadge :color="item.active ? 'success' : 'neutral'" variant="subtle" size="sm">
                  {{ item.active_Display ?? (item.active ? $t('catalogs.status.active') : $t('catalogs.status.inactive')) }}
                </UBadge>
              </td>
              <td class="px-5 py-3">
                <div class="flex items-center justify-end gap-1">
                  <UTooltip v-if="canUpdate" :text="$t('common.edit')">
                    <UButton color="info" variant="ghost" icon="i-lucide-pencil" size="sm" @click="openEdit(item)" />
                  </UTooltip>
                  <ReportPrintButton
                    :table-name="def.key"
                    :record-uuid="item.uuid"
                    icon-only
                    variant="ghost"
                    size="sm"
                  />
                  <UTooltip v-if="def.auditEntityKey && canViewAudit" :text="t('audit.trigger')">
                    <UButton color="neutral" variant="ghost" icon="i-lucide-history" size="sm" @click="openAudit(item)" />
                  </UTooltip>
                  <UTooltip v-if="canDelete" :text="$t('common.delete')">
                    <UButton color="error" variant="ghost" icon="i-lucide-trash-2" size="sm" class="ms-2" @click="openDelete(item)" />
                  </UTooltip>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t border-prohealth-100 shrink-0">
        <p class="text-xs text-prohealth-500">
          {{ $t('catalogs.recordCount', { count: total }) }}
        </p>
        <div class="flex items-center gap-3">
          <UPagination
            v-if="pageSize !== UNPAGED_PAGE_SIZE"
            v-model:page="page"
            :total="total"
            :items-per-page="pageSize"
          />
          <UTooltip :text="$t('catalogs.pageSizeLabel')">
            <USelectMenu
              v-model="pageSize"
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
      :title="mode === 'create' ? $t('catalogs.modalCreateTitle', { entity: catLabelSingular(def) }) : $t('catalogs.modalEditTitle', { entity: catLabelSingular(def) })"
    >
      <template #body>
        <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
          <UFormField
            v-for="f in formFields"
            :key="f.name"
            :label="fieldLabel(f)"
            :name="f.name"
            :required="f.required"
          >
            <USelectMenu
              v-if="f.type === 'parent'"
              v-model="state[f.name]"
              :items="parentOptions[f.name] ?? []"
              label-key="label"
              value-key="value"
              :placeholder="$t('catalogs.selectPlaceholder', { field: fieldLabel(f).toLowerCase() })"
              class="w-full"
            />
            <UTextarea
              v-else-if="f.type === 'textarea'"
              v-model="state[f.name]"
              :rows="2"
              :maxlength="f.max"
              class="w-full"
            />
            <UInput
              v-else
              v-model="state[f.name]"
              :placeholder="f.placeholder"
              :maxlength="f.max"
              class="w-full"
            />
          </UFormField>

          <UFormField v-if="mode === 'edit'" :label="$t('catalogs.fields.active')">
            <USwitch v-model="isActive" />
          </UFormField>

          <p class="text-xs text-prohealth-500">{{ $t('common.requiredFieldsHint') }}</p>

          <div class="flex items-center justify-between gap-3 pt-2">
            <!-- Shortcut to delete the record being edited; meaningless while creating one that does not exist yet. -->
            <div v-if="mode === 'edit' && editingItem && canDelete">
              <UButton
                color="error"
                variant="ghost"
                icon="i-lucide-trash-2"
                size="sm"
                :label="$t('common.delete')"
                :disabled="isSubmitting"
                @click="openDeleteFromEdit"
              />
            </div>
            <div v-else />

            <div class="flex items-center gap-3">
              <RefreshButton
                v-if="mode === 'edit'"
                :icon-only="false"
                :label="$t('common.refresh')"
                :title="$t('common.refresh')"
                :loading="editReloading"
                :disabled="isSubmitting"
                @refresh="onEditRefresh"
              />
              <UButton color="neutral" variant="ghost" :disabled="isSubmitting" @click="formOpen = false">
                {{ $t('common.cancel') }}
              </UButton>
              <UButton type="submit" :color="mode === 'create' ? 'primary' : 'info'" variant="outline" :loading="isSubmitting" icon="i-lucide-save">
                {{ mode === 'create' ? $t('common.saveNew') : $t('common.saveChanges') }}
              </UButton>
            </div>
          </div>
        </UForm>
      </template>
    </UModal>

    <!-- Discard unsaved changes before refreshing the edit form -->
    <UModal v-model:open="discardConfirmOpen" :title="$t('common.discardChangesTitle')">
      <template #body>
        <p class="text-sm text-prohealth-700">{{ $t('common.discardChangesBody') }}</p>
        <div class="flex items-center justify-end gap-3 pt-5">
          <UButton color="neutral" variant="ghost" @click="discardConfirmOpen = false">{{ $t('common.cancel') }}</UButton>
          <UButton color="warning" icon="i-lucide-refresh-cw" @click="discardAndRefresh">{{ $t('common.discardAndRefresh') }}</UButton>
        </div>
      </template>
    </UModal>

    <!-- Delete modal -->
    <UModal v-model:open="deleteOpen" :title="$t('catalogs.deleteTitle', { entity: catLabelSingular(def).toLowerCase() })">
      <template #body>
        <div v-if="usageChecking" class="flex items-center gap-2 text-sm text-prohealth-600">
          <UIcon name="i-lucide-loader-2" class="w-4 h-4 animate-spin" />
          {{ $t('common.loading') }}
        </div>
        <p v-else class="text-sm text-prohealth-700">
          {{
            usageInfo?.inUse === false
              ? t('catalogs.deleteConfirmPermanent')
              : t('catalogs.deleteConfirmDeactivate', { count: usageInfo?.count ?? 0 })
          }}
        </p>
        <div class="flex items-center justify-end gap-3 pt-5">
          <UButton color="neutral" variant="ghost" :disabled="deleting" @click="deleteOpen = false">
            {{ $t('common.cancel') }}
          </UButton>
          <UButton color="error" :loading="deleting" :disabled="usageChecking" icon="i-lucide-trash-2" @click="confirmDelete">
            {{ $t('common.delete') }}
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Audit modal -->
    <AuditModal
      v-if="auditTarget && def.auditEntityKey"
      v-model:open="auditOpen"
      :entity-key="def.auditEntityKey"
      :entity-uuid="auditTarget.uuid"
      :entity-label="auditTarget.name"
      :entity-code="auditTarget.code ?? auditTarget.isoCode"
      :can-view-changes="canViewAuditChanges"
      :can-view-reports="canViewAuditReports"
    />
  </div>
</template>
