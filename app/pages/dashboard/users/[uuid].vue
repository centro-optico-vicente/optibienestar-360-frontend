<script setup lang="ts">
import type { RoleDto, UserDto } from '~/types/admin'
import type { AllyListItemDto, AssignAllyUserRequest, UserAllyDto } from '~/types/allies'

definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'USER_VIEW_ALL',
})

const { t } = useI18n()

useSeoMeta({ title: () => t('common.seoTitle', { page: t('security.users.detail.seoPage') }) })

const route = useRoute()
const userUuid = route.params.uuid as string

const usersApi = useUsers()
const rolesApi = useRoles()
const alliesApi = useAllies()
const { can } = usePermissions()
const { formatDate } = useFormatters()
const toast = useToast()

const canUpdate = computed(() => can('USER_UPDATE'))
const canDelete = computed(() => can('USER_DELETE'))
const canAssignRoles = computed(() => can('ROLE_USER_CREATE'))
const canRemoveRoles = computed(() => can('ROLE_USER_DELETE'))
const canAssignAllies = computed(() => can('ALLY_USER_CREATE'))
const canRemoveAllies = computed(() => can('ALLY_USER_DELETE'))
const canViewAuditChanges = computed(() => can('AUDIT_VIEW_ALL') || can('USER_RECORD_AUDIT_VIEW'))
const canViewAuditReports = computed(() => can('REPORT_AUDIT_VIEW_ALL') || can('USER_REPORT_AUDIT_VIEW'))
const canViewAudit = computed(() => canViewAuditChanges.value || canViewAuditReports.value)

// ---- User load ----
const user = ref<UserDto | null>(null)
const loading = ref(true)
const notFound = ref(false)

async function loadUser() {
  loading.value = true
  try {
    user.value = await usersApi.get(userUuid)
  }
  catch {
    notFound.value = true
    user.value = null
  }
  finally {
    loading.value = false
  }
}

function statusLabel(u: UserDto): string {
  if (u.active === false) return u.active_Display ?? t('security.users.inactive')
  if (!u.status) return t('common.empty')
  return u.status_Display ?? t(`security.users.status.${u.status}`, u.status)
}

// ---- Tabs (allies always visible per spec) ----
const tabs = computed(() => [
  { label: t('security.users.detail.tabs.roles'), value: 'roles', icon: 'i-lucide-shield' },
  { label: t('security.users.detail.tabs.allies'), value: 'allies', icon: 'i-lucide-handshake' },
])
const activeTab = ref('roles')

// =========================================================
// Roles assigned to this user
// =========================================================
// The backend has no "roles for a user" listing endpoint distinct from the user
// record itself, so `UserDto.roles` (already returned by GET /v1/admin/users/{uuid})
// is used as the source of truth here instead of inventing a per-role lookup loop.
const userRolesRaw = computed<RoleDto[]>(() => user.value?.roles ?? [])

// No backend list endpoint exists for "roles of this user" (it's embedded in
// GET /v1/admin/users/{uuid} itself), so sort is applied client-side over the
// already-fetched array instead of round-tripping to the server.
const userRolesSort = useTableSort([])
const userRolesHasActiveSort = computed(() => userRolesSort.orders.value.length > 0)
const userRolesIsMultiSort = computed(() => userRolesSort.orders.value.length > 1)
const userRoles = computed<RoleDto[]>(() => {
  const orders = userRolesSort.orders.value
  if (orders.length === 0) return userRolesRaw.value
  const rows = [...userRolesRaw.value]
  rows.sort((a, b) => {
    for (const o of orders) {
      const av = String(a[o.field as keyof RoleDto] ?? '')
      const bv = String(b[o.field as keyof RoleDto] ?? '')
      const cmp = av.localeCompare(bv)
      if (cmp !== 0) return o.direction === 'asc' ? cmp : -cmp
    }
    return 0
  })
  return rows
})

const allRoleOptions = ref<{ label: string, value: string }[]>([])

async function loadAllRoles() {
  try {
    const list = await rolesApi.list()
    allRoleOptions.value = list.map(r => ({ label: r.name, value: r.uuid }))
  }
  catch {
    allRoleOptions.value = []
  }
}

const availableRoleOptions = computed(() => {
  const assigned = new Set(userRoles.value.map(r => r.uuid))
  return allRoleOptions.value.filter(o => !assigned.has(o.value))
})

const roleToAdd = ref<string | undefined>(undefined)
const roleMutating = ref(false)

async function addUserRole() {
  if (!roleToAdd.value) return
  roleMutating.value = true
  try {
    await rolesApi.assignUser(roleToAdd.value, userUuid)
    toast.add({ title: t('security.users.detail.rolesTab.assignedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    roleToAdd.value = undefined
    await loadUser()
  }
  catch {
    // toast handled by useApi
  }
  finally {
    roleMutating.value = false
  }
}

const roleDeleteOpen = ref(false)
const roleDeleting = ref(false)
const roleTarget = ref<RoleDto | null>(null)

function openRoleDelete(r: RoleDto) {
  roleTarget.value = r
  roleDeleteOpen.value = true
}

async function confirmRoleDelete() {
  if (!roleTarget.value) return
  roleDeleting.value = true
  try {
    await rolesApi.removeUser(roleTarget.value.uuid, userUuid)
    toast.add({ title: t('security.users.detail.rolesTab.unlinkedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    roleDeleteOpen.value = false
    await loadUser()
  }
  catch {
    // toast handled by useApi
  }
  finally {
    roleDeleting.value = false
  }
}

// =========================================================
// Allies associated with this user
// =========================================================
// GET /v1/admin/users/{uuid}/allies (ALLY_VIEW_ALL) returns the allies this user
// belongs to directly, so no client-side derivation over the full ally catalog
// is needed here.
type UserAllyRow = UserAllyDto

const userAllies = ref<UserAllyRow[]>([])
const userAlliesLoading = ref(false)
const allAllies = ref<AllyListItemDto[]>([])
const userAlliesSort = useTableSort([])
const userAlliesHasActiveSort = computed(() => userAlliesSort.orders.value.length > 0)
const userAlliesIsMultiSort = computed(() => userAlliesSort.orders.value.length > 1)

async function loadUserAllies() {
  userAlliesLoading.value = true
  try {
    userAllies.value = await alliesApi.listAlliesForUser(userUuid, userAlliesSort.sortParam.value)
  }
  catch {
    userAllies.value = []
  }
  finally {
    userAlliesLoading.value = false
  }
}

watch(userAlliesSort.orders, () => loadUserAllies(), { deep: true })

async function loadAllAllies() {
  try {
    const page = await alliesApi.list({ size: 200 })
    allAllies.value = page.content ?? []
  }
  catch {
    allAllies.value = []
  }
}

const availableAllyOptions = computed(() => {
  const assigned = new Set(userAllies.value.map(r => r.allyUuid))
  return allAllies.value
    .filter(a => !assigned.has(a.uuid))
    .map(a => ({ label: a.name, value: a.uuid }))
})

const allyToAdd = ref<string | undefined>(undefined)
const allyMutating = ref(false)

async function addUserAlly() {
  if (!allyToAdd.value) return
  allyMutating.value = true
  try {
    const body: AssignAllyUserRequest = { userUuid, allyRole: 'STAFF' }
    await alliesApi.assignUser(allyToAdd.value, body)
    toast.add({ title: t('security.users.detail.alliesTab.assignedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    allyToAdd.value = undefined
    await loadUserAllies()
  }
  catch {
    // toast handled by useApi
  }
  finally {
    allyMutating.value = false
  }
}

const allyDeleteOpen = ref(false)
const allyDeleting = ref(false)
const allyTarget = ref<UserAllyRow | null>(null)

function openAllyDelete(row: UserAllyRow) {
  allyTarget.value = row
  allyDeleteOpen.value = true
}

async function confirmAllyDelete() {
  if (!allyTarget.value) return
  allyDeleting.value = true
  try {
    // The staff sub-resource is keyed by its own membership uuid, not the user's —
    // look it up fresh so a stale row can't send the wrong pivot id.
    const staff = await alliesApi.listUsers(allyTarget.value.allyUuid)
    const membership = staff.find(s => s.userUuid === userUuid)
    if (membership) {
      await alliesApi.removeUser(allyTarget.value.allyUuid, membership.uuid)
    }
    toast.add({ title: t('security.users.detail.alliesTab.unlinkedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    allyDeleteOpen.value = false
    await loadUserAllies()
  }
  catch {
    // toast handled by useApi
  }
  finally {
    allyDeleting.value = false
  }
}

// ---- Restore ----
const restoring = ref(false)

async function restoreUser() {
  restoring.value = true
  try {
    await usersApi.update(userUuid, { active: true })
    toast.add({ title: t('security.users.restoredToast'), color: 'success', icon: 'i-lucide-check-circle' })
    await loadUser()
  }
  catch {
    // toast handled by useApi
  }
  finally {
    restoring.value = false
  }
}

// ---- Reach the existing edit modal on users/index.vue ----
function goEditUser() {
  navigateTo(`/dashboard/users?edit=${userUuid}`)
}

// ---- Audit ----
const auditOpen = ref(false)

// ---- Init ----
onMounted(async () => {
  await loadUser()
  await Promise.all([
    loadAllRoles(),
    loadUserAllies(),
    loadAllAllies(),
  ])
})

// Header "Refrescar": re-fetch the user (roles come with it) + the allies tab.
const refreshingAll = ref(false)
async function refreshAll() {
  refreshingAll.value = true
  try {
    await Promise.all([loadUser(), loadUserAllies()])
  }
  finally {
    refreshingAll.value = false
  }
}
</script>

<template>
  <div class="space-y-5">
    <!-- Back -->
    <UButton
      color="neutral"
      variant="ghost"
      icon="i-lucide-arrow-left"
      to="/dashboard/users"
      size="sm"
    >
      {{ t('security.users.title') }}
    </UButton>

    <!-- Loading -->
    <div v-if="loading" class="bg-white rounded-2xl border border-prohealth-100 p-6 space-y-3">
      <USkeleton class="h-7 w-64 rounded" />
      <USkeleton class="h-4 w-40 rounded" />
    </div>

    <!-- Not found -->
    <div v-else-if="notFound || !user" class="bg-white rounded-2xl border border-prohealth-100 p-12 text-center">
      <UIcon name="i-lucide-search-x" class="w-10 h-10 mx-auto mb-3 text-prohealth-300" />
      <p class="text-prohealth-700 font-semibold">{{ t('security.users.detail.notFoundTitle') }}</p>
      <p class="text-sm text-prohealth-500 mt-1">{{ t('security.users.detail.notFoundBody') }}</p>
    </div>

    <template v-else>
      <!-- User header -->
      <div class="bg-white rounded-2xl border border-prohealth-100 p-6">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div class="flex items-center gap-3 flex-wrap">
              <h1 class="text-2xl font-extrabold text-prohealth-900">{{ user.fullName }}</h1>
              <UBadge
                :color="user.active === false ? 'neutral' : (user.status === 'ACTIVE' ? 'success' : 'warning')"
                variant="subtle"
              >
                {{ statusLabel(user) }}
              </UBadge>
            </div>
            <p class="text-sm text-prohealth-500 mt-1">
              {{ user.email }}
              <template v-if="user.documentNumber"> · {{ user.documentType }} {{ user.documentNumber }}</template>
            </p>
          </div>
          <div class="flex items-center gap-2">
            <RefreshButton
              size="md"
              variant="ghost"
              :icon-only="false"
              :loading="refreshingAll"
              :title="t('common.refreshRecord')"
              @refresh="refreshAll"
            />
            <ReportPrintButton :record-uuid="userUuid" variant="ghost" />
            <UTooltip :text="canUpdate ? t('common.edit') : t('security.users.noPermissionEdit')">
              <UButton
                color="info"
                variant="ghost"
                icon="i-lucide-pencil"
                :disabled="!canUpdate"
                @click="goEditUser"
              >
                {{ t('security.users.detail.editButton') }}
              </UButton>
            </UTooltip>
            <RestoreButton
              v-if="user.active === false"
              :active="user.active"
              :allowed="canDelete"
              :loading="restoring"
              class="ms-2"
              @restore="restoreUser"
            />
            <UTooltip v-if="canViewAudit" :text="t('audit.trigger')">
              <UButton color="neutral" variant="ghost" icon="i-lucide-history" @click="auditOpen = true" />
            </UTooltip>
          </div>
        </div>

        <dl class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 mt-6 text-sm">
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('security.users.fields.phone') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ user.phone || t('common.empty') }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('security.users.columns.lastLogin') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ user.lastLoginAt_Display ?? formatDate(user.lastLoginAt, 'datetime') }}</dd>
          </div>
        </dl>
      </div>

      <!-- Sub-resource tabs -->
      <UTabs v-model="activeTab" :items="tabs" :content="false" />

      <!-- ============ Roles ============ -->
      <div v-show="activeTab === 'roles'" class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden">
        <div class="flex items-center justify-between px-6 py-4 border-b border-prohealth-100 gap-4">
          <div>
            <h2 class="font-bold text-prohealth-900">{{ t('security.users.detail.rolesTab.title') }}</h2>
            <p class="text-xs text-prohealth-500 mt-0.5">{{ t('security.users.detail.rolesTab.hint') }}</p>
          </div>
          <div class="flex items-center gap-2">
            <USelectMenu
              v-model="roleToAdd"
              :items="availableRoleOptions"
              label-key="label"
              value-key="value"
              :placeholder="t('security.users.detail.rolesTab.selectRole')"
              :disabled="!canAssignRoles"
              class="w-48"
            />
            <UTooltip :text="t('security.users.detail.rolesTab.addTooltip')">
              <UButton
                color="primary"
                variant="soft"
                icon="i-lucide-plus"
                :disabled="!canAssignRoles || !roleToAdd"
                :loading="roleMutating"
                @click="addUserRole"
              >
                {{ t('security.users.detail.rolesTab.add') }}
              </UButton>
            </UTooltip>
            <UButton
              v-if="userRolesHasActiveSort"
              variant="link"
              color="neutral"
              size="sm"
              icon="i-lucide-list-restart"
              :title="t('common.clearSortHint')"
              @click="userRolesSort.reset()"
            >
              {{ t('common.clearSort') }}
            </UButton>
            <RefreshButton
              :loading="loading"
              :title="t('common.refreshSection')"
              @refresh="loadUser"
            />
          </div>
        </div>

        <div class="p-6 space-y-5">
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
                  <th class="px-6 py-3 font-semibold cursor-pointer select-none" @click="userRolesSort.toggle('name')">
                    {{ t('security.users.detail.rolesTab.columns.role') }}
                    <SortIndicator :state="userRolesSort.stateOf('name')" :multi-active="userRolesIsMultiSort" @clear="userRolesSort.remove('name')" />
                  </th>
                  <th class="px-6 py-3 font-semibold cursor-pointer select-none" @click="userRolesSort.toggle('description')">
                    {{ t('security.users.detail.rolesTab.columns.description') }}
                    <SortIndicator :state="userRolesSort.stateOf('description')" :multi-active="userRolesIsMultiSort" @clear="userRolesSort.remove('description')" />
                  </th>
                  <th class="px-6 py-3 font-semibold text-right">{{ t('common.actions') }}</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-prohealth-100">
                <tr v-if="userRoles.length === 0">
                  <td colspan="3" class="px-6 py-10 text-center text-prohealth-500">
                    <UIcon name="i-lucide-shield" class="w-7 h-7 mx-auto mb-2 text-prohealth-300" />
                    {{ t('security.users.detail.rolesTab.empty') }}
                  </td>
                </tr>
                <tr v-for="r in userRoles" v-else :key="r.uuid" class="hover:bg-prohealth-50/50">
                  <td class="px-6 py-3 font-semibold text-prohealth-900">{{ r.name }}</td>
                  <td class="px-6 py-3 text-prohealth-600">{{ r.description || t('common.empty') }}</td>
                  <td class="px-6 py-3">
                    <div class="flex items-center justify-end gap-1">
                      <UTooltip :text="canRemoveRoles ? t('security.users.detail.rolesTab.unlinkTooltip') : t('security.roles.noPermission')">
                        <UButton
                          color="error"
                          variant="ghost"
                          icon="i-lucide-user-minus"
                          size="sm"
                          :disabled="!canRemoveRoles"
                          @click="openRoleDelete(r)"
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

      <!-- ============ Allies (always visible) ============ -->
      <div v-show="activeTab === 'allies'" class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden">
        <div class="flex items-center justify-between px-6 py-4 border-b border-prohealth-100 gap-4">
          <div>
            <h2 class="font-bold text-prohealth-900">{{ t('security.users.detail.alliesTab.title') }}</h2>
            <p class="text-xs text-prohealth-500 mt-0.5">{{ t('security.users.detail.alliesTab.hint') }}</p>
          </div>
          <div class="flex items-center gap-2">
            <USelectMenu
              v-model="allyToAdd"
              :items="availableAllyOptions"
              label-key="label"
              value-key="value"
              :placeholder="t('security.users.detail.alliesTab.selectAlly')"
              :disabled="!canAssignAllies"
              class="w-48"
            />
            <UTooltip :text="t('security.users.detail.alliesTab.addTooltip')">
              <UButton
                color="primary"
                variant="soft"
                icon="i-lucide-plus"
                :disabled="!canAssignAllies || !allyToAdd"
                :loading="allyMutating"
                @click="addUserAlly"
              >
                {{ t('security.users.detail.alliesTab.add') }}
              </UButton>
            </UTooltip>
            <UButton
              v-if="userAlliesHasActiveSort"
              variant="link"
              color="neutral"
              size="sm"
              icon="i-lucide-list-restart"
              :title="t('common.clearSortHint')"
              @click="userAlliesSort.reset()"
            >
              {{ t('common.clearSort') }}
            </UButton>
            <RefreshButton
              :loading="userAlliesLoading"
              :title="t('common.refreshSection')"
              @refresh="loadUserAllies"
            />
          </div>
        </div>

        <div class="p-6 space-y-5">
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
                  <th class="px-6 py-3 font-semibold cursor-pointer select-none" @click="userAlliesSort.toggle('ally_Display')">
                    {{ t('security.users.detail.alliesTab.columns.ally') }}
                    <SortIndicator :state="userAlliesSort.stateOf('ally_Display')" :multi-active="userAlliesIsMultiSort" @clear="userAlliesSort.remove('ally_Display')" />
                  </th>
                  <th class="px-6 py-3 font-semibold cursor-pointer select-none" @click="userAlliesSort.toggle('allyRole')">
                    {{ t('security.users.detail.alliesTab.columns.role') }}
                    <SortIndicator :state="userAlliesSort.stateOf('allyRole')" :multi-active="userAlliesIsMultiSort" @clear="userAlliesSort.remove('allyRole')" />
                  </th>
                  <th class="px-6 py-3 font-semibold cursor-pointer select-none" @click="userAlliesSort.toggle('primary')">
                    {{ t('security.users.detail.alliesTab.columns.primary') }}
                    <SortIndicator :state="userAlliesSort.stateOf('primary')" :multi-active="userAlliesIsMultiSort" @clear="userAlliesSort.remove('primary')" />
                  </th>
                  <th class="px-6 py-3 font-semibold cursor-pointer select-none" @click="userAlliesSort.toggle('joinedAt')">
                    {{ t('security.users.detail.alliesTab.columns.since') }}
                    <SortIndicator :state="userAlliesSort.stateOf('joinedAt')" :multi-active="userAlliesIsMultiSort" @clear="userAlliesSort.remove('joinedAt')" />
                  </th>
                  <th class="px-6 py-3 font-semibold text-right">{{ t('common.actions') }}</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-prohealth-100">
                <TableSkeleton v-if="userAlliesLoading" :rows="3" :cols="5" />
                <tr v-else-if="userAllies.length === 0">
                  <td colspan="5" class="px-6 py-10 text-center text-prohealth-500">
                    <UIcon name="i-lucide-handshake" class="w-7 h-7 mx-auto mb-2 text-prohealth-300" />
                    {{ t('security.users.detail.alliesTab.empty') }}
                  </td>
                </tr>
                <tr v-for="row in userAllies" v-else :key="row.allyUuid" class="hover:bg-prohealth-50/50">
                  <td class="px-6 py-3 font-semibold text-prohealth-900">{{ row.allyName }}</td>
                  <td class="px-6 py-3">
                    <UBadge color="primary" variant="subtle" size="sm">
                      {{ t(`allies.staff.roles.${row.allyRole}`, row.allyRole) }}
                    </UBadge>
                  </td>
                  <td class="px-6 py-3">
                    <UIcon
                      :name="row.primary ? 'i-lucide-star' : 'i-lucide-minus'"
                      class="w-4 h-4"
                      :class="row.primary ? 'text-amber-500' : 'text-prohealth-300'"
                    />
                  </td>
                  <td class="px-6 py-3 text-prohealth-600">{{ formatDate(row.joinedAt, 'short') }}</td>
                  <td class="px-6 py-3">
                    <div class="flex items-center justify-end gap-1">
                      <UTooltip :text="canRemoveAllies ? t('security.users.detail.alliesTab.unlinkTooltip') : t('security.roles.noPermission')">
                        <UButton
                          color="error"
                          variant="ghost"
                          icon="i-lucide-user-minus"
                          size="sm"
                          :disabled="!canRemoveAllies"
                          @click="openAllyDelete(row)"
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

    <!-- Remove role modal -->
    <UModal v-model:open="roleDeleteOpen" :title="t('security.users.detail.rolesTab.delete.title')">
      <template #body>
        <i18n-t keypath="security.users.detail.rolesTab.delete.confirm" tag="p" class="text-sm text-prohealth-700" scope="global">
          <template #name>
            <span class="font-semibold">{{ roleTarget?.name }}</span>
          </template>
        </i18n-t>
        <div class="flex items-center justify-end gap-3 pt-5">
          <UButton color="neutral" variant="ghost" :disabled="roleDeleting" @click="roleDeleteOpen = false">
            {{ t('common.cancel') }}
          </UButton>
          <UButton color="error" :loading="roleDeleting" icon="i-lucide-user-minus" @click="confirmRoleDelete">
            {{ t('common.delete') }}
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Unlink ally modal -->
    <UModal v-model:open="allyDeleteOpen" :title="t('security.users.detail.alliesTab.delete.title')">
      <template #body>
        <i18n-t keypath="security.users.detail.alliesTab.delete.confirm" tag="p" class="text-sm text-prohealth-700" scope="global">
          <template #name>
            <span class="font-semibold">{{ allyTarget?.allyName }}</span>
          </template>
        </i18n-t>
        <div class="flex items-center justify-end gap-3 pt-5">
          <UButton color="neutral" variant="ghost" :disabled="allyDeleting" @click="allyDeleteOpen = false">
            {{ t('common.cancel') }}
          </UButton>
          <UButton color="error" :loading="allyDeleting" icon="i-lucide-user-minus" @click="confirmAllyDelete">
            {{ t('common.delete') }}
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Audit modal -->
    <AuditModal
      v-if="user"
      v-model:open="auditOpen"
      entity-key="user"
      :entity-uuid="user.uuid"
      :entity-label="user.fullName"
      :entity-code="user.email"
      :can-view-changes="canViewAuditChanges"
      :can-view-reports="canViewAuditReports"
    />
  </div>
</template>
