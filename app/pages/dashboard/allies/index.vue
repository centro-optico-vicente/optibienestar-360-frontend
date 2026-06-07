<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { CatalogItem } from '~/types/catalogs'
import type {
  AllyDto,
  CreateAllyRequest,
  UpdateAllyRequest,
} from '~/types/allies'

definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'ALLY_VIEW_ALL',
})

useSeoMeta({ title: 'Aliados — OptiSalud Plus' })

const allies = useAllies()
const { can } = usePermissions()
const toast = useToast()

const canCreate = computed(() => can('ALLY_CREATE'))
const canUpdate = computed(() => can('ALLY_UPDATE'))
const canDelete = computed(() => can('ALLY_DELETE'))

// ---- Listado + paginación + búsqueda ----
const data = ref<AllyDto[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1) // UPagination es 1-based; la API es 0-based
const size = ref(20)
const search = ref('')

async function load() {
  loading.value = true
  try {
    const res = await allies.list({
      page: page.value - 1,
      size: size.value,
      sort: 'name,asc',
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
const allyTypeOptions = ref<Option[]>([])
const specialtyOptions = ref<Option[]>([])
const stateOptions = ref<Option[]>([])
const cityOptions = ref<Option[]>([])
const { options: documentTypeOptions, load: loadDocumentTypes } = useDocumentTypes()

function toOptions(items: CatalogItem[]): Option[] {
  return items
    .filter(i => i.active !== false)
    .map(i => ({ label: i.name, value: i.uuid }))
}

async function loadCatalogs() {
  const safeList = async (resource: string, query?: Record<string, string>) => {
    try {
      return await usePublicCatalog(resource).list({ size: '-1', ...query })
    }
    catch {
      return [] as CatalogItem[]
    }
  }
  const [types, specialties, states] = await Promise.all([
    safeList('ally-types'),
    safeList('medical-specialties'),
    safeList('states', { country: 'VE' }),
  ])
  allyTypeOptions.value = toOptions(types)
  specialtyOptions.value = toOptions(specialties)
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
  name: string
  allyTypeUuid: string | undefined
  taxDocumentType: string | undefined
  taxDocumentNumber: string
  email: string
  phone: string
  website: string
  address: string
  cityUuid: string | undefined
  description: string
  joinedAt: string
  published: boolean
  status: string
  specialtyUuids: string[]
}

const state = reactive<FormState>({
  name: '',
  allyTypeUuid: undefined,
  taxDocumentType: undefined,
  taxDocumentNumber: '',
  email: '',
  phone: '',
  website: '',
  address: '',
  cityUuid: undefined,
  description: '',
  joinedAt: '',
  published: false,
  status: 'ACTIVE',
  specialtyUuids: [],
})

const baseSchema = {
  name: z.string().min(3, 'Mínimo 3 caracteres'),
  allyTypeUuid: z.string({ message: 'Requerido' }).min(1, 'Requerido'),
  taxDocumentType: z.string().optional(),
  taxDocumentNumber: z.string().regex(/^\d*$/, 'Solo números').optional(),
  email: z.string().email('Email no válido').optional().or(z.literal('')),
  phone: z.string().optional(),
  website: z.string().url('URL no válida').optional().or(z.literal('')),
  address: z.string().optional(),
  description: z.string().optional(),
  joinedAt: z.string().optional(),
}

const createSchema = z.object(baseSchema)
const editSchema = z.object({ ...baseSchema, status: z.string() })
const schema = computed(() => (mode.value === 'create' ? createSchema : editSchema))

function resetForm() {
  state.name = ''
  state.allyTypeUuid = undefined
  state.taxDocumentType = undefined
  state.taxDocumentNumber = ''
  state.email = ''
  state.phone = ''
  state.website = ''
  state.address = ''
  state.cityUuid = undefined
  state.description = ''
  state.joinedAt = ''
  state.published = false
  state.status = 'ACTIVE'
  state.specialtyUuids = []
  selectedStateUuid.value = undefined
}

function openCreate() {
  mode.value = 'create'
  editingUuid.value = null
  resetForm()
  formOpen.value = true
}

function openEdit(a: AllyDto) {
  mode.value = 'edit'
  editingUuid.value = a.uuid
  resetForm()
  state.name = a.name ?? ''
  state.allyTypeUuid = a.allyType?.uuid
  state.taxDocumentType = a.taxDocumentType || undefined
  state.taxDocumentNumber = a.taxDocumentNumber ?? ''
  state.email = a.email ?? ''
  state.phone = a.phone ?? ''
  state.website = a.website ?? ''
  state.address = a.address ?? ''
  state.cityUuid = a.city?.uuid
  state.description = a.description ?? ''
  state.joinedAt = a.joinedAt ?? ''
  state.published = a.published ?? false
  state.status = a.status || 'ACTIVE'
  state.specialtyUuids = (a.specialties ?? []).map(s => s.uuid)
  formOpen.value = true
}

async function onSubmit(_event: FormSubmitEvent<Record<string, unknown>>) {
  isSubmitting.value = true
  try {
    if (mode.value === 'create') {
      const body: CreateAllyRequest = {
        name: state.name,
        allyTypeUuid: state.allyTypeUuid!,
        taxDocumentType: state.taxDocumentType || undefined,
        taxDocumentNumber: state.taxDocumentNumber || undefined,
        email: state.email || undefined,
        phone: state.phone || undefined,
        website: state.website || undefined,
        address: state.address || undefined,
        cityUuid: state.cityUuid,
        description: state.description || undefined,
        joinedAt: state.joinedAt || undefined,
        published: state.published,
        specialtyUuids: state.specialtyUuids.length ? state.specialtyUuids : undefined,
      }
      await allies.create(body)
      toast.add({ title: 'Aliado creado', color: 'success', icon: 'i-lucide-check-circle' })
    }
    else if (editingUuid.value) {
      const body: UpdateAllyRequest = {
        name: state.name,
        allyTypeUuid: state.allyTypeUuid,
        taxDocumentType: state.taxDocumentType || undefined,
        taxDocumentNumber: state.taxDocumentNumber || undefined,
        email: state.email || undefined,
        phone: state.phone || undefined,
        website: state.website || undefined,
        address: state.address || undefined,
        cityUuid: state.cityUuid,
        description: state.description || undefined,
        joinedAt: state.joinedAt || undefined,
        published: state.published,
        status: state.status,
        // Reemplaza el conjunto completo de especialidades.
        specialtyUuids: state.specialtyUuids,
      }
      await allies.update(editingUuid.value, body)
      toast.add({ title: 'Aliado actualizado', color: 'success', icon: 'i-lucide-check-circle' })
    }
    formOpen.value = false
    await load()
  }
  catch {
    // useApi ya notificó el error (409 RIF duplicado, 422, etc.)
  }
  finally {
    isSubmitting.value = false
  }
}

// ---- Eliminar ----
const deleteOpen = ref(false)
const deleting = ref(false)
const target = ref<AllyDto | null>(null)

function openDelete(a: AllyDto) {
  target.value = a
  deleteOpen.value = true
}

async function confirmDelete() {
  if (!target.value) return
  deleting.value = true
  try {
    await allies.remove(target.value.uuid)
    toast.add({ title: 'Aliado eliminado', color: 'success', icon: 'i-lucide-check-circle' })
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
        <h1 class="text-2xl font-extrabold text-prohealth-900">Aliados</h1>
        <p class="text-sm text-prohealth-700/70 mt-1">
          Empresas y profesionales aliados: servicios, acuerdos y personal.
        </p>
      </div>
      <UTooltip :text="canCreate ? 'Registrar un nuevo aliado' : 'No tienes permiso para crear aliados'">
        <UButton
          color="primary"
          icon="i-lucide-handshake"
          :disabled="!canCreate"
          @click="openCreate"
        >
          Nuevo aliado
        </UButton>
      </UTooltip>
    </div>

    <!-- Búsqueda -->
    <div class="bg-white rounded-2xl border border-prohealth-100 p-4">
      <UInput
        v-model="search"
        placeholder="Buscar por nombre…"
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
              <th class="px-5 py-3 font-semibold">Aliado</th>
              <th class="px-5 py-3 font-semibold">Tipo</th>
              <th class="px-5 py-3 font-semibold">RIF</th>
              <th class="px-5 py-3 font-semibold">Ciudad</th>
              <th class="px-5 py-3 font-semibold">Publicado</th>
              <th class="px-5 py-3 font-semibold">Estado</th>
              <th class="px-5 py-3 font-semibold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-prohealth-100">
            <TableSkeleton v-if="loading" :rows="8" :cols="7" />
            <tr v-else-if="data.length === 0">
              <td colspan="7" class="px-5 py-12 text-center text-prohealth-500">
                <UIcon name="i-lucide-handshake" class="w-8 h-8 mx-auto mb-2 text-prohealth-300" />
                Sin aliados
              </td>
            </tr>
            <tr
              v-for="a in data"
              v-else
              :key="a.uuid"
              class="hover:bg-prohealth-50/50 cursor-pointer"
              @click="navigateTo(`/dashboard/allies/${a.uuid}`)"
            >
              <td class="px-5 py-3">
                <div class="font-semibold text-prohealth-900">{{ a.name }}</div>
                <div class="text-xs text-prohealth-500">{{ a.email || '—' }}</div>
              </td>
              <td class="px-5 py-3 text-prohealth-700">{{ a.allyType?.name || '—' }}</td>
              <td class="px-5 py-3 text-prohealth-700">
                <span v-if="a.taxDocumentNumber">{{ a.taxDocumentType }}-{{ a.taxDocumentNumber }}</span>
                <span v-else class="text-prohealth-400">—</span>
              </td>
              <td class="px-5 py-3 text-prohealth-700">{{ a.city?.name || '—' }}</td>
              <td class="px-5 py-3">
                <UBadge :color="a.published ? 'success' : 'neutral'" variant="subtle" size="sm">
                  {{ a.published ? 'Publicado' : 'Borrador' }}
                </UBadge>
              </td>
              <td class="px-5 py-3">
                <UBadge
                  :color="a.status === 'ACTIVE' ? 'success' : 'warning'"
                  variant="subtle"
                  size="sm"
                >
                  {{ a.status || '—' }}
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
                      :to="`/dashboard/allies/${a.uuid}`"
                    />
                  </UTooltip>
                  <UTooltip :text="canUpdate ? 'Editar' : 'No tienes permiso para editar'">
                    <UButton
                      color="neutral"
                      variant="ghost"
                      icon="i-lucide-pencil"
                      size="sm"
                      :disabled="!canUpdate"
                      @click="openEdit(a)"
                    />
                  </UTooltip>
                  <UTooltip :text="canDelete ? 'Eliminar' : 'No tienes permiso para eliminar'">
                    <UButton
                      color="error"
                      variant="ghost"
                      icon="i-lucide-trash-2"
                      size="sm"
                      :disabled="!canDelete"
                      @click="openDelete(a)"
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
          {{ data.length }} de {{ total }} aliado(s)
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
      :title="mode === 'create' ? 'Nuevo aliado' : 'Editar aliado'"
      :description="mode === 'create' ? 'Registra una empresa o profesional aliado.' : 'Actualiza los datos del aliado.'"
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
            <UFormField label="Nombre" name="name" required>
              <UInput v-model="state.name" class="w-full" />
            </UFormField>
            <UFormField label="Tipo de aliado" name="allyTypeUuid" required>
              <USelectMenu
                v-model="state.allyTypeUuid"
                :items="allyTypeOptions"
                label-key="label"
                value-key="value"
                placeholder="Selecciona"
                class="w-full"
              />
            </UFormField>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField label="Tipo de documento fiscal" name="taxDocumentType">
              <USelectMenu
                v-model="state.taxDocumentType"
                :items="documentTypeOptions"
                label-key="label"
                value-key="value"
                placeholder="Selecciona"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Número (RIF)" name="taxDocumentNumber">
              <UInput v-model="state.taxDocumentNumber" class="w-full" />
            </UFormField>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField label="Email" name="email">
              <UInput v-model="state.email" type="email" class="w-full" />
            </UFormField>
            <UFormField label="Teléfono" name="phone">
              <UInput v-model="state.phone" class="w-full" />
            </UFormField>
          </div>

          <UFormField label="Sitio web" name="website">
            <UInput v-model="state.website" placeholder="https://…" class="w-full" />
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

          <UFormField label="Descripción" name="description">
            <UTextarea v-model="state.description" :rows="2" class="w-full" />
          </UFormField>

          <UFormField label="Especialidades" name="specialtyUuids">
            <USelectMenu
              v-model="state.specialtyUuids"
              :items="specialtyOptions"
              label-key="label"
              value-key="value"
              multiple
              placeholder="Selecciona una o más"
              class="w-full"
            />
          </UFormField>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <UFormField label="Fecha de alianza" name="joinedAt">
              <UInput v-model="state.joinedAt" type="date" class="w-full" />
            </UFormField>
            <UFormField label="Publicado en directorio" name="published">
              <USwitch v-model="state.published" />
            </UFormField>
            <UFormField v-if="mode === 'edit'" label="Estado" name="status">
              <USelectMenu v-model="state.status" :items="STATUS_OPTIONS" class="w-full" />
            </UFormField>
          </div>

          <div class="flex items-center justify-end gap-3 pt-2">
            <UButton color="neutral" variant="ghost" :disabled="isSubmitting" @click="formOpen = false">
              Cancelar
            </UButton>
            <UButton type="submit" color="primary" :loading="isSubmitting" icon="i-lucide-save">
              {{ mode === 'create' ? 'Crear aliado' : 'Guardar cambios' }}
            </UButton>
          </div>
        </UForm>
      </template>
    </UModal>

    <!-- Modal confirmar eliminación -->
    <UModal v-model:open="deleteOpen" title="Eliminar aliado">
      <template #body>
        <p class="text-sm text-prohealth-700">
          ¿Seguro que deseas eliminar a
          <span class="font-semibold">{{ target?.name }}</span>?
          Esta acción lo desactiva y lo retira del directorio (soft-delete).
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
