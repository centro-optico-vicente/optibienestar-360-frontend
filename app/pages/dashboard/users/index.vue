<script setup lang="ts">
import { buildPageSizeItems, DEFAULT_PAGE_SIZE, UNPAGED_PAGE_SIZE } from '~/utils/pagination'
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type {
  AdminCreateUserRequest,
  AdminUpdateUserRequest,
  UserDto,
} from '~/types/admin'
import type { SortDirection } from '~/composables/useTableSort'

definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'USER_VIEW_ALL',
})

const { t } = useI18n()

useSeoMeta({ title: () => t('security.users.seoTitle') })

const users = useUsers()
const roles = useRoles()
const { can } = usePermissions()
const { formatDate } = useFormatters()
const toast = useToast()

const canCreate = computed(() => can('USER_CREATE'))
const canUpdate = computed(() => can('USER_UPDATE'))
const canDelete = computed(() => can('USER_DELETE'))
const canViewAuditChanges = computed(() => can('AUDIT_VIEW_ALL') || can('USER_RECORD_AUDIT_VIEW'))
const canViewAuditReports = computed(() => can('REPORT_AUDIT_VIEW_ALL') || can('USER_REPORT_AUDIT_VIEW'))
const canViewAudit = computed(() => canViewAuditChanges.value || canViewAuditReports.value)

// ---- Auditoría ----
const auditOpen = ref(false)
const auditTarget = ref<UserDto | null>(null)

function openAudit(u: UserDto) {
  auditTarget.value = u
  auditOpen.value = true
}

// ---- Listado + paginación + búsqueda ----
const data = ref<UserDto[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1) // UPagination es 1-based; la API es 0-based
const size = ref(DEFAULT_PAGE_SIZE)
const pageSizeItems = buildPageSizeItems(t)
const search = ref('')
const includeInactive = ref(false)
// Empty by default: no `sort=` is sent until the user clicks a column, so
// the backend's own default-sort fallback (entity_config → system_configs
// → createdAt DESC) applies.
const sort = useTableSort([])
const hasActiveSort = computed(() => sort.hasActiveSort.value)
const isMultiSort = computed(() => sort.orders.value.length > 1)

function buildFilter(): string | undefined {
  const term = search.value.trim()
  if (!term) return undefined
  // RSQL: OR entre fullName y email (coma = OR)
  return `fullName=='*${term}*',email=='*${term}*'`
}

async function load() {
  loading.value = true
  try {
    const res = await users.list({
      page: page.value - 1,
      size: size.value,
      sort: sort.sortParam.value,
      filter: buildFilter(),
      includeInactive: includeInactive.value,
    })
    data.value = res.content ?? []
    total.value = res.totalElements ?? 0
    // No column clicked yet → reflect the server's own default in the header arrows.
    if (sort.orders.value.length === 0 && res.appliedSort?.length) {
      resetting.value = true
      sort.seedServerDefault(res.appliedSort.map(o => ({ field: o.field, direction: o.direction.toLowerCase() as SortDirection })))
      await nextTick()
      resetting.value = false
    }
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

// Guards the filter watchers so "clear filters and refresh" fires a single reload.
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

// ---- Catálogo de roles para el selector ----
// Fetched lazily (only when the create/edit form is opened, guarded by this
// flag) rather than on page mount — this select is only ever seen inside
// that form, so loading it eagerly for every list visit wastes requests.
const roleOptions = ref<{ label: string, value: string }[]>([])
const catalogsLoaded = ref(false)

async function loadCatalogs() {
  if (catalogsLoaded.value) return
  try {
    const res = await roles.options({ limit: 200 })
    roleOptions.value = res.map(o => ({ label: o.label, value: o.uuid }))
  }
  catch {
    // useApi ya notificó el error; sin roles no se puede asignar.
    roleOptions.value = []
  }
  await loadDocumentTypes()
  catalogsLoaded.value = true
}

// `?edit=<uuid>` lets the user detail page ("Edit user" button) reopen this
// modal without duplicating the create/edit form on a second page.
const route = useRoute()

onMounted(async () => {
  await load()
  const editUuid = route.query.edit
  if (typeof editUuid === 'string') {
    try {
      const target = await users.get(editUuid)
      openEdit(target)
    }
    catch {
      // Invalid/removed uuid: silently ignore, stay on the list.
    }
  }
})

// ---- Formulario crear/editar ----
const formOpen = ref(false)
const mode = ref<'create' | 'edit'>('create')
const editingUuid = ref<string | null>(null)
const editingItem = ref<UserDto | null>(null)
const isSubmitting = ref(false)

// Backend only accepts these (AdminUpdateUserRequest.status pattern).
const STATUS_VALUES = ['ACTIVE', 'SUSPENDED', 'LOCKED']
const statusOptions = computed(() =>
  STATUS_VALUES.map(s => ({ label: t(`security.users.status.${s}`), value: s })),
)

/** Prefers the server-resolved `_Display` sibling (hub ADR 0014); falls back to the local i18n lookup. */
function statusLabel(u: UserDto): string {
  if (u.active === false) return u.active_Display ?? t('security.users.inactive')
  if (!u.status) return t('common.empty')
  return u.status_Display ?? (STATUS_VALUES.includes(u.status) ? t(`security.users.status.${u.status}`) : u.status)
}

// Tipos de documento desde el catálogo real (/v1/admin/catalogs/document-types).
const { options: documentTypeOptions, load: loadDocumentTypes } = useDocumentTypes()

interface FormState {
  email: string
  firstName: string
  middleName: string
  lastName: string
  secondLastName: string
  password: string
  documentType: string | undefined
  documentNumber: string
  phone: string
  status: string
  active: boolean
  roleIds: string[]
}

const state = reactive<FormState>({
  email: '',
  firstName: '',
  middleName: '',
  lastName: '',
  secondLastName: '',
  password: '',
  documentType: undefined,
  documentNumber: '',
  phone: '',
  status: 'ACTIVE',
  active: true,
  roleIds: [],
})

const createSchema = computed(() => z.object({
  email: z.string().email(t('validation.emailInvalid')),
  firstName: z.string().min(1, t('validation.required')).max(50, t('validation.maxChars', { n: 50 })),
  middleName: z.string().max(50, t('validation.maxChars', { n: 50 })).optional(),
  lastName: z.string().min(1, t('validation.required')).max(50, t('validation.maxChars', { n: 50 })),
  secondLastName: z.string().max(50, t('validation.maxChars', { n: 50 })).optional(),
  password: z
    .string()
    .min(10, t('validation.minChars', { n: 10 }))
    .regex(/[A-Z]/, t('validation.passwordUppercase'))
    .regex(/[a-z]/, t('validation.passwordLowercase'))
    .regex(/[0-9]/, t('validation.passwordNumber'))
    .regex(/[^A-Za-z0-9]/, t('validation.passwordSymbol')),
  documentType: z.string().min(1, t('validation.required')),
  documentNumber: z.string().min(1, t('validation.required')),
  phone: z.string().optional(),
  roleIds: z.array(z.string()).min(1, t('security.users.selectAtLeastOneRole')),
}))

const editSchema = computed(() => z.object({
  email: z.string().email(t('validation.emailInvalid')).optional(),
  firstName: z.string().min(1, t('validation.required')).max(50, t('validation.maxChars', { n: 50 })),
  middleName: z.string().max(50, t('validation.maxChars', { n: 50 })).optional(),
  lastName: z.string().min(1, t('validation.required')).max(50, t('validation.maxChars', { n: 50 })),
  secondLastName: z.string().max(50, t('validation.maxChars', { n: 50 })).optional(),
  documentType: z.string().optional(),
  documentNumber: z.string().optional(),
  phone: z.string().optional(),
  status: z.string(),
  roleIds: z.array(z.string()).min(1, t('security.users.selectAtLeastOneRole')),
}))

const schema = computed(() => (mode.value === 'create' ? createSchema.value : editSchema.value))

function resetForm() {
  state.email = ''
  state.firstName = ''
  state.middleName = ''
  state.lastName = ''
  state.secondLastName = ''
  state.password = ''
  state.documentType = undefined
  state.documentNumber = ''
  state.phone = ''
  state.status = 'ACTIVE'
  state.active = true
  state.roleIds = []
}

function openCreate() {
  mode.value = 'create'
  editingUuid.value = null
  resetForm()
  formOpen.value = true
  loadCatalogs()
}

// Snapshot of the last-loaded edit state, used to warn before a refresh
// discards unsaved changes.
const editSnapshot = ref('')
function snapEditState() { return JSON.stringify(state) }
const isEditDirty = computed(() => editSnapshot.value !== '' && snapEditState() !== editSnapshot.value)
const discardConfirmOpen = ref(false)
const editReloading = ref(false)

function populateEditForm(u: UserDto) {
  editingUuid.value = u.uuid
  editingItem.value = u
  resetForm()
  state.email = u.email
  state.firstName = u.firstName ?? ''
  state.middleName = u.middleName ?? ''
  state.lastName = u.lastName ?? ''
  state.secondLastName = u.secondLastName ?? ''
  state.documentType = u.documentType || undefined
  state.documentNumber = u.documentNumber ?? ''
  state.phone = u.phone ?? ''
  state.status = u.status || 'ACTIVE'
  state.active = u.active ?? true
  state.roleIds = (u.roles ?? []).map(r => r.uuid)
  editSnapshot.value = snapEditState()
}

function openEdit(u: UserDto) {
  mode.value = 'edit'
  populateEditForm(u)
  formOpen.value = true
  loadCatalogs()
}

async function reloadEditForm() {
  if (!editingUuid.value) return
  editReloading.value = true
  try { populateEditForm(await users.get(editingUuid.value)) }
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

async function onSubmit(_event: FormSubmitEvent<Record<string, unknown>>) {
  isSubmitting.value = true
  try {
    if (mode.value === 'create') {
      const body: AdminCreateUserRequest = {
        email: state.email,
        firstName: state.firstName,
        middleName: state.middleName || undefined,
        lastName: state.lastName,
        secondLastName: state.secondLastName || undefined,
        password: state.password,
        documentType: state.documentType!,
        documentNumber: state.documentNumber,
        phone: state.phone || undefined,
        roleIds: state.roleIds,
      }
      await users.create(body)
      toast.add({ title: t('security.users.createdToast'), color: 'success', icon: 'i-lucide-check-circle' })
    }
    else if (editingUuid.value) {
      const body: AdminUpdateUserRequest = {
        firstName: state.firstName,
        middleName: state.middleName || undefined,
        lastName: state.lastName,
        secondLastName: state.secondLastName || undefined,
        documentType: state.documentType || undefined,
        documentNumber: state.documentNumber || undefined,
        phone: state.phone || undefined,
        status: state.status,
        active: state.active,
        roleIds: state.roleIds,
      }
      await users.update(editingUuid.value, body)
      toast.add({ title: t('security.users.updatedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    }
    formOpen.value = false
    await load()
  }
  catch {
    // useApi ya notificó el error (409 email duplicado, 422, etc.)
  }
  finally {
    isSubmitting.value = false
  }
}

// ---- Eliminar ----
const deleteOpen = ref(false)
const deleting = ref(false)
const target = ref<UserDto | null>(null)
const usageChecking = ref(false)
const usageInfo = ref<{ inUse: boolean, count: number } | null>(null)

async function openDelete(u: UserDto) {
  target.value = u
  deleteOpen.value = true
  usageChecking.value = true
  usageInfo.value = null
  try {
    usageInfo.value = await users.usage(u.uuid)
  }
  catch {
    // Fallback: treat as "in use" for safety (soft-deactivate instead of physical delete).
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

// ---- Restore (undo soft-delete) ----
const restoring = ref(false)

async function restoreUser(u: UserDto) {
  restoring.value = true
  try {
    await users.update(u.uuid, { active: true })
    toast.add({ title: t('security.users.restoredToast'), color: 'success', icon: 'i-lucide-check-circle' })
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
  const wasPhysical = usageInfo.value?.inUse === false
  try {
    await users.remove(target.value.uuid, wasPhysical)
    toast.add({
      title: wasPhysical
        ? t('security.users.deletedPermanentToast')
        : t('security.users.deactivatedToast'),
      color: wasPhysical ? 'success' : 'info',
      icon: wasPhysical ? 'i-lucide-check-circle' : 'i-lucide-info',
    })
    deleteOpen.value = false
    // Si la página queda vacía tras borrar, retrocede una.
    if (data.value.length === 1 && page.value > 1) page.value -= 1
    else await load()
  }
  catch {
    // toast por useApi
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
        <h1 class="text-2xl font-extrabold text-prohealth-900">{{ $t('security.users.title') }}</h1>
        <p class="text-sm text-prohealth-700/70 mt-1">
          {{ $t('security.users.subtitle') }}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <ListRefreshMenu :loading="loading" variant="ghost" @refresh="load" @reset="resetFilters" />
        <ReportPrintButton variant="ghost" />
        <UTooltip :text="canCreate ? $t('security.users.createTooltip') : $t('security.users.noPermissionCreate')">
          <UButton
            color="primary"
            variant="outline"
            icon="i-lucide-plus"
            :disabled="!canCreate"
            @click="openCreate"
          >
            {{ $t('common.new') }}
          </UButton>
        </UTooltip>
      </div>
    </div>

    <!-- Búsqueda -->
    <div class="bg-white rounded-2xl border border-prohealth-100 p-4 flex flex-wrap items-center gap-3">
      <UInput
        v-model="search"
        :placeholder="$t('security.users.searchPlaceholder')"
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

    <!-- Tabla -->
    <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden flex flex-col h-[calc(100vh-19rem)] min-h-[24rem]">
      <div class="overflow-auto flex-1">
        <table class="w-full text-sm">
          <thead class="sticky top-0 bg-white z-10">
            <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('fullName')">
                {{ $t('security.users.columns.user') }}
                <SortIndicator :state="sort.stateOf('fullName')" :multi-active="isMultiSort" @clear="sort.remove('fullName')" />
              </th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('documentNumber')">
                {{ $t('security.users.columns.document') }}
                <SortIndicator :state="sort.stateOf('documentNumber')" :multi-active="isMultiSort" @clear="sort.remove('documentNumber')" />
              </th>
              <th class="px-5 py-3 font-semibold">{{ $t('security.users.columns.roles') }}</th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('status')">
                {{ $t('security.users.columns.status') }}
                <SortIndicator :state="sort.stateOf('status')" :multi-active="isMultiSort" @clear="sort.remove('status')" />
              </th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('lastLoginAt')">
                {{ $t('security.users.columns.lastLogin') }}
                <SortIndicator :state="sort.stateOf('lastLoginAt')" :multi-active="isMultiSort" @clear="sort.remove('lastLoginAt')" />
              </th>
              <th class="px-5 py-3 font-semibold text-right">{{ $t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-prohealth-100">
            <TableSkeleton v-if="loading" :rows="8" :cols="6" />
            <tr v-else-if="data.length === 0">
              <td colspan="6" class="px-5 py-12 text-center text-prohealth-500">
                <UIcon name="i-lucide-users" class="w-8 h-8 mx-auto mb-2 text-prohealth-300" />
                {{ $t('security.users.empty') }}
              </td>
            </tr>
            <tr
              v-for="u in data"
              v-else
              :key="u.uuid"
              class="hover:bg-prohealth-50/50"
              :class="{ 'opacity-60': u.active === false }"
              @dblclick="(e: MouseEvent) => { if (!(e.target as HTMLElement).closest('button, a')) navigateTo(`/dashboard/users/${u.uuid}`) }"
            >
              <td class="px-5 py-3">
                <div class="font-semibold text-prohealth-900">{{ u.fullName }}</div>
                <div class="text-xs text-prohealth-500">{{ u.email }}</div>
              </td>
              <td class="px-5 py-3 text-prohealth-700">
                <span v-if="u.documentNumber">{{ u.documentType }} {{ u.documentNumber }}</span>
                <span v-else class="text-prohealth-400">—</span>
              </td>
              <td class="px-5 py-3">
                <div class="flex flex-wrap gap-1">
                  <UBadge
                    v-for="r in u.roles"
                    :key="r.uuid"
                    color="primary"
                    variant="subtle"
                    size="sm"
                  >
                    {{ r.name }}
                  </UBadge>
                  <span v-if="!u.roles?.length" class="text-prohealth-400">—</span>
                </div>
              </td>
              <td class="px-5 py-3">
                <UBadge
                  :color="u.active === false ? 'neutral' : (u.status === 'ACTIVE' ? 'success' : 'warning')"
                  variant="subtle"
                  size="sm"
                >
                  {{ statusLabel(u) }}
                </UBadge>
              </td>
              <td class="px-5 py-3 text-prohealth-600">{{ u.lastLoginAt_Display ?? formatDate(u.lastLoginAt, 'datetime') }}</td>
              <td class="px-5 py-3">
                <div class="flex items-center justify-end gap-1">
                  <UTooltip :text="$t('security.users.viewDetailTooltip')">
                    <UButton
                      color="neutral"
                      variant="ghost"
                      icon="i-lucide-eye"
                      size="sm"
                      :to="`/dashboard/users/${u.uuid}`"
                    />
                  </UTooltip>
                  <UTooltip :text="canUpdate ? $t('common.edit') : $t('security.users.noPermissionEdit')">
                    <UButton
                      color="info"
                      variant="ghost"
                      icon="i-lucide-pencil"
                      size="sm"
                      :disabled="!canUpdate"
                      @click="openEdit(u)"
                    />
                  </UTooltip>
                  <ReportPrintButton
                    table-name="users"
                    :record-uuid="u.uuid"
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
                      @click="openAudit(u)"
                    />
                  </UTooltip>
                  <UTooltip :text="canDelete ? $t('common.delete') : $t('security.users.noPermissionDelete')">
                    <UButton
                      color="error"
                      variant="ghost"
                      icon="i-lucide-trash-2"
                      size="sm"
                      class="ms-2"
                      :disabled="!canDelete"
                      @click="openDelete(u)"
                    />
                  </UTooltip>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Paginación -->
      <div class="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t border-prohealth-100 shrink-0">
        <p class="text-xs text-prohealth-500">
          {{ $t('security.users.paginationSummary', { shown: data.length, total }) }}
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

    <!-- Modal crear/editar -->
    <UModal
      v-model:open="formOpen"
      :title="mode === 'create' ? $t('security.users.modalCreateTitle') : $t('security.users.modalEditTitle')"
      :description="mode === 'create' ? $t('security.users.modalCreateDescription') : $t('security.users.modalEditDescription')"
    >
      <template #body>
        <UForm
          :schema="schema"
          :state="state"
          class="space-y-4"
          @submit="onSubmit"
        >
          <UFormField :label="$t('security.users.fields.email')" name="email" :required="mode === 'create'">
            <UInput
              v-model="state.email"
              type="email"
              autocomplete="off"
              class="w-full"
              :disabled="mode === 'edit'"
            />
          </UFormField>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField :label="$t('security.users.fields.firstName')" name="firstName" required>
              <UInput v-model="state.firstName" class="w-full" />
            </UFormField>
            <UFormField :label="$t('security.users.fields.middleName')" name="middleName">
              <UInput v-model="state.middleName" class="w-full" />
            </UFormField>
            <UFormField :label="$t('security.users.fields.lastName')" name="lastName" required>
              <UInput v-model="state.lastName" class="w-full" />
            </UFormField>
            <UFormField :label="$t('security.users.fields.secondLastName')" name="secondLastName">
              <UInput v-model="state.secondLastName" class="w-full" />
            </UFormField>
          </div>

          <UFormField v-if="mode === 'create'" :label="$t('security.users.fields.password')" name="password" required>
            <UInput v-model="state.password" type="password" autocomplete="new-password" class="w-full" />
          </UFormField>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField :label="$t('security.users.fields.documentType')" name="documentType">
              <USelectMenu
                v-model="state.documentType"
                :items="documentTypeOptions"
                label-key="label"
                value-key="value"
                :placeholder="$t('common.select')"
                class="w-full"
              />
            </UFormField>
            <UFormField :label="$t('security.users.fields.documentNumber')" name="documentNumber">
              <UInput v-model="state.documentNumber" class="w-full" />
            </UFormField>
          </div>

          <UFormField :label="$t('security.users.fields.phone')" name="phone">
            <UInput v-model="state.phone" class="w-full" />
          </UFormField>

          <div v-if="mode === 'edit'" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField :label="$t('security.users.fields.status')" name="status">
              <USelectMenu
                v-model="state.status"
                :items="statusOptions"
                label-key="label"
                value-key="value"
                class="w-full"
              />
            </UFormField>
            <UFormField :label="$t('security.users.fields.active')" name="active">
              <USwitch v-model="state.active" />
            </UFormField>
          </div>

          <UFormField :label="$t('security.users.fields.roles')" name="roleIds" required>
            <USelectMenu
              v-model="state.roleIds"
              :items="roleOptions"
              label-key="label"
              value-key="value"
              multiple
              icon="i-lucide-list-checks"
              :placeholder="$t('security.users.selectRolesPlaceholder')"
              class="w-full"
            />
          </UFormField>

          <p class="text-xs text-prohealth-500">{{ $t('common.requiredFieldsHint') }}</p>

          <div class="flex items-center justify-between gap-3 pt-2">
            <div v-if="mode === 'edit' && editingItem">
              <RestoreButton
                v-if="editingItem.active === false"
                :active="editingItem.active"
                :allowed="canDelete"
                :loading="restoring"
                :disabled="isSubmitting"
                @restore="restoreUser(editingItem)"
              />
              <UTooltip v-else :text="canDelete ? $t('common.delete') : $t('security.users.noPermissionDelete')">
                <UButton
                  color="error"
                  variant="ghost"
                  icon="i-lucide-trash-2"
                  size="sm"
                  :label="$t('common.delete')"
                  :disabled="isSubmitting || !canDelete"
                  @click="openDeleteFromEdit"
                />
              </UTooltip>
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

        <!-- Discard unsaved changes before refreshing -->
        <UModal v-model:open="discardConfirmOpen" :title="$t('common.discardChangesTitle')">
          <template #body>
            <p class="text-sm text-prohealth-700">{{ $t('common.discardChangesBody') }}</p>
            <div class="flex items-center justify-end gap-3 pt-5">
              <UButton color="neutral" variant="ghost" @click="discardConfirmOpen = false">{{ $t('common.cancel') }}</UButton>
              <UButton color="warning" icon="i-lucide-refresh-cw" @click="discardAndRefresh">{{ $t('common.discardAndRefresh') }}</UButton>
            </div>
          </template>
        </UModal>
      </template>
    </UModal>

    <!-- Modal confirmar eliminación -->
    <UModal v-model:open="deleteOpen" :title="$t('security.users.deleteTitle')">
      <template #body>
        <div v-if="usageChecking" class="flex items-center gap-2 text-sm text-prohealth-600">
          <UIcon name="i-lucide-loader-2" class="w-4 h-4 animate-spin" />
          {{ $t('common.loading') }}
        </div>
        <p v-else class="text-sm text-prohealth-700">
          {{
            usageInfo?.inUse === false
              ? t('security.users.deleteConfirmPermanent')
              : t('security.users.deleteConfirmDeactivate', { count: usageInfo?.count ?? 0 })
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
      v-if="auditTarget"
      v-model:open="auditOpen"
      entity-key="user"
      :entity-uuid="auditTarget.uuid"
      :entity-label="auditTarget.fullName"
      :entity-code="auditTarget.email"
      :can-view-changes="canViewAuditChanges"
      :can-view-reports="canViewAuditReports"
    />
  </div>
</template>
