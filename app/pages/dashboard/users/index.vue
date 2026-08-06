<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type {
  AdminCreateUserRequest,
  AdminUpdateUserRequest,
  UserDto,
} from '~/types/admin'

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

// ---- Listado + paginación + búsqueda ----
const data = ref<UserDto[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1) // UPagination es 1-based; la API es 0-based
const size = ref(20)
const search = ref('')

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
    const res = await roles.options({ limit: 200 })
    roleOptions.value = res.map(o => ({ label: o.label, value: o.uuid }))
  }
  catch {
    // useApi ya notificó el error; sin roles no se puede asignar.
    roleOptions.value = []
  }
}

onMounted(async () => {
  await load()
  await Promise.all([loadRoles(), loadDocumentTypes()])
})

// ---- Formulario crear/editar ----
const formOpen = ref(false)
const mode = ref<'create' | 'edit'>('create')
const editingUuid = ref<string | null>(null)
const isSubmitting = ref(false)

// Backend only accepts these (AdminUpdateUserRequest.status pattern).
const STATUS_VALUES = ['ACTIVE', 'SUSPENDED', 'LOCKED']
const statusOptions = computed(() =>
  STATUS_VALUES.map(s => ({ label: t(`security.users.status.${s}`), value: s })),
)

/** Localized status label; unknown statuses are shown raw. */
function statusLabel(u: UserDto): string {
  if (u.active === false) return t('security.users.inactive')
  if (!u.status) return t('common.empty')
  return STATUS_VALUES.includes(u.status) ? t(`security.users.status.${u.status}`) : u.status
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
}

function openEdit(u: UserDto) {
  mode.value = 'edit'
  editingUuid.value = u.uuid
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
  formOpen.value = true
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

function openDelete(u: UserDto) {
  target.value = u
  deleteOpen.value = true
}

async function confirmDelete() {
  if (!target.value) return
  deleting.value = true
  try {
    await users.remove(target.value.uuid)
    toast.add({ title: t('security.users.deletedToast'), color: 'success', icon: 'i-lucide-check-circle' })
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
      <UTooltip :text="canCreate ? $t('security.users.createTooltip') : $t('security.users.noPermissionCreate')">
        <UButton
          color="primary"
          icon="i-lucide-user-plus"
          :disabled="!canCreate"
          @click="openCreate"
        >
          {{ $t('security.users.new') }}
        </UButton>
      </UTooltip>
    </div>

    <!-- Búsqueda -->
    <div class="bg-white rounded-2xl border border-prohealth-100 p-4">
      <UInput
        v-model="search"
        :placeholder="$t('security.users.searchPlaceholder')"
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
              <th class="px-5 py-3 font-semibold">{{ $t('security.users.columns.user') }}</th>
              <th class="px-5 py-3 font-semibold">{{ $t('security.users.columns.document') }}</th>
              <th class="px-5 py-3 font-semibold">{{ $t('security.users.columns.roles') }}</th>
              <th class="px-5 py-3 font-semibold">{{ $t('security.users.columns.status') }}</th>
              <th class="px-5 py-3 font-semibold">{{ $t('security.users.columns.lastLogin') }}</th>
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
              <td class="px-5 py-3 text-prohealth-600">{{ formatDate(u.lastLoginAt, 'datetime') }}</td>
              <td class="px-5 py-3">
                <div class="flex items-center justify-end gap-1">
                  <UTooltip :text="canUpdate ? $t('common.edit') : $t('security.users.noPermissionEdit')">
                    <UButton
                      color="neutral"
                      variant="ghost"
                      icon="i-lucide-pencil"
                      size="sm"
                      :disabled="!canUpdate"
                      @click="openEdit(u)"
                    />
                  </UTooltip>
                  <UTooltip :text="canDelete ? $t('common.delete') : $t('security.users.noPermissionDelete')">
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
          {{ $t('security.users.paginationSummary', { shown: data.length, total }) }}
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

          <div class="flex items-center justify-between gap-3 pt-2">
            <p class="text-xs text-prohealth-500">{{ $t('common.requiredFieldsHint') }}</p>
            <div class="flex items-center gap-3">
              <UButton color="neutral" variant="ghost" :disabled="isSubmitting" @click="formOpen = false">
                {{ $t('common.cancel') }}
              </UButton>
              <UButton type="submit" color="primary" :loading="isSubmitting" icon="i-lucide-save">
                {{ mode === 'create' ? $t('security.users.submitCreate') : $t('common.saveChanges') }}
              </UButton>
            </div>
          </div>
        </UForm>
      </template>
    </UModal>

    <!-- Modal confirmar eliminación -->
    <UModal v-model:open="deleteOpen" :title="$t('security.users.deleteTitle')">
      <template #body>
        <p class="text-sm text-prohealth-700">
          {{ $t('security.users.deleteConfirm', { name: target?.fullName ?? '', email: target?.email ?? '' }) }}
        </p>
        <div class="flex items-center justify-end gap-3 pt-5">
          <UButton color="neutral" variant="ghost" :disabled="deleting" @click="deleteOpen = false">
            {{ $t('common.cancel') }}
          </UButton>
          <UButton color="error" :loading="deleting" icon="i-lucide-trash-2" @click="confirmDelete">
            {{ $t('common.delete') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
