<script setup lang="ts">
import type { PermissionDomainDto, RoleDto } from '~/types/admin'

definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'USER_CHANGE_ROLE',
})

useSeoMeta({ title: 'Roles — OptiSalud Plus' })

const rolesApi = useRoles()
const { can } = usePermissions()
const toast = useToast()

// La gestión de permisos por rol se protege con USER_CHANGE_ROLE.
const canManage = computed(() => can('USER_CHANGE_ROLE'))

const roles = ref<RoleDto[]>([])
const domains = ref<PermissionDomainDto[]>([])
const loading = ref(false)

// Total de permisos del catálogo (para mostrar "n/total" por rol).
const totalPermissions = computed(() =>
  domains.value.reduce((acc, d) => acc + d.permissions.length, 0),
)

async function loadRoles() {
  loading.value = true
  try {
    roles.value = await rolesApi.list()
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
    toast.add({ title: 'Permisos actualizados', color: 'success', icon: 'i-lucide-check-circle' })
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
        <h1 class="text-2xl font-extrabold text-prohealth-900">Roles y permisos</h1>
        <p class="text-sm text-prohealth-700/70 mt-1">
          Los roles los define el sistema. Aquí ajustas los permisos (llaves) que otorga cada uno.
        </p>
      </div>
    </div>

    <!-- Tabla de roles -->
    <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
              <th class="px-5 py-3 font-semibold">Rol</th>
              <th class="px-5 py-3 font-semibold">Descripción</th>
              <th class="px-5 py-3 font-semibold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-prohealth-100">
            <TableSkeleton v-if="loading" :rows="5" :cols="3" />
            <tr v-else-if="roles.length === 0">
              <td colspan="3" class="px-5 py-12 text-center text-prohealth-500">
                <UIcon name="i-lucide-shield" class="w-8 h-8 mx-auto mb-2 text-prohealth-300" />
                Sin roles
              </td>
            </tr>
            <tr v-for="r in roles" v-else :key="r.uuid" class="hover:bg-prohealth-50/50">
              <td class="px-5 py-3">
                <UBadge color="primary" variant="subtle">{{ r.name }}</UBadge>
              </td>
              <td class="px-5 py-3 text-prohealth-700">
                {{ r.description || '—' }}
              </td>
              <td class="px-5 py-3">
                <div class="flex items-center justify-end gap-1">
                  <UTooltip :text="canManage ? 'Editar permisos' : 'No tienes permiso'">
                    <UButton
                      color="neutral"
                      variant="ghost"
                      icon="i-lucide-key-round"
                      size="sm"
                      label="Permisos"
                      :disabled="!canManage"
                      @click="openEdit(r)"
                    />
                  </UTooltip>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal editar permisos del rol -->
    <UModal
      v-model:open="formOpen"
      :title="`Permisos de ${editing?.name ?? ''}`"
      description="Marca las llaves que otorga este rol. Debe tener al menos un permiso."
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
            No se pudo cargar el catálogo de permisos (/v1/admin/permissions).
          </p>
        </div>

        <div class="flex items-center justify-between gap-3 pt-4 mt-2 border-t border-prohealth-100">
          <span class="text-xs text-prohealth-500">
            {{ selected.length }} / {{ totalPermissions }} permisos
          </span>
          <div class="flex items-center gap-3">
            <UButton color="neutral" variant="ghost" :disabled="isSubmitting" @click="formOpen = false">
              Cancelar
            </UButton>
            <UTooltip :text="selected.length === 0 ? 'Selecciona al menos un permiso' : ''">
              <UButton
                color="primary"
                icon="i-lucide-save"
                :loading="isSubmitting"
                :disabled="selected.length === 0 || loadingPerms"
                @click="onSave"
              >
                Guardar permisos
              </UButton>
            </UTooltip>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
