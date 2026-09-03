<script setup lang="ts">
import { buildPageSizeItems, DEFAULT_PAGE_SIZE, UNPAGED_PAGE_SIZE } from '~/utils/pagination'
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
import type { SortDirection } from '~/composables/useTableSort'

definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'MEMBER_VIEW_ALL',
})

const { t } = useI18n()

useSeoMeta({ title: () => t('common.seoTitle', { page: t('members.title') }) })

const members = useMembers()
const { can } = usePermissions()
const toast = useToast()

const canCreate = computed(() => can('MEMBER_CREATE'))
const canUpdate = computed(() => can('MEMBER_UPDATE'))
const canDelete = computed(() => can('MEMBER_DELETE'))
const canViewAuditChanges = computed(() => can('AUDIT_VIEW_ALL') || can('MEMBER_RECORD_AUDIT_VIEW'))
const canViewAuditReports = computed(() => can('REPORT_AUDIT_VIEW_ALL') || can('MEMBER_REPORT_AUDIT_VIEW'))
const canViewAudit = computed(() => canViewAuditChanges.value || canViewAuditReports.value)

const auditOpen = ref(false)
const auditTarget = ref<MemberListItemDto | null>(null)

function openAudit(m: MemberListItemDto) {
  auditTarget.value = m
  auditOpen.value = true
}

// ---- List + pagination + search ----
const data = ref<MemberListItemDto[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1) // UPagination is 1-based; the API is 0-based
const size = ref(DEFAULT_PAGE_SIZE)
const pageSizeItems = buildPageSizeItems(t)
const search = ref('')
const includeInactive = ref(false)
// Empty by default: no `sort=` is sent until the user clicks a column, so
// the backend's own default-sort fallback (entity_config → system_configs
// → enrolledAt DESC) applies.
const sort = useTableSort([])
const hasActiveSort = computed(() => sort.orders.value.length > 0)
const isMultiSort = computed(() => sort.orders.value.length > 1)

async function load() {
  loading.value = true
  try {
    const res = await members.list({
      page: page.value - 1,
      size: size.value,
      sort: sort.sortParam.value,
      // The backend exposes free-text search (trigram, accent-insensitive)
      q: search.value.trim() || undefined,
      includeInactive: includeInactive.value,
    })
    data.value = res.content ?? []
    total.value = res.totalElements ?? 0
    // No column clicked yet → reflect the server's own default in the header arrows.
    if (sort.orders.value.length === 0 && res.appliedSort?.length) {
      resetting.value = true
      sort.seedServerDefault(res.appliedSort.map(o => ({ field: o.field, direction: o.direction.toLowerCase() as SortDirection })))
      await nextTick()
      resetting.value = false
    }
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

// Guards the filter watchers so "clear filters and refresh" fires a single reload.
const resetting = ref(false)

watch(size, () => { if (!resetting.value) page.value = 1 })
watch([page, size], () => { if (!resetting.value) load() })
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, () => {
  if (resetting.value) return
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    load()
  }, 400)
})
watch(includeInactive, () => { if (!resetting.value) { page.value = 1; load() } })
watch(sort.orders, () => { if (!resetting.value) load() }, { deep: true })

async function resetFilters() {
  resetting.value = true
  search.value = ''
  includeInactive.value = false
  sort.reset()
  size.value = DEFAULT_PAGE_SIZE
  page.value = 1
  await nextTick()
  resetting.value = false
  load()
}

// Member status select label (form dropdown, not server-resolved); falls back to the raw value.
function statusLabel(s?: string | null): string {
  return s ? t(`members.status.${s}`, s) : t('common.empty')
}

// Effective status label for the table row: `active` (soft-delete flag) wins over the
// business `status` field, so a soft-deleted record always reads "Inactivo" instead of
// whatever business status it happened to have. Prefers the server-resolved `_Display`
// siblings (hub ADR 0014) over local i18n lookups.
function effectiveStatusLabel(m: MemberListItemDto): string {
  if (m.active === false) return m.active_Display ?? t('members.status.INACTIVE')
  return m.status_Display ?? t('common.empty')
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

// `?edit=<uuid>` lets the member detail page ("Editar" button) reopen this
// modal without duplicating the create/edit form on a second page.
const route = useRoute()

onMounted(async () => {
  await load()
  await Promise.all([loadCatalogs(), loadDocumentTypes()])
  const editUuid = route.query.edit
  if (typeof editUuid === 'string') {
    try {
      await openEdit({ uuid: editUuid } as MemberListItemDto)
    }
    catch {
      // Invalid/removed uuid: silently ignore, stay on the list.
    }
  }
})

// ---- Create/edit form ----
const formOpen = ref(false)
const mode = ref<'create' | 'edit'>('create')
const editingUuid = ref<string | null>(null)
const editingItem = ref<MemberListItemDto | null>(null)
const isSubmitting = ref(false)
// The list returns a compact projection (MemberListItemDto); on edit the full detail
// is loaded, and this flag shows the loading state in the modal.
const editLoading = ref(false)
const restoring = ref(false)

async function restoreMember(m: MemberListItemDto) {
  restoring.value = true
  try {
    await members.update(m.uuid, { active: true })
    toast.add({ title: t('members.restoredToast'), color: 'success', icon: 'i-lucide-check-circle' })
    formOpen.value = false
    await load()
  }
  catch {
    // toast handled by useApi
  }
  finally {
    restoring.value = false
  }
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
  isActive.value = true
  selectedStateUuid.value = undefined
  pendingCityUuid.value = undefined
}

function openCreate() {
  mode.value = 'create'
  editingUuid.value = null
  resetForm()
  formOpen.value = true
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
  // The city select is populated by a cascade that keys off the selected state; set the
  // state first (from the embedded CityDto's own stateUuid) and stash the city so the
  // cascade watcher can apply it once that state's cities finish loading.
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

async function openEdit(m: MemberListItemDto) {
  mode.value = 'edit'
  editingUuid.value = m.uuid
  editingItem.value = m
  resetForm()
  formOpen.value = true
  // The list row (MemberListItemDto) only carries the full name, document, phone and
  // enrollment date; the rest (name parts, birth, gender, catalogs…) only comes in the
  // detail. The full record is loaded to populate.
  editLoading.value = true
  try {
    populateEditForm(await members.get(m.uuid))
  }
  catch {
    // The detail failed to load (useApi already notified); close the modal.
    formOpen.value = false
  }
  finally {
    editLoading.value = false
  }
}

async function reloadEditForm() {
  if (!editingUuid.value) return
  editLoading.value = true
  try { populateEditForm(await members.get(editingUuid.value)) }
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
        active: isActive.value,
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
const target = ref<MemberListItemDto | null>(null)
const usageChecking = ref(false)
const usageInfo = ref<{ inUse: boolean, count: number } | null>(null)

async function openDelete(m: MemberListItemDto) {
  target.value = m
  deleteOpen.value = true
  usageChecking.value = true
  usageInfo.value = null
  try {
    usageInfo.value = await members.usage(m.uuid)
  }
  catch {
    // Fallback: treat as "in use" for safety (soft-deactivate instead of physical delete).
    usageInfo.value = null
  }
  finally {
    usageChecking.value = false
  }
}

// Shortcut from the edit modal so the user doesn't have to close it first
// and hunt for the row's trash icon. Closes the edit modal so the two
// dialogs never stack.
function openDeleteFromEdit() {
  if (!editingItem.value) return
  formOpen.value = false
  openDelete(editingItem.value)
}

async function confirmDelete() {
  if (!target.value) return
  deleting.value = true
  const wasPhysical = usageInfo.value?.inUse === false
  try {
    await members.remove(target.value.uuid, wasPhysical)
    toast.add({
      title: wasPhysical
        ? t('members.deletedPermanentToast')
        : t('members.deactivatedToast'),
      color: wasPhysical ? 'success' : 'info',
      icon: wasPhysical ? 'i-lucide-check-circle' : 'i-lucide-info',
    })
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
function displayName(m: MemberListItemDto): string {
  return m.fullName || t('common.empty')
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
      <div class="flex items-center gap-2">
        <ListRefreshMenu :loading="loading" variant="ghost" @refresh="load" @reset="resetFilters" />
        <ReportPrintButton variant="ghost" />
        <UTooltip :text="canCreate ? t('members.createTooltip') : t('members.noPermissionCreate')">
          <UButton
            color="primary"
            variant="outline"
            icon="i-lucide-plus"
            :disabled="!canCreate"
            @click="openCreate"
          >
            {{ t('common.new') }}
          </UButton>
        </UTooltip>
      </div>
    </div>

    <!-- Search -->
    <div class="bg-white rounded-2xl border border-prohealth-100 p-4 flex flex-wrap items-center gap-3">
      <UInput
        v-model="search"
        :placeholder="t('members.searchPlaceholder')"
        icon="i-lucide-search"
        size="lg"
        class="w-full max-w-md"
      />
      <UCheckbox v-model="includeInactive" :label="$t('catalogs.includeInactive')" class="self-center" />
      <UButton
        v-if="hasActiveSort"
        variant="link"
        color="neutral"
        size="sm"
        icon="i-lucide-list-restart"
        :title="t('common.clearSortHint')"
        @click="sort.reset()"
      >
        {{ t('common.clearSort') }}
      </UButton>
    </div>

    <!-- Table -->
    <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden flex flex-col h-[calc(100vh-19rem)] min-h-[24rem]">
      <div class="overflow-auto flex-1">
        <table class="w-full text-sm">
          <thead class="sticky top-0 bg-white z-10">
            <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('fullName')">
                {{ t('members.columns.member') }}
                <SortIndicator :state="sort.stateOf('fullName')" :multi-active="isMultiSort" @clear="sort.remove('fullName')" />
              </th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('documentNumber')">
                {{ t('members.columns.document') }}
                <SortIndicator :state="sort.stateOf('documentNumber')" :multi-active="isMultiSort" @clear="sort.remove('documentNumber')" />
              </th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('phone')">
                {{ t('members.columns.phone') }}
                <SortIndicator :state="sort.stateOf('phone')" :multi-active="isMultiSort" @clear="sort.remove('phone')" />
              </th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('enrolledAt')">
                {{ t('members.columns.enrolledAt') }}
                <SortIndicator :state="sort.stateOf('enrolledAt')" :multi-active="isMultiSort" @clear="sort.remove('enrolledAt')" />
              </th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('currentPromoter_Display')">
                {{ t('members.columns.promoter') }}
                <SortIndicator :state="sort.stateOf('currentPromoter_Display')" :multi-active="isMultiSort" @clear="sort.remove('currentPromoter_Display')" />
              </th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('status')">
                {{ t('members.columns.status') }}
                <SortIndicator :state="sort.stateOf('status')" :multi-active="isMultiSort" @clear="sort.remove('status')" />
              </th>
              <th class="px-5 py-3 font-semibold text-right">{{ t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-prohealth-100">
            <TableSkeleton v-if="loading" :rows="8" :cols="7" />
            <tr v-else-if="data.length === 0">
              <td colspan="7" class="px-5 py-12 text-center text-prohealth-500">
                <UIcon name="i-lucide-users" class="w-8 h-8 mx-auto mb-2 text-prohealth-300" />
                {{ t('members.empty') }}
              </td>
            </tr>
            <tr
              v-for="m in data"
              v-else
              :key="m.uuid"
              class="hover:bg-prohealth-50/50 cursor-pointer"
              :class="{ 'opacity-60': m.active === false }"
              @click="navigateTo(`/dashboard/members/${m.uuid}`)"
            >
              <td class="px-5 py-3">
                <div class="font-semibold text-prohealth-900">{{ displayName(m) }}</div>
              </td>
              <td class="px-5 py-3 text-prohealth-700">
                <span v-if="m.documentNumber">{{ m.documentType }} {{ m.documentNumber }}</span>
                <span v-else class="text-prohealth-400">{{ t('common.empty') }}</span>
              </td>
              <td class="px-5 py-3 text-prohealth-700">{{ m.phone || t('common.empty') }}</td>
              <td class="px-5 py-3 text-prohealth-600">{{ m.enrolledAt_Display || t('common.empty') }}</td>
              <td class="px-5 py-3" @click.stop>
                <NuxtLink
                  v-if="m.currentPromoter_Uuid"
                  :to="`/dashboard/promoters/${m.currentPromoter_Uuid}`"
                  class="text-primary-600 hover:underline"
                >
                  {{ m.currentPromoter_Display || t('common.empty') }}
                </NuxtLink>
                <span v-else class="text-prohealth-400">{{ t('common.empty') }}</span>
              </td>
              <td class="px-5 py-3">
                <UBadge
                  :color="m.active === false ? 'neutral' : (m.status === 'ACTIVE' ? 'success' : 'warning')"
                  variant="subtle"
                  size="sm"
                >
                  {{ effectiveStatusLabel(m) }}
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
                      color="info"
                      variant="ghost"
                      icon="i-lucide-pencil"
                      size="sm"
                      :disabled="!canUpdate"
                      @click="openEdit(m)"
                    />
                  </UTooltip>
                  <ReportPrintButton
                    table-name="members"
                    :record-uuid="m.uuid"
                    icon-only
                    variant="ghost"
                    size="sm"
                  />
                  <UTooltip v-if="canViewAudit" :text="t('audit.trigger')">
                    <UButton
                      color="neutral"
                      variant="ghost"
                      icon="i-lucide-history"
                      size="sm"
                      @click="openAudit(m)"
                    />
                  </UTooltip>
                  <UTooltip :text="canDelete ? t('common.delete') : t('members.noPermissionDelete')">
                    <UButton
                      color="error"
                      variant="ghost"
                      icon="i-lucide-trash-2"
                      size="sm"
                      class="ms-2"
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
      <div class="flex items-center flex-wrap justify-between gap-3 px-5 py-3 border-t border-prohealth-100 shrink-0">
        <p class="text-xs text-prohealth-500">
          {{ t('members.paginationSummary', { shown: data.length, total }) }}
        </p>
        <div class="flex items-center gap-3">
          <UPagination
            v-if="size !== UNPAGED_PAGE_SIZE"
            v-model:page="page"
            :total="total"
            :items-per-page="size"
          />
          <UTooltip :text="$t('catalogs.pageSizeLabel')">
            <USelectMenu
              v-model="size"
              :items="pageSizeItems"
              label-key="label"
              value-key="value"
              icon="i-lucide-list"
              :search-input="false"
              :aria-label="$t('catalogs.pageSizeLabel')"
              class="w-40"
            />
          </UTooltip>
        </div>
      </div>
    </div>

    <!-- Create/edit modal -->
    <UModal
      v-model:open="formOpen"
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
            <div v-if="mode === 'edit' && editingItem">
              <RestoreButton
                v-if="editingItem.active === false"
                :active="editingItem.active"
                :allowed="canDelete"
                :loading="restoring"
                :disabled="isSubmitting"
                @restore="restoreMember(editingItem)"
              />
              <UTooltip v-else :text="canDelete ? t('common.delete') : t('members.noPermissionDelete')">
                <UButton
                  color="error"
                  variant="ghost"
                  icon="i-lucide-trash-2"
                  size="sm"
                  :label="t('common.delete')"
                  :disabled="isSubmitting || !canDelete"
                  @click="openDeleteFromEdit"
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
              <UButton color="neutral" variant="ghost" :disabled="isSubmitting" @click="formOpen = false">
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

    <!-- Delete confirmation modal -->
    <UModal v-model:open="deleteOpen" :title="t('members.delete.title')">
      <template #body>
        <div v-if="usageChecking" class="flex items-center gap-2 text-sm text-prohealth-600">
          <UIcon name="i-lucide-loader-2" class="w-4 h-4 animate-spin" />
          {{ t('common.loading') }}
        </div>
        <p v-else class="text-sm text-prohealth-700">
          {{
            usageInfo?.inUse === false
              ? t('members.deleteConfirmPermanent')
              : t('members.deleteConfirmDeactivate', { count: usageInfo?.count ?? 0 })
          }}
        </p>
        <div class="flex items-center justify-end gap-3 pt-5">
          <UButton color="neutral" variant="ghost" :disabled="deleting" @click="deleteOpen = false">
            {{ t('common.cancel') }}
          </UButton>
          <UButton color="error" :loading="deleting" :disabled="usageChecking" icon="i-lucide-trash-2" @click="confirmDelete">
            {{ t('common.delete') }}
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Audit modal -->
    <AuditModal
      v-if="auditTarget"
      v-model:open="auditOpen"
      entity-key="member"
      :entity-uuid="auditTarget.uuid"
      :entity-label="displayName(auditTarget)"
      :can-view-changes="canViewAuditChanges"
      :can-view-reports="canViewAuditReports"
    />
  </div>
</template>
