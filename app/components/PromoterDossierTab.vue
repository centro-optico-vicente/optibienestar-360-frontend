<script setup lang="ts">
import { z } from 'zod'
import type { SelectItem } from '~/types/options'
import { toSelectItems } from '~/types/options'
import type { EducationLevel, PromoterDossierUpdateRequest, PromoterDto } from '~/types/promoters'
import { EDUCATION_LEVEL_OPTIONS } from '~/types/promoters'

// "Expediente" tab of the advisor detail (backend V180): registration +
// executive profile (promoter columns) and the identity block, which the
// backend writes onto the linked person (shared identity hub). PATCH
// semantics — an empty optional text field is sent as '' so it gets cleared.
const props = defineProps<{
  promoter: PromoterDto
  /** PROMOTER_UPDATE and not the INSTITUCION system row. */
  canEdit: boolean
}>()

const emit = defineEmits<{
  saved: [promoter: PromoterDto]
}>()

const { t } = useI18n()
const promoters = usePromoters()
const toast = useToast()

const educationLevelOptions = computed(() =>
  EDUCATION_LEVEL_OPTIONS.map(o => ({ label: t(o.labelKey), value: o.value })),
)
const documentTypeOptions = computed(() => [
  { label: t('promoters.dossier.documentTypes.V'), value: 'V' },
  { label: t('promoters.dossier.documentTypes.E'), value: 'E' },
])

const maritalStatusOptions = ref<SelectItem[]>([])
async function loadMaritalStatuses() {
  try {
    maritalStatusOptions.value = toSelectItems(await useCatalogOptions('marital-statuses').options({ limit: 100 }))
  }
  catch {
    maritalStatusOptions.value = []
  }
}

// City is searched server-side (no state cascade here: the identity block only
// carries the city); `currentValues` keeps the saved city selectable.
async function searchCities(q: string): Promise<SelectItem[]> {
  const res = await useCatalogOptions('cities').options({
    q,
    limit: 20,
    currentValues: state.cityUuid ? [state.cityUuid] : undefined,
  })
  return toSelectItems(res)
}

interface FormState {
  joinedAt: string
  assignedZone: string
  educationLevel: EducationLevel | undefined
  profession: string
  yearsOfExperience: string
  lastCompany: string
  lastPosition: string
  vehicle: string
  firstName: string
  lastName: string
  documentType: 'V' | 'E' | undefined
  documentNumber: string
  birthDate: string
  maritalStatusUuid: string | undefined
  landlinePhone: string
  address: string
  cityUuid: string | undefined
}

const state = reactive<FormState>({
  joinedAt: '',
  assignedZone: '',
  educationLevel: undefined,
  profession: '',
  yearsOfExperience: '',
  lastCompany: '',
  lastPosition: '',
  vehicle: '',
  firstName: '',
  lastName: '',
  documentType: undefined,
  documentNumber: '',
  birthDate: '',
  maritalStatusUuid: undefined,
  landlinePhone: '',
  address: '',
  cityUuid: undefined,
})

const hasIdentity = computed(() => Boolean(props.promoter.identity))

function populate(p: PromoterDto) {
  state.joinedAt = p.joinedAt ?? ''
  state.assignedZone = p.assignedZone ?? ''
  state.educationLevel = p.educationLevel ?? undefined
  state.profession = p.profession ?? ''
  state.yearsOfExperience = p.yearsOfExperience === null || p.yearsOfExperience === undefined ? '' : String(p.yearsOfExperience)
  state.lastCompany = p.lastCompany ?? ''
  state.lastPosition = p.lastPosition ?? ''
  state.vehicle = p.vehicle ?? ''
  const id = p.identity
  state.firstName = id?.firstName ?? ''
  state.lastName = id?.lastName ?? ''
  state.documentType = id?.documentType ?? undefined
  state.documentNumber = id?.documentNumber ?? ''
  state.birthDate = id?.birthDate ?? ''
  state.maritalStatusUuid = id?.maritalStatus_Uuid ?? undefined
  state.landlinePhone = id?.landlinePhone ?? ''
  state.address = id?.address ?? ''
  state.cityUuid = id?.city_Uuid ?? undefined
}

watch(() => props.promoter, p => populate(p), { immediate: true })
onMounted(loadMaritalStatuses)

const schema = computed(() => z.object({
  assignedZone: z.string().max(120, t('validation.maxChars', { n: 120 })).optional(),
  profession: z.string().max(120, t('validation.maxChars', { n: 120 })).optional(),
  yearsOfExperience: z.string().regex(/^(\d{1,2})?$/, t('validation.digitsOnly')).optional(),
  lastCompany: z.string().max(150, t('validation.maxChars', { n: 150 })).optional(),
  lastPosition: z.string().max(100, t('validation.maxChars', { n: 100 })).optional(),
  vehicle: z.string().max(120, t('validation.maxChars', { n: 120 })).optional(),
  firstName: hasIdentity.value ? z.string().min(1, t('validation.required')).max(50, t('validation.maxChars', { n: 50 })) : z.string().optional(),
  lastName: hasIdentity.value ? z.string().min(1, t('validation.required')).max(50, t('validation.maxChars', { n: 50 })) : z.string().optional(),
  documentNumber: z.string().regex(/^(\d{1,9})?$/, t('promoters.dossier.validation.documentNumber')).optional(),
  landlinePhone: z.string().max(30, t('validation.maxChars', { n: 30 })).optional(),
}))

const saving = ref(false)

async function onSubmit() {
  saving.value = true
  try {
    const body: PromoterDossierUpdateRequest = {
      joinedAt: state.joinedAt || undefined,
      assignedZone: state.assignedZone.trim(),
      educationLevel: state.educationLevel,
      profession: state.profession.trim(),
      yearsOfExperience: state.yearsOfExperience === '' ? undefined : Number(state.yearsOfExperience),
      lastCompany: state.lastCompany.trim(),
      lastPosition: state.lastPosition.trim(),
      vehicle: state.vehicle.trim(),
    }
    if (hasIdentity.value) {
      body.firstName = state.firstName.trim() || undefined
      body.lastName = state.lastName.trim() || undefined
      // The cédula travels as a pair; a half-filled pair is not sent.
      if (state.documentType && state.documentNumber.trim()) {
        body.documentType = state.documentType
        body.documentNumber = state.documentNumber.trim()
      }
      body.birthDate = state.birthDate || undefined
      body.maritalStatusUuid = state.maritalStatusUuid || undefined
      body.landlinePhone = state.landlinePhone.trim()
      body.address = state.address.trim()
      body.cityUuid = state.cityUuid || undefined
    }
    const updated = await promoters.update(props.promoter.uuid, body)
    toast.add({ title: t('promoters.dossier.savedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    emit('saved', updated)
  }
  catch {
    // useApi already reported the API error (422 duplicate cédula, validation…).
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden">
    <div class="px-6 py-4 border-b border-prohealth-100">
      <h2 class="font-bold text-prohealth-900">{{ t('promoters.dossier.title') }}</h2>
      <p class="text-xs text-prohealth-500 mt-0.5">{{ t('promoters.dossier.hint') }}</p>
    </div>

    <UForm :schema="schema" :state="state" class="p-6 space-y-6" :disabled="!canEdit" @submit="onSubmit">
      <!-- I. Registro -->
      <section class="space-y-4">
        <h3 class="text-sm font-semibold text-prohealth-800">{{ t('promoters.dossier.sections.registration') }}</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <UFormField :label="t('promoters.dossier.fields.joinedAt')" name="joinedAt">
            <AppDatePicker v-model="state.joinedAt" :disabled="!canEdit" />
          </UFormField>
          <UFormField :label="t('promoters.dossier.fields.assignedZone')" name="assignedZone">
            <UInput v-model="state.assignedZone" class="w-full" :placeholder="t('promoters.dossier.placeholders.assignedZone')" />
          </UFormField>
          <UFormField :label="t('promoters.detail.fields.referralCode')">
            <UInput :model-value="promoter.referralCode" class="w-full font-mono" readonly />
          </UFormField>
          <UFormField :label="t('promoters.dossier.fields.rank')">
            <UInput :model-value="promoter.rank_Display ?? ''" class="w-full" readonly />
          </UFormField>
        </div>
      </section>

      <!-- II. Identidad -->
      <section v-if="hasIdentity" class="space-y-4">
        <div>
          <h3 class="text-sm font-semibold text-prohealth-800">{{ t('promoters.dossier.sections.identity') }}</h3>
          <p class="text-xs text-prohealth-500 mt-0.5">{{ t('promoters.dossier.identityHint') }}</p>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <UFormField :label="t('promoters.dossier.fields.firstName')" name="firstName" required>
            <UInput v-model="state.firstName" class="w-full" />
          </UFormField>
          <UFormField :label="t('promoters.dossier.fields.lastName')" name="lastName" required>
            <UInput v-model="state.lastName" class="w-full" />
          </UFormField>
          <UFormField :label="t('promoters.dossier.fields.documentType')" name="documentType">
            <USelect v-model="state.documentType" :items="documentTypeOptions" class="w-full" />
          </UFormField>
          <UFormField :label="t('promoters.dossier.fields.documentNumber')" name="documentNumber">
            <UInput v-model="state.documentNumber" inputmode="numeric" class="w-full" />
          </UFormField>
          <UFormField :label="t('promoters.dossier.fields.birthDate')" name="birthDate">
            <AppDatePicker v-model="state.birthDate" :disabled="!canEdit" />
          </UFormField>
          <UFormField :label="t('promoters.dossier.fields.maritalStatus')" name="maritalStatusUuid">
            <CommonEntityReferenceSelect
              v-model="state.maritalStatusUuid"
              :items="maritalStatusOptions"
              entity="marital_status"
              :disabled="!canEdit"
              :placeholder="t('common.select')"
            />
          </UFormField>
          <UFormField :label="t('promoters.dossier.fields.mobilePhone')">
            <UInput :model-value="promoter.identity?.phone || promoter.phone || ''" class="w-full" readonly />
          </UFormField>
          <UFormField :label="t('promoters.dossier.fields.landlinePhone')" name="landlinePhone">
            <UInput v-model="state.landlinePhone" class="w-full" />
          </UFormField>
          <UFormField :label="t('promoters.dossier.fields.email')">
            <UInput :model-value="promoter.identity?.email || promoter.email || ''" class="w-full" readonly />
          </UFormField>
          <UFormField class="sm:col-span-2" :label="t('promoters.dossier.fields.address')" name="address">
            <UInput v-model="state.address" class="w-full" />
          </UFormField>
          <UFormField :label="t('promoters.dossier.fields.city')" name="cityUuid">
            <CommonEntityReferenceSelect
              v-model="state.cityUuid"
              :search="searchCities"
              entity="city"
              icon="i-lucide-search"
              :disabled="!canEdit"
              :placeholder="t('common.select')"
            />
          </UFormField>
        </div>
      </section>

      <!-- III. Perfil ejecutivo -->
      <section class="space-y-4">
        <h3 class="text-sm font-semibold text-prohealth-800">{{ t('promoters.dossier.sections.profile') }}</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <UFormField :label="t('promoters.dossier.fields.educationLevel')" name="educationLevel">
            <USelect v-model="state.educationLevel" :items="educationLevelOptions" class="w-full" :placeholder="t('common.select')" />
          </UFormField>
          <UFormField :label="t('promoters.dossier.fields.profession')" name="profession">
            <UInput v-model="state.profession" class="w-full" />
          </UFormField>
          <UFormField :label="t('promoters.dossier.fields.yearsOfExperience')" name="yearsOfExperience">
            <UInput v-model="state.yearsOfExperience" inputmode="numeric" class="w-full" />
          </UFormField>
          <UFormField :label="t('promoters.dossier.fields.lastCompany')" name="lastCompany">
            <UInput v-model="state.lastCompany" class="w-full" />
          </UFormField>
          <UFormField :label="t('promoters.dossier.fields.lastPosition')" name="lastPosition">
            <UInput v-model="state.lastPosition" class="w-full" />
          </UFormField>
          <UFormField :label="t('promoters.dossier.fields.vehicle')" name="vehicle">
            <UInput v-model="state.vehicle" class="w-full" :placeholder="t('promoters.dossier.placeholders.vehicle')" />
          </UFormField>
        </div>
      </section>

      <div v-if="canEdit" class="flex justify-end">
        <UButton type="submit" color="primary" variant="outline" icon="i-lucide-save" :loading="saving">
          {{ t('common.save') }}
        </UButton>
      </div>
    </UForm>
  </div>
</template>
