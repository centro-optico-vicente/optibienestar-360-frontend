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
import { RELATIONSHIP_OPTIONS } from '~/types/members'

definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'MEMBER_VIEW_ALL',
})

const { t } = useI18n()
const { formatDate } = useFormatters()

useSeoMeta({ title: () => t('common.seoTitle', { page: t('members.detail.seoPage') }) })

const route = useRoute()
const memberUuid = route.params.uuid as string

const members = useMembers()
const { can } = usePermissions()
const toast = useToast()

const canUpdate = computed(() => can('MEMBER_UPDATE'))
const canDelete = computed(() => can('MEMBER_DELETE'))
const canViewMedical = computed(() => can('MEDICAL_RECORD_VIEW'))
const canEditMedical = computed(() => can('MEDICAL_RECORD_UPDATE'))

// Localized enum options + resolvers.
const relationshipOptions = computed(() => RELATIONSHIP_OPTIONS.map(o => ({ label: t(o.labelKey), value: o.value })))
const benStatusOptions = computed(() => ['ACTIVE', 'INACTIVE'].map(s => ({ label: statusLabel(s), value: s })))
function relationshipLabel(r?: string | null): string {
  return r ? t(`members.relationships.${r}`, r) : t('common.empty')
}
function statusLabel(s?: string | null): string {
  return s ? t(`members.status.${s}`, s) : t('common.empty')
}

// ---- Member load ----
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

// ---- Beneficiaries ----
const beneficiaries = ref<BeneficiaryDto[]>([])
const beneficiariesLoading = ref(false)

async function loadBeneficiaries() {
  beneficiariesLoading.value = true
  try {
    beneficiaries.value = await members.listBeneficiaries(memberUuid)
  }
  catch {
    // useApi already notified the error
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

const benSchema = computed(() => z.object({
  firstName: z.string().min(2, t('validation.minChars', { n: 2 })),
  middleName: z.string().optional(),
  lastName: z.string().min(2, t('validation.minChars', { n: 2 })),
  secondLastName: z.string().optional(),
  documentType: z.string().optional(),
  documentNumber: z.string().regex(/^\d*$/, t('validation.digitsOnly')).optional(),
  birthDate: z.string().optional(),
  relationship: z.string({ message: t('validation.required') }).min(1, t('validation.required')),
}))

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
      toast.add({ title: t('members.beneficiaries.createdToast'), color: 'success', icon: 'i-lucide-check-circle' })
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
      toast.add({ title: t('members.beneficiaries.updatedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    }
    benFormOpen.value = false
    await loadBeneficiaries()
  }
  catch {
    // toast handled by useApi
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
    toast.add({ title: t('members.beneficiaries.deletedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    benDeleteOpen.value = false
    await loadBeneficiaries()
  }
  catch {
    // toast handled by useApi
  }
  finally {
    benDeleting.value = false
  }
}

function benDisplayName(b: BeneficiaryDto): string {
  return b.fullName || [b.firstName, b.middleName, b.lastName, b.secondLastName].filter(Boolean).join(' ')
}

// ---- Medical record ----
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
    // 404 = no record yet; not an error.
    if ((err as ApiError).status !== 404) {
      // useApi already notified other errors
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
    toast.add({ title: t('members.medical.savedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    medFormOpen.value = false
    await loadMedicalRecord()
  }
  catch {
    // toast handled by useApi
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
    toast.add({ title: t('members.medical.deletedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    medDeleteOpen.value = false
    medicalRecord.value = null
    medicalExists.value = false
  }
  catch {
    // toast handled by useApi
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
    <!-- Back -->
    <UButton
      color="neutral"
      variant="ghost"
      icon="i-lucide-arrow-left"
      to="/dashboard/members"
      size="sm"
    >
      {{ t('members.title') }}
    </UButton>

    <!-- Loading -->
    <div v-if="loading" class="bg-white rounded-2xl border border-prohealth-100 p-6 space-y-3">
      <USkeleton class="h-7 w-64 rounded" />
      <USkeleton class="h-4 w-40 rounded" />
      <USkeleton class="h-4 w-full max-w-lg rounded" />
    </div>

    <!-- Not found -->
    <div v-else-if="notFound || !member" class="bg-white rounded-2xl border border-prohealth-100 p-12 text-center">
      <UIcon name="i-lucide-user-x" class="w-10 h-10 mx-auto mb-3 text-prohealth-300" />
      <p class="text-prohealth-700 font-semibold">{{ t('members.detail.notFoundTitle') }}</p>
      <p class="text-sm text-prohealth-500 mt-1">{{ t('members.detail.notFoundBody') }}</p>
    </div>

    <template v-else>
      <!-- Holder data -->
      <div class="bg-white rounded-2xl border border-prohealth-100 p-6">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div class="flex items-center gap-3">
              <h1 class="text-2xl font-extrabold text-prohealth-900">{{ displayName }}</h1>
              <UBadge
                :color="member.status === 'ACTIVE' ? 'success' : 'warning'"
                variant="subtle"
              >
                {{ member.status ? statusLabel(member.status) : t('common.empty') }}
              </UBadge>
            </div>
            <p class="text-sm text-prohealth-500 mt-1">
              {{ member.documentType }} {{ member.documentNumber }} · {{ t('members.detail.memberSince', { date: formatDate(member.enrolledAt, 'short') }) }}
            </p>
          </div>
        </div>

        <dl class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 mt-6 text-sm">
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('members.detail.fields.birthDate') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ formatDate(member.birthDate, 'short') }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('members.detail.fields.gender') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ member.gender?.name || t('common.empty') }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('members.detail.fields.maritalStatus') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ member.maritalStatus?.name || t('common.empty') }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('members.detail.fields.birthplace') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ member.birthplace || t('common.empty') }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('members.detail.fields.numberOfChildren') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ member.numberOfChildren ?? t('common.empty') }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('members.detail.fields.spouseName') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ member.spouseName || t('common.empty') }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('members.detail.fields.occupation') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ member.occupation?.name || t('common.empty') }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('members.detail.fields.employerName') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ member.employerName || t('common.empty') }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('members.detail.fields.jobPosition') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ member.jobPosition || t('common.empty') }}</dd>
          </div>
          <div class="sm:col-span-2 lg:col-span-3">
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('members.detail.fields.employerAddress') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ member.employerAddress || t('common.empty') }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('members.detail.fields.phone') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ member.phone || t('common.empty') }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('members.detail.fields.landlinePhone') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ member.landlinePhone || t('common.empty') }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('members.detail.fields.email') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ member.email || t('common.empty') }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('members.detail.fields.city') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ member.city?.name || t('common.empty') }}</dd>
          </div>
          <div class="sm:col-span-2">
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('members.detail.fields.address') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ member.address || t('common.empty') }}</dd>
          </div>
          <div v-if="member.notes" class="sm:col-span-3">
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('members.detail.fields.notes') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ member.notes }}</dd>
          </div>
        </dl>
      </div>

      <!-- Beneficiaries -->
      <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden">
        <div class="flex items-center justify-between px-6 py-4 border-b border-prohealth-100">
          <div>
            <h2 class="font-bold text-prohealth-900">{{ t('members.beneficiaries.title') }}</h2>
            <p class="text-xs text-prohealth-500 mt-0.5">{{ t('members.beneficiaries.subtitle') }}</p>
          </div>
          <UTooltip :text="canUpdate ? t('members.beneficiaries.addTooltip') : t('members.noPermission')">
            <UButton
              color="primary"
              variant="soft"
              icon="i-lucide-user-plus"
              size="sm"
              :disabled="!canUpdate"
              @click="openBenCreate"
            >
              {{ t('members.beneficiaries.add') }}
            </UButton>
          </UTooltip>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
                <th class="px-6 py-3 font-semibold">{{ t('members.beneficiaries.columns.name') }}</th>
                <th class="px-6 py-3 font-semibold">{{ t('members.beneficiaries.columns.document') }}</th>
                <th class="px-6 py-3 font-semibold">{{ t('members.beneficiaries.columns.birthDate') }}</th>
                <th class="px-6 py-3 font-semibold">{{ t('members.beneficiaries.columns.relationship') }}</th>
                <th class="px-6 py-3 font-semibold">{{ t('members.beneficiaries.columns.extraInscription') }}</th>
                <th class="px-6 py-3 font-semibold">{{ t('members.beneficiaries.columns.status') }}</th>
                <th class="px-6 py-3 font-semibold text-right">{{ t('common.actions') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-prohealth-100">
              <TableSkeleton v-if="beneficiariesLoading" :rows="3" :cols="7" />
              <tr v-else-if="beneficiaries.length === 0">
                <td colspan="7" class="px-6 py-10 text-center text-prohealth-500">
                  <UIcon name="i-lucide-users" class="w-7 h-7 mx-auto mb-2 text-prohealth-300" />
                  {{ t('members.beneficiaries.empty') }}
                </td>
              </tr>
              <tr v-for="b in beneficiaries" v-else :key="b.uuid" class="hover:bg-prohealth-50/50">
                <td class="px-6 py-3 font-semibold text-prohealth-900">{{ benDisplayName(b) }}</td>
                <td class="px-6 py-3 text-prohealth-700">
                  <span v-if="b.documentNumber">{{ b.documentType }} {{ b.documentNumber }}</span>
                  <span v-else class="text-prohealth-400">{{ t('common.empty') }}</span>
                </td>
                <td class="px-6 py-3 text-prohealth-600">{{ formatDate(b.birthDate, 'short') }}</td>
                <td class="px-6 py-3">
                  <UBadge color="primary" variant="subtle" size="sm">
                    {{ relationshipLabel(b.relationship) }}
                  </UBadge>
                </td>
                <td class="px-6 py-3">
                  <UBadge :color="b.extraInscriptionPaid ? 'success' : 'neutral'" variant="subtle" size="sm">
                    {{ b.extraInscriptionPaid ? t('members.beneficiaries.extraPaid') : t('common.no') }}
                  </UBadge>
                </td>
                <td class="px-6 py-3">
                  <UBadge
                    :color="b.status === 'ACTIVE' || !b.status ? 'success' : 'warning'"
                    variant="subtle"
                    size="sm"
                  >
                    {{ statusLabel(b.status || 'ACTIVE') }}
                  </UBadge>
                </td>
                <td class="px-6 py-3">
                  <div class="flex items-center justify-end gap-1">
                    <UTooltip :text="canUpdate ? t('common.edit') : t('members.noPermission')">
                      <UButton
                        color="neutral"
                        variant="ghost"
                        icon="i-lucide-pencil"
                        size="sm"
                        :disabled="!canUpdate"
                        @click="openBenEdit(b)"
                      />
                    </UTooltip>
                    <UTooltip :text="canDelete ? t('common.delete') : t('members.noPermission')">
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

      <!-- Memberships (self-gated by MEMBERSHIP_VIEW_ALL) -->
      <MemberMembershipsCard :member-uuid="memberUuid" />

      <!-- Referral code (self-gated by REFERRAL_CODE_CREATE) -->
      <MemberReferralCodeCard :member-uuid="memberUuid" />

      <!-- Medical record -->
      <div v-if="canViewMedical" class="bg-white rounded-2xl border border-prohealth-100">
        <div class="flex items-center justify-between px-6 py-4 border-b border-prohealth-100">
          <div>
            <h2 class="font-bold text-prohealth-900">{{ t('members.medical.title') }}</h2>
            <p class="text-xs text-prohealth-500 mt-0.5">{{ t('members.medical.subtitle') }}</p>
          </div>
          <div class="flex items-center gap-2">
            <UTooltip v-if="medicalExists" :text="canEditMedical ? t('members.medical.deleteTooltip') : t('members.noPermission')">
              <UButton
                color="error"
                variant="ghost"
                icon="i-lucide-trash-2"
                size="sm"
                :disabled="!canEditMedical"
                @click="medDeleteOpen = true"
              />
            </UTooltip>
            <UTooltip :text="canEditMedical ? (medicalExists ? t('members.medical.editTooltip') : t('members.medical.createTooltip')) : t('members.noPermission')">
              <UButton
                color="primary"
                variant="soft"
                :icon="medicalExists ? 'i-lucide-pencil' : 'i-lucide-plus'"
                size="sm"
                :disabled="!canEditMedical"
                @click="openMedicalForm"
              >
                {{ medicalExists ? t('members.medical.edit') : t('members.medical.create') }}
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
            {{ t('members.medical.empty') }}
          </div>
          <dl v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 text-sm">
            <div>
              <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('members.medical.fields.bloodType') }}</dt>
              <dd class="text-prohealth-800 mt-0.5 font-semibold">{{ medicalRecord?.bloodType || t('common.empty') }}</dd>
            </div>
            <div class="sm:col-span-2">
              <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('members.medical.fields.allergies') }}</dt>
              <dd class="text-prohealth-800 mt-0.5">{{ medicalRecord?.allergies || t('common.empty') }}</dd>
            </div>
            <div class="sm:col-span-2 lg:col-span-1">
              <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('members.medical.fields.chronicConditions') }}</dt>
              <dd class="text-prohealth-800 mt-0.5">{{ medicalRecord?.chronicConditions || t('common.empty') }}</dd>
            </div>
            <div class="sm:col-span-2">
              <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('members.medical.fields.currentMedications') }}</dt>
              <dd class="text-prohealth-800 mt-0.5">{{ medicalRecord?.currentMedications || t('common.empty') }}</dd>
            </div>
            <div>
              <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('members.medical.fields.emergencyContact') }}</dt>
              <dd class="text-prohealth-800 mt-0.5">
                {{ medicalRecord?.emergencyContactName || t('common.empty') }}
                <span v-if="medicalRecord?.emergencyContactRelationship" class="text-prohealth-500">
                  ({{ relationshipLabel(medicalRecord.emergencyContactRelationship) }})
                </span>
              </dd>
            </div>
            <div>
              <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('members.medical.fields.emergencyPhone') }}</dt>
              <dd class="text-prohealth-800 mt-0.5">{{ medicalRecord?.emergencyContactPhone || t('common.empty') }}</dd>
            </div>
            <div v-if="medicalRecord?.notes" class="sm:col-span-3">
              <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('members.medical.fields.notes') }}</dt>
              <dd class="text-prohealth-800 mt-0.5">{{ medicalRecord.notes }}</dd>
            </div>
          </dl>
        </div>
      </div>
    </template>

    <!-- Beneficiary create/edit modal -->
    <UModal
      v-model:open="benFormOpen"
      :title="benMode === 'create' ? t('members.beneficiaries.form.createTitle') : t('members.beneficiaries.form.editTitle')"
      :description="benMode === 'create' ? t('members.beneficiaries.form.createDescription') : t('members.beneficiaries.form.editDescription')"
    >
      <template #body>
        <UForm
          :schema="benSchema"
          :state="benState"
          class="space-y-4"
          @submit="onBenSubmit"
        >
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField :label="t('members.form.fields.firstName')" name="firstName" required>
              <UInput v-model="benState.firstName" class="w-full" />
            </UFormField>
            <UFormField :label="t('members.form.fields.middleName')" name="middleName">
              <UInput v-model="benState.middleName" class="w-full" />
            </UFormField>
            <UFormField :label="t('members.form.fields.lastName')" name="lastName" required>
              <UInput v-model="benState.lastName" class="w-full" />
            </UFormField>
            <UFormField :label="t('members.form.fields.secondLastName')" name="secondLastName">
              <UInput v-model="benState.secondLastName" class="w-full" />
            </UFormField>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField :label="t('members.form.fields.documentType')" name="documentType">
              <USelectMenu
                v-model="benState.documentType"
                :items="documentTypeOptions"
                label-key="label"
                value-key="value"
                :placeholder="t('common.select')"
                :disabled="benMode === 'edit'"
                class="w-full"
              />
            </UFormField>
            <UFormField :label="t('members.form.fields.documentNumber')" name="documentNumber">
              <UInput v-model="benState.documentNumber" :disabled="benMode === 'edit'" class="w-full" />
            </UFormField>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField :label="t('members.form.fields.birthDate')" name="birthDate">
              <UInput v-model="benState.birthDate" type="date" class="w-full" />
            </UFormField>
            <UFormField :label="t('members.beneficiaries.form.relationship')" name="relationship" required>
              <USelectMenu
                v-model="benState.relationship"
                :items="relationshipOptions"
                label-key="label"
                value-key="value"
                :placeholder="t('common.select')"
                class="w-full"
              />
            </UFormField>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField :label="t('members.beneficiaries.form.extraInscriptionPaid')" name="extraInscriptionPaid">
              <USwitch v-model="benState.extraInscriptionPaid" />
            </UFormField>
            <UFormField v-if="benMode === 'edit'" :label="t('members.form.fields.status')" name="status">
              <USelectMenu
                v-model="benState.status"
                :items="benStatusOptions"
                label-key="label"
                value-key="value"
                class="w-full"
              />
            </UFormField>
          </div>

          <div class="flex items-center justify-between gap-3 pt-2">
            <p class="text-xs text-prohealth-500">{{ t('common.requiredFieldsHint') }}</p>
            <div class="flex items-center gap-3">
              <UButton color="neutral" variant="ghost" :disabled="benSubmitting" @click="benFormOpen = false">
                {{ t('common.cancel') }}
              </UButton>
              <UButton type="submit" color="primary" :loading="benSubmitting" icon="i-lucide-save">
                {{ benMode === 'create' ? t('members.beneficiaries.add') : t('common.saveChanges') }}
              </UButton>
            </div>
          </div>
        </UForm>
      </template>
    </UModal>

    <!-- Beneficiary delete confirmation modal -->
    <UModal v-model:open="benDeleteOpen" :title="t('members.beneficiaries.delete.title')">
      <template #body>
        <i18n-t keypath="members.beneficiaries.delete.confirm" tag="p" class="text-sm text-prohealth-700" scope="global">
          <template #name>
            <span class="font-semibold">{{ benTarget ? benDisplayName(benTarget) : '' }}</span>
          </template>
        </i18n-t>
        <div class="flex items-center justify-end gap-3 pt-5">
          <UButton color="neutral" variant="ghost" :disabled="benDeleting" @click="benDeleteOpen = false">
            {{ t('common.cancel') }}
          </UButton>
          <UButton color="error" :loading="benDeleting" icon="i-lucide-trash-2" @click="confirmBenDelete">
            {{ t('common.delete') }}
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Medical record modal -->
    <UModal
      v-model:open="medFormOpen"
      :title="medicalExists ? t('members.medical.form.editTitle') : t('members.medical.form.createTitle')"
      :description="t('members.medical.form.description')"
      :ui="{ content: 'max-w-2xl' }"
    >
      <template #body>
        <UForm
          :state="medState"
          class="space-y-4"
          @submit="onMedicalSubmit"
        >
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField :label="t('members.medical.fields.bloodType')" name="bloodType">
              <USelectMenu v-model="medState.bloodType" :items="BLOOD_TYPES" :placeholder="t('common.select')" class="w-full" />
            </UFormField>
          </div>

          <UFormField :label="t('members.medical.fields.allergies')" name="allergies">
            <UTextarea v-model="medState.allergies" :rows="2" :placeholder="t('members.medical.form.placeholders.allergies')" class="w-full" />
          </UFormField>

          <UFormField :label="t('members.medical.fields.chronicConditions')" name="chronicConditions">
            <UTextarea v-model="medState.chronicConditions" :rows="2" :placeholder="t('members.medical.form.placeholders.chronic')" class="w-full" />
          </UFormField>

          <UFormField :label="t('members.medical.fields.currentMedications')" name="currentMedications">
            <UTextarea v-model="medState.currentMedications" :rows="2" class="w-full" />
          </UFormField>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <UFormField :label="t('members.medical.form.emergencyContact')" name="emergencyContactName">
              <UInput v-model="medState.emergencyContactName" class="w-full" />
            </UFormField>
            <UFormField :label="t('members.medical.form.phone')" name="emergencyContactPhone">
              <UInput v-model="medState.emergencyContactPhone" class="w-full" />
            </UFormField>
            <UFormField :label="t('members.medical.form.relationship')" name="emergencyContactRelationship">
              <USelectMenu
                v-model="medState.emergencyContactRelationship"
                :items="relationshipOptions"
                label-key="label"
                value-key="value"
                :placeholder="t('common.select')"
                class="w-full"
              />
            </UFormField>
          </div>

          <UFormField :label="t('members.medical.fields.notes')" name="notes">
            <UTextarea v-model="medState.notes" :rows="2" class="w-full" />
          </UFormField>

          <div class="flex items-center justify-end gap-3 pt-2">
            <UButton color="neutral" variant="ghost" :disabled="medSubmitting" @click="medFormOpen = false">
              {{ t('common.cancel') }}
            </UButton>
            <UButton type="submit" color="primary" :loading="medSubmitting" icon="i-lucide-save">
              {{ t('members.medical.form.submit') }}
            </UButton>
          </div>
        </UForm>
      </template>
    </UModal>

    <!-- Medical record delete confirmation modal -->
    <UModal v-model:open="medDeleteOpen" :title="t('members.medical.delete.title')">
      <template #body>
        <i18n-t keypath="members.medical.delete.confirm" tag="p" class="text-sm text-prohealth-700" scope="global">
          <template #name>
            <span class="font-semibold">{{ displayName }}</span>
          </template>
        </i18n-t>
        <div class="flex items-center justify-end gap-3 pt-5">
          <UButton color="neutral" variant="ghost" :disabled="medDeleting" @click="medDeleteOpen = false">
            {{ t('common.cancel') }}
          </UButton>
          <UButton color="error" :loading="medDeleting" icon="i-lucide-trash-2" @click="confirmMedicalDelete">
            {{ t('common.delete') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
