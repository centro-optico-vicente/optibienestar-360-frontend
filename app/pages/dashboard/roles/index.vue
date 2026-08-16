<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { PermissionDomainDto, RoleDto } from '~/types/admin'
import { buildPageSizeItems, DEFAULT_PAGE_SIZE, UNPAGED_PAGE_SIZE } from '~/utils/pagination'

definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  // Entering only needs read access; each action is gated below by its own key
  // (V32), so a read-only role can consult the list without editing anything.
  permission: 'ROLE_VIEW',
})

const { t } = useI18n()

useSeoMeta({ title: () => t('security.roles.seoTitle') })

const rolesApi = useRoles()
const { can, hasRole } = usePermissions()
const toast = useToast()

// One key per action (V32), mirroring the backend's @PreAuthorize.
const canCreate = computed(() => can('ROLE_CREATE'))
const canUpdate = computed(() => can('ROLE_UPDATE'))
const canDelete = computed(() => can('ROLE_DELETE'))
const canEditPermissions = computed(() => can('ROLE_PERMISSION_EDIT'))

const isSystemUser = computed(() => hasRole('SYSTEM'))

function isSystemRole(r: RoleDto): boolean {
  return r.name === 'SYSTEM'
}

/** The SYSTEM role is only touchable by a SYSTEM actor (403 `role.system.not_editable`). */
function systemAllows(r: RoleDto): boolean {
  return !isSystemRole(r) || isSystemUser.value
}

/**
 * Mirrors the backend guards: every action needs its own key, and the SYSTEM
 * role additionally requires a SYSTEM actor. Deleting the SYSTEM role is blocked
 * for everyone (`role.system.not_deletable`), even for a SYSTEM actor.
 */
function canEditRole(r: RoleDto): boolean {
  return canUpdate.value && systemAllows(r)
}

function canEditRolePermissions(r: RoleDto): boolean {
  return canEditPermissions.value && systemAllows(r)
}

function canDeleteRole(r: RoleDto): boolean {
  return canDelete.value && !isSystemRole(r)
}

const roles = ref<RoleDto[]>([])
const domains = ref<PermissionDomainDto[]>([])
const loading = ref(false)
const search = ref('')
const includeInactive = ref(false)

// Client-side pagination: the backend endpoint (GET /v1/admin/roles) returns the
// full list — it doesn't accept Pageable — so page/size are sliced here.
const page = ref(1)
const size = ref(DEFAULT_PAGE_SIZE)
const pageSizeItems = buildPageSizeItems(t)

// The backend may still ignore `q` until the other session ships support for it;
// this client-side filter keeps the search box working immediately either way.
// Only applied when there's an active search term, to avoid double-filtering once
// the backend does honor `q` for real.
const filteredRoles = computed(() => {
  const term = search.value.trim().toLowerCase()
  if (!term) return roles.value
  return roles.value.filter(r =>
    r.name?.toLowerCase().includes(term) || r.description?.toLowerCase().includes(term),
  )
})
const total = computed(() => filteredRoles.value.length)
const pagedRoles = computed(() => {
  if (size.value === UNPAGED_PAGE_SIZE) return filteredRoles.value
  const start = (page.value - 1) * size.value
  return filteredRoles.value.slice(start, start + size.value)
})
watch(size, () => { page.value = 1 })
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    loadRoles()
  }, 400)
})
watch(includeInactive, () => { page.value = 1; loadRoles() })

// Total de permisos del catálogo (para mostrar "n/total" por rol).
const totalPermissions = computed(() =>
  domains.value.reduce((acc, d) => acc + d.permissions.length, 0),
)

async function loadRoles() {
  loading.value = true
  try {
    roles.value = await rolesApi.list({ q: search.value.trim() || undefined, includeInactive: includeInactive.value })
  }
  catch {
    roles.value = []
  }
  finally {
    loading.value = false
  }
}

async function loadPermissions() {
  try {
    domains.value = await rolesApi.permissions()
  }
  catch {
    domains.value = []
  }
}

onMounted(async () => {
  await Promise.all([loadRoles(), loadPermissions()])
})

// ---- CRUD de roles ----
const roleFormOpen = ref(false)
const roleMode = ref<'create' | 'edit'>('create')
const roleEditingUuid = ref<string | null>(null)
/** Role open in the name/description modal; drives its inline actions. */
const roleEditing = ref<RoleDto | null>(null)
const roleSubmitting = ref(false)

const roleState = reactive({ name: '', description: '' })
// Kept outside `roleState` (a string-only form-state map) so the boolean isn't coerced.
const roleIsActive = ref(true)

const roleSchema = computed(() => z.object({
  name: z
    .string()
    .min(3, t('validation.minChars', { n: 3 }))
    .regex(/^[A-Z][A-Z0-9_]*$/, t('security.roles.nameFormat')),
  description: z.string().optional(),
}))

function openRoleCreate() {
  roleMode.value = 'create'
  roleEditingUuid.value = null
  roleEditing.value = null
  roleState.name = ''
  roleState.description = ''
  roleIsActive.value = true
  roleFormOpen.value = true
}

function openRoleEdit(r: RoleDto) {
  roleMode.value = 'edit'
  roleEditingUuid.value = r.uuid
  roleEditing.value = r
  roleState.name = r.name
  roleState.description = r.description ?? ''
  roleIsActive.value = r.active ?? true
  roleFormOpen.value = true
}

// Shortcuts from the edit modal to the role's other two actions. They close this
// modal first so two dialogs never stack.
function openPermissionsFromEdit() {
  const r = roleEditing.value
  if (!r) return
  roleFormOpen.value = false
  openEdit(r)
}

function openDeleteFromEdit() {
  const r = roleEditing.value
  if (!r) return
  roleFormOpen.value = false
  openRoleDelete(r)
}

async function onRoleSubmit(_event: FormSubmitEvent<Record<string, unknown>>) {
  roleSubmitting.value = true
  try {
    if (roleMode.value === 'create') {
      await rolesApi.create({
        name: roleState.name,
        description: roleState.description || undefined,
      })
      toast.add({ title: t('security.roles.createdToast'), color: 'success', icon: 'i-lucide-check-circle' })
    }
    else if (roleEditingUuid.value) {
      await rolesApi.update(roleEditingUuid.value, {
        name: roleState.name,
        description: roleState.description || undefined,
        active: roleIsActive.value,
      })
      toast.add({ title: t('security.roles.updatedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    }
    roleFormOpen.value = false
    await loadRoles()
  }
  catch {
    // useApi ya notificó el error (409 nombre duplicado, 422, etc.)
  }
  finally {
    roleSubmitting.value = false
  }
}

const roleDeleteOpen = ref(false)
const roleDeleting = ref(false)
const roleTarget = ref<RoleDto | null>(null)
const roleUsageChecking = ref(false)
const roleUsageInfo = ref<{ inUse: boolean, count: number } | null>(null)

async function openRoleDelete(r: RoleDto) {
  roleTarget.value = r
  roleDeleteOpen.value = true
  roleUsageChecking.value = true
  roleUsageInfo.value = null
  try {
    roleUsageInfo.value = await rolesApi.usage(r.uuid)
  }
  catch {
    // Fallback: treat as "in use" for safety (soft-deactivate instead of physical delete).
    roleUsageInfo.value = null
  }
  finally {
    roleUsageChecking.value = false
  }
}

async function confirmRoleDelete() {
  if (!roleTarget.value) return
  roleDeleting.value = true
  const wasPhysical = roleUsageInfo.value?.inUse === false
  try {
    await rolesApi.remove(roleTarget.value.uuid, wasPhysical)
    toast.add({
      title: wasPhysical
        ? t('security.roles.deletedPermanentToast')
        : t('security.roles.deactivatedToast'),
      color: wasPhysical ? 'success' : 'info',
      icon: wasPhysical ? 'i-lucide-check-circle' : 'i-lucide-info',
    })
    roleDeleteOpen.value = false
    await loadRoles()
  }
  catch {
    // toast por useApi (422 si tiene usuarios asignados, etc.)
  }
  finally {
    roleDeleting.value = false
  }
}

// ---- Edición de permisos por rol ----
const formOpen = ref(false)
const isSubmitting = ref(false)
const loadingPerms = ref(false)
const editing = ref<RoleDto | null>(null)
const selected = ref<string[]>([])

function isChecked(uuid: string) {
  return selected.value.includes(uuid)
}

function togglePermission(uuid: string, checked: boolean) {
  if (checked) {
    if (!selected.value.includes(uuid)) selected.value.push(uuid)
  }
  else {
    selected.value = selected.value.filter(u => u !== uuid)
  }
}

function domainState(domain: PermissionDomainDto): boolean | 'indeterminate' {
  const ids = domain.permissions.map(p => p.uuid)
  const count = ids.filter(id => selected.value.includes(id)).length
  if (count === 0) return false
  if (count === ids.length) return true
  return 'indeterminate'
}

function toggleDomain(domain: PermissionDomainDto, checked: boolean) {
  const ids = domain.permissions.map(p => p.uuid)
  if (checked) {
    const set = new Set([...selected.value, ...ids])
    selected.value = [...set]
  }
  else {
    selected.value = selected.value.filter(u => !ids.includes(u))
  }
}

async function openEdit(role: RoleDto) {
  editing.value = role
  selected.value = []
  formOpen.value = true
  loadingPerms.value = true
  try {
    selected.value = await rolesApi.getRolePermissions(role.uuid)
  }
  catch {
    selected.value = []
  }
  finally {
    loadingPerms.value = false
  }
}

async function onSave() {
  if (!editing.value || selected.value.length === 0) return
  isSubmitting.value = true
  try {
    await rolesApi.updateRolePermissions(editing.value.uuid, selected.value)
    toast.add({ title: t('security.roles.permissionsUpdatedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    formOpen.value = false
  }
  catch {
    // useApi ya notificó el error
  }
  finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="space-y-5">
    <!-- Header -->
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-extrabold text-prohealth-900">{{ $t('security.roles.title') }}</h1>
        <p class="text-sm text-prohealth-700/70 mt-1">
          {{ $t('security.roles.subtitle') }}
        </p>
      </div>
      <UTooltip :text="canCreate ? $t('security.roles.createTooltip') : $t('security.roles.noPermissionCreate')">
        <UButton
          color="primary"
          icon="i-lucide-shield-plus"
          :disabled="!canCreate"
          @click="openRoleCreate"
        >
          {{ $t('security.roles.new') }}
        </UButton>
      </UTooltip>
    </div>

    <!-- Search -->
    <div class="bg-white rounded-2xl border border-prohealth-100 p-4 flex flex-wrap items-center gap-3">
      <UInput
        v-model="search"
        :placeholder="$t('security.roles.searchPlaceholder')"
        icon="i-lucide-search"
        size="lg"
        class="w-full max-w-md"
      />
      <UCheckbox v-model="includeInactive" :label="$t('catalogs.includeInactive')" class="self-center" />
    </div>

    <!-- Tabla de roles -->
    <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden flex flex-col h-[calc(100vh-15rem)] min-h-[20rem]">
      <div class="overflow-auto flex-1">
        <table class="w-full text-sm">
          <thead class="sticky top-0 bg-white z-10">
            <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
              <th class="px-5 py-3 font-semibold">{{ $t('security.roles.columns.role') }}</th>
              <th class="px-5 py-3 font-semibold">{{ $t('security.roles.columns.description') }}</th>
              <th class="px-5 py-3 font-semibold text-right">{{ $t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-prohealth-100">
            <TableSkeleton v-if="loading" :rows="5" :cols="3" />
            <tr v-else-if="filteredRoles.length === 0">
              <td colspan="3" class="px-5 py-12 text-center text-prohealth-500">
                <UIcon name="i-lucide-shield" class="w-8 h-8 mx-auto mb-2 text-prohealth-300" />
                {{ $t('security.roles.empty') }}
              </td>
            </tr>
            <tr
              v-for="r in pagedRoles"
              v-else
              :key="r.uuid"
              class="hover:bg-prohealth-50/50"
              :class="{ 'opacity-60': r.active === false }"
            >
              <td class="px-5 py-3">
                <UBadge color="primary" variant="subtle">{{ r.name }}</UBadge>
              </td>
              <td class="px-5 py-3 text-prohealth-700">
                {{ r.description || $t('common.empty') }}
              </td>
              <td class="px-5 py-3">
                <div class="flex items-center justify-end gap-1">
                  <UTooltip :text="!canEditPermissions ? $t('security.roles.noPermission') : (canEditRolePermissions(r) ? $t('security.roles.editPermissionsTooltip') : $t('security.roles.systemOnlySystemActor'))">
                    <UButton
                      color="neutral"
                      variant="ghost"
                      icon="i-lucide-key-round"
                      size="sm"
                      :label="$t('security.roles.permissions')"
                      :disabled="!canEditRolePermissions(r)"
                      @click="openEdit(r)"
                    />
                  </UTooltip>
                  <UTooltip :text="!canUpdate ? $t('security.roles.noPermission') : (canEditRole(r) ? $t('security.roles.editRoleTooltip') : $t('security.roles.systemOnlySystemActor'))">
                    <UButton
                      color="neutral"
                      variant="ghost"
                      icon="i-lucide-pencil"
                      size="sm"
                      :disabled="!canEditRole(r)"
                      @click="openRoleEdit(r)"
                    />
                  </UTooltip>
                  <UTooltip :text="!canDelete ? $t('security.roles.noPermission') : (isSystemRole(r) ? $t('security.roles.systemNotDeletable') : $t('security.roles.deleteRoleTooltip'))">
                    <UButton
                      color="error"
                      variant="ghost"
                      icon="i-lucide-trash-2"
                      size="sm"
                      :disabled="!canDeleteRole(r)"
                      @click="openRoleDelete(r)"
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
          {{ $t('catalogs.recordCount', { count: total }) }}
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

    <!-- Modal crear/editar rol -->
    <UModal
      v-model:open="roleFormOpen"
      :title="roleMode === 'create' ? $t('security.roles.modalCreateTitle') : $t('security.roles.modalEditTitle')"
      :description="roleMode === 'create' ? $t('security.roles.modalCreateDescription') : $t('security.roles.modalEditDescription')"
    >
      <template #body>
        <UForm
          :schema="roleSchema"
          :state="roleState"
          class="space-y-4"
          @submit="onRoleSubmit"
        >
          <UFormField :label="$t('security.roles.fields.name')" name="name" required>
            <UInput v-model="roleState.name" placeholder="GERENTE_ALIADO" class="w-full" />
          </UFormField>

          <UFormField :label="$t('security.roles.fields.description')" name="description">
            <UTextarea v-model="roleState.description" :rows="2" class="w-full" />
          </UFormField>

          <UFormField v-if="roleMode === 'edit'" :label="$t('security.roles.fields.active')">
            <USwitch v-model="roleIsActive" />
          </UFormField>

          <p class="text-xs text-prohealth-500">{{ $t('common.requiredFieldsHint') }}</p>

          <div class="flex items-center justify-between gap-3 pt-2">
            <!-- Inline actions on the same role; meaningless while creating one that does not exist yet. -->
            <div v-if="roleMode === 'edit' && roleEditing" class="flex items-center gap-1">
              <UTooltip :text="!canEditPermissions ? $t('security.roles.noPermission') : (canEditRolePermissions(roleEditing) ? $t('security.roles.editPermissionsTooltip') : $t('security.roles.systemOnlySystemActor'))">
                <UButton
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-key-round"
                  size="sm"
                  :label="$t('security.roles.permissions')"
                  :disabled="roleSubmitting || !canEditRolePermissions(roleEditing)"
                  @click="openPermissionsFromEdit"
                />
              </UTooltip>
              <UTooltip :text="!canDelete ? $t('security.roles.noPermission') : (isSystemRole(roleEditing) ? $t('security.roles.systemNotDeletable') : $t('security.roles.deleteRoleTooltip'))">
                <UButton
                  color="error"
                  variant="ghost"
                  icon="i-lucide-trash-2"
                  size="sm"
                  :label="$t('common.delete')"
                  :disabled="roleSubmitting || !canDeleteRole(roleEditing)"
                  @click="openDeleteFromEdit"
                />
              </UTooltip>
            </div>
            <div v-else />

            <div class="flex items-center gap-3">
              <UButton color="neutral" variant="ghost" :disabled="roleSubmitting" @click="roleFormOpen = false">
                {{ $t('common.cancel') }}
              </UButton>
              <UButton type="submit" color="primary" :loading="roleSubmitting" icon="i-lucide-save">
                {{ roleMode === 'create' ? $t('security.roles.submitCreate') : $t('common.saveChanges') }}
              </UButton>
            </div>
          </div>
        </UForm>
      </template>
    </UModal>

    <!-- Modal confirmar eliminación de rol -->
    <UModal v-model:open="roleDeleteOpen" :title="$t('security.roles.deleteTitle')">
      <template #body>
        <div v-if="roleUsageChecking" class="flex items-center gap-2 text-sm text-prohealth-600">
          <UIcon name="i-lucide-loader-2" class="w-4 h-4 animate-spin" />
          {{ $t('common.loading') }}
        </div>
        <p v-else class="text-sm text-prohealth-700">
          {{
            roleUsageInfo?.inUse === false
              ? t('security.roles.deleteConfirmPermanent')
              : t('security.roles.deleteConfirmDeactivate', { count: roleUsageInfo?.count ?? 0 })
          }}
        </p>
        <div class="flex items-center justify-end gap-3 pt-5">
          <UButton color="neutral" variant="ghost" :disabled="roleDeleting" @click="roleDeleteOpen = false">
            {{ $t('common.cancel') }}
          </UButton>
          <UButton color="error" :loading="roleDeleting" :disabled="roleUsageChecking" icon="i-lucide-trash-2" @click="confirmRoleDelete">
            {{ $t('common.delete') }}
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Modal editar permisos del rol -->
    <UModal
      v-model:open="formOpen"
      :title="$t('security.roles.permissionsModalTitle', { name: editing?.name ?? '' })"
      :description="$t('security.roles.permissionsModalDescription')"
    >
      <template #body>
        <div v-if="loadingPerms" class="space-y-4 max-h-[60vh] overflow-hidden">
          <div
            v-for="i in 3"
            :key="i"
            class="rounded-xl border border-prohealth-100 overflow-hidden"
          >
            <div class="px-4 py-2.5 bg-prohealth-50/60 border-b border-prohealth-100">
              <USkeleton class="h-4 w-40 rounded" />
            </div>
            <div class="p-3 grid sm:grid-cols-2 gap-3">
              <USkeleton v-for="j in 4" :key="j" class="h-5 w-full rounded" />
            </div>
          </div>
        </div>

        <div v-else class="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          <div
            v-for="domain in domains"
            :key="domain.uuid"
            class="rounded-xl border border-prohealth-100 overflow-hidden"
          >
            <div class="flex items-center gap-2 px-4 py-2.5 bg-prohealth-50/60 border-b border-prohealth-100">
              <UCheckbox
                :model-value="domainState(domain)"
                @update:model-value="(v: boolean | 'indeterminate') => toggleDomain(domain, v === true)"
              />
              <UIcon v-if="domain.icon" :name="domain.icon" class="w-4 h-4 text-prohealth-500" />
              <span class="font-semibold text-prohealth-800">{{ domain.name }}</span>
            </div>
            <div class="p-3 grid sm:grid-cols-2 gap-2">
              <label
                v-for="p in domain.permissions"
                :key="p.uuid"
                class="flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-prohealth-50/50 cursor-pointer"
              >
                <UCheckbox
                  :model-value="isChecked(p.uuid)"
                  @update:model-value="(v: boolean | 'indeterminate') => togglePermission(p.uuid, v === true)"
                />
                <span class="text-sm">
                  <span class="font-medium text-prohealth-800">{{ p.name }}</span>
                  <span v-if="p.description" class="block text-xs text-prohealth-500">{{ p.description }}</span>
                </span>
              </label>
            </div>
          </div>

          <p v-if="domains.length === 0" class="text-sm text-amber-600">
            {{ $t('security.roles.permissionsCatalogError') }}
          </p>
        </div>

        <div class="flex items-center justify-between gap-3 pt-4 mt-2 border-t border-prohealth-100">
          <span class="text-xs text-prohealth-500">
            {{ $t('security.roles.permissionsCount', { selected: selected.length, total: totalPermissions }) }}
          </span>
          <div class="flex items-center gap-3">
            <UButton color="neutral" variant="ghost" :disabled="isSubmitting" @click="formOpen = false">
              {{ $t('common.cancel') }}
            </UButton>
            <UTooltip :text="selected.length === 0 ? $t('security.roles.selectAtLeastOnePermission') : ''">
              <UButton
                color="primary"
                icon="i-lucide-save"
                :loading="isSubmitting"
                :disabled="selected.length === 0 || loadingPerms"
                @click="onSave"
              >
                {{ $t('security.roles.savePermissions') }}
              </UButton>
            </UTooltip>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
