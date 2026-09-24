<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { ApiError } from '~/types/auth'
import type { CatalogItem } from '~/types/catalogs'
import type { CatalogRef } from '~/types/members'
import { toSelectItems } from '~/types/options'
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
} from '~/types/allies'

definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'ALLY_VIEW_ALL',
})

const { t } = useI18n()
const { formatCurrency, formatDate } = useFormatters()

useSeoMeta({ title: () => t('common.seoTitle', { page: t('allies.detail.seoPage') }) })

const route = useRoute()
const allyUuid = route.params.uuid as string

const allies = useAllies()
const { can } = usePermissions()
const toast = useToast()

const canUpdate = computed(() => can('ALLY_UPDATE'))
const canDelete = computed(() => can('ALLY_DELETE'))
const canViewAuditChanges = computed(() => can('AUDIT_VIEW_ALL') || can('ALLY_RECORD_AUDIT_VIEW'))
const canViewAuditReports = computed(() => can('REPORT_AUDIT_VIEW_ALL') || can('ALLY_REPORT_AUDIT_VIEW'))
const canViewAudit = computed(() => canViewAuditChanges.value || canViewAuditReports.value)
const auditOpen = ref(false)
const canViewAgreements = computed(() => can('ALLY_AGREEMENT_VIEW_ALL'))
const canViewUser = computed(() => can('USER_VIEW_ALL'))
const canCreateAgreements = computed(() => can('ALLY_AGREEMENT_CREATE'))
const canUpdateAgreements = computed(() => can('ALLY_AGREEMENT_UPDATE'))
const canDeleteAgreements = computed(() => can('ALLY_AGREEMENT_DELETE'))
const canViewStaff = computed(() => can('ALLY_USER_VIEW_ALL'))
const canCreateStaff = computed(() => can('ALLY_USER_CREATE'))
const canUpdateStaff = computed(() => can('ALLY_USER_UPDATE'))
const canDeleteStaff = computed(() => can('ALLY_USER_DELETE'))

// ---- Ally load ----
const ally = ref<AllyDto | null>(null)
const loading = ref(true)
const notFound = ref(false)

async function loadAlly() {
  loading.value = true
  try {
    ally.value = await allies.get(allyUuid)
    professions.value = ally.value.professions ?? []
    allyTypes.value = ally.value.allyTypes ?? []
  }
  catch (err) {
    if ((err as ApiError).status === 404) notFound.value = true
    ally.value = null
  }
  finally {
    loading.value = false
  }
}

const restoring = ref(false)

async function restoreAlly() {
  restoring.value = true
  try {
    await allies.restore(allyUuid)
    toast.add({ title: t('allies.restoredToast'), color: 'success', icon: 'i-lucide-check-circle' })
    await loadAlly()
  }
  catch {
    // toast handled by useApi
  }
  finally {
    restoring.value = false
  }
}

// ---- Edit (local modal, no navigation away from the detail page) ----
const editFormOpen = ref(false)
function onAllySaved(updated: AllyDto) {
  ally.value = updated
  professions.value = updated.professions ?? []
  allyTypes.value = updated.allyTypes ?? []
}
function onAllyRestored() {
  loadAlly()
}
function onAllyDeleteRequested() {
  navigateTo(`/dashboard/allies?delete=${allyUuid}`)
}

// Date in the VE convention (useFormatters). Empty → '—'.
function date(iso?: string | null): string {
  return formatDate(iso, 'short')
}

// Amount in USD, formatted in the VE convention. Empty → '—'.
function money(v?: string | null): string {
  if (v === null || v === undefined || v === '') return t('common.empty')
  return formatCurrency(Number(v), 'USD')
}

// ---- Enum label resolvers (fall back to the raw value) ----
function allyStatusLabel(s?: string | null): string {
  return s ? t(`allies.status.${s}`, s) : t('common.empty')
}
function agrTypeLabel(type?: string | null): string {
  return type ? t(`allies.agreements.types.${type}`, type) : t('common.empty')
}
function agreementStatusLabel(s?: string | null): string {
  return s ? t(`allies.agreements.status.${s}`, s) : t('common.empty')
}
function roleLabel(role?: string | null): string {
  return role ? t(`allies.staff.roles.${role}`, role) : t('common.empty')
}
function reviewStatusLabel(s?: string | null): string {
  return s ? t(`allies.services.reviewStatus.${s}`, s) : t('common.empty')
}
function staffStatusLabel(s?: string | null): string {
  return s ? t(`allies.staff.status.${s}`, s) : t('common.empty')
}

// Localized enum options for the selects.
const agreementTypeOptions = computed(() => AGREEMENT_TYPE_OPTIONS.map(o => ({ label: t(o.labelKey), value: o.value })))
const allyRoleOptions = computed(() => ALLY_ROLE_OPTIONS.map(o => ({ label: t(o.labelKey), value: o.value })))
const AGR_STATUS_OPTIONS = ['ACTIVE', 'EXPIRED', 'TERMINATED']
const agrStatusOptions = computed(() => AGR_STATUS_OPTIONS.map(s => ({ label: agreementStatusLabel(s), value: s })))
const STAFF_STATUS_OPTIONS = ['ACTIVE', 'INACTIVE']
const staffStatusOptions = computed(() => STAFF_STATUS_OPTIONS.map(s => ({ label: staffStatusLabel(s), value: s })))

// ---- Tabs ----
const tabs = computed(() => [
  { label: t('allies.tabs.services'), value: 'services', icon: 'i-lucide-briefcase-medical' },
  { label: t('allies.tabs.professions'), value: 'professions', icon: 'i-lucide-stethoscope' },
  { label: t('allies.tabs.allyTypes'), value: 'allyTypes', icon: 'i-lucide-tags' },
  ...(canViewAgreements.value
    ? [{ label: t('allies.tabs.agreements'), value: 'agreements', icon: 'i-lucide-file-signature' }]
    : []),
  ...(canViewStaff.value
    ? [{ label: t('allies.tabs.staff'), value: 'users', icon: 'i-lucide-users' }]
    : []),
])
const activeTab = ref('services')

// =========================================================
// Services
// =========================================================
const services = ref<AllyServiceDto[]>([])
const servicesLoading = ref(false)
const servicesSort = useTableSort([])
const servicesHasActiveSort = computed(() => servicesSort.hasActiveSort.value)
const servicesIsMultiSort = computed(() => servicesSort.orders.value.length > 1)

async function loadServices() {
  servicesLoading.value = true
  try {
    services.value = await allies.listServices(allyUuid, servicesSort.sortParam.value)
  }
  catch {
    // toast handled by useApi
  }
  finally {
    servicesLoading.value = false
  }
}
watch(servicesSort.orders, () => loadServices(), { deep: true })

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
const svcEditingItem = ref<AllyServiceDto | null>(null)
const svcSubmitting = ref(false)
// Save button lives in the modal's #footer slot, outside the <UForm> element,
// so it can't use type="submit"; it triggers validation via this instead.
const svcFormRef = ref<{ submit: () => Promise<void> } | null>(null)

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

const svcSchema = computed(() => z.object({
  serviceCategoryUuid: z.string({ message: t('validation.required') }).min(1, t('validation.required')),
  name: z.string().min(3, t('validation.minChars', { n: 3 })),
  description: z.string().optional(),
  priceUsd: z.string().regex(/^\d*(\.\d{1,2})?$/, t('validation.invalidAmount')).optional().or(z.literal('')),
  discountPct: z.string().regex(/^\d*(\.\d{1,2})?$/, t('validation.invalidPercent')).optional().or(z.literal('')),
}))

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
  svcEditingItem.value = s
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
      toast.add({ title: t('allies.services.createdToast'), color: 'success', icon: 'i-lucide-check-circle' })
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
      toast.add({ title: t('allies.services.updatedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    }
    svcFormOpen.value = false
    await loadServices()
  }
  catch {
    // toast handled by useApi
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

// Shortcut from the edit modal so the user doesn't have to close it first
// and hunt for the row's trash icon. Closes the edit modal so the two
// dialogs never stack.
function openSvcDeleteFromEdit() {
  if (!svcEditingItem.value) return
  svcFormOpen.value = false
  openSvcDelete(svcEditingItem.value)
}

async function confirmSvcDelete() {
  if (!svcTarget.value) return
  svcDeleting.value = true
  try {
    await allies.removeService(allyUuid, svcTarget.value.uuid)
    toast.add({ title: t('allies.services.deletedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    svcDeleteOpen.value = false
    await loadServices()
  }
  catch {
    // toast handled by useApi
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
// Professions (ManyToMany)
// =========================================================
const professions = ref<CatalogRef[]>([])
const professionsLoading = ref(false)
const allProfessionOptions = ref<{ label: string, value: string }[]>([])
const professionToAdd = ref<string | undefined>(undefined)
const professionMutating = ref(false)

async function loadProfessions() {
  professionsLoading.value = true
  try {
    professions.value = await allies.listProfessions(allyUuid)
  }
  catch {
    // toast handled by useApi
  }
  finally {
    professionsLoading.value = false
  }
}

async function loadAllProfessions() {
  try {
    const items = await useCatalogOptions('professions').options({ limit: 200 })
    allProfessionOptions.value = toSelectItems(items)
  }
  catch {
    allProfessionOptions.value = []
  }
}

/** Only the professions not yet assigned. */
const availableProfessionOptions = computed(() => {
  const assigned = new Set(professions.value.map(s => s.uuid))
  return allProfessionOptions.value.filter(o => !assigned.has(o.value))
})

async function addProfession() {
  if (!professionToAdd.value) return
  professionMutating.value = true
  try {
    await allies.addProfession(allyUuid, professionToAdd.value)
    professionToAdd.value = undefined
    await loadProfessions()
  }
  catch {
    // toast handled by useApi
  }
  finally {
    professionMutating.value = false
  }
}

async function removeProfession(professionUuid: string) {
  professionMutating.value = true
  try {
    await allies.removeProfession(allyUuid, professionUuid)
    await loadProfessions()
  }
  catch {
    // toast handled by useApi
  }
  finally {
    professionMutating.value = false
  }
}

// =========================================================
// Ally types (ManyToMany)
// =========================================================
const allyTypes = ref<CatalogRef[]>([])
const allyTypesLoading = ref(false)
const allAllyTypeOptions = ref<{ label: string, value: string }[]>([])
const allyTypeToAdd = ref<string | undefined>(undefined)
const allyTypeMutating = ref(false)

async function loadAllyTypes() {
  allyTypesLoading.value = true
  try {
    allyTypes.value = await allies.listAllyTypes(allyUuid)
  }
  catch {
    // toast handled by useApi
  }
  finally {
    allyTypesLoading.value = false
  }
}

async function loadAllAllyTypes() {
  try {
    const items = await useCatalogOptions('ally-types').options({ limit: 200 })
    allAllyTypeOptions.value = toSelectItems(items)
  }
  catch {
    allAllyTypeOptions.value = []
  }
}

/** Only the ally types not yet assigned. */
const availableAllyTypeOptions = computed(() => {
  const assigned = new Set(allyTypes.value.map(s => s.uuid))
  return allAllyTypeOptions.value.filter(o => !assigned.has(o.value))
})

async function addAllyType() {
  if (!allyTypeToAdd.value) return
  allyTypeMutating.value = true
  try {
    await allies.addAllyType(allyUuid, allyTypeToAdd.value)
    allyTypeToAdd.value = undefined
    await loadAllyTypes()
  }
  catch {
    // toast handled by useApi
  }
  finally {
    allyTypeMutating.value = false
  }
}

async function removeAllyType(allyTypeUuid: string) {
  allyTypeMutating.value = true
  try {
    await allies.removeAllyType(allyUuid, allyTypeUuid)
    await loadAllyTypes()
  }
  catch {
    // toast handled by useApi
  }
  finally {
    allyTypeMutating.value = false
  }
}

// =========================================================
// Agreements (ALLY_AGREEMENT_VIEW_ALL / _CREATE / _UPDATE / _DELETE)
// =========================================================
const agreements = ref<AllyAgreementDto[]>([])
const agreementsLoading = ref(false)
const agreementsSort = useTableSort([])
const agreementsHasActiveSort = computed(() => agreementsSort.hasActiveSort.value)
const agreementsIsMultiSort = computed(() => agreementsSort.orders.value.length > 1)

async function loadAgreements() {
  if (!canViewAgreements.value) return
  agreementsLoading.value = true
  try {
    agreements.value = await allies.listAgreements(allyUuid, agreementsSort.sortParam.value)
  }
  catch {
    // toast handled by useApi
  }
  finally {
    agreementsLoading.value = false
  }
}

watch(agreementsSort.orders, () => loadAgreements(), { deep: true })

const agrFormOpen = ref(false)
const agrMode = ref<'create' | 'edit'>('create')
const agrEditingUuid = ref<string | null>(null)
const agrEditingItem = ref<AllyAgreementDto | null>(null)
const agrSubmitting = ref(false)
// Save button lives in the modal's #footer slot, outside the <UForm> element,
// so it can't use type="submit"; it triggers validation via this instead.
const agrFormRef = ref<{ submit: () => Promise<void> } | null>(null)

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

const agrSchema = computed(() => z.object({
  agreementType: z.string({ message: t('validation.required') }).min(1, t('validation.required')),
  startDate: z.string({ message: t('validation.required') }).min(1, t('validation.required')),
  endDate: z.string().optional(),
  terms: z.string({ message: t('validation.required') }).min(1, t('validation.required')),
  signedPdfUrl: z.string().url(t('validation.invalidUrl')).optional().or(z.literal('')),
}))

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
  agrEditingItem.value = a
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
      toast.add({ title: t('allies.agreements.createdToast'), color: 'success', icon: 'i-lucide-check-circle' })
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
      toast.add({ title: t('allies.agreements.updatedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    }
    agrFormOpen.value = false
    await loadAgreements()
  }
  catch {
    // toast handled by useApi
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

// Shortcut from the edit modal so the user doesn't have to close it first
// and hunt for the row's trash icon. Closes the edit modal so the two
// dialogs never stack.
function openAgrDeleteFromEdit() {
  if (!agrEditingItem.value) return
  agrFormOpen.value = false
  openAgrDelete(agrEditingItem.value)
}

async function confirmAgrDelete() {
  if (!agrTarget.value) return
  agrDeleting.value = true
  try {
    await allies.removeAgreement(allyUuid, agrTarget.value.uuid)
    toast.add({ title: t('allies.agreements.deletedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    agrDeleteOpen.value = false
    await loadAgreements()
  }
  catch {
    // toast handled by useApi
  }
  finally {
    agrDeleting.value = false
  }
}

// =========================================================
// Staff (partner users) — ALLY_USER_VIEW_ALL / _CREATE / _UPDATE / _DELETE
// =========================================================
const staff = ref<AllyUserDto[]>([])
const staffLoading = ref(false)
const staffSort = useTableSort([])
const staffHasActiveSort = computed(() => staffSort.hasActiveSort.value)
const staffIsMultiSort = computed(() => staffSort.orders.value.length > 1)

async function loadStaff() {
  if (!canViewStaff.value) return
  staffLoading.value = true
  try {
    staff.value = await allies.listUsers(allyUuid, staffSort.sortParam.value)
  }
  catch {
    // toast handled by useApi
  }
  finally {
    staffLoading.value = false
  }
}
watch(staffSort.orders, () => loadStaff(), { deep: true })

// System users for the assignment selector (requires USER_VIEW_ALL; without the
// permission it fails silently and the select stays empty).
const userOptions = ref<{ label: string, value: string }[]>([])

async function loadUserOptions() {
  if (!can('USER_VIEW_ALL')) return
  try {
    const res = await useUsers().list({ size: 100, sort: ['createdAt,desc'] })
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
const staffEditingItem = ref<AllyUserDto | null>(null)
const staffSubmitting = ref(false)
// Save button lives in the modal's #footer slot, outside the <UForm> element,
// so it can't use type="submit"; it triggers validation via this instead.
const staffFormRef = ref<{ submit: () => Promise<void> } | null>(null)

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

const staffSchema = computed(() => {
  const createSchema = z.object({
    userUuid: z.string({ message: t('validation.required') }).min(1, t('validation.required')),
    allyRole: z.string({ message: t('validation.required') }).min(1, t('validation.required')),
  })
  const editSchema = z.object({
    allyRole: z.string({ message: t('validation.required') }).min(1, t('validation.required')),
  })
  return staffMode.value === 'create' ? createSchema : editSchema
})

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
  staffEditingItem.value = s
  resetStaffForm()
  staffState.userUuid = s.userUuid
  staffState.allyRole = s.allyRole as AllyRole
  staffState.primary = s.primary ?? false
  staffState.joinedAt = s.joinedAt ?? ''
  staffState.status = s.status || 'ACTIVE'
  staffFormOpen.value = true
}

// `primary` only applies to OWNER: it's cleared when the role changes.
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
      toast.add({ title: t('allies.staff.assignedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    }
    else if (staffEditingUuid.value) {
      await allies.updateUser(allyUuid, staffEditingUuid.value, {
        allyRole: staffState.allyRole,
        primary: staffState.primary,
        joinedAt: staffState.joinedAt || undefined,
        status: staffState.status,
      })
      toast.add({ title: t('allies.staff.updatedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    }
    staffFormOpen.value = false
    await loadStaff()
  }
  catch {
    // toast handled by useApi (422 if there's already a primary OWNER, etc.)
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

// Shortcut from the edit modal so the user doesn't have to close it first
// and hunt for the row's icon. Closes the edit modal so the two dialogs
// never stack.
function openStaffDeleteFromEdit() {
  if (!staffEditingItem.value) return
  staffFormOpen.value = false
  openStaffDelete(staffEditingItem.value)
}

async function confirmStaffDelete() {
  if (!staffTarget.value) return
  staffDeleting.value = true
  try {
    await allies.removeUser(allyUuid, staffTarget.value.uuid)
    toast.add({ title: t('allies.staff.unlinkedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    staffDeleteOpen.value = false
    await loadStaff()
  }
  catch {
    // toast handled by useApi
  }
  finally {
    staffDeleting.value = false
  }
}

// ---- Refresh whole record (header button) ----
const refreshingAll = ref(false)
async function refreshAll() {
  refreshingAll.value = true
  try {
    // loadAgreements / loadStaff early-return without the view permission.
    await Promise.all([loadAlly(), loadServices(), loadProfessions(), loadAllyTypes(), loadAgreements(), loadStaff()])
  }
  finally {
    refreshingAll.value = false
  }
}

// ---- Init ----
onMounted(async () => {
  await loadAlly()
  await Promise.all([
    loadServices(),
    loadProfessions(),
    loadAllyTypes(),
    loadAgreements(),
    loadStaff(),
    loadCategories(),
    loadAllProfessions(),
    loadAllAllyTypes(),
    loadUserOptions(),
  ])
})
</script>

<template>
  <div class="space-y-5">
    <!-- Back -->
    <UButton
      color="neutral"
      variant="ghost"
      icon="i-lucide-arrow-left"
      to="/dashboard/allies"
      size="sm"
    >
      {{ t('allies.title') }}
    </UButton>

    <!-- Loading -->
    <div v-if="loading" class="bg-white rounded-2xl border border-prohealth-100 p-6 space-y-3">
      <USkeleton class="h-7 w-64 rounded" />
      <USkeleton class="h-4 w-40 rounded" />
      <USkeleton class="h-4 w-full max-w-lg rounded" />
    </div>

    <!-- Not found -->
    <div v-else-if="notFound || !ally" class="bg-white rounded-2xl border border-prohealth-100 p-12 text-center">
      <UIcon name="i-lucide-search-x" class="w-10 h-10 mx-auto mb-3 text-prohealth-300" />
      <p class="text-prohealth-700 font-semibold">{{ t('allies.detail.notFoundTitle') }}</p>
      <p class="text-sm text-prohealth-500 mt-1">{{ t('allies.detail.notFoundBody') }}</p>
    </div>

    <template v-else>
      <!-- Ally data -->
      <div class="bg-white rounded-2xl border border-prohealth-100 p-6">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div class="flex items-center gap-3 flex-wrap">
              <h1 class="text-2xl font-extrabold text-prohealth-900">{{ ally.name }}</h1>
              <!-- `active === false` (soft-delete) wins over the business `status`,
                   mirroring effectiveStatusLabel() on the list. -->
              <UBadge
                :color="ally.active === false ? 'warning' : (ally.status === 'ACTIVE' ? 'success' : 'warning')"
                variant="subtle"
              >
                {{ ally.active === false
                  ? t('allies.status.INACTIVE')
                  : (ally.status ? allyStatusLabel(ally.status) : t('common.empty')) }}
              </UBadge>
              <UBadge :color="ally.published ? 'success' : 'neutral'" variant="subtle">
                {{ ally.published ? t('allies.published') : t('allies.draft') }}
              </UBadge>
            </div>
            <p class="text-sm text-prohealth-500 mt-1 flex flex-wrap items-center gap-1">
              <template v-if="ally.allyTypes?.length">
                <UBadge v-for="allyTypeRef in ally.allyTypes" :key="allyTypeRef.uuid" color="neutral" variant="subtle" size="sm">
                  {{ allyTypeRef.name }}
                </UBadge>
              </template>
              <span v-else>{{ t('allies.fallbackName') }}</span>
              <template v-if="ally.taxDocumentNumber"> · {{ ally.taxDocumentType }}-{{ ally.taxDocumentNumber }}</template>
              · {{ t('allies.detail.memberSince', { date: date(ally.joinedAt) }) }}
            </p>
          </div>
          <div class="flex items-center gap-2">
            <!-- Refresh + read-only tools -->
            <RefreshButton
              size="md"
              variant="ghost"
              :icon-only="false"
              :loading="refreshingAll"
              :title="t('common.refreshRecord')"
              @refresh="refreshAll"
            />
            <ReportPrintButton :record-uuid="allyUuid" size="md" variant="ghost" />
            <UButton
              v-if="canViewAudit"
              color="neutral"
              variant="ghost"
              icon="i-lucide-history"
              size="md"
              :label="t('audit.trigger')"
              @click="auditOpen = true"
            />

            <!-- Primary action -->
            <UTooltip :text="canUpdate ? t('common.edit') : t('allies.noPermissionEdit')">
              <UButton
                color="info"
                variant="ghost"
                icon="i-lucide-pencil"
                size="md"
                :label="t('common.edit')"
                :disabled="!canUpdate"
                @click="editFormOpen = true"
              />
            </UTooltip>

            <!-- Destructive action, separated from the rest -->
            <RestoreButton
              v-if="ally.active === false"
              :active="ally.active"
              :allowed="canDelete"
              :loading="restoring"
              size="md"
              variant="ghost"
              class="ms-2"
              @restore="restoreAlly"
            />
            <UTooltip v-else :text="canDelete ? t('common.delete') : t('allies.noPermissionDelete')">
              <UButton
                color="error"
                variant="ghost"
                size="md"
                icon="i-lucide-trash-2"
                :label="t('common.delete')"
                class="ms-2"
                :disabled="!canDelete"
                @click="navigateTo(`/dashboard/allies?delete=${allyUuid}`)"
              />
            </UTooltip>
          </div>
        </div>

        <dl class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 mt-6 text-sm">
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('allies.detail.fields.email') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ ally.email || t('common.empty') }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('allies.detail.fields.phone') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ ally.phone || t('common.empty') }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('allies.detail.fields.website') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">
              <a v-if="ally.website" :href="ally.website" target="_blank" rel="noopener" class="text-cyan-700 hover:underline">
                {{ ally.website }}
              </a>
              <span v-else>{{ t('common.empty') }}</span>
            </dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('allies.detail.fields.whatsapp') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ ally.whatsapp || t('common.empty') }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('allies.detail.fields.instagram') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">
              <a v-if="ally.instagram" :href="ally.instagram" target="_blank" rel="noopener" class="text-cyan-700 hover:underline">
                {{ ally.instagram }}
              </a>
              <span v-else>{{ t('common.empty') }}</span>
            </dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('allies.detail.fields.facebook') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">
              <a v-if="ally.facebook" :href="ally.facebook" target="_blank" rel="noopener" class="text-cyan-700 hover:underline">
                {{ ally.facebook }}
              </a>
              <span v-else>{{ t('common.empty') }}</span>
            </dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('allies.detail.fields.city') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ ally.city?.name || t('common.empty') }}</dd>
          </div>
          <div class="sm:col-span-2">
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('allies.detail.fields.address') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ ally.address || t('common.empty') }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('allies.detail.fields.googleMapsUrl') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">
              <a v-if="ally.googleMapsUrl" :href="ally.googleMapsUrl" target="_blank" rel="noopener" class="text-cyan-700 hover:underline">
                {{ t('allies.detail.viewOnMap') }}
              </a>
              <span v-else>{{ t('common.empty') }}</span>
            </dd>
          </div>
          <div v-if="ally.description" class="sm:col-span-3">
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('allies.detail.fields.description') }}</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ ally.description }}</dd>
          </div>
        </dl>
      </div>

      <!-- Sub-resource tabs -->
      <UTabs v-model="activeTab" :items="tabs" :content="false" />

      <!-- ============ Services ============ -->
      <div v-show="activeTab === 'services'" class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden">
        <div class="flex items-center justify-between px-6 py-4 border-b border-prohealth-100">
          <div>
            <h2 class="font-bold text-prohealth-900">{{ t('allies.services.title') }}</h2>
            <p class="text-xs text-prohealth-500 mt-0.5">{{ t('allies.services.hint') }}</p>
          </div>
          <div class="flex items-center gap-2">
            <UTooltip :text="canUpdate ? t('allies.services.addTooltip') : t('allies.noPermission')">
              <UButton
                color="primary"
                variant="soft"
                icon="i-lucide-plus"
                size="sm"
                :disabled="!canUpdate"
                @click="openSvcCreate"
              >
                {{ t('allies.services.add') }}
              </UButton>
            </UTooltip>
            <UButton
              v-if="servicesHasActiveSort"
              variant="link"
              color="neutral"
              size="sm"
              icon="i-lucide-list-restart"
              :title="t('common.clearSortHint')"
              @click="servicesSort.reset()"
            >
              {{ t('common.clearSort') }}
            </UButton>
            <RefreshButton
              :loading="servicesLoading"
              :title="t('common.refreshSection')"
              @refresh="loadServices"
            />
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
                <th class="px-6 py-3 font-semibold cursor-pointer select-none" @click="servicesSort.toggle('name')">
                  {{ t('allies.services.columns.service') }}
                  <SortIndicator :state="servicesSort.stateOf('name')" :multi-active="servicesIsMultiSort" @clear="servicesSort.remove('name')" />
                </th>
                <th class="px-6 py-3 font-semibold cursor-pointer select-none" @click="servicesSort.toggle('serviceCategory')">
                  {{ t('allies.services.columns.category') }}
                  <SortIndicator :state="servicesSort.stateOf('serviceCategory')" :multi-active="servicesIsMultiSort" @clear="servicesSort.remove('serviceCategory')" />
                </th>
                <th class="px-6 py-3 font-semibold cursor-pointer select-none" @click="servicesSort.toggle('priceUsd')">
                  {{ t('allies.services.columns.price') }}
                  <SortIndicator :state="servicesSort.stateOf('priceUsd')" :multi-active="servicesIsMultiSort" @clear="servicesSort.remove('priceUsd')" />
                </th>
                <th class="px-6 py-3 font-semibold cursor-pointer select-none" @click="servicesSort.toggle('discountPct')">
                  {{ t('allies.services.columns.discount') }}
                  <SortIndicator :state="servicesSort.stateOf('discountPct')" :multi-active="servicesIsMultiSort" @clear="servicesSort.remove('discountPct')" />
                </th>
                <th class="px-6 py-3 font-semibold cursor-pointer select-none" @click="servicesSort.toggle('requiresAppointment')">
                  {{ t('allies.services.columns.appointment') }}
                  <SortIndicator :state="servicesSort.stateOf('requiresAppointment')" :multi-active="servicesIsMultiSort" @clear="servicesSort.remove('requiresAppointment')" />
                </th>
                <th class="px-6 py-3 font-semibold cursor-pointer select-none" @click="servicesSort.toggle('reviewStatus')">
                  {{ t('allies.services.columns.review') }}
                  <SortIndicator :state="servicesSort.stateOf('reviewStatus')" :multi-active="servicesIsMultiSort" @clear="servicesSort.remove('reviewStatus')" />
                </th>
                <th class="px-6 py-3 font-semibold cursor-pointer select-none" @click="servicesSort.toggle('published')">
                  {{ t('allies.services.columns.published') }}
                  <SortIndicator :state="servicesSort.stateOf('published')" :multi-active="servicesIsMultiSort" @clear="servicesSort.remove('published')" />
                </th>
                <th class="px-6 py-3 font-semibold text-right">{{ t('common.actions') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-prohealth-100">
              <TableSkeleton v-if="servicesLoading" :rows="3" :cols="8" />
              <tr v-else-if="services.length === 0">
                <td colspan="8" class="px-6 py-10 text-center text-prohealth-500">
                  <UIcon name="i-lucide-briefcase-medical" class="w-7 h-7 mx-auto mb-2 text-prohealth-300" />
                  {{ t('allies.services.empty') }}
                </td>
              </tr>
              <tr v-for="s in services" v-else :key="s.uuid" class="hover:bg-prohealth-50/50">
                <td class="px-6 py-3">
                  <div class="font-semibold text-prohealth-900">{{ s.name }}</div>
                  <div v-if="s.description" class="text-xs text-prohealth-500 line-clamp-1">{{ s.description }}</div>
                </td>
                <td class="px-6 py-3 text-prohealth-700">{{ s.serviceCategory?.name || t('common.empty') }}</td>
                <td class="px-6 py-3 text-prohealth-700">{{ money(s.priceUsd) }}</td>
                <td class="px-6 py-3 text-prohealth-700">{{ s.discountPct ? `${s.discountPct}%` : t('common.empty') }}</td>
                <td class="px-6 py-3">
                  <UIcon
                    :name="s.requiresAppointment ? 'i-lucide-calendar-check' : 'i-lucide-minus'"
                    class="w-4 h-4"
                    :class="s.requiresAppointment ? 'text-cyan-600' : 'text-prohealth-300'"
                  />
                </td>
                <td class="px-6 py-3">
                  <UBadge :color="reviewStatusColor(s.reviewStatus)" variant="subtle" size="sm">
                    {{ s.reviewStatus_Display ?? (s.reviewStatus ? reviewStatusLabel(s.reviewStatus) : t('common.empty')) }}
                  </UBadge>
                </td>
                <td class="px-6 py-3">
                  <UBadge :color="s.published ? 'success' : 'neutral'" variant="subtle" size="sm">
                    {{ s.published_Display ?? (s.published ? t('common.yes') : t('common.no')) }}
                  </UBadge>
                </td>
                <td class="px-6 py-3">
                  <div class="flex items-center justify-end gap-1">
                    <UTooltip :text="canUpdate ? t('common.edit') : t('allies.noPermission')">
                      <UButton
                        color="neutral"
                        variant="ghost"
                        icon="i-lucide-pencil"
                        size="sm"
                        :disabled="!canUpdate"
                        @click="openSvcEdit(s)"
                      />
                    </UTooltip>
                    <UTooltip :text="canDelete ? t('common.delete') : t('allies.noPermission')">
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

      <!-- ============ Professions ============ -->
      <div v-show="activeTab === 'professions'" class="bg-white rounded-2xl border border-prohealth-100">
        <div class="flex items-center justify-between px-6 py-4 border-b border-prohealth-100 gap-4">
          <div>
            <h2 class="font-bold text-prohealth-900">{{ t('allies.professions.title') }}</h2>
            <p class="text-xs text-prohealth-500 mt-0.5">{{ t('allies.professions.hint') }}</p>
          </div>
          <div class="flex items-center gap-2">
            <USelectMenu
              clear
              v-model="professionToAdd"
              :items="availableProfessionOptions"
              label-key="label"
              value-key="value"
              :placeholder="t('common.select')"
              :disabled="!canUpdate"
              class="w-48"
            />
            <UButton
              color="primary"
              variant="soft"
              icon="i-lucide-plus"
              size="sm"
              :disabled="!canUpdate || !professionToAdd"
              :loading="professionMutating"
              @click="addProfession"
            >
              {{ t('allies.professions.addButton') }}
            </UButton>
            <RefreshButton
              :loading="professionsLoading"
              :title="t('common.refreshSection')"
              @refresh="loadProfessions"
            />
          </div>
        </div>

        <div class="p-6 space-y-5">
          <!-- List -->
          <div v-if="professionsLoading" class="flex gap-2">
            <USkeleton v-for="i in 3" :key="i" class="h-7 w-28 rounded-full" />
          </div>
          <p v-else-if="professions.length === 0" class="text-sm text-prohealth-500">
            {{ t('allies.professions.empty') }}
          </p>
          <div v-else class="flex flex-wrap gap-2">
            <UBadge
              v-for="s in professions"
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
                :disabled="professionMutating"
                @click="removeProfession(s.uuid)"
              />
            </UBadge>
          </div>
        </div>
      </div>

      <!-- ============ Ally types ============ -->
      <div v-show="activeTab === 'allyTypes'" class="bg-white rounded-2xl border border-prohealth-100">
        <div class="flex items-center justify-between px-6 py-4 border-b border-prohealth-100 gap-4">
          <div>
            <h2 class="font-bold text-prohealth-900">{{ t('allies.allyTypes.title') }}</h2>
            <p class="text-xs text-prohealth-500 mt-0.5">{{ t('allies.allyTypes.hint') }}</p>
          </div>
          <div class="flex items-center gap-2">
            <USelectMenu
              clear
              v-model="allyTypeToAdd"
              :items="availableAllyTypeOptions"
              label-key="label"
              value-key="value"
              :placeholder="t('common.select')"
              :disabled="!canUpdate"
              class="w-48"
            />
            <UButton
              color="primary"
              variant="soft"
              icon="i-lucide-plus"
              size="sm"
              :disabled="!canUpdate || !allyTypeToAdd"
              :loading="allyTypeMutating"
              @click="addAllyType"
            >
              {{ t('allies.allyTypes.addButton') }}
            </UButton>
            <RefreshButton
              :loading="allyTypesLoading"
              :title="t('common.refreshSection')"
              @refresh="loadAllyTypes"
            />
          </div>
        </div>

        <div class="p-6 space-y-5">
          <!-- List -->
          <div v-if="allyTypesLoading" class="flex gap-2">
            <USkeleton v-for="i in 3" :key="i" class="h-7 w-28 rounded-full" />
          </div>
          <p v-else-if="allyTypes.length === 0" class="text-sm text-prohealth-500">
            {{ t('allies.allyTypes.empty') }}
          </p>
          <div v-else class="flex flex-wrap gap-2">
            <UBadge
              v-for="s in allyTypes"
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
                :disabled="allyTypeMutating"
                @click="removeAllyType(s.uuid)"
              />
            </UBadge>
          </div>
        </div>
      </div>

      <!-- ============ Agreements ============ -->
      <div
        v-if="canViewAgreements"
        v-show="activeTab === 'agreements'"
        class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden"
      >
        <div class="flex items-center justify-between px-6 py-4 border-b border-prohealth-100">
          <div>
            <h2 class="font-bold text-prohealth-900">{{ t('allies.agreements.title') }}</h2>
            <p class="text-xs text-prohealth-500 mt-0.5">{{ t('allies.agreements.hint') }}</p>
          </div>
          <div class="flex items-center gap-2">
            <UButton
              v-if="canCreateAgreements"
              color="primary"
              variant="soft"
              icon="i-lucide-plus"
              size="sm"
              @click="openAgrCreate"
            >
              {{ t('allies.agreements.add') }}
            </UButton>
            <UButton
              v-if="agreementsHasActiveSort"
              variant="link"
              color="neutral"
              size="sm"
              icon="i-lucide-list-restart"
              :title="t('common.clearSortHint')"
              @click="agreementsSort.reset()"
            >
              {{ t('common.clearSort') }}
            </UButton>
            <RefreshButton
              :loading="agreementsLoading"
              :title="t('common.refreshSection')"
              @refresh="loadAgreements"
            />
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
                <th class="px-6 py-3 font-semibold cursor-pointer select-none" @click="agreementsSort.toggle('agreementType')">
                  {{ t('allies.agreements.columns.type') }}
                  <SortIndicator :state="agreementsSort.stateOf('agreementType')" :multi-active="agreementsIsMultiSort" @clear="agreementsSort.remove('agreementType')" />
                </th>
                <th class="px-6 py-3 font-semibold cursor-pointer select-none" @click="agreementsSort.toggle('startDate')">
                  {{ t('allies.agreements.columns.start') }}
                  <SortIndicator :state="agreementsSort.stateOf('startDate')" :multi-active="agreementsIsMultiSort" @clear="agreementsSort.remove('startDate')" />
                </th>
                <th class="px-6 py-3 font-semibold cursor-pointer select-none" @click="agreementsSort.toggle('endDate')">
                  {{ t('allies.agreements.columns.end') }}
                  <SortIndicator :state="agreementsSort.stateOf('endDate')" :multi-active="agreementsIsMultiSort" @clear="agreementsSort.remove('endDate')" />
                </th>
                <th class="px-6 py-3 font-semibold">{{ t('allies.agreements.columns.pdf') }}</th>
                <th class="px-6 py-3 font-semibold cursor-pointer select-none" @click="agreementsSort.toggle('status')">
                  {{ t('allies.agreements.columns.status') }}
                  <SortIndicator :state="agreementsSort.stateOf('status')" :multi-active="agreementsIsMultiSort" @clear="agreementsSort.remove('status')" />
                </th>
                <th class="px-6 py-3 font-semibold text-right">{{ t('common.actions') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-prohealth-100">
              <TableSkeleton v-if="agreementsLoading" :rows="3" :cols="6" />
              <tr v-else-if="agreements.length === 0">
                <td colspan="6" class="px-6 py-10 text-center text-prohealth-500">
                  <UIcon name="i-lucide-file-signature" class="w-7 h-7 mx-auto mb-2 text-prohealth-300" />
                  {{ t('allies.agreements.empty') }}
                </td>
              </tr>
              <tr v-for="a in agreements" v-else :key="a.uuid" class="hover:bg-prohealth-50/50">
                <td class="px-6 py-3 font-semibold text-prohealth-900">{{ a.agreementType_Display ?? agrTypeLabel(a.agreementType) }}</td>
                <td class="px-6 py-3 text-prohealth-600">{{ a.startDate_Display ?? date(a.startDate) }}</td>
                <td class="px-6 py-3 text-prohealth-600">{{ a.endDate_Display ?? date(a.endDate) }}</td>
                <td class="px-6 py-3">
                  <a
                    v-if="a.signedPdfUrl"
                    :href="a.signedPdfUrl"
                    target="_blank"
                    rel="noopener"
                    class="text-cyan-700 hover:underline inline-flex items-center gap-1"
                  >
                    <UIcon name="i-lucide-file-text" class="w-4 h-4" /> {{ t('allies.agreements.viewPdf') }}
                  </a>
                  <span v-else class="text-prohealth-400">{{ t('common.empty') }}</span>
                </td>
                <td class="px-6 py-3">
                  <UBadge
                    :color="a.status === 'ACTIVE' ? 'success' : 'warning'"
                    variant="subtle"
                    size="sm"
                  >
                    {{ a.status_Display ?? (a.status ? agreementStatusLabel(a.status) : t('common.empty')) }}
                  </UBadge>
                </td>
                <td class="px-6 py-3">
                  <div class="flex items-center justify-end gap-1">
                    <UButton
                      v-if="canUpdateAgreements"
                      color="neutral"
                      variant="ghost"
                      icon="i-lucide-pencil"
                      size="sm"
                      @click="openAgrEdit(a)"
                    />
                    <UButton
                      v-if="canDeleteAgreements"
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

      <!-- ============ Staff ============ -->
      <div v-show="activeTab === 'users'" class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden">
        <div class="flex items-center justify-between px-6 py-4 border-b border-prohealth-100">
          <div>
            <h2 class="font-bold text-prohealth-900">{{ t('allies.staff.title') }}</h2>
            <p class="text-xs text-prohealth-500 mt-0.5">{{ t('allies.staff.hint') }}</p>
          </div>
          <div class="flex items-center gap-2">
            <UTooltip :text="canCreateStaff ? t('allies.staff.assignTooltip') : t('allies.noPermission')">
              <UButton
                color="primary"
                variant="soft"
                icon="i-lucide-user-plus"
                size="sm"
                :disabled="!canCreateStaff"
                @click="openStaffCreate"
              >
                {{ t('allies.staff.assign') }}
              </UButton>
            </UTooltip>
            <UButton
              v-if="staffHasActiveSort"
              variant="link"
              color="neutral"
              size="sm"
              icon="i-lucide-list-restart"
              :title="t('common.clearSortHint')"
              @click="staffSort.reset()"
            >
              {{ t('common.clearSort') }}
            </UButton>
            <RefreshButton
              :loading="staffLoading"
              :title="t('common.refreshSection')"
              @refresh="loadStaff"
            />
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
                <th class="px-6 py-3 font-semibold cursor-pointer select-none" @click="staffSort.toggle('userFullName')">
                  {{ t('allies.staff.columns.user') }}
                  <SortIndicator :state="staffSort.stateOf('userFullName')" :multi-active="staffIsMultiSort" @clear="staffSort.remove('userFullName')" />
                </th>
                <th class="px-6 py-3 font-semibold cursor-pointer select-none" @click="staffSort.toggle('allyRole')">
                  {{ t('allies.staff.columns.role') }}
                  <SortIndicator :state="staffSort.stateOf('allyRole')" :multi-active="staffIsMultiSort" @clear="staffSort.remove('allyRole')" />
                </th>
                <th class="px-6 py-3 font-semibold cursor-pointer select-none" @click="staffSort.toggle('primary')">
                  {{ t('allies.staff.columns.primary') }}
                  <SortIndicator :state="staffSort.stateOf('primary')" :multi-active="staffIsMultiSort" @clear="staffSort.remove('primary')" />
                </th>
                <th class="px-6 py-3 font-semibold cursor-pointer select-none" @click="staffSort.toggle('joinedAt')">
                  {{ t('allies.staff.columns.since') }}
                  <SortIndicator :state="staffSort.stateOf('joinedAt')" :multi-active="staffIsMultiSort" @clear="staffSort.remove('joinedAt')" />
                </th>
                <th class="px-6 py-3 font-semibold cursor-pointer select-none" @click="staffSort.toggle('status')">
                  {{ t('allies.staff.columns.status') }}
                  <SortIndicator :state="staffSort.stateOf('status')" :multi-active="staffIsMultiSort" @clear="staffSort.remove('status')" />
                </th>
                <th class="px-6 py-3 font-semibold text-right">{{ t('common.actions') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-prohealth-100">
              <TableSkeleton v-if="staffLoading" :rows="3" :cols="6" />
              <tr v-else-if="staff.length === 0">
                <td colspan="6" class="px-6 py-10 text-center text-prohealth-500">
                  <UIcon name="i-lucide-users" class="w-7 h-7 mx-auto mb-2 text-prohealth-300" />
                  {{ t('allies.staff.empty') }}
                </td>
              </tr>
              <tr v-for="s in staff" v-else :key="s.uuid" class="hover:bg-prohealth-50/50">
                <td class="px-6 py-3">
                  <div class="font-semibold">
                    <CommonEntityLinkCell
                      :to="`/dashboard/users/${s.userUuid}`"
                      :label="s.userFullName"
                      :can="canViewUser"
                    />
                  </div>
                  <div class="text-xs text-prohealth-500">{{ s.userEmail || t('common.empty') }}</div>
                </td>
                <td class="px-6 py-3">
                  <UBadge color="primary" variant="subtle" size="sm">
                    {{ roleLabel(s.allyRole) }}
                  </UBadge>
                </td>
                <td class="px-6 py-3">
                  <UIcon
                    :name="s.primary ? 'i-lucide-star' : 'i-lucide-minus'"
                    class="w-4 h-4"
                    :class="s.primary ? 'text-amber-500' : 'text-prohealth-300'"
                  />
                </td>
                <td class="px-6 py-3 text-prohealth-600">{{ date(s.joinedAt) }}</td>
                <td class="px-6 py-3">
                  <UBadge
                    :color="s.status === 'ACTIVE' || !s.status ? 'success' : 'warning'"
                    variant="subtle"
                    size="sm"
                  >
                    {{ staffStatusLabel(s.status || 'ACTIVE') }}
                  </UBadge>
                </td>
                <td class="px-6 py-3">
                  <div class="flex items-center justify-end gap-1">
                    <UTooltip :text="canUpdateStaff ? t('common.edit') : t('allies.noPermission')">
                      <UButton
                        color="neutral"
                        variant="ghost"
                        icon="i-lucide-pencil"
                        size="sm"
                        :disabled="!canUpdateStaff"
                        @click="openStaffEdit(s)"
                      />
                    </UTooltip>
                    <UTooltip :text="canDeleteStaff ? t('allies.staff.unlinkTooltip') : t('allies.noPermission')">
                      <UButton
                        color="error"
                        variant="ghost"
                        icon="i-lucide-user-minus"
                        size="sm"
                        :disabled="!canDeleteStaff"
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

    <!-- Service modal -->
    <UModal
      v-model:open="svcFormOpen"
      :title="svcMode === 'create' ? t('allies.services.form.createTitle') : t('allies.services.form.editTitle')"
      :description="svcMode === 'create' ? t('allies.services.form.createDescription') : t('allies.services.form.editDescription')"
    >
      <template #body>
        <UForm
          ref="svcFormRef"
          :schema="svcSchema"
          :state="svcState"
          class="space-y-4"
          @submit="onSvcSubmit"
        >
          <UFormField :label="t('allies.services.form.fields.category')" name="serviceCategoryUuid" required>
            <USelectMenu
              clear
              v-model="svcState.serviceCategoryUuid"
              :items="categoryOptions"
              label-key="label"
              value-key="value"
              :placeholder="t('common.select')"
              class="w-full"
            />
          </UFormField>

          <UFormField :label="t('allies.services.form.fields.name')" name="name" required>
            <UInput v-model="svcState.name" class="w-full" />
          </UFormField>

          <UFormField :label="t('allies.services.form.fields.description')" name="description">
            <UTextarea v-model="svcState.description" :rows="2" class="w-full" />
          </UFormField>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField :label="t('allies.services.form.fields.price')" name="priceUsd">
              <UInput v-model="svcState.priceUsd" placeholder="100.00" class="w-full" />
            </UFormField>
            <UFormField :label="t('allies.services.form.fields.discount')" name="discountPct">
              <UInput v-model="svcState.discountPct" placeholder="10.00" class="w-full" />
            </UFormField>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField :label="t('allies.services.form.fields.requiresAppointment')" name="requiresAppointment">
              <USwitch v-model="svcState.requiresAppointment" />
            </UFormField>
            <UFormField v-if="svcMode === 'edit'" :label="t('allies.services.form.fields.published')" name="published">
              <USwitch v-model="svcState.published" />
            </UFormField>
          </div>

        </UForm>
      </template>

      <template #footer>
        <div class="w-full space-y-2">
          <p class="text-xs text-prohealth-500">{{ t('common.requiredFieldsHint') }}</p>

          <div class="flex items-center justify-between gap-3">
            <div v-if="svcMode === 'edit' && svcEditingItem">
              <UTooltip :text="canDelete ? t('common.delete') : t('allies.noPermission')">
                <UButton
                  color="error"
                  variant="ghost"
                  icon="i-lucide-trash-2"
                  size="sm"
                  :label="t('common.delete')"
                  :disabled="svcSubmitting || !canDelete"
                  @click="openSvcDeleteFromEdit"
                />
              </UTooltip>
            </div>
            <div v-else />

            <div class="flex items-center gap-3">
              <UButton color="neutral" variant="ghost" :disabled="svcSubmitting" @click="svcFormOpen = false">
                {{ t('common.cancel') }}
              </UButton>
              <UButton color="primary" :loading="svcSubmitting" icon="i-lucide-save" @click="svcFormRef?.submit()">
                {{ svcMode === 'create' ? t('allies.services.add') : t('common.saveChanges') }}
              </UButton>
            </div>
          </div>
        </div>
      </template>
    </UModal>

    <!-- Delete service modal -->
    <UModal v-model:open="svcDeleteOpen" :title="t('allies.services.delete.title')">
      <template #body>
        <i18n-t keypath="allies.services.delete.confirm" tag="p" class="text-sm text-prohealth-700" scope="global">
          <template #name>
            <span class="font-semibold">{{ svcTarget?.name }}</span>
          </template>
        </i18n-t>
        <div class="flex items-center justify-end gap-3 pt-5">
          <UButton color="neutral" variant="ghost" :disabled="svcDeleting" @click="svcDeleteOpen = false">
            {{ t('common.cancel') }}
          </UButton>
          <UButton color="error" :loading="svcDeleting" icon="i-lucide-trash-2" @click="confirmSvcDelete">
            {{ t('common.delete') }}
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Agreement modal -->
    <UModal
      v-model:open="agrFormOpen"
      :title="agrMode === 'create' ? t('allies.agreements.form.createTitle') : t('allies.agreements.form.editTitle')"
      :description="t('allies.agreements.form.description')"
    >
      <template #body>
        <UForm
          ref="agrFormRef"
          :schema="agrSchema"
          :state="agrState"
          class="space-y-4"
          @submit="onAgrSubmit"
        >
          <UFormField :label="t('allies.agreements.form.fields.type')" name="agreementType" required>
            <USelectMenu
              clear
              v-model="agrState.agreementType"
              :items="agreementTypeOptions"
              label-key="label"
              value-key="value"
              :placeholder="t('common.select')"
              class="w-full"
            />
          </UFormField>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField :label="t('allies.agreements.form.fields.startDate')" name="startDate" required>
              <UInput v-model="agrState.startDate" type="date" class="w-full" />
            </UFormField>
            <UFormField :label="t('allies.agreements.form.fields.endDate')" name="endDate">
              <UInput v-model="agrState.endDate" type="date" class="w-full" />
            </UFormField>
          </div>

          <UFormField :label="t('allies.agreements.form.fields.terms')" name="terms" required>
            <UTextarea v-model="agrState.terms" :rows="3" class="w-full" />
          </UFormField>

          <UFormField :label="t('allies.agreements.form.fields.signedPdfUrl')" name="signedPdfUrl">
            <UInput v-model="agrState.signedPdfUrl" placeholder="https://…" class="w-full" />
          </UFormField>

          <UFormField v-if="agrMode === 'edit'" :label="t('allies.agreements.form.fields.status')" name="status">
            <USelectMenu
              clear
              v-model="agrState.status"
              :items="agrStatusOptions"
              label-key="label"
              value-key="value"
              class="w-full"
            />
          </UFormField>

        </UForm>
      </template>

      <template #footer>
        <div class="w-full space-y-2">
          <p class="text-xs text-prohealth-500">{{ t('common.requiredFieldsHint') }}</p>

          <div class="flex items-center justify-between gap-3">
            <div v-if="agrMode === 'edit' && agrEditingItem && canDeleteAgreements">
              <UButton
                color="error"
                variant="ghost"
                icon="i-lucide-trash-2"
                size="sm"
                :label="t('common.delete')"
                :disabled="agrSubmitting"
                @click="openAgrDeleteFromEdit"
              />
            </div>
            <div v-else />

            <div class="flex items-center gap-3">
              <UButton color="neutral" variant="ghost" :disabled="agrSubmitting" @click="agrFormOpen = false">
                {{ t('common.cancel') }}
              </UButton>
              <UButton color="primary" :loading="agrSubmitting" icon="i-lucide-save" @click="agrFormRef?.submit()">
                {{ agrMode === 'create' ? t('allies.agreements.add') : t('common.saveChanges') }}
              </UButton>
            </div>
          </div>
        </div>
      </template>
    </UModal>

    <!-- Delete agreement modal -->
    <UModal v-model:open="agrDeleteOpen" :title="t('allies.agreements.delete.title')">
      <template #body>
        <i18n-t keypath="allies.agreements.delete.confirm" tag="p" class="text-sm text-prohealth-700" scope="global">
          <template #type>
            <span class="font-semibold">{{ agrTarget?.agreementType_Display ?? agrTypeLabel(agrTarget?.agreementType) }}</span>
          </template>
        </i18n-t>
        <div class="flex items-center justify-end gap-3 pt-5">
          <UButton color="neutral" variant="ghost" :disabled="agrDeleting" @click="agrDeleteOpen = false">
            {{ t('common.cancel') }}
          </UButton>
          <UButton color="error" :loading="agrDeleting" icon="i-lucide-trash-2" @click="confirmAgrDelete">
            {{ t('common.delete') }}
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Assign/edit staff modal -->
    <UModal
      v-model:open="staffFormOpen"
      :title="staffMode === 'create' ? t('allies.staff.form.createTitle') : t('allies.staff.form.editTitle')"
      :description="t('allies.staff.form.description')"
    >
      <template #body>
        <UForm
          ref="staffFormRef"
          :schema="staffSchema"
          :state="staffState"
          class="space-y-4"
          @submit="onStaffSubmit"
        >
          <UFormField v-if="staffMode === 'create'" :label="t('allies.staff.form.fields.user')" name="userUuid" required>
            <USelectMenu
              clear
              v-model="staffState.userUuid"
              :items="userOptions"
              label-key="label"
              value-key="value"
              :placeholder="t('allies.staff.form.selectUser')"
              class="w-full"
            />
          </UFormField>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField :label="t('allies.staff.form.fields.role')" name="allyRole" required>
              <USelectMenu
                clear
                v-model="staffState.allyRole"
                :items="allyRoleOptions"
                label-key="label"
                value-key="value"
                :placeholder="t('common.select')"
                class="w-full"
              />
            </UFormField>
            <UFormField :label="t('allies.staff.form.fields.joinedAt')" name="joinedAt">
              <UInput v-model="staffState.joinedAt" type="date" class="w-full" />
            </UFormField>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField :label="t('allies.staff.form.fields.primary')" name="primary">
              <USwitch v-model="staffState.primary" :disabled="staffState.allyRole !== 'OWNER'" />
            </UFormField>
            <UFormField v-if="staffMode === 'edit'" :label="t('allies.staff.form.fields.status')" name="status">
              <USelectMenu
                clear
                v-model="staffState.status"
                :items="staffStatusOptions"
                label-key="label"
                value-key="value"
                class="w-full"
              />
            </UFormField>
          </div>

        </UForm>
      </template>

      <template #footer>
        <div class="w-full space-y-2">
          <p class="text-xs text-prohealth-500">{{ t('common.requiredFieldsHint') }}</p>

          <div class="flex items-center justify-between gap-3">
            <div v-if="staffMode === 'edit' && staffEditingItem && canDeleteStaff">
              <UTooltip :text="t('allies.staff.unlinkTooltip')">
                <UButton
                  color="error"
                  variant="ghost"
                  icon="i-lucide-user-minus"
                  size="sm"
                  :label="t('common.delete')"
                  :disabled="staffSubmitting"
                  @click="openStaffDeleteFromEdit"
                />
              </UTooltip>
            </div>
            <div v-else />

            <div class="flex items-center gap-3">
              <UButton color="neutral" variant="ghost" :disabled="staffSubmitting" @click="staffFormOpen = false">
                {{ t('common.cancel') }}
              </UButton>
              <UButton color="primary" :loading="staffSubmitting" icon="i-lucide-save" @click="staffFormRef?.submit()">
                {{ staffMode === 'create' ? t('allies.staff.assign') : t('common.saveChanges') }}
              </UButton>
            </div>
          </div>
        </div>
      </template>
    </UModal>

    <!-- Unlink staff modal -->
    <UModal v-model:open="staffDeleteOpen" :title="t('allies.staff.delete.title')">
      <template #body>
        <i18n-t keypath="allies.staff.delete.confirm" tag="p" class="text-sm text-prohealth-700" scope="global">
          <template #name>
            <span class="font-semibold">{{ staffTarget?.userFullName || staffTarget?.userEmail }}</span>
          </template>
        </i18n-t>
        <div class="flex items-center justify-end gap-3 pt-5">
          <UButton color="neutral" variant="ghost" :disabled="staffDeleting" @click="staffDeleteOpen = false">
            {{ t('common.cancel') }}
          </UButton>
          <UButton color="error" :loading="staffDeleting" icon="i-lucide-user-minus" @click="confirmStaffDelete">
            {{ t('allies.staff.unlinkTooltip') }}
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Audit modal -->
    <AuditModal
      v-if="ally"
      v-model:open="auditOpen"
      entity-key="ally"
      :entity-uuid="ally.uuid"
      :entity-label="ally.name"
      :can-view-changes="canViewAuditChanges"
      :can-view-reports="canViewAuditReports"
    />

    <!-- Edit modal (in place, no navigation away from this page) -->
    <AllyFormModal
      v-model:open="editFormOpen"
      mode="edit"
      :ally="ally"
      :can-delete="canDelete"
      @saved="onAllySaved"
      @restored="onAllyRestored"
      @delete-requested="onAllyDeleteRequested"
    />
  </div>
</template>
