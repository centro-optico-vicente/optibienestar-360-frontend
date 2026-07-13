<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { ApiError } from '~/types/auth'
import type {
  BeneficiaryDto,
  BeneficiaryRelationship,
  CreateBeneficiaryRequest,
  MedicalRecordDto,
  MemberDto,
  UpdateBeneficiaryRequest,
} from '~/types/members'
import { RELATIONSHIP_OPTIONS, relationshipLabel } from '~/types/members'

definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'MEMBER_VIEW_ALL',
})

useSeoMeta({ title: 'Detalle de afiliado — OptiBienestar 360' })

const route = useRoute()
const memberUuid = route.params.uuid as string

const members = useMembers()
const { can } = usePermissions()
const toast = useToast()

const canUpdate = computed(() => can('MEMBER_UPDATE'))
const canDelete = computed(() => can('MEMBER_DELETE'))
const canViewMedical = computed(() => can('MEDICAL_RECORD_VIEW'))
const canEditMedical = computed(() => can('MEDICAL_RECORD_UPDATE'))

// ---- Carga del miembro ----
const member = ref<MemberDto | null>(null)
const loading = ref(true)
const notFound = ref(false)

async function loadMember() {
  loading.value = true
  try {
    member.value = await members.get(memberUuid)
    beneficiaries.value = member.value.beneficiaries ?? []
  }
  catch (err) {
    if ((err as ApiError).status === 404) notFound.value = true
    member.value = null
  }
  finally {
    loading.value = false
  }
}

const displayName = computed(() => {
  const m = member.value
  if (!m) return ''
  return m.fullName || [m.firstName, m.middleName, m.lastName, m.secondLastName].filter(Boolean).join(' ')
})

function formatDate(iso?: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es', { dateStyle: 'medium' })
}

// ---- Beneficiarios ----
const beneficiaries = ref<BeneficiaryDto[]>([])
const beneficiariesLoading = ref(false)

async function loadBeneficiaries() {
  beneficiariesLoading.value = true
  try {
    beneficiaries.value = await members.listBeneficiaries(memberUuid)
  }
  catch {
    // useApi ya notificó el error
  }
  finally {
    beneficiariesLoading.value = false
  }
}

const benFormOpen = ref(false)
const benMode = ref<'create' | 'edit'>('create')
const benEditingUuid = ref<string | null>(null)
const benSubmitting = ref(false)

const { options: documentTypeOptions, load: loadDocumentTypes } = useDocumentTypes()

interface BenFormState {
  firstName: string
  middleName: string
  lastName: string
  secondLastName: string
  documentType: string | undefined
  documentNumber: string
  birthDate: string
  relationship: BeneficiaryRelationship | undefined
  extraInscriptionPaid: boolean
  status: string
}

const benState = reactive<BenFormState>({
  firstName: '',
  middleName: '',
  lastName: '',
  secondLastName: '',
  documentType: undefined,
  documentNumber: '',
  birthDate: '',
  relationship: undefined,
  extraInscriptionPaid: false,
  status: 'ACTIVE',
})

const benSchema = z.object({
  firstName: z.string().min(2, 'Mínimo 2 caracteres'),
  middleName: z.string().optional(),
  lastName: z.string().min(2, 'Mínimo 2 caracteres'),
  secondLastName: z.string().optional(),
  documentType: z.string().optional(),
  documentNumber: z.string().regex(/^\d*$/, 'Solo números').optional(),
  birthDate: z.string().optional(),
  relationship: z.string({ message: 'Requerido' }).min(1, 'Requerido'),
})

function resetBenForm() {
  benState.firstName = ''
  benState.middleName = ''
  benState.lastName = ''
  benState.secondLastName = ''
  benState.documentType = undefined
  benState.documentNumber = ''
  benState.birthDate = ''
  benState.relationship = undefined
  benState.extraInscriptionPaid = false
  benState.status = 'ACTIVE'
}

function openBenCreate() {
  benMode.value = 'create'
  benEditingUuid.value = null
  resetBenForm()
  benFormOpen.value = true
}

function openBenEdit(b: BeneficiaryDto) {
  benMode.value = 'edit'
  benEditingUuid.value = b.uuid
  resetBenForm()
  benState.firstName = b.firstName ?? ''
  benState.middleName = b.middleName ?? ''
  benState.lastName = b.lastName ?? ''
  benState.secondLastName = b.secondLastName ?? ''
  benState.documentType = b.documentType || undefined
  benState.documentNumber = b.documentNumber ?? ''
  benState.birthDate = b.birthDate ?? ''
  benState.relationship = b.relationship
  benState.extraInscriptionPaid = b.extraInscriptionPaid ?? false
  benState.status = b.status || 'ACTIVE'
  benFormOpen.value = true
}

async function onBenSubmit(_event: FormSubmitEvent<Record<string, unknown>>) {
  benSubmitting.value = true
  try {
    if (benMode.value === 'create') {
      const body: CreateBeneficiaryRequest = {
        firstName: benState.firstName,
        middleName: benState.middleName || undefined,
        lastName: benState.lastName,
        secondLastName: benState.secondLastName || undefined,
        documentType: benState.documentType || undefined,
        documentNumber: benState.documentNumber || undefined,
        birthDate: benState.birthDate || undefined,
        relationship: benState.relationship as CreateBeneficiaryRequest['relationship'],
        extraInscriptionPaid: benState.extraInscriptionPaid,
      }
      await members.createBeneficiary(memberUuid, body)
      toast.add({ title: 'Beneficiario añadido', color: 'success', icon: 'i-lucide-check-circle' })
    }
    else if (benEditingUuid.value) {
      const body: UpdateBeneficiaryRequest = {
        firstName: benState.firstName,
        middleName: benState.middleName || undefined,
        lastName: benState.lastName,
        secondLastName: benState.secondLastName || undefined,
        birthDate: benState.birthDate || undefined,
        relationship: benState.relationship as UpdateBeneficiaryRequest['relationship'],
        extraInscriptionPaid: benState.extraInscriptionPaid,
        status: benState.status,
      }
      await members.updateBeneficiary(memberUuid, benEditingUuid.value, body)
      toast.add({ title: 'Beneficiario actualizado', color: 'success', icon: 'i-lucide-check-circle' })
    }
    benFormOpen.value = false
    await loadBeneficiaries()
  }
  catch {
    // toast por useApi
  }
  finally {
    benSubmitting.value = false
  }
}

const benDeleteOpen = ref(false)
const benDeleting = ref(false)
const benTarget = ref<BeneficiaryDto | null>(null)

function openBenDelete(b: BeneficiaryDto) {
  benTarget.value = b
  benDeleteOpen.value = true
}

async function confirmBenDelete() {
  if (!benTarget.value) return
  benDeleting.value = true
  try {
    await members.removeBeneficiary(memberUuid, benTarget.value.uuid)
    toast.add({ title: 'Beneficiario eliminado', color: 'success', icon: 'i-lucide-check-circle' })
    benDeleteOpen.value = false
    await loadBeneficiaries()
  }
  catch {
    // toast por useApi
  }
  finally {
    benDeleting.value = false
  }
}

function benDisplayName(b: BeneficiaryDto): string {
  return b.fullName || [b.firstName, b.middleName, b.lastName, b.secondLastName].filter(Boolean).join(' ')
}

// ---- Histórico médico ----
const medicalRecord = ref<MedicalRecordDto | null>(null)
const medicalLoading = ref(false)
const medicalExists = ref(false)

async function loadMedicalRecord() {
  if (!canViewMedical.value) return
  medicalLoading.value = true
  try {
    medicalRecord.value = await members.getMedicalRecord(memberUuid)
    medicalExists.value = true
  }
  catch (err) {
    // 404 = aún no tiene histórico; no es un error.
    if ((err as ApiError).status !== 404) {
      // useApi ya notificó otros errores
    }
    medicalRecord.value = null
    medicalExists.value = false
  }
  finally {
    medicalLoading.value = false
  }
}

const medFormOpen = ref(false)
const medSubmitting = ref(false)

interface MedFormState {
  bloodType: string | undefined
  allergies: string
  chronicConditions: string
  currentMedications: string
  emergencyContactName: string
  emergencyContactPhone: string
  emergencyContactRelationship: BeneficiaryRelationship | undefined
  notes: string
}

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

const medState = reactive<MedFormState>({
  bloodType: undefined,
  allergies: '',
  chronicConditions: '',
  currentMedications: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  emergencyContactRelationship: undefined,
  notes: '',
})

function openMedicalForm() {
  const r = medicalRecord.value
  medState.bloodType = r?.bloodType || undefined
  medState.allergies = r?.allergies ?? ''
  medState.chronicConditions = r?.chronicConditions ?? ''
  medState.currentMedications = r?.currentMedications ?? ''
  medState.emergencyContactName = r?.emergencyContactName ?? ''
  medState.emergencyContactPhone = r?.emergencyContactPhone ?? ''
  medState.emergencyContactRelationship = (r?.emergencyContactRelationship as BeneficiaryRelationship | undefined) || undefined
  medState.notes = r?.notes ?? ''
  medFormOpen.value = true
}

async function onMedicalSubmit() {
  medSubmitting.value = true
  try {
    await members.upsertMedicalRecord(memberUuid, {
      bloodType: medState.bloodType,
      allergies: medState.allergies || undefined,
      chronicConditions: medState.chronicConditions || undefined,
      currentMedications: medState.currentMedications || undefined,
      emergencyContactName: medState.emergencyContactName || undefined,
      emergencyContactPhone: medState.emergencyContactPhone || undefined,
      emergencyContactRelationship: medState.emergencyContactRelationship,
      notes: medState.notes || undefined,
    })
    toast.add({ title: 'Histórico médico guardado', color: 'success', icon: 'i-lucide-check-circle' })
    medFormOpen.value = false
    await loadMedicalRecord()
  }
  catch {
    // toast por useApi
  }
  finally {
    medSubmitting.value = false
  }
}

const medDeleteOpen = ref(false)
const medDeleting = ref(false)

async function confirmMedicalDelete() {
  medDeleting.value = true
  try {
    await members.removeMedicalRecord(memberUuid)
    toast.add({ title: 'Histórico médico eliminado', color: 'success', icon: 'i-lucide-check-circle' })
    medDeleteOpen.value = false
    medicalRecord.value = null
    medicalExists.value = false
  }
  catch {
    // toast por useApi
  }
  finally {
    medDeleting.value = false
  }
}

onMounted(async () => {
  await loadMember()
  await Promise.all([loadMedicalRecord(), loadDocumentTypes()])
})
</script>

<template>
  <div class="space-y-5">
    <!-- Volver -->
    <UButton
      color="neutral"
      variant="ghost"
      icon="i-lucide-arrow-left"
      to="/dashboard/members"
      size="sm"
    >
      Afiliados
    </UButton>

    <!-- Cargando -->
    <div v-if="loading" class="bg-white rounded-2xl border border-prohealth-100 p-6 space-y-3">
      <USkeleton class="h-7 w-64 rounded" />
      <USkeleton class="h-4 w-40 rounded" />
      <USkeleton class="h-4 w-full max-w-lg rounded" />
    </div>

    <!-- No encontrado -->
    <div v-else-if="notFound || !member" class="bg-white rounded-2xl border border-prohealth-100 p-12 text-center">
      <UIcon name="i-lucide-user-x" class="w-10 h-10 mx-auto mb-3 text-prohealth-300" />
      <p class="text-prohealth-700 font-semibold">Afiliado no encontrado</p>
      <p class="text-sm text-prohealth-500 mt-1">El registro no existe o fue eliminado.</p>
    </div>

    <template v-else>
      <!-- Datos del titular -->
      <div class="bg-white rounded-2xl border border-prohealth-100 p-6">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div class="flex items-center gap-3">
              <h1 class="text-2xl font-extrabold text-prohealth-900">{{ displayName }}</h1>
              <UBadge
                :color="member.status === 'ACTIVE' ? 'success' : 'warning'"
                variant="subtle"
              >
                {{ member.status || '—' }}
              </UBadge>
            </div>
            <p class="text-sm text-prohealth-500 mt-1">
              {{ member.documentType }} {{ member.documentNumber }} · Afiliado desde {{ formatDate(member.enrolledAt) }}
            </p>
          </div>
        </div>

        <dl class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 mt-6 text-sm">
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">Nacimiento</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ formatDate(member.birthDate) }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">Género</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ member.gender?.name || '—' }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">Estado civil</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ member.maritalStatus?.name || '—' }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">Lugar de nacimiento</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ member.birthplace || '—' }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">Cantidad de hijos</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ member.numberOfChildren ?? '—' }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">Cónyuge</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ member.spouseName || '—' }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">Ocupación</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ member.occupation?.name || '—' }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">Lugar de trabajo</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ member.employerName || '—' }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">Cargo</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ member.jobPosition || '—' }}</dd>
          </div>
          <div class="sm:col-span-2 lg:col-span-3">
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">Dirección de la empresa</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ member.employerAddress || '—' }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">Celular</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ member.phone || '—' }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">Teléfono fijo</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ member.landlinePhone || '—' }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">Email</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ member.email || '—' }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">Ciudad</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ member.city?.name || '—' }}</dd>
          </div>
          <div class="sm:col-span-2">
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">Dirección</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ member.address || '—' }}</dd>
          </div>
          <div v-if="member.notes" class="sm:col-span-3">
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">Notas</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ member.notes }}</dd>
          </div>
        </dl>
      </div>

      <!-- Beneficiarios -->
      <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden">
        <div class="flex items-center justify-between px-6 py-4 border-b border-prohealth-100">
          <div>
            <h2 class="font-bold text-prohealth-900">Beneficiarios</h2>
            <p class="text-xs text-prohealth-500 mt-0.5">Familiares cubiertos por la afiliación.</p>
          </div>
          <UTooltip :text="canUpdate ? 'Añadir beneficiario' : 'No tienes permiso'">
            <UButton
              color="primary"
              variant="soft"
              icon="i-lucide-user-plus"
              size="sm"
              :disabled="!canUpdate"
              @click="openBenCreate"
            >
              Añadir
            </UButton>
          </UTooltip>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
                <th class="px-6 py-3 font-semibold">Nombre</th>
                <th class="px-6 py-3 font-semibold">Documento</th>
                <th class="px-6 py-3 font-semibold">Nacimiento</th>
                <th class="px-6 py-3 font-semibold">Parentesco</th>
                <th class="px-6 py-3 font-semibold">Inscripción extra</th>
                <th class="px-6 py-3 font-semibold">Estado</th>
                <th class="px-6 py-3 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-prohealth-100">
              <TableSkeleton v-if="beneficiariesLoading" :rows="3" :cols="7" />
              <tr v-else-if="beneficiaries.length === 0">
                <td colspan="7" class="px-6 py-10 text-center text-prohealth-500">
                  <UIcon name="i-lucide-users" class="w-7 h-7 mx-auto mb-2 text-prohealth-300" />
                  Sin beneficiarios registrados
                </td>
              </tr>
              <tr v-for="b in beneficiaries" v-else :key="b.uuid" class="hover:bg-prohealth-50/50">
                <td class="px-6 py-3 font-semibold text-prohealth-900">{{ benDisplayName(b) }}</td>
                <td class="px-6 py-3 text-prohealth-700">
                  <span v-if="b.documentNumber">{{ b.documentType }} {{ b.documentNumber }}</span>
                  <span v-else class="text-prohealth-400">—</span>
                </td>
                <td class="px-6 py-3 text-prohealth-600">{{ formatDate(b.birthDate) }}</td>
                <td class="px-6 py-3">
                  <UBadge color="primary" variant="subtle" size="sm">
                    {{ relationshipLabel(b.relationship) }}
                  </UBadge>
                </td>
                <td class="px-6 py-3">
                  <UBadge :color="b.extraInscriptionPaid ? 'success' : 'neutral'" variant="subtle" size="sm">
                    {{ b.extraInscriptionPaid ? 'Pagada' : 'No' }}
                  </UBadge>
                </td>
                <td class="px-6 py-3">
                  <UBadge
                    :color="b.status === 'ACTIVE' || !b.status ? 'success' : 'warning'"
                    variant="subtle"
                    size="sm"
                  >
                    {{ b.status || 'ACTIVE' }}
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
                        @click="openBenEdit(b)"
                      />
                    </UTooltip>
                    <UTooltip :text="canDelete ? 'Eliminar' : 'No tienes permiso'">
                      <UButton
                        color="error"
                        variant="ghost"
                        icon="i-lucide-trash-2"
                        size="sm"
                        :disabled="!canDelete"
                        @click="openBenDelete(b)"
                      />
                    </UTooltip>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Membresías (self-gated by MEMBERSHIP_VIEW_ALL) -->
      <MemberMembershipsCard :member-uuid="memberUuid" />

      <!-- Histórico médico -->
      <div v-if="canViewMedical" class="bg-white rounded-2xl border border-prohealth-100">
        <div class="flex items-center justify-between px-6 py-4 border-b border-prohealth-100">
          <div>
            <h2 class="font-bold text-prohealth-900">Histórico médico</h2>
            <p class="text-xs text-prohealth-500 mt-0.5">Información clínica y contacto de emergencia.</p>
          </div>
          <div class="flex items-center gap-2">
            <UTooltip v-if="medicalExists" :text="canEditMedical ? 'Eliminar histórico' : 'No tienes permiso'">
              <UButton
                color="error"
                variant="ghost"
                icon="i-lucide-trash-2"
                size="sm"
                :disabled="!canEditMedical"
                @click="medDeleteOpen = true"
              />
            </UTooltip>
            <UTooltip :text="canEditMedical ? (medicalExists ? 'Editar histórico' : 'Crear histórico') : 'No tienes permiso'">
              <UButton
                color="primary"
                variant="soft"
                :icon="medicalExists ? 'i-lucide-pencil' : 'i-lucide-plus'"
                size="sm"
                :disabled="!canEditMedical"
                @click="openMedicalForm"
              >
                {{ medicalExists ? 'Editar' : 'Crear' }}
              </UButton>
            </UTooltip>
          </div>
        </div>

        <div class="p-6">
          <div v-if="medicalLoading" class="space-y-3">
            <USkeleton class="h-4 w-48 rounded" />
            <USkeleton class="h-4 w-full max-w-md rounded" />
          </div>
          <div v-else-if="!medicalExists" class="text-center py-6 text-prohealth-500">
            <UIcon name="i-lucide-heart-pulse" class="w-7 h-7 mx-auto mb-2 text-prohealth-300" />
            Este afiliado aún no tiene histórico médico.
          </div>
          <dl v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 text-sm">
            <div>
              <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">Tipo de sangre</dt>
              <dd class="text-prohealth-800 mt-0.5 font-semibold">{{ medicalRecord?.bloodType || '—' }}</dd>
            </div>
            <div class="sm:col-span-2">
              <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">Alergias</dt>
              <dd class="text-prohealth-800 mt-0.5">{{ medicalRecord?.allergies || '—' }}</dd>
            </div>
            <div class="sm:col-span-2 lg:col-span-1">
              <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">Condiciones crónicas</dt>
              <dd class="text-prohealth-800 mt-0.5">{{ medicalRecord?.chronicConditions || '—' }}</dd>
            </div>
            <div class="sm:col-span-2">
              <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">Medicación actual</dt>
              <dd class="text-prohealth-800 mt-0.5">{{ medicalRecord?.currentMedications || '—' }}</dd>
            </div>
            <div>
              <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">Contacto de emergencia</dt>
              <dd class="text-prohealth-800 mt-0.5">
                {{ medicalRecord?.emergencyContactName || '—' }}
                <span v-if="medicalRecord?.emergencyContactRelationship" class="text-prohealth-500">
                  ({{ relationshipLabel(medicalRecord.emergencyContactRelationship) }})
                </span>
              </dd>
            </div>
            <div>
              <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">Teléfono de emergencia</dt>
              <dd class="text-prohealth-800 mt-0.5">{{ medicalRecord?.emergencyContactPhone || '—' }}</dd>
            </div>
            <div v-if="medicalRecord?.notes" class="sm:col-span-3">
              <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">Notas</dt>
              <dd class="text-prohealth-800 mt-0.5">{{ medicalRecord.notes }}</dd>
            </div>
          </dl>
        </div>
      </div>
    </template>

    <!-- Modal beneficiario crear/editar -->
    <UModal
      v-model:open="benFormOpen"
      :title="benMode === 'create' ? 'Añadir beneficiario' : 'Editar beneficiario'"
      :description="benMode === 'create' ? 'Los beneficiarios pueden ser menores de edad.' : 'Actualiza los datos del beneficiario.'"
    >
      <template #body>
        <UForm
          :schema="benSchema"
          :state="benState"
          class="space-y-4"
          @submit="onBenSubmit"
        >
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField label="Primer nombre" name="firstName" required>
              <UInput v-model="benState.firstName" class="w-full" />
            </UFormField>
            <UFormField label="Segundo nombre" name="middleName">
              <UInput v-model="benState.middleName" class="w-full" />
            </UFormField>
            <UFormField label="Primer apellido" name="lastName" required>
              <UInput v-model="benState.lastName" class="w-full" />
            </UFormField>
            <UFormField label="Segundo apellido" name="secondLastName">
              <UInput v-model="benState.secondLastName" class="w-full" />
            </UFormField>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField label="Tipo de documento" name="documentType">
              <USelectMenu
                v-model="benState.documentType"
                :items="documentTypeOptions"
                label-key="label"
                value-key="value"
                placeholder="Selecciona"
                :disabled="benMode === 'edit'"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Número de documento" name="documentNumber">
              <UInput v-model="benState.documentNumber" :disabled="benMode === 'edit'" class="w-full" />
            </UFormField>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField label="Fecha de nacimiento" name="birthDate">
              <UInput v-model="benState.birthDate" type="date" class="w-full" />
            </UFormField>
            <UFormField label="Parentesco" name="relationship" required>
              <USelectMenu
                v-model="benState.relationship"
                :items="RELATIONSHIP_OPTIONS"
                label-key="label"
                value-key="value"
                placeholder="Selecciona"
                class="w-full"
              />
            </UFormField>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField label="Inscripción extra pagada" name="extraInscriptionPaid">
              <USwitch v-model="benState.extraInscriptionPaid" />
            </UFormField>
            <UFormField v-if="benMode === 'edit'" label="Estado" name="status">
              <USelectMenu v-model="benState.status" :items="['ACTIVE', 'INACTIVE']" class="w-full" />
            </UFormField>
          </div>

          <div class="flex items-center justify-end gap-3 pt-2">
            <UButton color="neutral" variant="ghost" :disabled="benSubmitting" @click="benFormOpen = false">
              Cancelar
            </UButton>
            <UButton type="submit" color="primary" :loading="benSubmitting" icon="i-lucide-save">
              {{ benMode === 'create' ? 'Añadir' : 'Guardar cambios' }}
            </UButton>
          </div>
        </UForm>
      </template>
    </UModal>

    <!-- Modal confirmar eliminación de beneficiario -->
    <UModal v-model:open="benDeleteOpen" title="Eliminar beneficiario">
      <template #body>
        <p class="text-sm text-prohealth-700">
          ¿Seguro que deseas eliminar a
          <span class="font-semibold">{{ benTarget ? benDisplayName(benTarget) : '' }}</span>?
          Esta acción desactiva su cobertura (soft-delete).
        </p>
        <div class="flex items-center justify-end gap-3 pt-5">
          <UButton color="neutral" variant="ghost" :disabled="benDeleting" @click="benDeleteOpen = false">
            Cancelar
          </UButton>
          <UButton color="error" :loading="benDeleting" icon="i-lucide-trash-2" @click="confirmBenDelete">
            Eliminar
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Modal histórico médico -->
    <UModal
      v-model:open="medFormOpen"
      :title="medicalExists ? 'Editar histórico médico' : 'Crear histórico médico'"
      description="Información clínica del titular y contacto de emergencia."
      :ui="{ content: 'max-w-2xl' }"
    >
      <template #body>
        <UForm
          :state="medState"
          class="space-y-4"
          @submit="onMedicalSubmit"
        >
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField label="Tipo de sangre" name="bloodType">
              <USelectMenu v-model="medState.bloodType" :items="BLOOD_TYPES" placeholder="Selecciona" class="w-full" />
            </UFormField>
          </div>

          <UFormField label="Alergias" name="allergies">
            <UTextarea v-model="medState.allergies" :rows="2" placeholder="Penicilina, mariscos…" class="w-full" />
          </UFormField>

          <UFormField label="Condiciones crónicas" name="chronicConditions">
            <UTextarea v-model="medState.chronicConditions" :rows="2" placeholder="Hipertensión, diabetes…" class="w-full" />
          </UFormField>

          <UFormField label="Medicación actual" name="currentMedications">
            <UTextarea v-model="medState.currentMedications" :rows="2" class="w-full" />
          </UFormField>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <UFormField label="Contacto de emergencia" name="emergencyContactName">
              <UInput v-model="medState.emergencyContactName" class="w-full" />
            </UFormField>
            <UFormField label="Teléfono" name="emergencyContactPhone">
              <UInput v-model="medState.emergencyContactPhone" class="w-full" />
            </UFormField>
            <UFormField label="Parentesco" name="emergencyContactRelationship">
              <USelectMenu
                v-model="medState.emergencyContactRelationship"
                :items="RELATIONSHIP_OPTIONS"
                label-key="label"
                value-key="value"
                placeholder="Selecciona"
                class="w-full"
              />
            </UFormField>
          </div>

          <UFormField label="Notas" name="notes">
            <UTextarea v-model="medState.notes" :rows="2" class="w-full" />
          </UFormField>

          <div class="flex items-center justify-end gap-3 pt-2">
            <UButton color="neutral" variant="ghost" :disabled="medSubmitting" @click="medFormOpen = false">
              Cancelar
            </UButton>
            <UButton type="submit" color="primary" :loading="medSubmitting" icon="i-lucide-save">
              Guardar
            </UButton>
          </div>
        </UForm>
      </template>
    </UModal>

    <!-- Modal confirmar eliminación de histórico -->
    <UModal v-model:open="medDeleteOpen" title="Eliminar histórico médico">
      <template #body>
        <p class="text-sm text-prohealth-700">
          ¿Seguro que deseas eliminar el histórico médico de
          <span class="font-semibold">{{ displayName }}</span>? (soft-delete)
        </p>
        <div class="flex items-center justify-end gap-3 pt-5">
          <UButton color="neutral" variant="ghost" :disabled="medDeleting" @click="medDeleteOpen = false">
            Cancelar
          </UButton>
          <UButton color="error" :loading="medDeleting" icon="i-lucide-trash-2" @click="confirmMedicalDelete">
            Eliminar
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
