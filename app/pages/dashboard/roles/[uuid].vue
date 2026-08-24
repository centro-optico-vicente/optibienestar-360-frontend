<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { PermissionDomainDto, RoleDto, RoleUserDto } from '~/types/admin'

definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'ROLE_VIEW',
})

const { t } = useI18n()

useSeoMeta({ title: () => t('common.seoTitle', { page: t('security.roles.detail.seoPage') }) })

const route = useRoute()
const roleUuid = route.params.uuid as string

const rolesApi = useRoles()
const { can, hasRole } = usePermissions()
const toast = useToast()

const canUpdate = computed(() => can('ROLE_UPDATE'))
const canDelete = computed(() => can('ROLE_DELETE'))
const canEditPermissions = computed(() => can('ROLE_PERMISSION_EDIT'))
const canManageUsers = computed(() => can('ROLE_USERS_MANAGE'))
const canViewUsers = computed(() => can('USER_VIEW_ALL'))
const canViewAuditChanges = computed(() => can('AUDIT_VIEW_ALL'))
const canViewAuditReports = computed(() => can('REPORT_AUDIT_VIEW_ALL'))
const canViewAudit = computed(() => canViewAuditChanges.value || canViewAuditReports.value)

const isSystemUser = computed(() => hasRole('SYSTEM'))

function isSystemRole(r: RoleDto | null): boolean {
  return r?.name === 'SYSTEM'
}

/** The SYSTEM role is only touchable by a SYSTEM actor (403 `role.system.not_editable`). */
function systemAllows(r: RoleDto | null): boolean {
  return !isSystemRole(r) || isSystemUser.value
}

const canEditRole = computed(() => canUpdate.value && systemAllows(role.value))
const canEditRolePermissions = computed(() => canEditPermissions.value && systemAllows(role.value))
const canDeleteRole = computed(() => canDelete.value && !isSystemRole(role.value))

// ---- Role load ----
const role = ref<RoleDto | null>(null)
const loading = ref(true)
const notFound = ref(false)

async function loadRole() {
  loading.value = true
  try {
    role.value = await rolesApi.get(roleUuid)
  }
  catch {
    notFound.value = true
    role.value = null
  }
  finally {
    loading.value = false
  }
}

// ---- Tabs ----
const tabs = computed(() => [
  { label: t('security.roles.detail.tabs.permissions'), value: 'permissions', icon: 'i-lucide-key-round' },
  ...(canViewUsers.value
    ? [{ label: t('security.roles.detail.tabs.users'), value: 'users', icon: 'i-lucide-users' }]
    : []),
])
const activeTab = ref('permissions')

// =========================================================
// Permissions (modal, reusing roles/index.vue logic)
// =========================================================
const domains = ref<PermissionDomainDto[]>([])
const formOpen = ref(false)
const isSubmitting = ref(false)
const loadingPerms = ref(false)
const selected = ref<string[]>([])

const totalPermissions = computed(() =>
  domains.value.reduce((acc, d) => acc + d.permissions.length, 0),
)

async function loadPermissionsCatalog() {
  try {
    domains.value = await rolesApi.permissions()
  }
  catch {
    domains.value = []
  }
}

// ---- Granted permissions summary (read-only table on the permissions tab) ----
const grantedPermissionUuids = ref<string[]>([])
const grantedPermissionsLoading = ref(false)

async function loadGrantedPermissions() {
  grantedPermissionsLoading.value = true
  try {
    grantedPermissionUuids.value = await rolesApi.getRolePermissions(roleUuid)
  }
  catch {
    grantedPermissionUuids.value = []
  }
  finally {
    grantedPermissionsLoading.value = false
  }
}

const grantedPermissionsByDomain = computed(() =>
  domains.value
    .map(domain => ({
      domain,
      permissions: domain.permissions.filter(p => grantedPermissionUuids.value.includes(p.uuid)),
    }))
    .filter(entry => entry.permissions.length > 0),
)

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

interface ActionToggle {
  key: string
  labelKey: string
  suffixes: string[]
}

const ACTION_TOGGLES: ActionToggle[] = [
  { key: 'create', labelKey: 'security.roles.bulkActions.create', suffixes: ['_CREATE'] },
  { key: 'delete', labelKey: 'security.roles.bulkActions.delete', suffixes: ['_DELETE'] },
  { key: 'viewAll', labelKey: 'security.roles.bulkActions.viewAll', suffixes: ['_VIEW_ALL', '_VIEW'] },
  { key: 'reportGenerate', labelKey: 'security.roles.bulkActions.reportGenerate', suffixes: ['_REPORT_GENERATE'] },
]

function permissionsForAction(suffixes: string[]): string[] {
  const ids: string[] = []
  for (const domain of domains.value) {
    for (const p of domain.permissions) {
      if (suffixes.some(sfx => p.name.endsWith(sfx))) ids.push(p.uuid)
    }
  }
  return ids
}

function actionState(suffixes: string[]): boolean | 'indeterminate' {
  const ids = permissionsForAction(suffixes)
  if (ids.length === 0) return false
  const count = ids.filter(id => selected.value.includes(id)).length
  if (count === 0) return false
  if (count === ids.length) return true
  return 'indeterminate'
}

function toggleByAction(suffixes: string[], checked: boolean) {
  const ids = permissionsForAction(suffixes)
  if (checked) {
    const set = new Set([...selected.value, ...ids])
    selected.value = [...set]
  }
  else {
    selected.value = selected.value.filter(u => !ids.includes(u))
  }
}

async function openPermissionsModal() {
  if (!role.value) return
  selected.value = []
  formOpen.value = true
  loadingPerms.value = true
  try {
    selected.value = await rolesApi.getRolePermissions(role.value.uuid)
  }
  catch {
    selected.value = []
  }
  finally {
    loadingPerms.value = false
  }
}

async function onSavePermissions() {
  if (!role.value || selected.value.length === 0) return
  isSubmitting.value = true
  try {
    await rolesApi.updateRolePermissions(role.value.uuid, selected.value)
    toast.add({ title: t('security.roles.permissionsUpdatedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    formOpen.value = false
    await loadGrantedPermissions()
  }
  catch {
    // useApi ya notificó el error
  }
  finally {
    isSubmitting.value = false
  }
}

// =========================================================
// Assigned users
// =========================================================
const roleUsers = ref<RoleUserDto[]>([])
const roleUsersLoading = ref(false)

async function loadRoleUsers() {
  if (!canViewUsers.value) return
  roleUsersLoading.value = true
  try {
    roleUsers.value = await rolesApi.listUsers(roleUuid)
  }
  catch {
    // toast handled by useApi
  }
  finally {
    roleUsersLoading.value = false
  }
}

// System users for the assignment selector.
const userOptions = ref<{ label: string, value: string }[]>([])

async function loadUserOptions() {
  if (!canViewUsers.value) return
  try {
    const res = await useUsers().list({ size: 100, sort: 'createdAt,desc' })
    userOptions.value = (res.content ?? []).map(u => ({
      label: `${u.fullName} (${u.email})`,
      value: u.uuid,
    }))
  }
  catch {
    userOptions.value = []
  }
}

/** Only the users not yet assigned to this role. */
const availableUserOptions = computed(() => {
  const assigned = new Set(roleUsers.value.map(ru => ru.userUuid))
  return userOptions.value.filter(o => !assigned.has(o.value))
})

const userToAdd = ref<string | undefined>(undefined)
const userMutating = ref(false)

async function addRoleUser() {
  if (!userToAdd.value) return
  userMutating.value = true
  try {
    await rolesApi.assignUser(roleUuid, userToAdd.value)
    toast.add({ title: t('security.roles.detail.usersTab.assignedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    userToAdd.value = undefined
    await loadRoleUsers()
  }
  catch {
    // toast handled by useApi
  }
  finally {
    userMutating.value = false
  }
}

const roleUserDeleteOpen = ref(false)
const roleUserDeleting = ref(false)
const roleUserTarget = ref<RoleUserDto | null>(null)

function openRoleUserDelete(ru: RoleUserDto) {
  roleUserTarget.value = ru
  roleUserDeleteOpen.value = true
}

async function confirmRoleUserDelete() {
  if (!roleUserTarget.value) return
  roleUserDeleting.value = true
  try {
    await rolesApi.removeUser(roleUuid, roleUserTarget.value.userUuid)
    toast.add({ title: t('security.roles.detail.usersTab.unlinkedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    roleUserDeleteOpen.value = false
    await loadRoleUsers()
  }
  catch {
    // toast handled by useApi
  }
  finally {
    roleUserDeleting.value = false
  }
}

// ---- Delete role (mirrors roles/index.vue) ----
const roleDeleteOpen = ref(false)
const roleDeleting = ref(false)
const roleUsageChecking = ref(false)
const roleUsageInfo = ref<{ inUse: boolean, count: number } | null>(null)

async function openRoleDelete() {
  if (!role.value) return
  roleDeleteOpen.value = true
  roleUsageChecking.value = true
  roleUsageInfo.value = null
  try {
    roleUsageInfo.value = await rolesApi.usage(role.value.uuid)
  }
  catch {
    roleUsageInfo.value = null
  }
  finally {
    roleUsageChecking.value = false
  }
}

async function confirmRoleDelete() {
  if (!role.value) return
  roleDeleting.value = true
  const wasPhysical = roleUsageInfo.value?.inUse === false
  try {
    await rolesApi.remove(role.value.uuid, wasPhysical)
    toast.add({
      title: wasPhysical
        ? t('security.roles.deletedPermanentToast')
        : t('security.roles.deactivatedToast'),
      color: wasPhysical ? 'success' : 'info',
      icon: wasPhysical ? 'i-lucide-check-circle' : 'i-lucide-info',
    })
    roleDeleteOpen.value = false
    await navigateTo('/dashboard/roles')
  }
  catch {
    // toast por useApi (422 si tiene usuarios asignados, etc.)
  }
  finally {
    roleDeleting.value = false
  }
}

// ---- Edit role (name/description/active), mirrors roles/index.vue ----
const roleFormOpen = ref(false)
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

function openRoleEdit() {
  if (!role.value) return
  roleState.name = role.value.name
  roleState.description = role.value.description ?? ''
  roleIsActive.value = role.value.active ?? true
  roleFormOpen.value = true
}

async function onRoleSubmit(_event: FormSubmitEvent<Record<string, unknown>>) {
  if (!role.value) return
  roleSubmitting.value = true
  try {
    const updated = await rolesApi.update(role.value.uuid, {
      name: roleState.name,
      description: roleState.description || undefined,
      active: roleIsActive.value,
    })
    // Patch locally so the header reflects the change without a full page reload.
    role.value = updated
    toast.add({ title: t('security.roles.updatedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    roleFormOpen.value = false
  }
  catch {
    // useApi ya notificó el error (409 nombre duplicado, 422, etc.)
  }
  finally {
    roleSubmitting.value = false
  }
}

// ---- Audit ----
const auditOpen = ref(false)

// ---- Init ----
onMounted(async () => {
  await loadRole()
  await Promise.all([
    loadPermissionsCatalog(),
    loadGrantedPermissions(),
    loadRoleUsers(),
    loadUserOptions(),
  ])
})
</script>

<template>
  <div class="space-y-5">
    <!-- Back -->
    <UButton
      color="neutral"
      variant="ghost"
      icon="i-lucide-arrow-left"
      to="/dashboard/roles"
      size="sm"
    >
      {{ t('security.roles.title') }}
    </UButton>

    <!-- Loading -->
    <div v-if="loading" class="bg-white rounded-2xl border border-prohealth-100 p-6 space-y-3">
      <USkeleton class="h-7 w-64 rounded" />
      <USkeleton class="h-4 w-40 rounded" />
    </div>

    <!-- Not found -->
    <div v-else-if="notFound || !role" class="bg-white rounded-2xl border border-prohealth-100 p-12 text-center">
      <UIcon name="i-lucide-search-x" class="w-10 h-10 mx-auto mb-3 text-prohealth-300" />
      <p class="text-prohealth-700 font-semibold">{{ t('security.roles.detail.notFoundTitle') }}</p>
      <p class="text-sm text-prohealth-500 mt-1">{{ t('security.roles.detail.notFoundBody') }}</p>
    </div>

    <template v-else>
      <!-- Role header -->
      <div class="bg-white rounded-2xl border border-prohealth-100 p-6">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div class="flex items-center gap-3 flex-wrap">
              <h1 class="text-2xl font-extrabold text-prohealth-900">{{ role.name }}</h1>
              <UBadge :color="role.active === false ? 'neutral' : 'success'" variant="subtle">
                {{ role.active === false ? t('common.no') : t('common.yes') }}
              </UBadge>
            </div>
            <p class="text-sm text-prohealth-500 mt-1">
              {{ role.description || t('common.empty') }}
            </p>
          </div>
          <div class="flex items-center gap-2">
            <UTooltip :text="!canUpdate ? t('security.roles.noPermission') : (canEditRole ? t('security.roles.editRoleTooltip') : t('security.roles.systemOnlySystemActor'))">
              <UButton
                color="neutral"
                variant="ghost"
                icon="i-lucide-pencil"
                :disabled="!canEditRole"
                @click="openRoleEdit"
              />
            </UTooltip>
            <UTooltip :text="!canEditPermissions ? t('security.roles.noPermission') : (canEditRolePermissions ? t('security.roles.editPermissionsTooltip') : t('security.roles.systemOnlySystemActor'))">
              <UButton
                color="neutral"
                variant="ghost"
                icon="i-lucide-key-round"
                :disabled="!canEditRolePermissions"
                @click="openPermissionsModal"
              >
                {{ t('security.roles.permissions') }}
              </UButton>
            </UTooltip>
            <UTooltip :text="!canDelete ? t('security.roles.noPermission') : (isSystemRole(role) ? t('security.roles.systemNotDeletable') : t('security.roles.deleteRoleTooltip'))">
              <UButton
                color="error"
                variant="ghost"
                icon="i-lucide-trash-2"
                :disabled="!canDeleteRole"
                @click="openRoleDelete"
              />
            </UTooltip>
            <UTooltip v-if="canViewAudit" :text="t('audit.trigger')">
              <UButton color="neutral" variant="ghost" icon="i-lucide-history" @click="auditOpen = true" />
            </UTooltip>
          </div>
        </div>
      </div>

      <!-- Sub-resource tabs -->
      <UTabs v-model="activeTab" :items="tabs" :content="false" />

      <!-- ============ Permissions ============ -->
      <div v-show="activeTab === 'permissions'" class="bg-white rounded-2xl border border-prohealth-100 p-6">
        <div class="flex items-center justify-between gap-4">
          <div>
            <h2 class="font-bold text-prohealth-900">{{ t('security.roles.detail.tabs.permissions') }}</h2>
            <p class="text-xs text-prohealth-500 mt-0.5">{{ t('security.roles.permissionsModalDescription') }}</p>
          </div>
          <UTooltip :text="!canEditPermissions ? t('security.roles.noPermission') : (canEditRolePermissions ? t('security.roles.editPermissionsTooltip') : t('security.roles.systemOnlySystemActor'))">
            <UButton
              color="primary"
              variant="soft"
              icon="i-lucide-key-round"
              size="sm"
              :disabled="!canEditRolePermissions"
              @click="openPermissionsModal"
            >
              {{ t('security.roles.permissions') }}
            </UButton>
          </UTooltip>
        </div>

        <div class="mt-5 overflow-x-auto rounded-xl border border-prohealth-100">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
                <th class="px-4 py-2.5 font-semibold w-56">{{ t('security.roles.detail.permissionsTab.columns.entity') }}</th>
                <th class="px-4 py-2.5 font-semibold">{{ t('security.roles.detail.permissionsTab.columns.permissions') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-prohealth-100">
              <tr v-if="grantedPermissionsLoading">
                <td colspan="2" class="px-4 py-4">
                  <USkeleton class="h-4 w-full rounded" />
                </td>
              </tr>
              <tr v-else-if="grantedPermissionsByDomain.length === 0">
                <td colspan="2" class="px-4 py-8 text-center text-prohealth-500">
                  <UIcon name="i-lucide-key-round" class="w-6 h-6 mx-auto mb-2 text-prohealth-300" />
                  {{ t('security.roles.detail.permissionsTab.empty') }}
                </td>
              </tr>
              <tr v-for="entry in grantedPermissionsByDomain" v-else :key="entry.domain.uuid" class="align-top">
                <td class="px-4 py-3">
                  <div class="flex items-center gap-2 font-semibold text-prohealth-800">
                    <UIcon v-if="entry.domain.icon" :name="entry.domain.icon" class="w-4 h-4 text-prohealth-500" />
                    {{ entry.domain.name }}
                  </div>
                </td>
                <td class="px-4 py-3">
                  <div class="flex flex-wrap gap-1.5">
                    <UBadge
                      v-for="p in entry.permissions"
                      :key="p.uuid"
                      color="primary"
                      variant="subtle"
                    >
                      {{ p.name }}
                    </UBadge>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ============ Assigned users ============ -->
      <div
        v-if="canViewUsers"
        v-show="activeTab === 'users'"
        class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden"
      >
        <div class="flex items-center justify-between px-6 py-4 border-b border-prohealth-100">
          <div>
            <h2 class="font-bold text-prohealth-900">{{ t('security.roles.detail.usersTab.title') }}</h2>
            <p class="text-xs text-prohealth-500 mt-0.5">{{ t('security.roles.detail.usersTab.hint') }}</p>
          </div>
        </div>

        <div class="p-6 space-y-5">
          <!-- Add -->
          <div v-if="canManageUsers" class="flex items-end gap-3 max-w-md">
            <UFormField :label="t('security.roles.detail.usersTab.add')" class="flex-1">
              <USelectMenu
                v-model="userToAdd"
                :items="availableUserOptions"
                label-key="label"
                value-key="value"
                :placeholder="t('security.roles.detail.usersTab.selectUser')"
                class="w-full"
              />
            </UFormField>
            <UTooltip :text="t('security.roles.detail.usersTab.addTooltip')">
              <UButton
                color="primary"
                icon="i-lucide-plus"
                :disabled="!userToAdd"
                :loading="userMutating"
                @click="addRoleUser"
              >
                {{ t('security.roles.detail.usersTab.add') }}
              </UButton>
            </UTooltip>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
                  <th class="px-6 py-3 font-semibold">{{ t('security.roles.detail.usersTab.columns.user') }}</th>
                  <th class="px-6 py-3 font-semibold">{{ t('security.roles.detail.usersTab.columns.email') }}</th>
                  <th class="px-6 py-3 font-semibold">{{ t('security.roles.detail.usersTab.columns.status') }}</th>
                  <th class="px-6 py-3 font-semibold">{{ t('security.roles.detail.usersTab.columns.since') }}</th>
                  <th class="px-6 py-3 font-semibold text-right">{{ t('common.actions') }}</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-prohealth-100">
                <TableSkeleton v-if="roleUsersLoading" :rows="3" :cols="5" />
                <tr v-else-if="roleUsers.length === 0">
                  <td colspan="5" class="px-6 py-10 text-center text-prohealth-500">
                    <UIcon name="i-lucide-users" class="w-7 h-7 mx-auto mb-2 text-prohealth-300" />
                    {{ t('security.roles.detail.usersTab.empty') }}
                  </td>
                </tr>
                <tr v-for="ru in roleUsers" v-else :key="ru.userUuid" class="hover:bg-prohealth-50/50">
                  <td class="px-6 py-3 font-semibold text-prohealth-900">{{ ru.userFullName || t('common.empty') }}</td>
                  <td class="px-6 py-3 text-prohealth-600">{{ ru.userEmail || t('common.empty') }}</td>
                  <td class="px-6 py-3">
                    <UBadge
                      :color="ru.active === false ? 'neutral' : 'success'"
                      variant="subtle"
                      size="sm"
                    >
                      {{ ru.active === false ? t('security.users.inactive') : t('security.users.status.ACTIVE') }}
                    </UBadge>
                  </td>
                  <td class="px-6 py-3 text-prohealth-600">{{ ru.createdAt ? ru.createdAt.slice(0, 10) : t('common.empty') }}</td>
                  <td class="px-6 py-3">
                    <div class="flex items-center justify-end gap-1">
                      <UTooltip :text="canManageUsers ? t('security.roles.detail.usersTab.unlinkTooltip') : t('security.roles.noPermission')">
                        <UButton
                          color="error"
                          variant="ghost"
                          icon="i-lucide-user-minus"
                          size="sm"
                          :disabled="!canManageUsers"
                          @click="openRoleUserDelete(ru)"
                        />
                      </UTooltip>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </template>

    <!-- Edit role modal (mirrors roles/index.vue) -->
    <UModal
      v-model:open="roleFormOpen"
      :title="t('security.roles.modalEditTitle')"
      :description="t('security.roles.modalEditDescription')"
    >
      <template #body>
        <UForm
          :schema="roleSchema"
          :state="roleState"
          class="space-y-4"
          @submit="onRoleSubmit"
        >
          <UFormField :label="t('security.roles.fields.name')" name="name" required>
            <UInput v-model="roleState.name" placeholder="GERENTE_ALIADO" class="w-full" />
          </UFormField>

          <UFormField :label="t('security.roles.fields.description')" name="description">
            <UTextarea v-model="roleState.description" :rows="2" class="w-full" />
          </UFormField>

          <UFormField :label="t('security.roles.fields.active')">
            <USwitch v-model="roleIsActive" />
          </UFormField>

          <p class="text-xs text-prohealth-500">{{ t('common.requiredFieldsHint') }}</p>

          <div class="flex items-center justify-end gap-3 pt-2">
            <UButton color="neutral" variant="ghost" :disabled="roleSubmitting" @click="roleFormOpen = false">
              {{ t('common.cancel') }}
            </UButton>
            <UButton type="submit" color="primary" :loading="roleSubmitting" icon="i-lucide-save">
              {{ t('common.saveChanges') }}
            </UButton>
          </div>
        </UForm>
      </template>
    </UModal>

    <!-- Permissions modal (mirrors roles/index.vue) -->
    <UModal
      v-model:open="formOpen"
      :title="t('security.roles.permissionsModalTitle', { name: role?.name ?? '' })"
      :description="t('security.roles.permissionsModalDescription')"
      :ui="{ content: 'max-w-5xl' }"
    >
      <template #body>
        <div v-if="loadingPerms" class="space-y-4 max-h-[60vh] overflow-hidden">
          <div v-for="i in 3" :key="i" class="rounded-xl border border-prohealth-100 overflow-hidden">
            <div class="px-4 py-2.5 bg-prohealth-50/60 border-b border-prohealth-100">
              <USkeleton class="h-4 w-40 rounded" />
            </div>
            <div class="p-3 grid sm:grid-cols-2 gap-3">
              <USkeleton v-for="j in 4" :key="j" class="h-5 w-full rounded" />
            </div>
          </div>
        </div>

        <div v-else class="space-y-4">
          <div class="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-prohealth-100 bg-prohealth-50/40 px-4 py-3">
            <span class="text-xs font-semibold uppercase tracking-wide text-prohealth-400">
              {{ t('security.roles.bulkActions.label') }}
            </span>
            <label v-for="action in ACTION_TOGGLES" :key="action.key" class="flex items-center gap-2 cursor-pointer">
              <UCheckbox
                :model-value="actionState(action.suffixes)"
                @update:model-value="(v: boolean | 'indeterminate') => toggleByAction(action.suffixes, v === true)"
              />
              <span class="text-sm text-prohealth-700">{{ t(action.labelKey) }}</span>
            </label>
          </div>

          <div class="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div v-for="domain in domains" :key="domain.uuid" class="rounded-xl border border-prohealth-100 overflow-hidden">
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
              {{ t('security.roles.permissionsCatalogError') }}
            </p>
          </div>
        </div>

        <div class="flex items-center justify-between gap-3 pt-4 mt-2 border-t border-prohealth-100">
          <span class="text-xs text-prohealth-500">
            {{ t('security.roles.permissionsCount', { selected: selected.length, total: totalPermissions }) }}
          </span>
          <div class="flex items-center gap-3">
            <UButton color="neutral" variant="ghost" :disabled="isSubmitting" @click="formOpen = false">
              {{ t('common.cancel') }}
            </UButton>
            <UTooltip :text="selected.length === 0 ? t('security.roles.selectAtLeastOnePermission') : ''">
              <UButton
                color="primary"
                icon="i-lucide-save"
                :loading="isSubmitting"
                :disabled="selected.length === 0 || loadingPerms"
                @click="onSavePermissions"
              >
                {{ t('security.roles.savePermissions') }}
              </UButton>
            </UTooltip>
          </div>
        </div>
      </template>
    </UModal>

    <!-- Remove user from role modal -->
    <UModal v-model:open="roleUserDeleteOpen" :title="t('security.roles.detail.usersTab.delete.title')">
      <template #body>
        <i18n-t keypath="security.roles.detail.usersTab.delete.confirm" tag="p" class="text-sm text-prohealth-700" scope="global">
          <template #name>
            <span class="font-semibold">{{ roleUserTarget?.userFullName || roleUserTarget?.userEmail }}</span>
          </template>
        </i18n-t>
        <div class="flex items-center justify-end gap-3 pt-5">
          <UButton color="neutral" variant="ghost" :disabled="roleUserDeleting" @click="roleUserDeleteOpen = false">
            {{ t('common.cancel') }}
          </UButton>
          <UButton color="error" :loading="roleUserDeleting" icon="i-lucide-user-minus" @click="confirmRoleUserDelete">
            {{ t('security.roles.detail.usersTab.unlinkTooltip') }}
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Delete role modal -->
    <UModal v-model:open="roleDeleteOpen" :title="t('security.roles.deleteTitle')">
      <template #body>
        <div v-if="roleUsageChecking" class="flex items-center gap-2 text-sm text-prohealth-600">
          <UIcon name="i-lucide-loader-2" class="w-4 h-4 animate-spin" />
          {{ t('common.loading') }}
        </div>
        <p v-else class="text-sm text-prohealth-700">
          {{ t('security.roles.deleteConfirm', { name: role?.name ?? '' }) }}
        </p>
        <div class="flex items-center justify-end gap-3 pt-5">
          <UButton color="neutral" variant="ghost" :disabled="roleDeleting" @click="roleDeleteOpen = false">
            {{ t('common.cancel') }}
          </UButton>
          <UButton color="error" :loading="roleDeleting" :disabled="roleUsageChecking" icon="i-lucide-trash-2" @click="confirmRoleDelete">
            {{ t('common.delete') }}
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Audit modal -->
    <AuditModal
      v-if="role"
      v-model:open="auditOpen"
      entity-key="role"
      :entity-uuid="role.uuid"
      :entity-label="role.name"
      :can-view-changes="canViewAuditChanges"
      :can-view-reports="canViewAuditReports"
    />
  </div>
</template>
