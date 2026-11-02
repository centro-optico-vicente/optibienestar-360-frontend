<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { SelectItem } from '~/types/options'
import { toSelectItems } from '~/types/options'
import type {
  AllyDto,
  AllyHolderPersonDto,
  AllyHolderPersonRequest,
  AllyListItemDto,
  AllySegment,
  CreateAllyRequest,
  UpdateAllyRequest,
} from '~/types/allies'

// The admin table renders AllyListItemDto rows; the detail page passes a full AllyDto.
type AllyRow = AllyListItemDto | AllyDto

// Shared create/edit form, used by both allies/index.vue (row actions) and
// allies/[uuid].vue ("Editar" button) so the latter no longer has to navigate
// away to the list page just to reopen the modal.
const props = defineProps<{
  open: boolean
  mode: 'create' | 'edit'
  /**
   * The list row (AllyListItemDto) carries flat fields and omits email, tax ID,
   * website, professions, ally types…; the full detail is (re-)fetched by uuid
   * before the form is populated, whichever shape is passed in.
   */
  ally: AllyRow | null
  canDelete: boolean
}>()

const emit = defineEmits<{
  'update:open': [boolean]
  saved: [AllyDto]
  restored: [AllyRow]
  'delete-requested': [AllyRow]
}>()

const { t } = useI18n()
const allies = useAllies()
const toast = useToast()
const promotersApi = usePromoters()
const { can } = usePermissions()

const isOpen = computed({
  get: () => props.open,
  set: v => emit('update:open', v),
})

function goToCatalogRecord(to: string) {
  isOpen.value = false
  navigateTo(to)
}

const isSubmitting = ref(false)
const editLoading = ref(false)
// Save button lives in the modal's #footer slot, outside the <UForm> element,
// so it can't use type="submit"; it triggers validation via this instead.
const formRef = ref<{ submit: () => Promise<void> } | null>(null)

// ---- Lazy-loaded catalogs, fetched only when the modal opens ----
// Ally types carry their segment (V179) so the select only offers the types of
// the ally's segment (hub ADR 0031: an ally never mixes B2B and B2P types).
interface AllyTypeItem extends SelectItem { segment?: AllySegment }
const allyTypeItems = ref<AllyTypeItem[]>([])
const allyTypeOptions = computed<SelectItem[]>(() =>
  allyTypeItems.value.filter(i => !i.segment || i.segment === state.segment))
// B2P host clinic: another commercial (B2B) ally.
const hostAllyOptions = ref<SelectItem[]>([])
const hostAlliesLoaded = ref(false)
const professionOptions = ref<SelectItem[]>([])
const stateOptions = ref<SelectItem[]>([])
const cityOptions = ref<SelectItem[]>([])
const { options: documentTypeOptions, load: loadDocumentTypes } = useDocumentTypes()
// "Asesor que lo captó": the promoter list needs PROMOTER_VIEW_ALL; without it
// the select only shows the currently assigned promoter (from the detail).
const canListPromoters = computed(() => can('PROMOTER_VIEW_ALL'))
const promoterOptions = ref<SelectItem[]>([])
const catalogsLoaded = ref(false)

async function loadPromoterOptions() {
  if (!canListPromoters.value) return
  try {
    const res = await promotersApi.list({ size: 200, sort: ['displayName,asc'] })
    promoterOptions.value = (res.content ?? [])
      .filter(p => !p.system)
      .map(p => ({ label: `${p.displayName} (${p.referralCode || t('common.noCode')})`, value: p.uuid }))
  }
  catch {
    promoterOptions.value = []
  }
}

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
  const loadAllyTypes = async (): Promise<AllyTypeItem[]> => {
    try {
      const items = await useCatalog('/v1/admin/catalogs/ally-types').listAll()
      return items.map(i => ({
        label: i.active ? i.name : `${i.name} (${t('catalogs.status.inactive')})`,
        value: i.uuid,
        segment: i.segment,
      }))
    }
    catch {
      // Without the full catalog the segment is unknown: offer every type.
      return toSelectItems(await safeOptions('ally-types'))
    }
  }
  const [types, professions, states] = await Promise.all([
    loadAllyTypes(),
    safeOptions('professions'),
    safeOptions('states'),
  ])
  allyTypeItems.value = types
  professionOptions.value = toSelectItems(professions)
  stateOptions.value = toSelectItems(states)
  await Promise.all([loadDocumentTypes(), loadPromoterOptions()])
  catalogsLoaded.value = true
}

async function loadHostAllies() {
  if (hostAlliesLoaded.value) return
  try {
    const res = await allies.list({ size: 200, sort: ['name,asc'], filter: 'segment==B2B' })
    hostAllyOptions.value = (res.content ?? [])
      .filter(a => a.uuid !== props.ally?.uuid)
      .map(a => ({ label: a.name, value: a.uuid }))
    hostAlliesLoaded.value = true
  }
  catch {
    hostAllyOptions.value = []
  }
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

const STATUS_OPTIONS = ['ACTIVE', 'INACTIVE', 'SUSPENDED']
function statusLabel(status?: string | null): string {
  return status ? t(`allies.status.${status}`, status) : t('common.empty')
}
const statusOptions = computed(() => STATUS_OPTIONS.map(s => ({ label: statusLabel(s), value: s })))

interface FormState {
  segment: AllySegment
  name: string
  allyTypeUuids: string[]
  // Holder person (V209): the professional (B2P) or the signing representative (B2B)
  holderDocumentType: string
  holderDocumentNumber: string
  holderFirstName: string
  holderLastName: string
  holderBirthDate: string
  holderPhone: string
  holderEmail: string
  // B2P practice site
  hostAllyUuid: string | undefined
  hostName: string
  officeNumber: string
  appointmentPhone: string
  assistantName: string
  // B2B commercial data
  commercialZone: string
  tradeName: string
  foundedYear: string
  cashRegistersCount: string
  branchesCount: string
  hasPos: boolean
  representativePosition: string
  taxDocumentType: string | undefined
  taxDocumentNumber: string
  email: string
  phone: string
  website: string
  whatsapp: string
  instagram: string
  facebook: string
  address: string
  cityUuid: string | undefined
  googleMapsUrl: string
  referralCode: string
  description: string
  joinedAt: string
  published: boolean
  status: string
  professionUuids: string[]
  capturedByPromoterUuid: string | undefined
}

const state = reactive<FormState>({
  segment: 'B2B',
  name: '',
  allyTypeUuids: [],
  holderDocumentType: 'V',
  holderDocumentNumber: '',
  holderFirstName: '',
  holderLastName: '',
  holderBirthDate: '',
  holderPhone: '',
  holderEmail: '',
  hostAllyUuid: undefined,
  hostName: '',
  officeNumber: '',
  appointmentPhone: '',
  assistantName: '',
  commercialZone: '',
  tradeName: '',
  foundedYear: '',
  cashRegistersCount: '',
  branchesCount: '',
  hasPos: false,
  representativePosition: '',

  taxDocumentType: undefined,
  taxDocumentNumber: '',
  email: '',
  phone: '',
  website: '',
  whatsapp: '',
  instagram: '',
  facebook: '',
  address: '',
  cityUuid: undefined,
  googleMapsUrl: '',
  referralCode: '',
  description: '',
  joinedAt: '',
  published: false,
  status: 'ACTIVE',
  professionUuids: [],
  capturedByPromoterUuid: undefined,
})

// Holder loaded with the ally: while its cédula is unchanged the person is
// already linked, so its name fields are read-only (they belong to the person,
// which may also be a member or an advisor). A different cédula links or
// creates another person.
const loadedHolder = ref<AllyHolderPersonDto | null>(null)
const holderLinked = computed(() => !!loadedHolder.value
  && loadedHolder.value.documentType === state.holderDocumentType
  && loadedHolder.value.documentNumber === state.holderDocumentNumber.trim())
// Free-text representative from before V209, shown so it can be moved to a person.
const legacyRepresentative = ref<string | null>(null)

const segmentItems = computed(() => [
  { label: t('allies.segments.B2B'), value: 'B2B' },
  { label: t('allies.segments.B2P'), value: 'B2P' },
])
const personDocumentTypeItems = [
  { label: 'V', value: 'V' },
  { label: 'E', value: 'E' },
]

// Switching segment drops the types of the other segment (the backend rejects a mix).
watch(() => state.segment, (segment) => {
  const allowed = new Set(allyTypeItems.value.filter(i => !i.segment || i.segment === segment).map(i => i.value))
  state.allyTypeUuids = state.allyTypeUuids.filter(uuid => allowed.has(uuid))
  if (segment === 'B2P') loadHostAllies()
})

// Read-only agreement file data shown on edit (assigned by the backend).
const allyNumber = ref<number | null>(null)
const fileNumber = ref<string | null>(null)

// Locale-reactive schema so validation messages follow the UI locale.
const schema = computed(() => {
  const base = {
    name: z.string().min(3, t('validation.minChars', { n: 3 })),
    allyTypeUuids: z.array(z.string()).min(1, t('validation.required')),
    taxDocumentType: z.string().optional(),
    taxDocumentNumber: z.string().regex(/^\d*$/, t('validation.digitsOnly')).optional(),
    email: z.string().email(t('validation.emailInvalid')).optional().or(z.literal('')),
    phone: z.string().optional(),
    website: z.string().url(t('validation.invalidUrl')).optional().or(z.literal('')),
    whatsapp: z.string().optional(),
    instagram: z.string().optional(),
    facebook: z.string().optional(),
    address: z.string().optional(),
    googleMapsUrl: z.string().url(t('validation.invalidUrl')).optional().or(z.literal('')),
    referralCode: z.string().regex(/^[A-Za-z0-9-]{4,20}$/, t('allies.form.referralCodeFormat')).optional().or(z.literal('')),
    description: z.string().optional(),
    joinedAt: z.string().optional(),
    holderDocumentNumber: z.string().regex(/^\d*$/, t('validation.digitsOnly')).optional(),
    holderEmail: z.string().email(t('validation.emailInvalid')).optional().or(z.literal('')),
    foundedYear: z.string().regex(/^(\d{4})?$/, t('allies.form.foundedYearFormat')).optional(),
    cashRegistersCount: z.string().regex(/^\d*$/, t('validation.digitsOnly')).optional(),
    branchesCount: z.string().regex(/^\d*$/, t('validation.digitsOnly')).optional(),
  }
  const shape = props.mode === 'create' ? base : { ...base, status: z.string() }
  // A professional (B2P) ally needs its professional (backend 422 ally.holder.required).
  return z.object(shape).superRefine((_value, ctx) => {
    if (state.segment === 'B2P' && !state.holderDocumentNumber.trim()) {
      ctx.addIssue({ code: 'custom', path: ['holderDocumentNumber'], message: t('validation.required') })
    }
  })
})

function resetForm() {
  state.segment = 'B2B'
  Object.assign(state, {
  holderDocumentType: 'V',
  holderDocumentNumber: '',
  holderFirstName: '',
  holderLastName: '',
  holderBirthDate: '',
  holderPhone: '',
  holderEmail: '',
  hostAllyUuid: undefined,
  hostName: '',
  officeNumber: '',
  appointmentPhone: '',
  assistantName: '',
  commercialZone: '',
  tradeName: '',
  foundedYear: '',
  cashRegistersCount: '',
  branchesCount: '',
  hasPos: false,
  representativePosition: '',
  })
  loadedHolder.value = null
  legacyRepresentative.value = null
  state.name = ''
  state.allyTypeUuids = []
  state.taxDocumentType = undefined
  state.taxDocumentNumber = ''
  state.email = ''
  state.phone = ''
  state.website = ''
  state.whatsapp = ''
  state.instagram = ''
  state.facebook = ''
  state.address = ''
  state.cityUuid = undefined
  state.googleMapsUrl = ''
  state.referralCode = ''
  state.description = ''
  state.joinedAt = ''
  state.published = false
  state.status = 'ACTIVE'
  state.professionUuids = []
  state.capturedByPromoterUuid = undefined
  allyNumber.value = null
  fileNumber.value = null
  selectedStateUuid.value = undefined
  pendingCityUuid.value = undefined
}

// Serialized snapshot of the edit form right after it was populated from the
// server, used to detect unsaved changes before a manual refresh discards them.
const editSnapshot = ref('')
function snapshotEditState() {
  return JSON.stringify({ ...state, selectedStateUuid: selectedStateUuid.value })
}
const isEditDirty = computed(() => editSnapshot.value !== '' && snapshotEditState() !== editSnapshot.value)
const discardConfirmOpen = ref(false)

// Maps a full AllyDto (GET /{uuid}) into the reactive form state.
function populateEditForm(full: AllyDto) {
  state.segment = full.segment ?? 'B2B'
  if (state.segment === 'B2P') loadHostAllies()
  const holder = full.holder ?? null
  loadedHolder.value = holder
  state.holderDocumentType = holder?.documentType ?? 'V'
  state.holderDocumentNumber = holder?.documentNumber ?? ''
  state.holderFirstName = holder?.firstName ?? ''
  state.holderLastName = holder?.lastName ?? ''
  state.holderBirthDate = holder?.birthDate ?? ''
  state.holderPhone = holder?.phone ?? ''
  state.holderEmail = holder?.email ?? ''
  legacyRepresentative.value = !holder && full.representativeName
    ? [full.representativeName, full.representativeDocumentNumber
        ? `${full.representativeDocumentType ?? ''}-${full.representativeDocumentNumber}` : null]
        .filter(Boolean).join(' · ')
    : null
  state.hostAllyUuid = full.hostAlly_Uuid ?? undefined
  if (full.hostAlly_Uuid && !hostAllyOptions.value.some(o => o.value === full.hostAlly_Uuid)) {
    hostAllyOptions.value = [
      ...hostAllyOptions.value,
      { label: full.hostAlly_Display ?? full.hostAlly_Uuid, value: full.hostAlly_Uuid },
    ]
  }
  state.hostName = full.hostName ?? ''
  state.officeNumber = full.officeNumber ?? ''
  state.appointmentPhone = full.appointmentPhone ?? ''
  state.assistantName = full.assistantName ?? ''
  state.commercialZone = full.commercialZone ?? ''
  state.tradeName = full.tradeName ?? ''
  state.foundedYear = full.foundedYear != null ? String(full.foundedYear) : ''
  state.cashRegistersCount = full.cashRegistersCount != null ? String(full.cashRegistersCount) : ''
  state.branchesCount = full.branchesCount != null ? String(full.branchesCount) : ''
  state.hasPos = full.hasPos ?? false
  state.representativePosition = full.representativePosition ?? ''
  state.name = full.name ?? ''
  state.allyTypeUuids = (full.allyTypes ?? []).map(at => at.uuid)
  state.taxDocumentType = full.taxDocumentType || undefined
  state.taxDocumentNumber = full.taxDocumentNumber ?? ''
  state.email = full.email ?? ''
  state.phone = full.phone ?? ''
  state.website = full.website ?? ''
  state.whatsapp = full.whatsapp ?? ''
  state.instagram = full.instagram ?? ''
  state.facebook = full.facebook ?? ''
  state.address = full.address ?? ''
  pendingCityUuid.value = full.city?.uuid
  selectedStateUuid.value = full.city?.state_Uuid ?? undefined
  state.googleMapsUrl = full.googleMapsUrl ?? ''
  state.referralCode = full.referralCode ?? ''
  state.description = full.description ?? ''
  state.joinedAt = full.joinedAt ?? ''
  state.published = full.published ?? false
  state.status = full.status || 'ACTIVE'
  state.professionUuids = (full.professions ?? []).map(s => s.uuid)
  state.capturedByPromoterUuid = full.capturedByPromoter_Uuid ?? undefined
  // Keep the assigned promoter selectable even if the list is unavailable/filtered.
  if (full.capturedByPromoter_Uuid && !promoterOptions.value.some(o => o.value === full.capturedByPromoter_Uuid)) {
    promoterOptions.value = [
      ...promoterOptions.value,
      { label: full.capturedByPromoter_Display ?? full.capturedByPromoter_Uuid, value: full.capturedByPromoter_Uuid },
    ]
  }
  allyNumber.value = full.allyNumber ?? null
  fileNumber.value = full.fileNumber ?? null
  editSnapshot.value = snapshotEditState()
}

// Populate/reset the form whenever the modal opens (mode/ally are set by the parent beforehand).
watch(() => props.open, async (open) => {
  if (!open) return
  await loadCatalogs()
  resetForm()
  editSnapshot.value = ''
  if (props.mode !== 'edit' || !props.ally) return
  // The list row (AllyListItemDto) omits several fields the form needs; always
  // (re-)fetch the full detail so the form is populated reliably either way.
  editLoading.value = true
  try {
    populateEditForm(await allies.get(props.ally.uuid))
  }
  catch {
    // The detail failed to load (useApi already notified); close the modal.
    isOpen.value = false
  }
  finally {
    editLoading.value = false
  }
})

// Re-fetches the ally and repopulates the form, discarding any local edits.
async function reloadEditForm() {
  if (!props.ally) return
  discardConfirmOpen.value = false
  editLoading.value = true
  try {
    populateEditForm(await allies.get(props.ally.uuid))
  }
  catch {
    // useApi already notified; keep the modal open with the current values.
  }
  finally {
    editLoading.value = false
  }
}

function onEditRefresh() {
  if (isEditDirty.value) discardConfirmOpen.value = true
  else reloadEditForm()
}

function toNumber(value: string): number | undefined {
  return value.trim() === '' ? undefined : Number(value)
}

/**
 * Holder to send: always on create when a cédula is entered; on edit only when
 * the cédula changed (or there was none) — an already-linked person is never
 * overwritten from this form.
 */
function holderBody(): AllyHolderPersonRequest | undefined {
  const documentNumber = state.holderDocumentNumber.trim()
  if (!documentNumber || holderLinked.value) return undefined
  return {
    documentType: state.holderDocumentType,
    documentNumber,
    firstName: state.holderFirstName.trim() || undefined,
    lastName: state.holderLastName.trim() || undefined,
    birthDate: state.holderBirthDate || undefined,
    phone: state.holderPhone.trim() || undefined,
    email: state.holderEmail.trim() || undefined,
  }
}

/**
 * Only the fields of the ally's segment travel: the backend rejects (422) the
 * other segment's fields and wipes them itself when the segment changes. On
 * edit, blank text clears a field ('' instead of undefined).
 */
function segmentBody(clearBlanks: boolean): Partial<CreateAllyRequest> {
  const text = (value: string) => value.trim() || (clearBlanks ? '' : undefined)
  if (state.segment === 'B2P') {
    return {
      hostAllyUuid: state.hostAllyUuid,
      hostName: state.hostAllyUuid ? text('') : text(state.hostName),
      officeNumber: text(state.officeNumber),
      appointmentPhone: text(state.appointmentPhone),
      assistantName: text(state.assistantName),
    }
  }
  return {
    commercialZone: text(state.commercialZone),
    tradeName: text(state.tradeName),
    foundedYear: toNumber(state.foundedYear),
    cashRegistersCount: toNumber(state.cashRegistersCount),
    branchesCount: toNumber(state.branchesCount),
    hasPos: state.hasPos,
    representativePosition: text(state.representativePosition),
  }
}

async function onSubmit(_event: FormSubmitEvent<Record<string, unknown>>) {
  isSubmitting.value = true
  try {
    let saved: AllyDto
    if (props.mode === 'create') {
      const body: CreateAllyRequest = {
        name: state.name,
        allyTypeUuids: state.allyTypeUuids,
        segment: state.segment,
        holder: holderBody(),
        ...segmentBody(false),
        taxDocumentType: state.taxDocumentType || undefined,
        taxDocumentNumber: state.taxDocumentNumber || undefined,
        email: state.email || undefined,
        phone: state.phone || undefined,
        website: state.website || undefined,
        whatsapp: state.whatsapp || undefined,
        instagram: state.instagram || undefined,
        facebook: state.facebook || undefined,
        address: state.address || undefined,
        cityUuid: state.cityUuid,
        googleMapsUrl: state.googleMapsUrl || undefined,
        referralCode: state.referralCode.trim().toUpperCase() || undefined,
        description: state.description || undefined,
        joinedAt: state.joinedAt || undefined,
        published: state.published,
        professionUuids: state.professionUuids.length ? state.professionUuids : undefined,
        capturedByPromoterUuid: state.capturedByPromoterUuid,
      }
      saved = await allies.create(body)
      toast.add({ title: t('allies.createdToast'), color: 'success', icon: 'i-lucide-check-circle' })
    }
    else {
      if (!props.ally) return
      const body: UpdateAllyRequest = {
        name: state.name,
        allyTypeUuids: state.allyTypeUuids,
        segment: state.segment,
        holder: holderBody(),
        ...segmentBody(true),
        taxDocumentType: state.taxDocumentType || undefined,
        taxDocumentNumber: state.taxDocumentNumber || undefined,
        email: state.email || undefined,
        phone: state.phone || undefined,
        website: state.website || undefined,
        whatsapp: state.whatsapp || undefined,
        instagram: state.instagram || undefined,
        facebook: state.facebook || undefined,
        address: state.address || undefined,
        cityUuid: state.cityUuid,
        googleMapsUrl: state.googleMapsUrl || undefined,
        // Empty string clears the code.
        referralCode: state.referralCode.trim().toUpperCase(),
        description: state.description || undefined,
        joinedAt: state.joinedAt || undefined,
        published: state.published,
        status: state.status,
        // Replaces the full professions set.
        professionUuids: state.professionUuids,
        // PATCH semantics: an omitted promoter keeps the current one (it can be changed, not cleared).
        capturedByPromoterUuid: state.capturedByPromoterUuid,
      }
      saved = await allies.update(props.ally.uuid, body)
      toast.add({ title: t('allies.updatedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    }
    isOpen.value = false
    emit('saved', saved)
  }
  catch {
    // useApi already notified the error (409 duplicate tax ID, 422, etc.)
  }
  finally {
    isSubmitting.value = false
  }
}

const restoring = ref(false)
async function restoreAlly() {
  if (!props.ally) return
  restoring.value = true
  try {
    await allies.restore(props.ally.uuid)
    toast.add({ title: t('allies.restoredToast'), color: 'success', icon: 'i-lucide-check-circle' })
    isOpen.value = false
    emit('restored', props.ally)
  }
  catch {
    // toast handled by useApi
  }
  finally {
    restoring.value = false
  }
}

function requestDelete() {
  if (!props.ally) return
  isOpen.value = false
  emit('delete-requested', props.ally)
}
</script>

<template>
  <UModal
    v-model:open="isOpen"
    :title="mode === 'create' ? t('allies.form.createTitle') : t('allies.form.editTitle')"
    :description="mode === 'create' ? t('allies.form.createDescription') : t('allies.form.editDescription')"
    :ui="{ content: 'max-w-2xl' }"
  >
    <template #body>
      <div v-if="editLoading" class="py-12 flex flex-col items-center justify-center gap-2 text-prohealth-500">
        <UIcon name="i-lucide-loader-circle" class="w-6 h-6 animate-spin" />
        <span class="text-sm">{{ t('allies.form.loadingDetail') }}</span>
      </div>
      <UForm
        v-else
        ref="formRef"
        :schema="schema"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <!-- Segment first: it decides which types and fields apply (hub ADR 0031). -->
        <UFormField :label="t('allies.form.fields.segment')" name="segment" :help="t('allies.form.segmentHelp')" required>
          <URadioGroup
            v-model="state.segment"
            :items="segmentItems"
            orientation="horizontal"
            value-key="value"
            label-key="label"
          />
        </UFormField>

        <!-- Agreement file number (B2B "0007" / B2P "ASE001-0007") — assigned by the backend, read-only. -->
        <div v-if="mode === 'edit' && (allyNumber || fileNumber)" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('allies.form.fields.allyNumber')" name="allyNumber">
            <UInput :model-value="String(allyNumber ?? '')" disabled class="w-full font-mono" />
          </UFormField>
          <UFormField :label="t('allies.form.fields.fileNumber')" name="fileNumber" :help="t('allies.form.fileNumberHelp')">
            <UInput :model-value="fileNumber ?? ''" disabled class="w-full font-mono" />
          </UFormField>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="state.segment === 'B2P' ? t('allies.form.fields.nameProfessional') : t('allies.form.fields.name')" name="name" required>
            <UInput v-model="state.name" class="w-full" />
          </UFormField>
          <UFormField :label="t('allies.form.fields.allyTypes')" name="allyTypeUuids" required>
            <USelectMenu
              clear
              v-model="state.allyTypeUuids"
              :items="allyTypeOptions"
              label-key="label"
              value-key="value"
              multiple
              icon="i-lucide-tags"
              :placeholder="t('allies.form.selectMultiple')"
              class="w-full"
            />
          </UFormField>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('allies.form.fields.taxDocumentType')" name="taxDocumentType">
            <CommonEntityReferenceSelect
              v-model="state.taxDocumentType"
              :items="documentTypeOptions"
              entity="document_type"
              :placeholder="t('common.select')"
              @navigate="goToCatalogRecord"
            />
          </UFormField>
          <UFormField :label="t('allies.form.fields.taxDocumentNumber')" name="taxDocumentNumber">
            <UInput v-model="state.taxDocumentNumber" class="w-full" />
          </UFormField>
        </div>

        <!-- Holder person (V209): the professional (B2P) or the signing representative (B2B). -->
        <fieldset class="rounded-xl border border-prohealth-100 p-4 space-y-4">
          <legend class="px-1 text-sm font-semibold text-prohealth-800">
            {{ state.segment === 'B2P' ? t('allies.form.holder.professionalTitle') : t('allies.form.holder.representativeTitle') }}
          </legend>
          <p class="text-xs text-prohealth-500">{{ t('allies.form.holder.help') }}</p>
          <p v-if="legacyRepresentative" class="text-xs text-amber-600">
            {{ t('allies.form.holder.legacy', { name: legacyRepresentative }) }}
          </p>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <UFormField :label="t('allies.form.fields.holderDocumentType')" name="holderDocumentType">
              <USelect v-model="state.holderDocumentType" :items="personDocumentTypeItems" class="w-full" />
            </UFormField>
            <UFormField
              class="sm:col-span-2"
              :label="t('allies.form.fields.holderDocumentNumber')"
              name="holderDocumentNumber"
              :required="state.segment === 'B2P'"
            >
              <UInput v-model="state.holderDocumentNumber" icon="i-lucide-id-card" class="w-full" />
            </UFormField>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField :label="t('allies.form.fields.holderFirstName')" name="holderFirstName">
              <UInput v-model="state.holderFirstName" :disabled="holderLinked" class="w-full" />
            </UFormField>
            <UFormField :label="t('allies.form.fields.holderLastName')" name="holderLastName">
              <UInput v-model="state.holderLastName" :disabled="holderLinked" class="w-full" />
            </UFormField>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <UFormField :label="t('allies.form.fields.holderBirthDate')" name="holderBirthDate">
              <UInput v-model="state.holderBirthDate" type="date" :disabled="holderLinked" class="w-full" />
            </UFormField>
            <UFormField :label="t('allies.form.fields.holderPhone')" name="holderPhone">
              <UInput v-model="state.holderPhone" :disabled="holderLinked" class="w-full" />
            </UFormField>
            <UFormField :label="t('allies.form.fields.holderEmail')" name="holderEmail">
              <UInput v-model="state.holderEmail" type="email" :disabled="holderLinked" class="w-full" />
            </UFormField>
          </div>
          <p v-if="holderLinked" class="text-xs text-prohealth-500">{{ t('allies.form.holder.linkedHint') }}</p>
          <UFormField
            v-if="state.segment === 'B2B'"
            :label="t('allies.form.fields.representativePosition')"
            name="representativePosition"
          >
            <UInput v-model="state.representativePosition" :placeholder="t('allies.form.representativePositionPlaceholder')" class="w-full" />
          </UFormField>
        </fieldset>

        <!-- B2P: where the professional practices (Convenio Profesional §III). -->
        <fieldset v-if="state.segment === 'B2P'" class="rounded-xl border border-prohealth-100 p-4 space-y-4">
          <legend class="px-1 text-sm font-semibold text-prohealth-800">{{ t('allies.form.site.title') }}</legend>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField :label="t('allies.form.fields.hostAlly')" name="hostAllyUuid" :help="t('allies.form.site.hostAllyHelp')">
              <USelectMenu
                v-model="state.hostAllyUuid"
                clear
                :items="hostAllyOptions"
                label-key="label"
                value-key="value"
                icon="i-lucide-hospital"
                :placeholder="t('common.select')"
                class="w-full"
              />
            </UFormField>
            <UFormField :label="t('allies.form.fields.hostName')" name="hostName">
              <UInput v-model="state.hostName" :disabled="!!state.hostAllyUuid" class="w-full" />
            </UFormField>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <UFormField :label="t('allies.form.fields.officeNumber')" name="officeNumber">
              <UInput v-model="state.officeNumber" class="w-full" />
            </UFormField>
            <UFormField :label="t('allies.form.fields.appointmentPhone')" name="appointmentPhone">
              <UInput v-model="state.appointmentPhone" icon="i-lucide-phone" class="w-full" />
            </UFormField>
            <UFormField :label="t('allies.form.fields.assistantName')" name="assistantName">
              <UInput v-model="state.assistantName" class="w-full" />
            </UFormField>
          </div>
        </fieldset>

        <!-- B2B: operating structure (Convenio Comercial §I–IV). -->
        <fieldset v-else class="rounded-xl border border-prohealth-100 p-4 space-y-4">
          <legend class="px-1 text-sm font-semibold text-prohealth-800">{{ t('allies.form.commercial.title') }}</legend>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField :label="t('allies.form.fields.tradeName')" name="tradeName">
              <UInput v-model="state.tradeName" class="w-full" />
            </UFormField>
            <UFormField :label="t('allies.form.fields.commercialZone')" name="commercialZone">
              <UInput v-model="state.commercialZone" class="w-full" />
            </UFormField>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <UFormField :label="t('allies.form.fields.foundedYear')" name="foundedYear">
              <UInput v-model="state.foundedYear" inputmode="numeric" class="w-full" />
            </UFormField>
            <UFormField :label="t('allies.form.fields.cashRegistersCount')" name="cashRegistersCount">
              <UInput v-model="state.cashRegistersCount" inputmode="numeric" class="w-full" />
            </UFormField>
            <UFormField :label="t('allies.form.fields.branchesCount')" name="branchesCount">
              <UInput v-model="state.branchesCount" inputmode="numeric" class="w-full" />
            </UFormField>
            <UFormField :label="t('allies.form.fields.hasPos')" name="hasPos">
              <USwitch v-model="state.hasPos" />
            </UFormField>
          </div>
        </fieldset>

        <UFormField :label="t('allies.form.fields.capturedByPromoter')" name="capturedByPromoterUuid" :help="t('allies.form.capturedByPromoterHelp')">
          <!-- Clearable only on create: the update is PATCH, so an omitted promoter keeps the current one. -->
          <USelectMenu
            v-model="state.capturedByPromoterUuid"
            :clear="mode === 'create'"
            :items="promoterOptions"
            label-key="label"
            value-key="value"
            icon="i-lucide-user-check"
            :placeholder="t('common.select')"
            class="w-full"
          />
        </UFormField>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('allies.form.fields.email')" name="email">
            <UInput v-model="state.email" type="email" class="w-full" />
          </UFormField>
          <UFormField :label="t('allies.form.fields.phone')" name="phone">
            <UInput v-model="state.phone" class="w-full" />
          </UFormField>
        </div>

        <UFormField :label="t('allies.form.fields.website')" name="website">
          <UInput v-model="state.website" placeholder="https://…" class="w-full" />
        </UFormField>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <UFormField :label="t('allies.form.fields.whatsapp')" name="whatsapp">
            <UInput v-model="state.whatsapp" icon="i-simple-icons-whatsapp" placeholder="+58 414 0000000" class="w-full" />
          </UFormField>
          <UFormField :label="t('allies.form.fields.instagram')" name="instagram">
            <UInput v-model="state.instagram" icon="i-simple-icons-instagram" placeholder="https://instagram.com/…" class="w-full" />
          </UFormField>
          <UFormField :label="t('allies.form.fields.facebook')" name="facebook">
            <UInput v-model="state.facebook" icon="i-simple-icons-facebook" placeholder="https://facebook.com/…" class="w-full" />
          </UFormField>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('allies.form.fields.state')" name="stateUuid">
            <CommonEntityReferenceSelect
              v-model="selectedStateUuid"
              :items="stateOptions"
              entity="state"
              :placeholder="t('common.select')"
              @navigate="goToCatalogRecord"
            />
          </UFormField>
          <UFormField :label="t('allies.form.fields.city')" name="cityUuid">
            <CommonEntityReferenceSelect
              v-model="state.cityUuid"
              :items="cityOptions"
              :disabled="!selectedStateUuid"
              entity="city"
              :placeholder="t('allies.form.selectCityFirst')"
              @navigate="goToCatalogRecord"
            />
          </UFormField>
        </div>

        <UFormField :label="t('allies.form.fields.address')" name="address">
          <UInput v-model="state.address" class="w-full" />
        </UFormField>

        <UFormField :label="t('allies.form.fields.googleMapsUrl')" name="googleMapsUrl">
          <UInput v-model="state.googleMapsUrl" icon="i-lucide-map-pin" placeholder="https://maps.app.goo.gl/…" class="w-full" />
        </UFormField>

        <UFormField :label="t('allies.form.fields.referralCode')" name="referralCode" :help="t('allies.form.referralCodeHelp')">
          <UInput v-model="state.referralCode" icon="i-lucide-ticket" placeholder="ALIADO-01" class="w-full font-mono uppercase" />
        </UFormField>

        <UFormField :label="t('allies.form.fields.description')" name="description">
          <UTextarea v-model="state.description" :rows="2" class="w-full" />
        </UFormField>

        <UFormField :label="t('allies.form.fields.professions')" name="professionUuids">
          <USelectMenu
            clear
            v-model="state.professionUuids"
            :items="professionOptions"
            label-key="label"
            value-key="value"
            multiple
            icon="i-lucide-list-checks"
            :placeholder="t('allies.form.selectMultiple')"
            class="w-full"
          />
        </UFormField>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <UFormField :label="t('allies.form.fields.joinedAt')" name="joinedAt">
            <UInput v-model="state.joinedAt" type="date" class="w-full" />
          </UFormField>
          <UFormField :label="t('allies.form.fields.published')" name="published" :help="t('allies.form.publishedHelp')">
            <USwitch v-model="state.published" />
          </UFormField>
          <UFormField v-if="mode === 'edit'" :label="t('allies.form.fields.status')" name="status">
            <USelectMenu
              clear
              v-model="state.status"
              :items="statusOptions"
              label-key="label"
              value-key="value"
              class="w-full"
            />
            <!-- `status` is the business state; `active === false` means the record
                 is soft-deleted. Clarify the distinction next to Restaurar. -->
            <template v-if="ally?.active === false" #help>
              <span class="text-amber-600">{{ t('allies.form.softDeletedHint') }}</span>
            </template>
          </UFormField>
        </div>

      </UForm>

      <!-- Discard-unsaved-changes confirmation for the edit modal's refresh button -->
      <UModal v-model:open="discardConfirmOpen" :title="t('common.discardChangesTitle')">
        <template #body>
          <p class="text-sm text-prohealth-700">{{ t('common.discardChangesBody') }}</p>
          <div class="flex items-center justify-end gap-3 pt-5">
            <UButton color="neutral" variant="ghost" @click="discardConfirmOpen = false">
              {{ t('common.cancel') }}
            </UButton>
            <UButton color="warning" icon="i-lucide-refresh-cw" @click="reloadEditForm">
              {{ t('common.discardAndRefresh') }}
            </UButton>
          </div>
        </template>
      </UModal>
    </template>

    <template #footer>
      <div class="w-full space-y-2">
        <p class="text-xs text-prohealth-500">{{ t('common.requiredFieldsHint') }}</p>

        <div class="flex items-center justify-between gap-3">
          <div v-if="mode === 'edit' && ally" class="flex items-center gap-2">
            <RestoreButton
              v-if="ally.active === false"
              :active="ally.active"
              :allowed="canDelete"
              :loading="restoring"
              :disabled="isSubmitting"
              @restore="restoreAlly"
            />
            <UTooltip v-else :text="canDelete ? t('common.delete') : t('allies.noPermissionDelete')">
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
              :loading="editLoading"
              :disabled="isSubmitting"
              :icon-only="false"
              :label="t('common.refresh')"
              :title="t('common.refresh')"
              @refresh="onEditRefresh"
            />
            <UButton color="neutral" variant="ghost" :disabled="isSubmitting" @click="isOpen = false">
              {{ t('common.cancel') }}
            </UButton>
            <UButton
              :color="mode === 'create' ? 'primary' : 'info'"
              variant="outline"
              :loading="isSubmitting"
              :disabled="editLoading"
              icon="i-lucide-save"
              @click="formRef?.submit()"
            >
              {{ mode === 'create' ? t('common.saveNew') : t('common.saveChanges') }}
            </UButton>
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>
