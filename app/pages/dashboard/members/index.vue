<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { SelectItem } from '~/types/options'
import { toSelectItems } from '~/types/options'
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

const { t } = useI18n()
const { formatDate } = useFormatters()

useSeoMeta({ title: () => t('common.seoTitle', { page: t('members.title') }) })

const members = useMembers()
const { can } = usePermissions()
const toast = useToast()

const canCreate = computed(() => can('MEMBER_CREATE'))
const canUpdate = computed(() => can('MEMBER_UPDATE'))
const canDelete = computed(() => can('MEMBER_DELETE'))

// ---- List + pagination + search ----
const data = ref<MemberDto[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1) // UPagination is 1-based; the API is 0-based
const size = ref(20)
const search = ref('')

async function load() {
  loading.value = true
  try {
    const res = await members.list({
      page: page.value - 1,
      size: size.value,
      sort: 'enrolledAt,desc',
      // The backend exposes free-text search (trigram, accent-insensitive)
      q: search.value.trim() || undefined,
    })
    data.value = res.content ?? []
    total.value = res.totalElements ?? 0
  }
  catch {
    // useApi already shows the error toast
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

// Member status badge/select label; falls back to the raw value.
function statusLabel(s?: string | null): string {
  return s ? t(`members.status.${s}`, s) : t('common.empty')
}

// ---- Catalogs for the form selects ----
const genderOptions = ref<SelectItem[]>([])
const maritalStatusOptions = ref<SelectItem[]>([])
const occupationOptions = ref<SelectItem[]>([])
const stateOptions = ref<SelectItem[]>([])
const cityOptions = ref<SelectItem[]>([])
const { options: documentTypeOptions, load: loadDocumentTypes } = useDocumentTypes()

async function loadCatalogs() {
  // Admin catalog options (auth'd), all in parallel; each one fails silently.
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
}

// Cities cascade based on the selected state. `pendingCityUuid` lets openEdit
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

onMounted(async () => {
  await load()
  await Promise.all([loadCatalogs(), loadDocumentTypes()])
})

// ---- Create/edit form ----
const formOpen = ref(false)
const mode = ref<'create' | 'edit'>('create')
const editingUuid = ref<string | null>(null)
const isSubmitting = ref(false)
// The list returns a compact projection (MemberListItemDto); on edit the full detail
// is loaded, and this flag shows the loading state in the modal.
const editLoading = ref(false)

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
  return mode.value === 'create'
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
  selectedStateUuid.value = undefined
  pendingCityUuid.value = undefined
}

function openCreate() {
  mode.value = 'create'
  editingUuid.value = null
  resetForm()
  formOpen.value = true
}

async function openEdit(m: MemberDto) {
  mode.value = 'edit'
  editingUuid.value = m.uuid
  resetForm()
  formOpen.value = true
  // The list row (MemberListItemDto) only carries the full name, document, phone and
  // enrollment date; the rest (name parts, birth, gender, catalogs…) only comes in the
  // detail. The full record is loaded to populate.
  editLoading.value = true
  try {
    const full = await members.get(m.uuid)
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
    // The city select is populated by a cascade that keys off the selected state; set the
    // state first (from the embedded CityDto's own stateUuid) and stash the city so the
    // cascade watcher can apply it once that state's cities finish loading.
    pendingCityUuid.value = full.city?.uuid
    selectedStateUuid.value = full.city?.stateUuid
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
  }
  catch {
    // The detail failed to load (useApi already notified); close the modal.
    formOpen.value = false
  }
  finally {
    editLoading.value = false
  }
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
      toast.add({ title: t('members.createdToast'), color: 'success', icon: 'i-lucide-check-circle' })
    }
    else if (editingUuid.value) {
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
        notes: state.notes || undefined,
      }
      await members.update(editingUuid.value, body)
      toast.add({ title: t('members.updatedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    }
    formOpen.value = false
    await load()
  }
  catch {
    // useApi already notified the error (409 duplicate document, 422, etc.)
  }
  finally {
    isSubmitting.value = false
  }
}

// ---- Delete ----
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
    toast.add({ title: t('members.deletedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    deleteOpen.value = false
    // If the page is left empty after deleting, step back one.
    if (data.value.length === 1 && page.value > 1) page.value -= 1
    else await load()
  }
  catch {
    // toast handled by useApi
  }
  finally {
    deleting.value = false
  }
}

// ---- Presentation helpers ----
function displayName(m: MemberDto): string {
  if (m.fullName) return m.fullName
  return [m.firstName, m.middleName, m.lastName, m.secondLastName].filter(Boolean).join(' ') || t('common.empty')
}
</script>

<template>
  <div class="space-y-5">
    <!-- Header -->
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-extrabold text-prohealth-900">{{ t('members.title') }}</h1>
        <p class="text-sm text-prohealth-700/70 mt-1">
          {{ t('members.subtitle') }}
        </p>
      </div>
      <UTooltip :text="canCreate ? t('members.createTooltip') : t('members.noPermissionCreate')">
        <UButton
          color="primary"
          icon="i-lucide-user-plus"
          :disabled="!canCreate"
          @click="openCreate"
        >
          {{ t('members.new') }}
        </UButton>
      </UTooltip>
    </div>

    <!-- Search -->
    <div class="bg-white rounded-2xl border border-prohealth-100 p-4">
      <UInput
        v-model="search"
        :placeholder="t('members.searchPlaceholder')"
        icon="i-lucide-search"
        size="lg"
        class="w-full max-w-md"
      />
    </div>

    <!-- Table -->
    <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
              <th class="px-5 py-3 font-semibold">{{ t('members.columns.member') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('members.columns.document') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('members.columns.phone') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('members.columns.enrolledAt') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('members.columns.status') }}</th>
              <th class="px-5 py-3 font-semibold text-right">{{ t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-prohealth-100">
            <TableSkeleton v-if="loading" :rows="8" :cols="6" />
            <tr v-else-if="data.length === 0">
              <td colspan="6" class="px-5 py-12 text-center text-prohealth-500">
                <UIcon name="i-lucide-users" class="w-8 h-8 mx-auto mb-2 text-prohealth-300" />
                {{ t('members.empty') }}
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
                <div class="text-xs text-prohealth-500">{{ m.email || t('common.empty') }}</div>
              </td>
              <td class="px-5 py-3 text-prohealth-700">
                <span v-if="m.documentNumber">{{ m.documentType }} {{ m.documentNumber }}</span>
                <span v-else class="text-prohealth-400">{{ t('common.empty') }}</span>
              </td>
              <td class="px-5 py-3 text-prohealth-700">{{ m.phone || t('common.empty') }}</td>
              <td class="px-5 py-3 text-prohealth-600">{{ formatDate(m.enrolledAt, 'short') }}</td>
              <td class="px-5 py-3">
                <UBadge
                  :color="m.status === 'ACTIVE' ? 'success' : 'warning'"
                  variant="subtle"
                  size="sm"
                >
                  {{ m.status ? statusLabel(m.status) : t('common.empty') }}
                </UBadge>
              </td>
              <td class="px-5 py-3" @click.stop>
                <div class="flex items-center justify-end gap-1">
                  <UTooltip :text="t('members.viewDetailTooltip')">
                    <UButton
                      color="neutral"
                      variant="ghost"
                      icon="i-lucide-eye"
                      size="sm"
                      :to="`/dashboard/members/${m.uuid}`"
                    />
                  </UTooltip>
                  <UTooltip :text="canUpdate ? t('common.edit') : t('members.noPermissionEdit')">
                    <UButton
                      color="neutral"
                      variant="ghost"
                      icon="i-lucide-pencil"
                      size="sm"
                      :disabled="!canUpdate"
                      @click="openEdit(m)"
                    />
                  </UTooltip>
                  <UTooltip :text="canDelete ? t('common.delete') : t('members.noPermissionDelete')">
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

      <!-- Pagination -->
      <div class="flex items-center justify-between px-5 py-3 border-t border-prohealth-100">
        <p class="text-xs text-prohealth-500">
          {{ t('members.paginationSummary', { shown: data.length, total }) }}
        </p>
        <UPagination
          v-model:page="page"
          :total="total"
          :items-per-page="size"
        />
      </div>
    </div>

    <!-- Create/edit modal -->
    <UModal
      v-model:open="formOpen"
      :title="mode === 'create' ? t('members.form.createTitle') : t('members.form.editTitle')"
      :description="mode === 'create' ? t('members.form.createDescription') : t('members.form.editDescription')"
      :ui="{ content: 'max-w-2xl' }"
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

          <UFormField v-if="mode === 'edit'" :label="t('members.form.fields.status')" name="status">
            <USelectMenu
              v-model="state.status"
              :items="statusOptions"
              label-key="label"
              value-key="value"
              class="w-full"
            />
          </UFormField>

          <UFormField :label="t('members.form.fields.notes')" name="notes">
            <UTextarea v-model="state.notes" :rows="2" class="w-full" />
          </UFormField>

          <div class="flex items-center justify-between gap-3 pt-2">
            <p class="text-xs text-prohealth-500">{{ t('common.requiredFieldsHint') }}</p>
            <div class="flex items-center gap-3">
              <UButton color="neutral" variant="ghost" :disabled="isSubmitting" @click="formOpen = false">
                {{ t('common.cancel') }}
              </UButton>
              <UButton type="submit" color="primary" :loading="isSubmitting" icon="i-lucide-save">
                {{ mode === 'create' ? t('members.form.submitCreate') : t('common.saveChanges') }}
              </UButton>
            </div>
          </div>
        </UForm>
      </template>
    </UModal>

    <!-- Delete confirmation modal -->
    <UModal v-model:open="deleteOpen" :title="t('members.delete.title')">
      <template #body>
        <i18n-t keypath="members.delete.confirm" tag="p" class="text-sm text-prohealth-700" scope="global">
          <template #name>
            <span class="font-semibold">{{ target ? displayName(target) : '' }}</span>
          </template>
          <template #document>
            {{ target?.documentType }} {{ target?.documentNumber }}
          </template>
        </i18n-t>
        <div class="flex items-center justify-end gap-3 pt-5">
          <UButton color="neutral" variant="ghost" :disabled="deleting" @click="deleteOpen = false">
            {{ t('common.cancel') }}
          </UButton>
          <UButton color="error" :loading="deleting" icon="i-lucide-trash-2" @click="confirmDelete">
            {{ t('common.delete') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
