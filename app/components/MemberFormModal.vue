<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { SelectItem } from '~/types/options'
import { toSelectItems } from '~/types/options'
import type {
  CreateMemberRequest,
  MemberDto,
  MemberListItemDto,
  UpdateMemberRequest,
} from '~/types/members'

type MemberRow = MemberListItemDto | MemberDto

// Shared create/edit form, used by both members/index.vue (row actions) and
// members/[uuid].vue ("Editar" button) so the latter no longer has to navigate
// away to the list page just to reopen the modal.
const props = defineProps<{
  open: boolean
  mode: 'create' | 'edit'
  /**
   * The list row (MemberListItemDto) only carries the full name, document, phone
   * and enrollment date; the full detail is (re-)fetched by uuid before the form
   * is populated, whichever shape is passed in.
   */
  member: MemberRow | null
  canDelete: boolean
}>()

const emit = defineEmits<{
  'update:open': [boolean]
  saved: [MemberDto]
  restored: [MemberRow]
  'delete-requested': [MemberRow]
}>()

const { t } = useI18n()
const members = useMembers()
const toast = useToast()

const isOpen = computed({
  get: () => props.open,
  set: v => emit('update:open', v),
})

const isSubmitting = ref(false)
const editLoading = ref(false)

// ---- Lazy-loaded catalogs, fetched only when the modal opens ----
const genderOptions = ref<SelectItem[]>([])
const maritalStatusOptions = ref<SelectItem[]>([])
const occupationOptions = ref<SelectItem[]>([])
const stateOptions = ref<SelectItem[]>([])
const cityOptions = ref<SelectItem[]>([])
const { options: documentTypeOptions, load: loadDocumentTypes } = useDocumentTypes()
const catalogsLoaded = ref(false)

async function loadCatalogs() {
  if (catalogsLoaded.value) return
  const safeOptions = async (resource: string, limit = 200) => {
    try {
      return await useCatalogOptions(resource).options({ limit })
    }
    catch {
      return []
    }
  }
  const [genders, marital, occupations, states] = await Promise.all([
    safeOptions('genders'),
    safeOptions('marital-statuses'),
    safeOptions('occupations'),
    safeOptions('states'),
  ])
  genderOptions.value = toSelectItems(genders)
  maritalStatusOptions.value = toSelectItems(marital)
  occupationOptions.value = toSelectItems(occupations)
  stateOptions.value = toSelectItems(states)
  await loadDocumentTypes()
  catalogsLoaded.value = true
}

// Cities cascade based on the selected state. `pendingCityUuid` lets populateEditForm
// preselect a city once its state's cities finish loading — otherwise the watcher's
// reset below would wipe the value the instant `selectedStateUuid` is set.
const selectedStateUuid = ref<string | undefined>(undefined)
const pendingCityUuid = ref<string | undefined>(undefined)
watch(selectedStateUuid, async (stateUuid) => {
  const keepCityUuid = pendingCityUuid.value
  pendingCityUuid.value = undefined
  cityOptions.value = []
  state.cityUuid = undefined
  if (!stateUuid) return
  try {
    const cities = await useCatalogOptions('cities').options({ parentUuid: stateUuid, limit: 200 })
    cityOptions.value = toSelectItems(cities)
    if (keepCityUuid) state.cityUuid = keepCityUuid
  }
  catch {
    cityOptions.value = []
  }
})

function statusLabel(s?: string | null): string {
  return s ? t(`members.status.${s}`, s) : t('common.empty')
}
const STATUS_OPTIONS = ['ACTIVE', 'INACTIVE', 'SUSPENDED']
const statusOptions = computed(() => STATUS_OPTIONS.map(s => ({ label: statusLabel(s), value: s })))

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
// Kept outside `state` (a string-only-friendly form-state map) so the boolean isn't coerced.
// Distinct from `state.status` (business workflow value) — this is the soft-delete/reactivation flag.
const isActive = ref(true)

/** The holder must be of legal age (@MinimumAge=18 in the backend). */
function isAdult(iso: string): boolean {
  const birth = new Date(iso)
  if (Number.isNaN(birth.getTime())) return false
  const cutoff = new Date()
  cutoff.setFullYear(cutoff.getFullYear() - 18)
  return birth <= cutoff
}

// Locale-reactive schema so validation messages follow the UI locale.
const schema = computed(() => {
  const base = {
    firstName: z.string().min(2, t('validation.minChars', { n: 2 })),
    middleName: z.string().optional(),
    lastName: z.string().min(2, t('validation.minChars', { n: 2 })),
    secondLastName: z.string().optional(),
    birthDate: z.string().min(1, t('validation.required')).refine(isAdult, t('members.form.validation.adult')),
    birthplace: z.string().optional(),
    numberOfChildren: z.string().regex(/^\d*$/, t('validation.digitsOnly')).optional(),
    spouseName: z.string().optional(),
    phone: z.string().optional(),
    landlinePhone: z.string().optional(),
    email: z.string().email(t('validation.emailInvalid')).optional().or(z.literal('')),
    address: z.string().optional(),
    employerName: z.string().optional(),
    jobPosition: z.string().optional(),
    employerAddress: z.string().optional(),
    enrolledAt: z.string().optional(),
    notes: z.string().optional(),
  }
  const document = {
    documentType: z.string({ message: t('validation.required') }).min(1, t('validation.required')),
    documentNumber: z.string().min(5, t('members.form.validation.documentMin')).regex(/^\d+$/, t('validation.digitsOnly')),
  }
  return props.mode === 'create'
    ? z.object({ ...base, ...document })
    : z.object({ ...base, ...document, status: z.string() })
})

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
  isActive.value = true
  selectedStateUuid.value = undefined
  pendingCityUuid.value = undefined
}

// Snapshot of the last-loaded edit state, used to warn before a refresh
// discards unsaved changes.
const editSnapshot = ref('')
function snapEditState() { return JSON.stringify({ ...state, isActive: isActive.value, selectedStateUuid: selectedStateUuid.value }) }
const isEditDirty = computed(() => editSnapshot.value !== '' && snapEditState() !== editSnapshot.value)
const discardConfirmOpen = ref(false)

function populateEditForm(full: MemberDto) {
  state.firstName = full.firstName ?? ''
  state.middleName = full.middleName ?? ''
  state.lastName = full.lastName ?? ''
  state.secondLastName = full.secondLastName ?? ''
  state.documentType = full.documentType || undefined
  state.documentNumber = full.documentNumber ?? ''
  state.birthDate = full.birthDate ?? ''
  state.genderUuid = full.gender?.uuid
  state.maritalStatusUuid = full.maritalStatus?.uuid
  state.occupationUuid = full.occupation?.uuid
  pendingCityUuid.value = full.city?.uuid
  selectedStateUuid.value = full.city?.state_Uuid ?? undefined
  state.birthplace = full.birthplace ?? ''
  state.numberOfChildren = full.numberOfChildren != null ? String(full.numberOfChildren) : ''
  state.spouseName = full.spouseName ?? ''
  state.phone = full.phone ?? ''
  state.landlinePhone = full.landlinePhone ?? ''
  state.email = full.email ?? ''
  state.address = full.address ?? ''
  state.employerName = full.employerName ?? ''
  state.jobPosition = full.jobPosition ?? ''
  state.employerAddress = full.employerAddress ?? ''
  state.enrolledAt = full.enrolledAt ?? ''
  state.status = full.status || 'ACTIVE'
  state.notes = full.notes ?? ''
  isActive.value = full.active ?? true
  editSnapshot.value = snapEditState()
}

// Populate/reset the form whenever the modal opens (mode/member are set by the parent beforehand).
watch(() => props.open, async (open) => {
  if (!open) return
  await loadCatalogs()
  resetForm()
  editSnapshot.value = ''
  if (props.mode !== 'edit' || !props.member) return
  // The list row (MemberListItemDto) only carries the full name, document, phone and
  // enrollment date; the rest (name parts, birth, gender, catalogs…) only comes in the
  // detail. Always (re-)fetch the full record so the form is populated reliably either way.
  editLoading.value = true
  try {
    populateEditForm(await members.get(props.member.uuid))
  }
  catch {
    // The detail failed to load (useApi already notified); close the modal.
    isOpen.value = false
  }
  finally {
    editLoading.value = false
  }
})

async function reloadEditForm() {
  if (!props.member) return
  editLoading.value = true
  try { populateEditForm(await members.get(props.member.uuid)) }
  catch { /* useApi already notified */ }
  finally { editLoading.value = false }
}
function onEditRefresh() {
  if (isEditDirty.value) discardConfirmOpen.value = true
  else reloadEditForm()
}
function discardAndRefresh() {
  discardConfirmOpen.value = false
  reloadEditForm()
}

async function onSubmit(_event: FormSubmitEvent<Record<string, unknown>>) {
  isSubmitting.value = true
  try {
    let saved: MemberDto
    if (props.mode === 'create') {
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
      saved = await members.create(body)
      toast.add({ title: t('members.createdToast'), color: 'success', icon: 'i-lucide-check-circle' })
    }
    else {
      if (!props.member) return
      const body: UpdateMemberRequest = {
        firstName: state.firstName,
        middleName: state.middleName || undefined,
        lastName: state.lastName,
        secondLastName: state.secondLastName || undefined,
        documentType: state.documentType,
        documentNumber: state.documentNumber,
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
        active: isActive.value,
        notes: state.notes || undefined,
      }
      saved = await members.update(props.member.uuid, body)
      toast.add({ title: t('members.updatedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    }
    isOpen.value = false
    emit('saved', saved)
  }
  catch {
    // useApi already notified the error (409 duplicate document, 422, etc.)
  }
  finally {
    isSubmitting.value = false
  }
}

const restoring = ref(false)
async function restoreMember() {
  if (!props.member) return
  restoring.value = true
  try {
    await members.update(props.member.uuid, { active: true })
    toast.add({ title: t('members.restoredToast'), color: 'success', icon: 'i-lucide-check-circle' })
    isOpen.value = false
    emit('restored', props.member)
  }
  catch {
    // toast handled by useApi
  }
  finally {
    restoring.value = false
  }
}

function requestDelete() {
  if (!props.member) return
  isOpen.value = false
  emit('delete-requested', props.member)
}
</script>

<template>
  <UModal
    v-model:open="isOpen"
    :title="mode === 'create' ? t('members.form.createTitle') : t('members.form.editTitle')"
    :description="mode === 'create' ? t('members.form.createDescription') : t('members.form.editDescription')"
    :ui="{ content: 'max-w-3xl' }"
  >
    <template #body>
      <div v-if="editLoading" class="py-12 flex flex-col items-center justify-center gap-2 text-prohealth-500">
        <UIcon name="i-lucide-loader-circle" class="w-6 h-6 animate-spin" />
        <span class="text-sm">{{ t('members.form.loadingDetail') }}</span>
      </div>
      <UForm
        v-else
        :schema="schema"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('members.form.fields.firstName')" name="firstName" required>
            <UInput v-model="state.firstName" class="w-full" />
          </UFormField>
          <UFormField :label="t('members.form.fields.middleName')" name="middleName">
            <UInput v-model="state.middleName" class="w-full" />
          </UFormField>
          <UFormField :label="t('members.form.fields.lastName')" name="lastName" required>
            <UInput v-model="state.lastName" class="w-full" />
          </UFormField>
          <UFormField :label="t('members.form.fields.secondLastName')" name="secondLastName">
            <UInput v-model="state.secondLastName" class="w-full" />
          </UFormField>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('members.form.fields.documentType')" name="documentType" required>
            <USelectMenu
              v-model="state.documentType"
              :items="documentTypeOptions"
              label-key="label"
              value-key="value"
              :placeholder="t('common.select')"
              class="w-full"
            />
          </UFormField>
          <UFormField :label="t('members.form.fields.documentNumber')" name="documentNumber" required>
            <UInput v-model="state.documentNumber" class="w-full" />
          </UFormField>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('members.form.fields.birthDate')" name="birthDate" required>
            <UInput v-model="state.birthDate" type="date" class="w-full" />
          </UFormField>
          <UFormField :label="t('members.form.fields.enrolledAt')" name="enrolledAt">
            <UInput v-model="state.enrolledAt" type="date" class="w-full" />
          </UFormField>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('members.form.fields.gender')" name="genderUuid">
            <USelectMenu
              v-model="state.genderUuid"
              :items="genderOptions"
              label-key="label"
              value-key="value"
              :placeholder="t('common.select')"
              class="w-full"
            />
          </UFormField>
          <UFormField :label="t('members.form.fields.maritalStatus')" name="maritalStatusUuid">
            <USelectMenu
              v-model="state.maritalStatusUuid"
              :items="maritalStatusOptions"
              label-key="label"
              value-key="value"
              :placeholder="t('common.select')"
              class="w-full"
            />
          </UFormField>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('members.form.fields.birthplace')" name="birthplace">
            <UInput v-model="state.birthplace" class="w-full" />
          </UFormField>
          <UFormField :label="t('members.form.fields.numberOfChildren')" name="numberOfChildren">
            <UInput v-model="state.numberOfChildren" type="number" min="0" class="w-full" />
          </UFormField>
        </div>

        <UFormField :label="t('members.form.fields.spouseName')" name="spouseName">
          <UInput v-model="state.spouseName" class="w-full" />
        </UFormField>

        <UFormField :label="t('members.form.fields.occupation')" name="occupationUuid">
          <USelectMenu
            v-model="state.occupationUuid"
            :items="occupationOptions"
            label-key="label"
            value-key="value"
            :placeholder="t('common.select')"
            class="w-full"
          />
        </UFormField>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('members.form.fields.employerName')" name="employerName">
            <UInput v-model="state.employerName" class="w-full" />
          </UFormField>
          <UFormField :label="t('members.form.fields.jobPosition')" name="jobPosition">
            <UInput v-model="state.jobPosition" class="w-full" />
          </UFormField>
        </div>

        <UFormField :label="t('members.form.fields.employerAddress')" name="employerAddress">
          <UInput v-model="state.employerAddress" class="w-full" />
        </UFormField>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('members.form.fields.phone')" name="phone">
            <UInput v-model="state.phone" class="w-full" />
          </UFormField>
          <UFormField :label="t('members.form.fields.landlinePhone')" name="landlinePhone">
            <UInput v-model="state.landlinePhone" class="w-full" />
          </UFormField>
        </div>

        <UFormField :label="t('members.form.fields.email')" name="email">
          <UInput v-model="state.email" type="email" class="w-full" />
        </UFormField>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('members.form.fields.state')" name="stateUuid">
            <USelectMenu
              v-model="selectedStateUuid"
              :items="stateOptions"
              label-key="label"
              value-key="value"
              :placeholder="t('common.select')"
              class="w-full"
            />
          </UFormField>
          <UFormField :label="t('members.form.fields.city')" name="cityUuid">
            <USelectMenu
              v-model="state.cityUuid"
              :items="cityOptions"
              label-key="label"
              value-key="value"
              :disabled="!selectedStateUuid"
              :placeholder="t('members.form.selectCityFirst')"
              class="w-full"
            />
          </UFormField>
        </div>

        <UFormField :label="t('members.form.fields.address')" name="address">
          <UInput v-model="state.address" class="w-full" />
        </UFormField>

        <div v-if="mode === 'edit'" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('members.form.fields.status')" name="status">
            <USelectMenu
              v-model="state.status"
              :items="statusOptions"
              label-key="label"
              value-key="value"
              class="w-full"
            />
          </UFormField>
          <UFormField :label="t('members.form.fields.active')">
            <USwitch v-model="isActive" />
          </UFormField>
        </div>

        <UFormField :label="t('members.form.fields.notes')" name="notes">
          <UTextarea v-model="state.notes" :rows="2" class="w-full" />
        </UFormField>

        <p class="text-xs text-prohealth-500">{{ t('common.requiredFieldsHint') }}</p>

        <div class="flex items-center justify-between gap-3 pt-2">
          <div v-if="mode === 'edit' && member">
            <RestoreButton
              v-if="member.active === false"
              :active="member.active"
              :allowed="canDelete"
              :loading="restoring"
              :disabled="isSubmitting"
              @restore="restoreMember"
            />
            <UTooltip v-else :text="canDelete ? t('common.delete') : t('members.noPermissionDelete')">
              <UButton
                color="error"
                variant="ghost"
                icon="i-lucide-trash-2"
                size="sm"
                :label="t('common.delete')"
                :disabled="isSubmitting || !canDelete"
                @click="requestDelete"
              />
            </UTooltip>
          </div>
          <div v-else />

          <div class="flex items-center gap-3">
            <RefreshButton
              v-if="mode === 'edit'"
              :icon-only="false"
              :label="t('common.refresh')"
              :title="t('common.refresh')"
              :loading="editLoading"
              :disabled="isSubmitting"
              @refresh="onEditRefresh"
            />
            <UButton color="neutral" variant="ghost" :disabled="isSubmitting" @click="isOpen = false">
              {{ t('common.cancel') }}
            </UButton>
            <UButton type="submit" :color="mode === 'create' ? 'primary' : 'info'" variant="outline" :loading="isSubmitting" icon="i-lucide-save">
              {{ mode === 'create' ? t('common.saveNew') : t('common.saveChanges') }}
            </UButton>
          </div>
        </div>
      </UForm>

      <!-- Discard unsaved changes before refreshing -->
      <UModal v-model:open="discardConfirmOpen" :title="t('common.discardChangesTitle')">
        <template #body>
          <p class="text-sm text-prohealth-700">{{ t('common.discardChangesBody') }}</p>
          <div class="flex items-center justify-end gap-3 pt-5">
            <UButton color="neutral" variant="ghost" @click="discardConfirmOpen = false">{{ t('common.cancel') }}</UButton>
            <UButton color="warning" icon="i-lucide-refresh-cw" @click="discardAndRefresh">{{ t('common.discardAndRefresh') }}</UButton>
          </div>
        </template>
      </UModal>
    </template>
  </UModal>
</template>
