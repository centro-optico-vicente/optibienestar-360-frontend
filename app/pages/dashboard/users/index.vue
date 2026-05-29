<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type {
  AdminCreateUserRequest,
  AdminUpdateUserRequest,
  UserDto,
} from '~/types/admin'
import { toItems } from '~/types/admin'

definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'USER_VIEW_ALL',
})

useSeoMeta({ title: 'Usuarios — OptiSalud Plus' })

const users = useUsers()
const roles = useRoles()
const { can } = usePermissions()
const toast = useToast()

const canCreate = computed(() => can('USER_CREATE'))
const canUpdate = computed(() => can('USER_UPDATE'))
const canDelete = computed(() => can('USER_DELETE'))

// ---- Listado + paginación + búsqueda ----
const data = ref<UserDto[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1) // UPagination es 1-based; la API es 0-based
const size = ref(20)
const search = ref('')

function buildFilter(): string | undefined {
  const t = search.value.trim()
  if (!t) return undefined
  // RSQL: OR entre fullName y email (coma = OR)
  return `fullName=='*${t}*',email=='*${t}*'`
}

async function load() {
  loading.value = true
  try {
    const res = await users.list({
      page: page.value - 1,
      size: size.value,
      sort: 'createdAt,desc',
      filter: buildFilter(),
    })
    data.value = res.content ?? []
    total.value = res.totalElements ?? 0
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

watch([page, size], load)
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    load()
  }, 400)
})

// ---- Catálogo de roles para el selector ----
const roleOptions = ref<{ label: string, value: string }[]>([])

async function loadRoles() {
  try {
    const res = await roles.list()
    roleOptions.value = toItems(res).map(r => ({ label: r.name, value: r.uuid }))
  }
  catch {
    // El backend aún no expone /v1/admin/roles → derivamos de los usuarios cargados.
    const seen = new Map<string, string>()
    for (const u of data.value) {
      for (const r of u.roles ?? []) seen.set(r.uuid, r.name)
    }
    roleOptions.value = [...seen].map(([value, label]) => ({ label, value }))
    if (roleOptions.value.length === 0) {
      toast.add({
        title: 'No se pudieron cargar los roles',
        description: 'El backend aún no expone /v1/admin/roles. Pídelo a backend para asignar roles.',
        color: 'warning',
        icon: 'i-lucide-triangle-alert',
      })
    }
  }
}

onMounted(async () => {
  await load()
  await loadRoles()
})

// ---- Formulario crear/editar ----
const formOpen = ref(false)
const mode = ref<'create' | 'edit'>('create')
const editingUuid = ref<string | null>(null)
const isSubmitting = ref(false)

const STATUS_OPTIONS = ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING']
const DOCUMENT_OPTIONS = ['CC', 'CE', 'TI', 'PA', 'NIT']

interface FormState {
  email: string
  fullName: string
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
  fullName: '',
  password: '',
  documentType: undefined,
  documentNumber: '',
  phone: '',
  status: 'ACTIVE',
  active: true,
  roleIds: [],
})

const passwordRule = z
  .string()
  .min(10, 'Mínimo 10 caracteres')
  .regex(/[A-Z]/, 'Debe incluir una mayúscula')
  .regex(/[a-z]/, 'Debe incluir una minúscula')
  .regex(/[0-9]/, 'Debe incluir un número')
  .regex(/[^A-Za-z0-9]/, 'Debe incluir un símbolo')

const createSchema = z.object({
  email: z.string().email('Email no válido'),
  fullName: z.string().min(3, 'Mínimo 3 caracteres'),
  password: passwordRule,
  documentType: z.string().optional(),
  documentNumber: z.string().optional(),
  phone: z.string().optional(),
  roleIds: z.array(z.string()).min(1, 'Selecciona al menos un rol'),
})

const editSchema = z.object({
  fullName: z.string().min(3, 'Mínimo 3 caracteres'),
  documentType: z.string().optional(),
  documentNumber: z.string().optional(),
  phone: z.string().optional(),
  status: z.string(),
  roleIds: z.array(z.string()).min(1, 'Selecciona al menos un rol'),
})

const schema = computed(() => (mode.value === 'create' ? createSchema : editSchema))

function resetForm() {
  state.email = ''
  state.fullName = ''
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
}

function openEdit(u: UserDto) {
  mode.value = 'edit'
  editingUuid.value = u.uuid
  resetForm()
  state.email = u.email
  state.fullName = u.fullName ?? ''
  state.documentType = u.documentType || undefined
  state.documentNumber = u.documentNumber ?? ''
  state.phone = u.phone ?? ''
  state.status = u.status || 'ACTIVE'
  state.active = u.active ?? true
  state.roleIds = (u.roles ?? []).map(r => r.uuid)
  formOpen.value = true
}

async function onSubmit(_event: FormSubmitEvent<Record<string, unknown>>) {
  isSubmitting.value = true
  try {
    if (mode.value === 'create') {
      const body: AdminCreateUserRequest = {
        email: state.email,
        fullName: state.fullName,
        password: state.password,
        documentType: state.documentType || undefined,
        documentNumber: state.documentNumber || undefined,
        phone: state.phone || undefined,
        roleIds: state.roleIds,
      }
      await users.create(body)
      toast.add({ title: 'Usuario creado', color: 'success', icon: 'i-lucide-check-circle' })
    }
    else if (editingUuid.value) {
      const body: AdminUpdateUserRequest = {
        fullName: state.fullName,
        documentType: state.documentType || undefined,
        documentNumber: state.documentNumber || undefined,
        phone: state.phone || undefined,
        status: state.status,
        active: state.active,
        roleIds: state.roleIds,
      }
      await users.update(editingUuid.value, body)
      toast.add({ title: 'Usuario actualizado', color: 'success', icon: 'i-lucide-check-circle' })
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

function openDelete(u: UserDto) {
  target.value = u
  deleteOpen.value = true
}

async function confirmDelete() {
  if (!target.value) return
  deleting.value = true
  try {
    await users.remove(target.value.uuid)
    toast.add({ title: 'Usuario eliminado', color: 'success', icon: 'i-lucide-check-circle' })
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

function formatDate(iso?: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' })
}
</script>

<template>
  <div class="space-y-5">
    <!-- Header -->
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-extrabold text-prohealth-900">Usuarios</h1>
        <p class="text-sm text-prohealth-700/70 mt-1">
          Gestión de usuarios del sistema, sus datos y roles.
        </p>
      </div>
      <UTooltip :text="canCreate ? 'Crear un nuevo usuario' : 'No tienes permiso para crear usuarios'">
        <UButton
          color="primary"
          icon="i-lucide-user-plus"
          :disabled="!canCreate"
          @click="openCreate"
        >
          Nuevo usuario
        </UButton>
      </UTooltip>
    </div>

    <!-- Búsqueda -->
    <div class="bg-white rounded-2xl border border-prohealth-100 p-4">
      <UInput
        v-model="search"
        placeholder="Buscar por nombre o email…"
        icon="i-lucide-search"
        size="lg"
        class="w-full max-w-md"
      />
    </div>

    <!-- Tabla -->
    <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
              <th class="px-5 py-3 font-semibold">Usuario</th>
              <th class="px-5 py-3 font-semibold">Documento</th>
              <th class="px-5 py-3 font-semibold">Roles</th>
              <th class="px-5 py-3 font-semibold">Estado</th>
              <th class="px-5 py-3 font-semibold">Último acceso</th>
              <th class="px-5 py-3 font-semibold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-prohealth-100">
            <tr v-if="loading">
              <td colspan="6" class="px-5 py-10 text-center text-prohealth-500">
                <UIcon name="i-lucide-loader-circle" class="w-5 h-5 animate-spin inline" />
                Cargando…
              </td>
            </tr>
            <tr v-else-if="data.length === 0">
              <td colspan="6" class="px-5 py-12 text-center text-prohealth-500">
                <UIcon name="i-lucide-users" class="w-8 h-8 mx-auto mb-2 text-prohealth-300" />
                Sin usuarios
              </td>
            </tr>
            <tr
              v-for="u in data"
              v-else
              :key="u.uuid"
              class="hover:bg-prohealth-50/50"
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
                  {{ u.active === false ? 'Inactivo' : (u.status || '—') }}
                </UBadge>
              </td>
              <td class="px-5 py-3 text-prohealth-600">{{ formatDate(u.lastLoginAt) }}</td>
              <td class="px-5 py-3">
                <div class="flex items-center justify-end gap-1">
                  <UTooltip :text="canUpdate ? 'Editar' : 'No tienes permiso para editar'">
                    <UButton
                      color="neutral"
                      variant="ghost"
                      icon="i-lucide-pencil"
                      size="sm"
                      :disabled="!canUpdate"
                      @click="openEdit(u)"
                    />
                  </UTooltip>
                  <UTooltip :text="canDelete ? 'Eliminar' : 'No tienes permiso para eliminar'">
                    <UButton
                      color="error"
                      variant="ghost"
                      icon="i-lucide-trash-2"
                      size="sm"
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
      <div class="flex items-center justify-between px-5 py-3 border-t border-prohealth-100">
        <p class="text-xs text-prohealth-500">
          {{ data.length }} de {{ total }} usuario(s)
        </p>
        <UPagination
          v-model:page="page"
          :total="total"
          :items-per-page="size"
        />
      </div>
    </div>

    <!-- Modal crear/editar -->
    <UModal
      v-model:open="formOpen"
      :title="mode === 'create' ? 'Nuevo usuario' : 'Editar usuario'"
      :description="mode === 'create' ? 'Crea una cuenta y asígnale uno o más roles.' : 'Actualiza los datos y roles del usuario.'"
    >
      <template #body>
        <UForm
          :schema="schema"
          :state="state"
          class="space-y-4"
          @submit="onSubmit"
        >
          <UFormField v-if="mode === 'create'" label="Correo electrónico" name="email" required>
            <UInput v-model="state.email" type="email" autocomplete="off" class="w-full" />
          </UFormField>

          <UFormField label="Nombre completo" name="fullName" required>
            <UInput v-model="state.fullName" class="w-full" />
          </UFormField>

          <UFormField v-if="mode === 'create'" label="Contraseña" name="password" required>
            <UInput v-model="state.password" type="password" autocomplete="new-password" class="w-full" />
          </UFormField>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField label="Tipo de documento" name="documentType">
              <USelectMenu
                v-model="state.documentType"
                :items="DOCUMENT_OPTIONS"
                placeholder="Selecciona"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Número de documento" name="documentNumber">
              <UInput v-model="state.documentNumber" class="w-full" />
            </UFormField>
          </div>

          <UFormField label="Teléfono" name="phone">
            <UInput v-model="state.phone" class="w-full" />
          </UFormField>

          <div v-if="mode === 'edit'" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField label="Estado" name="status">
              <USelectMenu v-model="state.status" :items="STATUS_OPTIONS" class="w-full" />
            </UFormField>
            <UFormField label="Cuenta activa" name="active">
              <USwitch v-model="state.active" />
            </UFormField>
          </div>

          <UFormField label="Roles" name="roleIds" required>
            <USelectMenu
              v-model="state.roleIds"
              :items="roleOptions"
              label-key="label"
              value-key="value"
              multiple
              placeholder="Selecciona uno o más roles"
              class="w-full"
            />
          </UFormField>

          <div class="flex items-center justify-end gap-3 pt-2">
            <UButton color="neutral" variant="ghost" :disabled="isSubmitting" @click="formOpen = false">
              Cancelar
            </UButton>
            <UButton type="submit" color="primary" :loading="isSubmitting" icon="i-lucide-save">
              {{ mode === 'create' ? 'Crear usuario' : 'Guardar cambios' }}
            </UButton>
          </div>
        </UForm>
      </template>
    </UModal>

    <!-- Modal confirmar eliminación -->
    <UModal v-model:open="deleteOpen" title="Eliminar usuario">
      <template #body>
        <p class="text-sm text-prohealth-700">
          ¿Seguro que deseas eliminar a
          <span class="font-semibold">{{ target?.fullName }}</span>
          ({{ target?.email }})? Esta acción desactiva la cuenta.
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
