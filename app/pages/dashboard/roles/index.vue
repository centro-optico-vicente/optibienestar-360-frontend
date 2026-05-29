<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type {
  RoleCreateRequest,
  RoleDto,
  RoleUpdateRequest,
} from '~/types/admin'
import { toItems } from '~/types/admin'

definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'USER_CHANGE_ROLE',
})

useSeoMeta({ title: 'Roles — OptiSalud Plus' })

const rolesApi = useRoles()
const { can } = usePermissions()
const toast = useToast()

// La gestión de roles se protege con USER_CHANGE_ROLE (único permiso de roles del seed).
const canManage = computed(() => can('USER_CHANGE_ROLE'))

const data = ref<RoleDto[]>([])
const loading = ref(false)
// El backend aún puede no exponer /v1/admin/roles → lo informamos sin romper la UI.
const notAvailable = ref(false)

const permissionOptions = ref<{ label: string, value: string }[]>([])

async function loadRoles() {
  loading.value = true
  notAvailable.value = false
  try {
    const res = await rolesApi.list()
    data.value = toItems(res)
  }
  catch (err) {
    const e = err as { status?: number }
    if (e?.status === 404) notAvailable.value = true
    data.value = []
  }
  finally {
    loading.value = false
  }
}

async function loadPermissions() {
  try {
    const res = await rolesApi.permissions()
    permissionOptions.value = toItems(res).map(p => ({
      label: p.domain ? `${p.domain} · ${p.name}` : p.name,
      value: p.uuid,
    }))
  }
  catch {
    permissionOptions.value = []
  }
}

onMounted(async () => {
  await loadRoles()
  if (!notAvailable.value) await loadPermissions()
})

// ---- Formulario ----
const formOpen = ref(false)
const mode = ref<'create' | 'edit'>('create')
const editingUuid = ref<string | null>(null)
const isSubmitting = ref(false)

interface FormState {
  name: string
  description: string
  permissionIds: string[]
}

const state = reactive<FormState>({ name: '', description: '', permissionIds: [] })

const schema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres'),
  description: z.string().optional(),
  permissionIds: z.array(z.string()),
})

function resetForm() {
  state.name = ''
  state.description = ''
  state.permissionIds = []
}

function openCreate() {
  mode.value = 'create'
  editingUuid.value = null
  resetForm()
  formOpen.value = true
}

async function openEdit(r: RoleDto) {
  mode.value = 'edit'
  editingUuid.value = r.uuid
  resetForm()
  state.name = r.name
  state.description = r.description ?? ''
  // Cargar los permisos actuales del rol (detalle).
  try {
    const detail = await rolesApi.get(r.uuid)
    state.permissionIds = (detail.permissions ?? []).map(p => p.uuid)
  }
  catch {
    state.permissionIds = []
  }
  formOpen.value = true
}

async function onSubmit(_event: FormSubmitEvent<Record<string, unknown>>) {
  isSubmitting.value = true
  try {
    if (mode.value === 'create') {
      const body: RoleCreateRequest = {
        name: state.name,
        description: state.description || undefined,
        permissionIds: state.permissionIds,
      }
      await rolesApi.create(body)
      toast.add({ title: 'Rol creado', color: 'success', icon: 'i-lucide-check-circle' })
    }
    else if (editingUuid.value) {
      const body: RoleUpdateRequest = {
        name: state.name,
        description: state.description || undefined,
        permissionIds: state.permissionIds,
      }
      await rolesApi.update(editingUuid.value, body)
      toast.add({ title: 'Rol actualizado', color: 'success', icon: 'i-lucide-check-circle' })
    }
    formOpen.value = false
    await loadRoles()
  }
  catch {
    // useApi ya notificó el error
  }
  finally {
    isSubmitting.value = false
  }
}

// ---- Eliminar ----
const deleteOpen = ref(false)
const deleting = ref(false)
const target = ref<RoleDto | null>(null)

function openDelete(r: RoleDto) {
  target.value = r
  deleteOpen.value = true
}

async function confirmDelete() {
  if (!target.value) return
  deleting.value = true
  try {
    await rolesApi.remove(target.value.uuid)
    toast.add({ title: 'Rol eliminado', color: 'success', icon: 'i-lucide-check-circle' })
    deleteOpen.value = false
    await loadRoles()
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
        <h1 class="text-2xl font-extrabold text-prohealth-900">Roles</h1>
        <p class="text-sm text-prohealth-700/70 mt-1">
          Define los roles y los permisos (llaves) que otorga cada uno.
        </p>
      </div>
      <UTooltip :text="canManage ? 'Crear un nuevo rol' : 'No tienes permiso para gestionar roles'">
        <UButton
          color="primary"
          icon="i-lucide-shield-plus"
          :disabled="!canManage || notAvailable"
          @click="openCreate"
        >
          Nuevo rol
        </UButton>
      </UTooltip>
    </div>

    <!-- Aviso: backend sin endpoints de roles -->
    <UAlert
      v-if="notAvailable"
      color="warning"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      title="Gestión de roles no disponible todavía"
      description="El backend aún no expone /v1/admin/roles ni /v1/admin/permissions. La pantalla está lista; funcionará en cuanto backend implemente esos endpoints."
    />

    <!-- Tabla -->
    <div v-if="!notAvailable" class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden">
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
            <tr v-if="loading">
              <td colspan="3" class="px-5 py-10 text-center text-prohealth-500">
                <UIcon name="i-lucide-loader-circle" class="w-5 h-5 animate-spin inline" />
                Cargando…
              </td>
            </tr>
            <tr v-else-if="data.length === 0">
              <td colspan="3" class="px-5 py-12 text-center text-prohealth-500">
                <UIcon name="i-lucide-shield" class="w-8 h-8 mx-auto mb-2 text-prohealth-300" />
                Sin roles
              </td>
            </tr>
            <tr v-for="r in data" v-else :key="r.uuid" class="hover:bg-prohealth-50/50">
              <td class="px-5 py-3">
                <UBadge color="primary" variant="subtle">{{ r.name }}</UBadge>
              </td>
              <td class="px-5 py-3 text-prohealth-700">
                {{ r.description || '—' }}
              </td>
              <td class="px-5 py-3">
                <div class="flex items-center justify-end gap-1">
                  <UTooltip :text="canManage ? 'Editar' : 'No tienes permiso'">
                    <UButton
                      color="neutral"
                      variant="ghost"
                      icon="i-lucide-pencil"
                      size="sm"
                      :disabled="!canManage"
                      @click="openEdit(r)"
                    />
                  </UTooltip>
                  <UTooltip :text="canManage ? 'Eliminar' : 'No tienes permiso'">
                    <UButton
                      color="error"
                      variant="ghost"
                      icon="i-lucide-trash-2"
                      size="sm"
                      :disabled="!canManage"
                      @click="openDelete(r)"
                    />
                  </UTooltip>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal crear/editar -->
    <UModal
      v-model:open="formOpen"
      :title="mode === 'create' ? 'Nuevo rol' : 'Editar rol'"
      description="El nombre identifica el rol; los permisos son las acciones que habilita."
    >
      <template #body>
        <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
          <UFormField label="Nombre" name="name" required>
            <UInput v-model="state.name" placeholder="Ej. OPERADOR" class="w-full" />
          </UFormField>

          <UFormField label="Descripción" name="description">
            <UTextarea v-model="state.description" :rows="2" class="w-full" />
          </UFormField>

          <UFormField label="Permisos" name="permissionIds">
            <USelectMenu
              v-model="state.permissionIds"
              :items="permissionOptions"
              label-key="label"
              value-key="value"
              multiple
              placeholder="Selecciona los permisos del rol"
              class="w-full"
            />
            <template #help>
              <span v-if="permissionOptions.length === 0" class="text-amber-600">
                No se pudo cargar el catálogo de permisos (/v1/admin/permissions).
              </span>
            </template>
          </UFormField>

          <div class="flex items-center justify-end gap-3 pt-2">
            <UButton color="neutral" variant="ghost" :disabled="isSubmitting" @click="formOpen = false">
              Cancelar
            </UButton>
            <UButton type="submit" color="primary" :loading="isSubmitting" icon="i-lucide-save">
              {{ mode === 'create' ? 'Crear rol' : 'Guardar cambios' }}
            </UButton>
          </div>
        </UForm>
      </template>
    </UModal>

    <!-- Modal confirmar eliminación -->
    <UModal v-model:open="deleteOpen" title="Eliminar rol">
      <template #body>
        <p class="text-sm text-prohealth-700">
          ¿Seguro que deseas eliminar el rol
          <span class="font-semibold">{{ target?.name }}</span>?
          Los usuarios que lo tengan asignado perderán esos permisos.
        </p>
        <div class="flex items-center justify-end gap-3 pt-5">
          <UButton color="neutral" variant="ghost" :disabled="deleting" @click="deleteOpen = false">
            Cancelar
          </UButton>
          <UButton color="error" :loading="deleting" icon="i-lucide-trash-2" @click="confirmDelete">
            Eliminar
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
