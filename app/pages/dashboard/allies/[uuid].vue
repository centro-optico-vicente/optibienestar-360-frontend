<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { ApiError } from '~/types/auth'
import type { CatalogItem } from '~/types/catalogs'
import type { CatalogRef } from '~/types/members'
import type {
  AllyAgreementDto,
  AllyDto,
  AllyRole,
  AllyServiceDto,
  AllyUserDto,
  AgreementType,
  CreateAllyAgreementRequest,
  CreateAllyServiceRequest,
  UpdateAllyAgreementRequest,
  UpdateAllyServiceRequest,
} from '~/types/allies'
import {
  AGREEMENT_TYPE_OPTIONS,
  ALLY_ROLE_OPTIONS,
  agreementTypeLabel,
  allyRoleLabel,
} from '~/types/allies'

definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'ALLY_VIEW_ALL',
})

useSeoMeta({ title: 'Detalle de aliado — OptiSalud Plus' })

const route = useRoute()
const allyUuid = route.params.uuid as string

const allies = useAllies()
const { can } = usePermissions()
const toast = useToast()

const canUpdate = computed(() => can('ALLY_UPDATE'))
const canDelete = computed(() => can('ALLY_DELETE'))
const canManageAgreements = computed(() => can('ALLY_AGREEMENT_MANAGE'))

// ---- Carga del aliado ----
const ally = ref<AllyDto | null>(null)
const loading = ref(true)
const notFound = ref(false)

async function loadAlly() {
  loading.value = true
  try {
    ally.value = await allies.get(allyUuid)
    specialties.value = ally.value.specialties ?? []
  }
  catch (err) {
    if ((err as ApiError).status === 404) notFound.value = true
    ally.value = null
  }
  finally {
    loading.value = false
  }
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es', { dateStyle: 'medium' })
}

function formatMoney(v?: string | null): string {
  if (!v) return '—'
  return `$${Number(v).toFixed(2)}`
}

// ---- Tabs ----
const tabs = computed(() => [
  { label: 'Servicios', value: 'services', icon: 'i-lucide-briefcase-medical' },
  { label: 'Especialidades', value: 'specialties', icon: 'i-lucide-stethoscope' },
  ...(canManageAgreements.value
    ? [{ label: 'Acuerdos', value: 'agreements', icon: 'i-lucide-file-signature' }]
    : []),
  { label: 'Personal', value: 'users', icon: 'i-lucide-users' },
])
const activeTab = ref('services')

// =========================================================
// Servicios
// =========================================================
const services = ref<AllyServiceDto[]>([])
const servicesLoading = ref(false)

async function loadServices() {
  servicesLoading.value = true
  try {
    services.value = await allies.listServices(allyUuid)
  }
  catch {
    // toast por useApi
  }
  finally {
    servicesLoading.value = false
  }
}

const categoryOptions = ref<{ label: string, value: string }[]>([])

async function loadCategories() {
  try {
    const items = await usePublicCatalog('service-categories').list({ size: '-1' })
    categoryOptions.value = items
      .filter((i: CatalogItem) => i.active !== false)
      .map((i: CatalogItem) => ({ label: i.name, value: i.uuid }))
  }
  catch {
    categoryOptions.value = []
  }
}

const svcFormOpen = ref(false)
const svcMode = ref<'create' | 'edit'>('create')
const svcEditingUuid = ref<string | null>(null)
const svcSubmitting = ref(false)

interface SvcFormState {
  serviceCategoryUuid: string | undefined
  name: string
  description: string
  priceUsd: string
  discountPct: string
  requiresAppointment: boolean
  published: boolean
}

const svcState = reactive<SvcFormState>({
  serviceCategoryUuid: undefined,
  name: '',
  description: '',
  priceUsd: '',
  discountPct: '',
  requiresAppointment: false,
  published: false,
})

const svcSchema = z.object({
  serviceCategoryUuid: z.string({ message: 'Requerido' }).min(1, 'Requerido'),
  name: z.string().min(3, 'Mínimo 3 caracteres'),
  description: z.string().optional(),
  priceUsd: z.string().regex(/^\d*(\.\d{1,2})?$/, 'Monto no válido').optional().or(z.literal('')),
  discountPct: z.string().regex(/^\d*(\.\d{1,2})?$/, 'Porcentaje no válido').optional().or(z.literal('')),
})

function resetSvcForm() {
  svcState.serviceCategoryUuid = undefined
  svcState.name = ''
  svcState.description = ''
  svcState.priceUsd = ''
  svcState.discountPct = ''
  svcState.requiresAppointment = false
  svcState.published = false
}

function openSvcCreate() {
  svcMode.value = 'create'
  svcEditingUuid.value = null
  resetSvcForm()
  svcFormOpen.value = true
}

function openSvcEdit(s: AllyServiceDto) {
  svcMode.value = 'edit'
  svcEditingUuid.value = s.uuid
  resetSvcForm()
  svcState.serviceCategoryUuid = s.serviceCategory?.uuid
  svcState.name = s.name ?? ''
  svcState.description = s.description ?? ''
  svcState.priceUsd = s.priceUsd ?? ''
  svcState.discountPct = s.discountPct ?? ''
  svcState.requiresAppointment = s.requiresAppointment ?? false
  svcState.published = s.published ?? false
  svcFormOpen.value = true
}

async function onSvcSubmit(_event: FormSubmitEvent<Record<string, unknown>>) {
  svcSubmitting.value = true
  try {
    if (svcMode.value === 'create') {
      const body: CreateAllyServiceRequest = {
        serviceCategoryUuid: svcState.serviceCategoryUuid!,
        name: svcState.name,
        description: svcState.description || undefined,
        priceUsd: svcState.priceUsd || undefined,
        discountPct: svcState.discountPct || undefined,
        requiresAppointment: svcState.requiresAppointment,
      }
      await allies.createService(allyUuid, body)
      toast.add({ title: 'Servicio creado (en revisión)', color: 'success', icon: 'i-lucide-check-circle' })
    }
    else if (svcEditingUuid.value) {
      const body: UpdateAllyServiceRequest = {
        serviceCategoryUuid: svcState.serviceCategoryUuid,
        name: svcState.name,
        description: svcState.description || undefined,
        priceUsd: svcState.priceUsd || undefined,
        discountPct: svcState.discountPct || undefined,
        requiresAppointment: svcState.requiresAppointment,
        published: svcState.published,
      }
      await allies.updateService(allyUuid, svcEditingUuid.value, body)
      toast.add({ title: 'Servicio actualizado', color: 'success', icon: 'i-lucide-check-circle' })
    }
    svcFormOpen.value = false
    await loadServices()
  }
  catch {
    // toast por useApi
  }
  finally {
    svcSubmitting.value = false
  }
}

const svcDeleteOpen = ref(false)
const svcDeleting = ref(false)
const svcTarget = ref<AllyServiceDto | null>(null)

function openSvcDelete(s: AllyServiceDto) {
  svcTarget.value = s
  svcDeleteOpen.value = true
}

async function confirmSvcDelete() {
  if (!svcTarget.value) return
  svcDeleting.value = true
  try {
    await allies.removeService(allyUuid, svcTarget.value.uuid)
    toast.add({ title: 'Servicio eliminado', color: 'success', icon: 'i-lucide-check-circle' })
    svcDeleteOpen.value = false
    await loadServices()
  }
  catch {
    // toast por useApi
  }
  finally {
    svcDeleting.value = false
  }
}

function reviewStatusColor(s?: string): 'success' | 'warning' | 'error' | 'neutral' {
  if (s === 'APPROVED') return 'success'
  if (s === 'PROPOSED') return 'warning'
  if (s === 'REJECTED') return 'error'
  return 'neutral'
}

// =========================================================
// Especialidades (ManyToMany)
// =========================================================
const specialties = ref<CatalogRef[]>([])
const specialtiesLoading = ref(false)
const allSpecialtyOptions = ref<{ label: string, value: string }[]>([])
const specialtyToAdd = ref<string | undefined>(undefined)
const specialtyMutating = ref(false)

async function loadSpecialties() {
  specialtiesLoading.value = true
  try {
    specialties.value = await allies.listSpecialties(allyUuid)
  }
  catch {
    // toast por useApi
  }
  finally {
    specialtiesLoading.value = false
  }
}

async function loadAllSpecialties() {
  try {
    const items = await usePublicCatalog('medical-specialties').list({ size: '-1' })
    allSpecialtyOptions.value = items
      .filter((i: CatalogItem) => i.active !== false)
      .map((i: CatalogItem) => ({ label: i.name, value: i.uuid }))
  }
  catch {
    allSpecialtyOptions.value = []
  }
}

/** Solo las especialidades aún no asignadas. */
const availableSpecialtyOptions = computed(() => {
  const assigned = new Set(specialties.value.map(s => s.uuid))
  return allSpecialtyOptions.value.filter(o => !assigned.has(o.value))
})

async function addSpecialty() {
  if (!specialtyToAdd.value) return
  specialtyMutating.value = true
  try {
    await allies.addSpecialty(allyUuid, specialtyToAdd.value)
    specialtyToAdd.value = undefined
    await loadSpecialties()
  }
  catch {
    // toast por useApi
  }
  finally {
    specialtyMutating.value = false
  }
}

async function removeSpecialty(specialtyUuid: string) {
  specialtyMutating.value = true
  try {
    await allies.removeSpecialty(allyUuid, specialtyUuid)
    await loadSpecialties()
  }
  catch {
    // toast por useApi
  }
  finally {
    specialtyMutating.value = false
  }
}

// =========================================================
// Acuerdos (ALLY_AGREEMENT_MANAGE)
// =========================================================
const agreements = ref<AllyAgreementDto[]>([])
const agreementsLoading = ref(false)

async function loadAgreements() {
  if (!canManageAgreements.value) return
  agreementsLoading.value = true
  try {
    agreements.value = await allies.listAgreements(allyUuid)
  }
  catch {
    // toast por useApi
  }
  finally {
    agreementsLoading.value = false
  }
}

const agrFormOpen = ref(false)
const agrMode = ref<'create' | 'edit'>('create')
const agrEditingUuid = ref<string | null>(null)
const agrSubmitting = ref(false)

interface AgrFormState {
  agreementType: AgreementType | undefined
  startDate: string
  endDate: string
  terms: string
  signedPdfUrl: string
  status: string
}

const agrState = reactive<AgrFormState>({
  agreementType: undefined,
  startDate: '',
  endDate: '',
  terms: '',
  signedPdfUrl: '',
  status: 'ACTIVE',
})

const agrSchema = z.object({
  agreementType: z.string({ message: 'Requerido' }).min(1, 'Requerido'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  terms: z.string().optional(),
  signedPdfUrl: z.string().url('URL no válida').optional().or(z.literal('')),
})

function resetAgrForm() {
  agrState.agreementType = undefined
  agrState.startDate = ''
  agrState.endDate = ''
  agrState.terms = ''
  agrState.signedPdfUrl = ''
  agrState.status = 'ACTIVE'
}

function openAgrCreate() {
  agrMode.value = 'create'
  agrEditingUuid.value = null
  resetAgrForm()
  agrFormOpen.value = true
}

function openAgrEdit(a: AllyAgreementDto) {
  agrMode.value = 'edit'
  agrEditingUuid.value = a.uuid
  resetAgrForm()
  agrState.agreementType = a.agreementType as AgreementType
  agrState.startDate = a.startDate ?? ''
  agrState.endDate = a.endDate ?? ''
  agrState.terms = a.terms ?? ''
  agrState.signedPdfUrl = a.signedPdfUrl ?? ''
  agrState.status = a.status || 'ACTIVE'
  agrFormOpen.value = true
}

async function onAgrSubmit(_event: FormSubmitEvent<Record<string, unknown>>) {
  agrSubmitting.value = true
  try {
    if (agrMode.value === 'create') {
      const body: CreateAllyAgreementRequest = {
        agreementType: agrState.agreementType!,
        startDate: agrState.startDate || undefined,
        endDate: agrState.endDate || undefined,
        terms: agrState.terms || undefined,
        signedPdfUrl: agrState.signedPdfUrl || undefined,
      }
      await allies.createAgreement(allyUuid, body)
      toast.add({ title: 'Acuerdo creado', color: 'success', icon: 'i-lucide-check-circle' })
    }
    else if (agrEditingUuid.value) {
      const body: UpdateAllyAgreementRequest = {
        agreementType: agrState.agreementType,
        startDate: agrState.startDate || undefined,
        endDate: agrState.endDate || undefined,
        terms: agrState.terms || undefined,
        signedPdfUrl: agrState.signedPdfUrl || undefined,
        status: agrState.status,
      }
      await allies.updateAgreement(allyUuid, agrEditingUuid.value, body)
      toast.add({ title: 'Acuerdo actualizado', color: 'success', icon: 'i-lucide-check-circle' })
    }
    agrFormOpen.value = false
    await loadAgreements()
  }
  catch {
    // toast por useApi
  }
  finally {
    agrSubmitting.value = false
  }
}

const agrDeleteOpen = ref(false)
const agrDeleting = ref(false)
const agrTarget = ref<AllyAgreementDto | null>(null)

function openAgrDelete(a: AllyAgreementDto) {
  agrTarget.value = a
  agrDeleteOpen.value = true
}

async function confirmAgrDelete() {
  if (!agrTarget.value) return
  agrDeleting.value = true
  try {
    await allies.removeAgreement(allyUuid, agrTarget.value.uuid)
    toast.add({ title: 'Acuerdo eliminado', color: 'success', icon: 'i-lucide-check-circle' })
    agrDeleteOpen.value = false
    await loadAgreements()
  }
  catch {
    // toast por useApi
  }
  finally {
    agrDeleting.value = false
  }
}

// =========================================================
// Personal (staff del aliado)
// =========================================================
const staff = ref<AllyUserDto[]>([])
const staffLoading = ref(false)

async function loadStaff() {
  staffLoading.value = true
  try {
    staff.value = await allies.listUsers(allyUuid)
  }
  catch {
    // toast por useApi
  }
  finally {
    staffLoading.value = false
  }
}

// Usuarios del sistema para el selector de asignación (requiere USER_VIEW_ALL;
// si no hay permiso, falla en silencio y el select queda vacío).
const userOptions = ref<{ label: string, value: string }[]>([])

async function loadUserOptions() {
  if (!can('USER_VIEW_ALL')) return
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

const staffFormOpen = ref(false)
const staffMode = ref<'create' | 'edit'>('create')
const staffEditingUuid = ref<string | null>(null)
const staffSubmitting = ref(false)

interface StaffFormState {
  userUuid: string | undefined
  allyRole: AllyRole | undefined
  primary: boolean
  joinedAt: string
  status: string
}

const staffState = reactive<StaffFormState>({
  userUuid: undefined,
  allyRole: undefined,
  primary: false,
  joinedAt: '',
  status: 'ACTIVE',
})

const staffCreateSchema = z.object({
  userUuid: z.string({ message: 'Requerido' }).min(1, 'Requerido'),
  allyRole: z.string({ message: 'Requerido' }).min(1, 'Requerido'),
})

const staffEditSchema = z.object({
  allyRole: z.string({ message: 'Requerido' }).min(1, 'Requerido'),
})

const staffSchema = computed(() => (staffMode.value === 'create' ? staffCreateSchema : staffEditSchema))

function resetStaffForm() {
  staffState.userUuid = undefined
  staffState.allyRole = undefined
  staffState.primary = false
  staffState.joinedAt = ''
  staffState.status = 'ACTIVE'
}

function openStaffCreate() {
  staffMode.value = 'create'
  staffEditingUuid.value = null
  resetStaffForm()
  staffFormOpen.value = true
}

function openStaffEdit(s: AllyUserDto) {
  staffMode.value = 'edit'
  staffEditingUuid.value = s.uuid
  resetStaffForm()
  staffState.userUuid = s.user?.uuid
  staffState.allyRole = s.allyRole as AllyRole
  staffState.primary = s.primary ?? false
  staffState.joinedAt = s.joinedAt ?? ''
  staffState.status = s.status || 'ACTIVE'
  staffFormOpen.value = true
}

// `primary` solo aplica a OWNER: al cambiar de rol se desactiva.
watch(() => staffState.allyRole, (role) => {
  if (role !== 'OWNER') staffState.primary = false
})

async function onStaffSubmit(_event: FormSubmitEvent<Record<string, unknown>>) {
  staffSubmitting.value = true
  try {
    if (staffMode.value === 'create') {
      await allies.assignUser(allyUuid, {
        userUuid: staffState.userUuid!,
        allyRole: staffState.allyRole!,
        primary: staffState.primary,
        joinedAt: staffState.joinedAt || undefined,
      })
      toast.add({ title: 'Usuario asignado', color: 'success', icon: 'i-lucide-check-circle' })
    }
    else if (staffEditingUuid.value) {
      await allies.updateUser(allyUuid, staffEditingUuid.value, {
        allyRole: staffState.allyRole,
        primary: staffState.primary,
        joinedAt: staffState.joinedAt || undefined,
        status: staffState.status,
      })
      toast.add({ title: 'Membresía actualizada', color: 'success', icon: 'i-lucide-check-circle' })
    }
    staffFormOpen.value = false
    await loadStaff()
  }
  catch {
    // toast por useApi (422 si ya hay OWNER primary, etc.)
  }
  finally {
    staffSubmitting.value = false
  }
}

const staffDeleteOpen = ref(false)
const staffDeleting = ref(false)
const staffTarget = ref<AllyUserDto | null>(null)

function openStaffDelete(s: AllyUserDto) {
  staffTarget.value = s
  staffDeleteOpen.value = true
}

async function confirmStaffDelete() {
  if (!staffTarget.value) return
  staffDeleting.value = true
  try {
    await allies.removeUser(allyUuid, staffTarget.value.uuid)
    toast.add({ title: 'Usuario desvinculado', color: 'success', icon: 'i-lucide-check-circle' })
    staffDeleteOpen.value = false
    await loadStaff()
  }
  catch {
    // toast por useApi
  }
  finally {
    staffDeleting.value = false
  }
}

// ---- Init ----
onMounted(async () => {
  await loadAlly()
  await Promise.all([
    loadServices(),
    loadSpecialties(),
    loadAgreements(),
    loadStaff(),
    loadCategories(),
    loadAllSpecialties(),
    loadUserOptions(),
  ])
})
</script>

<template>
  <div class="space-y-5">
    <!-- Volver -->
    <UButton
      color="neutral"
      variant="ghost"
      icon="i-lucide-arrow-left"
      to="/dashboard/allies"
      size="sm"
    >
      Aliados
    </UButton>

    <!-- Cargando -->
    <div v-if="loading" class="bg-white rounded-2xl border border-prohealth-100 p-6 space-y-3">
      <USkeleton class="h-7 w-64 rounded" />
      <USkeleton class="h-4 w-40 rounded" />
      <USkeleton class="h-4 w-full max-w-lg rounded" />
    </div>

    <!-- No encontrado -->
    <div v-else-if="notFound || !ally" class="bg-white rounded-2xl border border-prohealth-100 p-12 text-center">
      <UIcon name="i-lucide-search-x" class="w-10 h-10 mx-auto mb-3 text-prohealth-300" />
      <p class="text-prohealth-700 font-semibold">Aliado no encontrado</p>
      <p class="text-sm text-prohealth-500 mt-1">El registro no existe o fue eliminado.</p>
    </div>

    <template v-else>
      <!-- Datos del aliado -->
      <div class="bg-white rounded-2xl border border-prohealth-100 p-6">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div class="flex items-center gap-3 flex-wrap">
              <h1 class="text-2xl font-extrabold text-prohealth-900">{{ ally.name }}</h1>
              <UBadge :color="ally.status === 'ACTIVE' ? 'success' : 'warning'" variant="subtle">
                {{ ally.status || '—' }}
              </UBadge>
              <UBadge :color="ally.published ? 'success' : 'neutral'" variant="subtle">
                {{ ally.published ? 'Publicado' : 'Borrador' }}
              </UBadge>
            </div>
            <p class="text-sm text-prohealth-500 mt-1">
              {{ ally.allyType?.name || 'Aliado' }}
              <template v-if="ally.taxDocumentNumber"> · {{ ally.taxDocumentType }}-{{ ally.taxDocumentNumber }}</template>
              · Aliado desde {{ formatDate(ally.joinedAt) }}
            </p>
          </div>
        </div>

        <dl class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 mt-6 text-sm">
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">Email</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ ally.email || '—' }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">Teléfono</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ ally.phone || '—' }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">Sitio web</dt>
            <dd class="text-prohealth-800 mt-0.5">
              <a v-if="ally.website" :href="ally.website" target="_blank" rel="noopener" class="text-cyan-700 hover:underline">
                {{ ally.website }}
              </a>
              <span v-else>—</span>
            </dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">Ciudad</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ ally.city?.name || '—' }}</dd>
          </div>
          <div class="sm:col-span-2">
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">Dirección</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ ally.address || '—' }}</dd>
          </div>
          <div v-if="ally.description" class="sm:col-span-3">
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">Descripción</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ ally.description }}</dd>
          </div>
        </dl>
      </div>

      <!-- Tabs de sub-recursos -->
      <UTabs v-model="activeTab" :items="tabs" :content="false" />

      <!-- ============ Servicios ============ -->
      <div v-show="activeTab === 'services'" class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden">
        <div class="flex items-center justify-between px-6 py-4 border-b border-prohealth-100">
          <div>
            <h2 class="font-bold text-prohealth-900">Servicios</h2>
            <p class="text-xs text-prohealth-500 mt-0.5">Los servicios nuevos quedan en revisión (PROPOSED).</p>
          </div>
          <UTooltip :text="canUpdate ? 'Añadir servicio' : 'No tienes permiso'">
            <UButton
              color="primary"
              variant="soft"
              icon="i-lucide-plus"
              size="sm"
              :disabled="!canUpdate"
              @click="openSvcCreate"
            >
              Añadir
            </UButton>
          </UTooltip>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
                <th class="px-6 py-3 font-semibold">Servicio</th>
                <th class="px-6 py-3 font-semibold">Categoría</th>
                <th class="px-6 py-3 font-semibold">Precio</th>
                <th class="px-6 py-3 font-semibold">Desc.</th>
                <th class="px-6 py-3 font-semibold">Cita</th>
                <th class="px-6 py-3 font-semibold">Revisión</th>
                <th class="px-6 py-3 font-semibold">Publicado</th>
                <th class="px-6 py-3 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-prohealth-100">
              <TableSkeleton v-if="servicesLoading" :rows="3" :cols="8" />
              <tr v-else-if="services.length === 0">
                <td colspan="8" class="px-6 py-10 text-center text-prohealth-500">
                  <UIcon name="i-lucide-briefcase-medical" class="w-7 h-7 mx-auto mb-2 text-prohealth-300" />
                  Sin servicios registrados
                </td>
              </tr>
              <tr v-for="s in services" v-else :key="s.uuid" class="hover:bg-prohealth-50/50">
                <td class="px-6 py-3">
                  <div class="font-semibold text-prohealth-900">{{ s.name }}</div>
                  <div v-if="s.description" class="text-xs text-prohealth-500 line-clamp-1">{{ s.description }}</div>
                </td>
                <td class="px-6 py-3 text-prohealth-700">{{ s.serviceCategory?.name || '—' }}</td>
                <td class="px-6 py-3 text-prohealth-700">{{ formatMoney(s.priceUsd) }}</td>
                <td class="px-6 py-3 text-prohealth-700">{{ s.discountPct ? `${s.discountPct}%` : '—' }}</td>
                <td class="px-6 py-3">
                  <UIcon
                    :name="s.requiresAppointment ? 'i-lucide-calendar-check' : 'i-lucide-minus'"
                    class="w-4 h-4"
                    :class="s.requiresAppointment ? 'text-cyan-600' : 'text-prohealth-300'"
                  />
                </td>
                <td class="px-6 py-3">
                  <UBadge :color="reviewStatusColor(s.reviewStatus)" variant="subtle" size="sm">
                    {{ s.reviewStatus || '—' }}
                  </UBadge>
                </td>
                <td class="px-6 py-3">
                  <UBadge :color="s.published ? 'success' : 'neutral'" variant="subtle" size="sm">
                    {{ s.published ? 'Sí' : 'No' }}
                  </UBadge>
                </td>
                <td class="px-6 py-3">
                  <div class="flex items-center justify-end gap-1">
                    <UTooltip :text="canUpdate ? 'Editar' : 'No tienes permiso'">
                      <UButton
                        color="neutral"
                        variant="ghost"
                        icon="i-lucide-pencil"
                        size="sm"
                        :disabled="!canUpdate"
                        @click="openSvcEdit(s)"
                      />
                    </UTooltip>
                    <UTooltip :text="canDelete ? 'Eliminar' : 'No tienes permiso'">
                      <UButton
                        color="error"
                        variant="ghost"
                        icon="i-lucide-trash-2"
                        size="sm"
                        :disabled="!canDelete"
                        @click="openSvcDelete(s)"
                      />
                    </UTooltip>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ============ Especialidades ============ -->
      <div v-show="activeTab === 'specialties'" class="bg-white rounded-2xl border border-prohealth-100">
        <div class="flex items-center justify-between px-6 py-4 border-b border-prohealth-100">
          <div>
            <h2 class="font-bold text-prohealth-900">Especialidades</h2>
            <p class="text-xs text-prohealth-500 mt-0.5">Especialidades médicas que ofrece el aliado.</p>
          </div>
        </div>

        <div class="p-6 space-y-5">
          <!-- Añadir -->
          <div v-if="canUpdate" class="flex items-end gap-3 max-w-md">
            <UFormField label="Añadir especialidad" class="flex-1">
              <USelectMenu
                v-model="specialtyToAdd"
                :items="availableSpecialtyOptions"
                label-key="label"
                value-key="value"
                placeholder="Selecciona"
                class="w-full"
              />
            </UFormField>
            <UButton
              color="primary"
              icon="i-lucide-plus"
              :disabled="!specialtyToAdd"
              :loading="specialtyMutating"
              @click="addSpecialty"
            >
              Añadir
            </UButton>
          </div>

          <!-- Lista -->
          <div v-if="specialtiesLoading" class="flex gap-2">
            <USkeleton v-for="i in 3" :key="i" class="h-7 w-28 rounded-full" />
          </div>
          <p v-else-if="specialties.length === 0" class="text-sm text-prohealth-500">
            Sin especialidades asignadas.
          </p>
          <div v-else class="flex flex-wrap gap-2">
            <UBadge
              v-for="s in specialties"
              :key="s.uuid"
              color="primary"
              variant="subtle"
              size="lg"
              class="gap-1.5"
            >
              {{ s.name }}
              <UButton
                v-if="canUpdate"
                color="primary"
                variant="link"
                icon="i-lucide-x"
                size="xs"
                :padded="false"
                :disabled="specialtyMutating"
                @click="removeSpecialty(s.uuid)"
              />
            </UBadge>
          </div>
        </div>
      </div>

      <!-- ============ Acuerdos ============ -->
      <div
        v-if="canManageAgreements"
        v-show="activeTab === 'agreements'"
        class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden"
      >
        <div class="flex items-center justify-between px-6 py-4 border-b border-prohealth-100">
          <div>
            <h2 class="font-bold text-prohealth-900">Acuerdos</h2>
            <p class="text-xs text-prohealth-500 mt-0.5">Contratos y convenios con el aliado.</p>
          </div>
          <UButton
            color="primary"
            variant="soft"
            icon="i-lucide-plus"
            size="sm"
            @click="openAgrCreate"
          >
            Añadir
          </UButton>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
                <th class="px-6 py-3 font-semibold">Tipo</th>
                <th class="px-6 py-3 font-semibold">Inicio</th>
                <th class="px-6 py-3 font-semibold">Fin</th>
                <th class="px-6 py-3 font-semibold">PDF</th>
                <th class="px-6 py-3 font-semibold">Estado</th>
                <th class="px-6 py-3 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-prohealth-100">
              <TableSkeleton v-if="agreementsLoading" :rows="3" :cols="6" />
              <tr v-else-if="agreements.length === 0">
                <td colspan="6" class="px-6 py-10 text-center text-prohealth-500">
                  <UIcon name="i-lucide-file-signature" class="w-7 h-7 mx-auto mb-2 text-prohealth-300" />
                  Sin acuerdos registrados
                </td>
              </tr>
              <tr v-for="a in agreements" v-else :key="a.uuid" class="hover:bg-prohealth-50/50">
                <td class="px-6 py-3 font-semibold text-prohealth-900">{{ agreementTypeLabel(a.agreementType) }}</td>
                <td class="px-6 py-3 text-prohealth-600">{{ formatDate(a.startDate) }}</td>
                <td class="px-6 py-3 text-prohealth-600">{{ formatDate(a.endDate) }}</td>
                <td class="px-6 py-3">
                  <a
                    v-if="a.signedPdfUrl"
                    :href="a.signedPdfUrl"
                    target="_blank"
                    rel="noopener"
                    class="text-cyan-700 hover:underline inline-flex items-center gap-1"
                  >
                    <UIcon name="i-lucide-file-text" class="w-4 h-4" /> Ver
                  </a>
                  <span v-else class="text-prohealth-400">—</span>
                </td>
                <td class="px-6 py-3">
                  <UBadge
                    :color="a.status === 'ACTIVE' ? 'success' : 'warning'"
                    variant="subtle"
                    size="sm"
                  >
                    {{ a.status || '—' }}
                  </UBadge>
                </td>
                <td class="px-6 py-3">
                  <div class="flex items-center justify-end gap-1">
                    <UButton
                      color="neutral"
                      variant="ghost"
                      icon="i-lucide-pencil"
                      size="sm"
                      @click="openAgrEdit(a)"
                    />
                    <UButton
                      color="error"
                      variant="ghost"
                      icon="i-lucide-trash-2"
                      size="sm"
                      @click="openAgrDelete(a)"
                    />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ============ Personal ============ -->
      <div v-show="activeTab === 'users'" class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden">
        <div class="flex items-center justify-between px-6 py-4 border-b border-prohealth-100">
          <div>
            <h2 class="font-bold text-prohealth-900">Personal</h2>
            <p class="text-xs text-prohealth-500 mt-0.5">Usuarios con acceso al panel del aliado.</p>
          </div>
          <UTooltip :text="canUpdate ? 'Asignar usuario' : 'No tienes permiso'">
            <UButton
              color="primary"
              variant="soft"
              icon="i-lucide-user-plus"
              size="sm"
              :disabled="!canUpdate"
              @click="openStaffCreate"
            >
              Asignar
            </UButton>
          </UTooltip>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
                <th class="px-6 py-3 font-semibold">Usuario</th>
                <th class="px-6 py-3 font-semibold">Rol en el aliado</th>
                <th class="px-6 py-3 font-semibold">Principal</th>
                <th class="px-6 py-3 font-semibold">Desde</th>
                <th class="px-6 py-3 font-semibold">Estado</th>
                <th class="px-6 py-3 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-prohealth-100">
              <TableSkeleton v-if="staffLoading" :rows="3" :cols="6" />
              <tr v-else-if="staff.length === 0">
                <td colspan="6" class="px-6 py-10 text-center text-prohealth-500">
                  <UIcon name="i-lucide-users" class="w-7 h-7 mx-auto mb-2 text-prohealth-300" />
                  Sin personal asignado
                </td>
              </tr>
              <tr v-for="s in staff" v-else :key="s.uuid" class="hover:bg-prohealth-50/50">
                <td class="px-6 py-3">
                  <div class="font-semibold text-prohealth-900">{{ s.user?.fullName || '—' }}</div>
                  <div class="text-xs text-prohealth-500">{{ s.user?.email || '—' }}</div>
                </td>
                <td class="px-6 py-3">
                  <UBadge color="primary" variant="subtle" size="sm">
                    {{ allyRoleLabel(s.allyRole) }}
                  </UBadge>
                </td>
                <td class="px-6 py-3">
                  <UIcon
                    :name="s.primary ? 'i-lucide-star' : 'i-lucide-minus'"
                    class="w-4 h-4"
                    :class="s.primary ? 'text-amber-500' : 'text-prohealth-300'"
                  />
                </td>
                <td class="px-6 py-3 text-prohealth-600">{{ formatDate(s.joinedAt) }}</td>
                <td class="px-6 py-3">
                  <UBadge
                    :color="s.status === 'ACTIVE' || !s.status ? 'success' : 'warning'"
                    variant="subtle"
                    size="sm"
                  >
                    {{ s.status || 'ACTIVE' }}
                  </UBadge>
                </td>
                <td class="px-6 py-3">
                  <div class="flex items-center justify-end gap-1">
                    <UTooltip :text="canUpdate ? 'Editar' : 'No tienes permiso'">
                      <UButton
                        color="neutral"
                        variant="ghost"
                        icon="i-lucide-pencil"
                        size="sm"
                        :disabled="!canUpdate"
                        @click="openStaffEdit(s)"
                      />
                    </UTooltip>
                    <UTooltip :text="canUpdate ? 'Desvincular' : 'No tienes permiso'">
                      <UButton
                        color="error"
                        variant="ghost"
                        icon="i-lucide-user-minus"
                        size="sm"
                        :disabled="!canUpdate"
                        @click="openStaffDelete(s)"
                      />
                    </UTooltip>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <!-- Modal servicio -->
    <UModal
      v-model:open="svcFormOpen"
      :title="svcMode === 'create' ? 'Añadir servicio' : 'Editar servicio'"
      :description="svcMode === 'create' ? 'El servicio quedará en revisión (PROPOSED).' : 'El estado de revisión no se cambia por esta vía.'"
    >
      <template #body>
        <UForm
          :schema="svcSchema"
          :state="svcState"
          class="space-y-4"
          @submit="onSvcSubmit"
        >
          <UFormField label="Categoría" name="serviceCategoryUuid" required>
            <USelectMenu
              v-model="svcState.serviceCategoryUuid"
              :items="categoryOptions"
              label-key="label"
              value-key="value"
              placeholder="Selecciona"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Nombre" name="name" required>
            <UInput v-model="svcState.name" class="w-full" />
          </UFormField>

          <UFormField label="Descripción" name="description">
            <UTextarea v-model="svcState.description" :rows="2" class="w-full" />
          </UFormField>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField label="Precio (USD)" name="priceUsd">
              <UInput v-model="svcState.priceUsd" placeholder="100.00" class="w-full" />
            </UFormField>
            <UFormField label="Descuento (%)" name="discountPct">
              <UInput v-model="svcState.discountPct" placeholder="10.00" class="w-full" />
            </UFormField>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField label="Requiere cita" name="requiresAppointment">
              <USwitch v-model="svcState.requiresAppointment" />
            </UFormField>
            <UFormField v-if="svcMode === 'edit'" label="Publicado" name="published">
              <USwitch v-model="svcState.published" />
            </UFormField>
          </div>

          <div class="flex items-center justify-end gap-3 pt-2">
            <UButton color="neutral" variant="ghost" :disabled="svcSubmitting" @click="svcFormOpen = false">
              Cancelar
            </UButton>
            <UButton type="submit" color="primary" :loading="svcSubmitting" icon="i-lucide-save">
              {{ svcMode === 'create' ? 'Añadir' : 'Guardar cambios' }}
            </UButton>
          </div>
        </UForm>
      </template>
    </UModal>

    <!-- Modal eliminar servicio -->
    <UModal v-model:open="svcDeleteOpen" title="Eliminar servicio">
      <template #body>
        <p class="text-sm text-prohealth-700">
          ¿Seguro que deseas eliminar el servicio
          <span class="font-semibold">{{ svcTarget?.name }}</span>? (soft-delete)
        </p>
        <div class="flex items-center justify-end gap-3 pt-5">
          <UButton color="neutral" variant="ghost" :disabled="svcDeleting" @click="svcDeleteOpen = false">
            Cancelar
          </UButton>
          <UButton color="error" :loading="svcDeleting" icon="i-lucide-trash-2" @click="confirmSvcDelete">
            Eliminar
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Modal acuerdo -->
    <UModal
      v-model:open="agrFormOpen"
      :title="agrMode === 'create' ? 'Añadir acuerdo' : 'Editar acuerdo'"
      description="Contrato o convenio firmado con el aliado."
    >
      <template #body>
        <UForm
          :schema="agrSchema"
          :state="agrState"
          class="space-y-4"
          @submit="onAgrSubmit"
        >
          <UFormField label="Tipo de acuerdo" name="agreementType" required>
            <USelectMenu
              v-model="agrState.agreementType"
              :items="AGREEMENT_TYPE_OPTIONS"
              label-key="label"
              value-key="value"
              placeholder="Selecciona"
              class="w-full"
            />
          </UFormField>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField label="Fecha de inicio" name="startDate">
              <UInput v-model="agrState.startDate" type="date" class="w-full" />
            </UFormField>
            <UFormField label="Fecha de fin" name="endDate">
              <UInput v-model="agrState.endDate" type="date" class="w-full" />
            </UFormField>
          </div>

          <UFormField label="Términos" name="terms">
            <UTextarea v-model="agrState.terms" :rows="3" class="w-full" />
          </UFormField>

          <UFormField label="URL del PDF firmado" name="signedPdfUrl">
            <UInput v-model="agrState.signedPdfUrl" placeholder="https://…" class="w-full" />
          </UFormField>

          <UFormField v-if="agrMode === 'edit'" label="Estado" name="status">
            <USelectMenu v-model="agrState.status" :items="['ACTIVE', 'EXPIRED', 'TERMINATED']" class="w-full" />
          </UFormField>

          <div class="flex items-center justify-end gap-3 pt-2">
            <UButton color="neutral" variant="ghost" :disabled="agrSubmitting" @click="agrFormOpen = false">
              Cancelar
            </UButton>
            <UButton type="submit" color="primary" :loading="agrSubmitting" icon="i-lucide-save">
              {{ agrMode === 'create' ? 'Añadir' : 'Guardar cambios' }}
            </UButton>
          </div>
        </UForm>
      </template>
    </UModal>

    <!-- Modal eliminar acuerdo -->
    <UModal v-model:open="agrDeleteOpen" title="Eliminar acuerdo">
      <template #body>
        <p class="text-sm text-prohealth-700">
          ¿Seguro que deseas eliminar el acuerdo
          <span class="font-semibold">{{ agreementTypeLabel(agrTarget?.agreementType) }}</span>? (soft-delete)
        </p>
        <div class="flex items-center justify-end gap-3 pt-5">
          <UButton color="neutral" variant="ghost" :disabled="agrDeleting" @click="agrDeleteOpen = false">
            Cancelar
          </UButton>
          <UButton color="error" :loading="agrDeleting" icon="i-lucide-trash-2" @click="confirmAgrDelete">
            Eliminar
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Modal asignar/editar personal -->
    <UModal
      v-model:open="staffFormOpen"
      :title="staffMode === 'create' ? 'Asignar usuario' : 'Editar membresía'"
      description="Solo puede haber un OWNER principal activo por aliado."
    >
      <template #body>
        <UForm
          :schema="staffSchema"
          :state="staffState"
          class="space-y-4"
          @submit="onStaffSubmit"
        >
          <UFormField v-if="staffMode === 'create'" label="Usuario" name="userUuid" required>
            <USelectMenu
              v-model="staffState.userUuid"
              :items="userOptions"
              label-key="label"
              value-key="value"
              placeholder="Selecciona un usuario"
              class="w-full"
            />
          </UFormField>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField label="Rol en el aliado" name="allyRole" required>
              <USelectMenu
                v-model="staffState.allyRole"
                :items="ALLY_ROLE_OPTIONS"
                label-key="label"
                value-key="value"
                placeholder="Selecciona"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Fecha de ingreso" name="joinedAt">
              <UInput v-model="staffState.joinedAt" type="date" class="w-full" />
            </UFormField>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField label="Principal (solo OWNER)" name="primary">
              <USwitch v-model="staffState.primary" :disabled="staffState.allyRole !== 'OWNER'" />
            </UFormField>
            <UFormField v-if="staffMode === 'edit'" label="Estado" name="status">
              <USelectMenu v-model="staffState.status" :items="['ACTIVE', 'INACTIVE']" class="w-full" />
            </UFormField>
          </div>

          <div class="flex items-center justify-end gap-3 pt-2">
            <UButton color="neutral" variant="ghost" :disabled="staffSubmitting" @click="staffFormOpen = false">
              Cancelar
            </UButton>
            <UButton type="submit" color="primary" :loading="staffSubmitting" icon="i-lucide-save">
              {{ staffMode === 'create' ? 'Asignar' : 'Guardar cambios' }}
            </UButton>
          </div>
        </UForm>
      </template>
    </UModal>

    <!-- Modal desvincular personal -->
    <UModal v-model:open="staffDeleteOpen" title="Desvincular usuario">
      <template #body>
        <p class="text-sm text-prohealth-700">
          ¿Seguro que deseas desvincular a
          <span class="font-semibold">{{ staffTarget?.user?.fullName || staffTarget?.user?.email }}</span>
          de este aliado? (soft-delete)
        </p>
        <div class="flex items-center justify-end gap-3 pt-5">
          <UButton color="neutral" variant="ghost" :disabled="staffDeleting" @click="staffDeleteOpen = false">
            Cancelar
          </UButton>
          <UButton color="error" :loading="staffDeleting" icon="i-lucide-user-minus" @click="confirmStaffDelete">
            Desvincular
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
