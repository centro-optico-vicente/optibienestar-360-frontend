<script setup lang="ts">
import { buildPageSizeItems, DEFAULT_PAGE_SIZE, UNPAGED_PAGE_SIZE } from '~/utils/pagination'
import type { UserDto } from '~/types/admin'
import type { SortDirection } from '~/composables/useTableSort'

definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'USER_VIEW_ALL',
})

const { t } = useI18n()

useSeoMeta({ title: () => t('security.users.seoTitle') })

const users = useUsers()
const { can } = usePermissions()
const { formatDate } = useFormatters()
const toast = useToast()

const canCreate = computed(() => can('USER_CREATE'))
const canUpdate = computed(() => can('USER_UPDATE'))
const canDelete = computed(() => can('USER_DELETE'))
const canViewRole = computed(() => can('ROLE_VIEW'))
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

/** Prefers the server-resolved `_Display` sibling (hub ADR 0014); falls back to the local i18n lookup. */
const STATUS_VALUES = ['ACTIVE', 'SUSPENDED', 'LOCKED']
function statusLabel(u: UserDto): string {
  if (u.active === false) return u.active_Display ?? t('security.users.inactive')
  if (!u.status) return t('common.empty')
  return u.status_Display ?? (STATUS_VALUES.includes(u.status) ? t(`security.users.status.${u.status}`) : u.status)
}

// `?edit=<uuid>` lets the user detail page ("Editar" button) reopen this
// modal without duplicating the create/edit form on a second page.
const route = useRoute()
const router = useRouter()

// `?delete=<uuid>` lets the user detail page ("Eliminar" inside the edit
// modal) delegate to this page's delete modal, which it has no equivalent of.
onMounted(async () => {
  await load()
  const editUuid = route.query.edit as string | undefined
  const deleteUuid = route.query.delete as string | undefined
  const targetUuid = editUuid || deleteUuid
  if (!targetUuid) return
  await router.replace({ query: {} })
  try {
    const found = await users.get(targetUuid)
    if (editUuid) openEdit(found)
    else openDelete(found)
  }
  catch {
    // Invalid/removed uuid: silently ignore, stay on the list.
  }
})

// ---- Formulario crear/editar (UserFormModal.vue) ----
const formOpen = ref(false)
const mode = ref<'create' | 'edit'>('create')
const editingItem = ref<UserDto | null>(null)

function openCreate() {
  mode.value = 'create'
  editingItem.value = null
  formOpen.value = true
}

function openEdit(u: UserDto) {
  mode.value = 'edit'
  editingItem.value = u
  formOpen.value = true
}

async function onUserSaved() {
  await load()
}

function onUserRestored() {
  load()
}

function onUserDeleteRequested(u: UserDto) {
  openDelete(u)
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
                  <template v-for="r in u.roles" :key="r.uuid">
                    <NuxtLink v-if="canViewRole" :to="`/dashboard/roles?edit=${r.uuid}`">
                      <UBadge color="primary" variant="subtle" size="sm" class="inline-flex items-center gap-1">
                        {{ r.name }}
                        <UIcon name="i-lucide-external-link" class="w-3 h-3 shrink-0" />
                      </UBadge>
                    </NuxtLink>
                    <UBadge v-else color="primary" variant="subtle" size="sm">{{ r.name }}</UBadge>
                  </template>
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
    <UserFormModal
      v-model:open="formOpen"
      :mode="mode"
      :user="editingItem"
      :can-delete="canDelete"
      @saved="onUserSaved"
      @restored="onUserRestored"
      @delete-requested="onUserDeleteRequested"
    />

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
