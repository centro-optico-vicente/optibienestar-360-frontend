<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { CatalogItem } from '~/types/catalogs'
import type {
  CreateMemberRequest,
  MemberDto,
  UpdateMemberRequest,
} from '~/types/members'

definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'MEMBER_VIEW_ALL',
})

useSeoMeta({ title: 'Afiliados — OptiSalud Plus' })

const members = useMembers()
const { can } = usePermissions()
const toast = useToast()

const canCreate = computed(() => can('MEMBER_CREATE'))
const canUpdate = computed(() => can('MEMBER_UPDATE'))
const canDelete = computed(() => can('MEMBER_DELETE'))

// ---- Listado + paginación + búsqueda ----
const data = ref<MemberDto[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1) // UPagination es 1-based; la API es 0-based
const size = ref(20)
const search = ref('')

async function load() {
  loading.value = true
  try {
    const res = await members.list({
      page: page.value - 1,
      size: size.value,
      sort: 'enrolledAt,desc',
      // El backend expone búsqueda free-text (trigram, insensible a acentos)
      q: search.value.trim() || undefined,
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

// ---- Catálogos para los selects del formulario ----
type Option = { label: string, value: string }
const genderOptions = ref<Option[]>([])
const maritalStatusOptions = ref<Option[]>([])
const occupationOptions = ref<Option[]>([])
const stateOptions = ref<Option[]>([])
const cityOptions = ref<Option[]>([])
const { options: documentTypeOptions, load: loadDocumentTypes } = useDocumentTypes()

function toOptions(items: CatalogItem[]): Option[] {
  return items
    .filter(i => i.active !== false)
    .map(i => ({ label: i.name, value: i.uuid }))
}

async function loadCatalogs() {
  // Públicos (sin permisos), todos en paralelo; cada uno falla en silencio.
  const safeList = async (resource: string, query?: Record<string, string>) => {
    try {
      return await usePublicCatalog(resource).list({ size: '-1', ...query })
    }
    catch {
      return [] as CatalogItem[]
    }
  }
  const [genders, marital, occupations, states] = await Promise.all([
    safeList('genders'),
    safeList('marital-statuses'),
    safeList('occupations'),
    safeList('states', { country: 'VE' }),
  ])
  genderOptions.value = toOptions(genders)
  maritalStatusOptions.value = toOptions(marital)
  occupationOptions.value = toOptions(occupations)
  stateOptions.value = toOptions(states)
}

// Ciudades en cascada según el estado seleccionado.
const selectedStateUuid = ref<string | undefined>(undefined)
watch(selectedStateUuid, async (stateUuid) => {
  cityOptions.value = []
  state.cityUuid = undefined
  if (!stateUuid) return
  try {
    const cities = await usePublicCatalog('cities').list({ stateUuid, size: '-1' })
    cityOptions.value = toOptions(cities)
  }
  catch {
    cityOptions.value = []
  }
})

onMounted(async () => {
  await load()
  await Promise.all([loadCatalogs(), loadDocumentTypes()])
})

// ---- Formulario crear/editar ----
const formOpen = ref(false)
const mode = ref<'create' | 'edit'>('create')
const editingUuid = ref<string | null>(null)
const isSubmitting = ref(false)

const STATUS_OPTIONS = ['ACTIVE', 'INACTIVE', 'SUSPENDED']

interface FormState {
  firstName: string
  middleName: string
  lastName: string
  secondLastName: string
  documentType: string | undefined
  documentNumber: string
  birthDate: string
  genderUuid: string | undefined
  maritalStatusUuid: string | undefined
  occupationUuid: string | undefined
  cityUuid: string | undefined
  birthplace: string
  numberOfChildren: string
  spouseName: string
  phone: string
  landlinePhone: string
  email: string
  address: string
  employerName: string
  jobPosition: string
  employerAddress: string
  enrolledAt: string
  status: string
  notes: string
}

const state = reactive<FormState>({
  firstName: '',
  middleName: '',
  lastName: '',
  secondLastName: '',
  documentType: undefined,
  documentNumber: '',
  birthDate: '',
  genderUuid: undefined,
  maritalStatusUuid: undefined,
  occupationUuid: undefined,
  cityUuid: undefined,
  birthplace: '',
  numberOfChildren: '',
  spouseName: '',
  phone: '',
  landlinePhone: '',
  email: '',
  address: '',
  employerName: '',
  jobPosition: '',
  employerAddress: '',
  enrolledAt: '',
  status: 'ACTIVE',
  notes: '',
})

/** El titular debe ser mayor de edad (@MinimumAge=18 en el backend). */
function isAdult(iso: string): boolean {
  const birth = new Date(iso)
  if (Number.isNaN(birth.getTime())) return false
  const cutoff = new Date()
  cutoff.setFullYear(cutoff.getFullYear() - 18)
  return birth <= cutoff
}

const baseSchema = {
  firstName: z.string().min(2, 'Mínimo 2 caracteres'),
  middleName: z.string().optional(),
  lastName: z.string().min(2, 'Mínimo 2 caracteres'),
  secondLastName: z.string().optional(),
  birthDate: z.string().min(1, 'Requerido').refine(isAdult, 'El titular debe ser mayor de 18 años'),
  birthplace: z.string().optional(),
  numberOfChildren: z.string().regex(/^\d*$/, 'Solo números').optional(),
  spouseName: z.string().optional(),
  phone: z.string().optional(),
  landlinePhone: z.string().optional(),
  email: z.string().email('Email no válido').optional().or(z.literal('')),
  address: z.string().optional(),
  employerName: z.string().optional(),
  jobPosition: z.string().optional(),
  employerAddress: z.string().optional(),
  enrolledAt: z.string().optional(),
  notes: z.string().optional(),
}

const createSchema = z.object({
  ...baseSchema,
  documentType: z.string({ message: 'Requerido' }).min(1, 'Requerido'),
  documentNumber: z.string().min(5, 'Mínimo 5 dígitos').regex(/^\d+$/, 'Solo números'),
})

const editSchema = z.object({
  ...baseSchema,
  status: z.string(),
})

const schema = computed(() => (mode.value === 'create' ? createSchema : editSchema))

function resetForm() {
  state.firstName = ''
  state.middleName = ''
  state.lastName = ''
  state.secondLastName = ''
  state.documentType = undefined
  state.documentNumber = ''
  state.birthDate = ''
  state.genderUuid = undefined
  state.maritalStatusUuid = undefined
  state.occupationUuid = undefined
  state.cityUuid = undefined
  state.birthplace = ''
  state.numberOfChildren = ''
  state.spouseName = ''
  state.phone = ''
  state.landlinePhone = ''
  state.email = ''
  state.address = ''
  state.employerName = ''
  state.jobPosition = ''
  state.employerAddress = ''
  state.enrolledAt = ''
  state.status = 'ACTIVE'
  state.notes = ''
  selectedStateUuid.value = undefined
}

function openCreate() {
  mode.value = 'create'
  editingUuid.value = null
  resetForm()
  formOpen.value = true
}

function openEdit(m: MemberDto) {
  mode.value = 'edit'
  editingUuid.value = m.uuid
  resetForm()
  state.firstName = m.firstName ?? ''
  state.middleName = m.middleName ?? ''
  state.lastName = m.lastName ?? ''
  state.secondLastName = m.secondLastName ?? ''
  state.documentType = m.documentType || undefined
  state.documentNumber = m.documentNumber ?? ''
  state.birthDate = m.birthDate ?? ''
  state.genderUuid = m.gender?.uuid
  state.maritalStatusUuid = m.maritalStatus?.uuid
  state.occupationUuid = m.occupation?.uuid
  state.cityUuid = m.city?.uuid
  state.birthplace = m.birthplace ?? ''
  state.numberOfChildren = m.numberOfChildren != null ? String(m.numberOfChildren) : ''
  state.spouseName = m.spouseName ?? ''
  state.phone = m.phone ?? ''
  state.landlinePhone = m.landlinePhone ?? ''
  state.email = m.email ?? ''
  state.address = m.address ?? ''
  state.employerName = m.employerName ?? ''
  state.jobPosition = m.jobPosition ?? ''
  state.employerAddress = m.employerAddress ?? ''
  state.enrolledAt = m.enrolledAt ?? ''
  state.status = m.status || 'ACTIVE'
  state.notes = m.notes ?? ''
  formOpen.value = true
}

async function onSubmit(_event: FormSubmitEvent<Record<string, unknown>>) {
  isSubmitting.value = true
  try {
    if (mode.value === 'create') {
      const body: CreateMemberRequest = {
        firstName: state.firstName,
        middleName: state.middleName || undefined,
        lastName: state.lastName,
        secondLastName: state.secondLastName || undefined,
        documentType: state.documentType!,
        documentNumber: state.documentNumber,
        birthDate: state.birthDate,
        genderUuid: state.genderUuid,
        maritalStatusUuid: state.maritalStatusUuid,
        occupationUuid: state.occupationUuid,
        cityUuid: state.cityUuid,
        birthplace: state.birthplace || undefined,
        numberOfChildren: state.numberOfChildren ? Number(state.numberOfChildren) : undefined,
        spouseName: state.spouseName || undefined,
        phone: state.phone || undefined,
        landlinePhone: state.landlinePhone || undefined,
        email: state.email || undefined,
        address: state.address || undefined,
        employerName: state.employerName || undefined,
        jobPosition: state.jobPosition || undefined,
        employerAddress: state.employerAddress || undefined,
        enrolledAt: state.enrolledAt || undefined,
        notes: state.notes || undefined,
      }
      await members.create(body)
      toast.add({ title: 'Afiliado creado', color: 'success', icon: 'i-lucide-check-circle' })
    }
    else if (editingUuid.value) {
      const body: UpdateMemberRequest = {
        firstName: state.firstName,
        middleName: state.middleName || undefined,
        lastName: state.lastName,
        secondLastName: state.secondLastName || undefined,
        birthDate: state.birthDate || undefined,
        genderUuid: state.genderUuid,
        maritalStatusUuid: state.maritalStatusUuid,
        occupationUuid: state.occupationUuid,
        cityUuid: state.cityUuid,
        birthplace: state.birthplace || undefined,
        numberOfChildren: state.numberOfChildren ? Number(state.numberOfChildren) : undefined,
        spouseName: state.spouseName || undefined,
        phone: state.phone || undefined,
        landlinePhone: state.landlinePhone || undefined,
        email: state.email || undefined,
        address: state.address || undefined,
        employerName: state.employerName || undefined,
        jobPosition: state.jobPosition || undefined,
        employerAddress: state.employerAddress || undefined,
        enrolledAt: state.enrolledAt || undefined,
        status: state.status,
        notes: state.notes || undefined,
      }
      await members.update(editingUuid.value, body)
      toast.add({ title: 'Afiliado actualizado', color: 'success', icon: 'i-lucide-check-circle' })
    }
    formOpen.value = false
    await load()
  }
  catch {
    // useApi ya notificó el error (409 documento duplicado, 422, etc.)
  }
  finally {
    isSubmitting.value = false
  }
}

// ---- Eliminar ----
const deleteOpen = ref(false)
const deleting = ref(false)
const target = ref<MemberDto | null>(null)

function openDelete(m: MemberDto) {
  target.value = m
  deleteOpen.value = true
}

async function confirmDelete() {
  if (!target.value) return
  deleting.value = true
  try {
    await members.remove(target.value.uuid)
    toast.add({ title: 'Afiliado eliminado', color: 'success', icon: 'i-lucide-check-circle' })
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

// ---- Helpers de presentación ----
function displayName(m: MemberDto): string {
  if (m.fullName) return m.fullName
  return [m.firstName, m.middleName, m.lastName, m.secondLastName].filter(Boolean).join(' ') || '—'
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es', { dateStyle: 'medium' })
}
</script>

<template>
  <div class="space-y-5">
    <!-- Header -->
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-extrabold text-prohealth-900">Afiliados</h1>
        <p class="text-sm text-prohealth-700/70 mt-1">
          Gestión de titulares afiliados, sus beneficiarios e histórico médico.
        </p>
      </div>
      <UTooltip :text="canCreate ? 'Registrar un nuevo afiliado' : 'No tienes permiso para crear afiliados'">
        <UButton
          color="primary"
          icon="i-lucide-user-plus"
          :disabled="!canCreate"
          @click="openCreate"
        >
          Nuevo afiliado
        </UButton>
      </UTooltip>
    </div>

    <!-- Búsqueda -->
    <div class="bg-white rounded-2xl border border-prohealth-100 p-4">
      <UInput
        v-model="search"
        placeholder="Buscar por nombre o documento…"
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
              <th class="px-5 py-3 font-semibold">Afiliado</th>
              <th class="px-5 py-3 font-semibold">Documento</th>
              <th class="px-5 py-3 font-semibold">Teléfono</th>
              <th class="px-5 py-3 font-semibold">Afiliación</th>
              <th class="px-5 py-3 font-semibold">Estado</th>
              <th class="px-5 py-3 font-semibold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-prohealth-100">
            <TableSkeleton v-if="loading" :rows="8" :cols="6" />
            <tr v-else-if="data.length === 0">
              <td colspan="6" class="px-5 py-12 text-center text-prohealth-500">
                <UIcon name="i-lucide-users" class="w-8 h-8 mx-auto mb-2 text-prohealth-300" />
                Sin afiliados
              </td>
            </tr>
            <tr
              v-for="m in data"
              v-else
              :key="m.uuid"
              class="hover:bg-prohealth-50/50 cursor-pointer"
              @click="navigateTo(`/dashboard/members/${m.uuid}`)"
            >
              <td class="px-5 py-3">
                <div class="font-semibold text-prohealth-900">{{ displayName(m) }}</div>
                <div class="text-xs text-prohealth-500">{{ m.email || '—' }}</div>
              </td>
              <td class="px-5 py-3 text-prohealth-700">
                <span v-if="m.documentNumber">{{ m.documentType }} {{ m.documentNumber }}</span>
                <span v-else class="text-prohealth-400">—</span>
              </td>
              <td class="px-5 py-3 text-prohealth-700">{{ m.phone || '—' }}</td>
              <td class="px-5 py-3 text-prohealth-600">{{ formatDate(m.enrolledAt) }}</td>
              <td class="px-5 py-3">
                <UBadge
                  :color="m.status === 'ACTIVE' ? 'success' : 'warning'"
                  variant="subtle"
                  size="sm"
                >
                  {{ m.status || '—' }}
                </UBadge>
              </td>
              <td class="px-5 py-3" @click.stop>
                <div class="flex items-center justify-end gap-1">
                  <UTooltip text="Ver detalle">
                    <UButton
                      color="neutral"
                      variant="ghost"
                      icon="i-lucide-eye"
                      size="sm"
                      :to="`/dashboard/members/${m.uuid}`"
                    />
                  </UTooltip>
                  <UTooltip :text="canUpdate ? 'Editar' : 'No tienes permiso para editar'">
                    <UButton
                      color="neutral"
                      variant="ghost"
                      icon="i-lucide-pencil"
                      size="sm"
                      :disabled="!canUpdate"
                      @click="openEdit(m)"
                    />
                  </UTooltip>
                  <UTooltip :text="canDelete ? 'Eliminar' : 'No tienes permiso para eliminar'">
                    <UButton
                      color="error"
                      variant="ghost"
                      icon="i-lucide-trash-2"
                      size="sm"
                      :disabled="!canDelete"
                      @click="openDelete(m)"
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
          {{ data.length }} de {{ total }} afiliado(s)
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
      :title="mode === 'create' ? 'Nuevo afiliado' : 'Editar afiliado'"
      :description="mode === 'create' ? 'Registra un titular (mayor de 18 años). Si la persona ya existe por documento, se reutiliza.' : 'Actualiza los datos del afiliado.'"
      :ui="{ content: 'max-w-2xl' }"
    >
      <template #body>
        <UForm
          :schema="schema"
          :state="state"
          class="space-y-4"
          @submit="onSubmit"
        >
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField label="Primer nombre" name="firstName" required>
              <UInput v-model="state.firstName" class="w-full" />
            </UFormField>
            <UFormField label="Segundo nombre" name="middleName">
              <UInput v-model="state.middleName" class="w-full" />
            </UFormField>
            <UFormField label="Primer apellido" name="lastName" required>
              <UInput v-model="state.lastName" class="w-full" />
            </UFormField>
            <UFormField label="Segundo apellido" name="secondLastName">
              <UInput v-model="state.secondLastName" class="w-full" />
            </UFormField>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField label="Tipo de documento" name="documentType" :required="mode === 'create'">
              <USelectMenu
                v-model="state.documentType"
                :items="documentTypeOptions"
                label-key="label"
                value-key="value"
                placeholder="Selecciona"
                :disabled="mode === 'edit'"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Número de documento" name="documentNumber" :required="mode === 'create'">
              <UInput v-model="state.documentNumber" :disabled="mode === 'edit'" class="w-full" />
            </UFormField>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField label="Fecha de nacimiento" name="birthDate" required>
              <UInput v-model="state.birthDate" type="date" class="w-full" />
            </UFormField>
            <UFormField label="Fecha de afiliación" name="enrolledAt">
              <UInput v-model="state.enrolledAt" type="date" class="w-full" />
            </UFormField>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField label="Género" name="genderUuid">
              <USelectMenu
                v-model="state.genderUuid"
                :items="genderOptions"
                label-key="label"
                value-key="value"
                placeholder="Selecciona"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Estado civil" name="maritalStatusUuid">
              <USelectMenu
                v-model="state.maritalStatusUuid"
                :items="maritalStatusOptions"
                label-key="label"
                value-key="value"
                placeholder="Selecciona"
                class="w-full"
              />
            </UFormField>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField label="Lugar de nacimiento" name="birthplace">
              <UInput v-model="state.birthplace" class="w-full" />
            </UFormField>
            <UFormField label="Cantidad de hijos" name="numberOfChildren">
              <UInput v-model="state.numberOfChildren" type="number" min="0" class="w-full" />
            </UFormField>
          </div>

          <UFormField label="Cónyuge" name="spouseName">
            <UInput v-model="state.spouseName" class="w-full" />
          </UFormField>

          <UFormField label="Ocupación" name="occupationUuid">
            <USelectMenu
              v-model="state.occupationUuid"
              :items="occupationOptions"
              label-key="label"
              value-key="value"
              placeholder="Selecciona"
              class="w-full"
            />
          </UFormField>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField label="Lugar de trabajo" name="employerName">
              <UInput v-model="state.employerName" class="w-full" />
            </UFormField>
            <UFormField label="Cargo" name="jobPosition">
              <UInput v-model="state.jobPosition" class="w-full" />
            </UFormField>
          </div>

          <UFormField label="Dirección de la empresa" name="employerAddress">
            <UInput v-model="state.employerAddress" class="w-full" />
          </UFormField>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField label="Celular" name="phone">
              <UInput v-model="state.phone" class="w-full" />
            </UFormField>
            <UFormField label="Teléfono fijo" name="landlinePhone">
              <UInput v-model="state.landlinePhone" class="w-full" />
            </UFormField>
          </div>

          <UFormField label="Email" name="email">
            <UInput v-model="state.email" type="email" class="w-full" />
          </UFormField>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField label="Estado (región)" name="stateUuid">
              <USelectMenu
                v-model="selectedStateUuid"
                :items="stateOptions"
                label-key="label"
                value-key="value"
                placeholder="Selecciona"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Ciudad" name="cityUuid">
              <USelectMenu
                v-model="state.cityUuid"
                :items="cityOptions"
                label-key="label"
                value-key="value"
                :disabled="!selectedStateUuid"
                placeholder="Selecciona un estado primero"
                class="w-full"
              />
            </UFormField>
          </div>

          <UFormField label="Dirección" name="address">
            <UInput v-model="state.address" class="w-full" />
          </UFormField>

          <UFormField v-if="mode === 'edit'" label="Estado" name="status">
            <USelectMenu v-model="state.status" :items="STATUS_OPTIONS" class="w-full" />
          </UFormField>

          <UFormField label="Notas" name="notes">
            <UTextarea v-model="state.notes" :rows="2" class="w-full" />
          </UFormField>

          <div class="flex items-center justify-end gap-3 pt-2">
            <UButton color="neutral" variant="ghost" :disabled="isSubmitting" @click="formOpen = false">
              Cancelar
            </UButton>
            <UButton type="submit" color="primary" :loading="isSubmitting" icon="i-lucide-save">
              {{ mode === 'create' ? 'Crear afiliado' : 'Guardar cambios' }}
            </UButton>
          </div>
        </UForm>
      </template>
    </UModal>

    <!-- Modal confirmar eliminación -->
    <UModal v-model:open="deleteOpen" title="Eliminar afiliado">
      <template #body>
        <p class="text-sm text-prohealth-700">
          ¿Seguro que deseas eliminar a
          <span class="font-semibold">{{ target ? displayName(target) : '' }}</span>
          ({{ target?.documentType }} {{ target?.documentNumber }})?
          Esta acción desactiva la afiliación (soft-delete).
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
