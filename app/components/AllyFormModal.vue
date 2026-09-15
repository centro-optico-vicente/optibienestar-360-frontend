<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { SelectItem } from '~/types/options'
import { toSelectItems } from '~/types/options'
import type {
  AllyDto,
  AllyListItemDto,
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
   * website, specialties…; the full detail is (re-)fetched by uuid before the
   * form is populated, whichever shape is passed in.
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
const { can } = usePermissions()

const canViewAllyType = computed(() => can('ALLY_TYPE_VIEW_ALL'))
const canViewDocumentType = computed(() => can('DOCUMENT_TYPE_VIEW_ALL'))
const canViewState = computed(() => can('STATE_VIEW_ALL'))
const canViewCity = computed(() => can('CITY_VIEW_ALL'))

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
const allyTypeOptions = ref<SelectItem[]>([])
const specialtyOptions = ref<SelectItem[]>([])
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
  const [types, specialties, states] = await Promise.all([
    safeOptions('ally-types'),
    safeOptions('medical-specialties'),
    safeOptions('states'),
  ])
  allyTypeOptions.value = toSelectItems(types)
  specialtyOptions.value = toSelectItems(specialties)
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

const STATUS_OPTIONS = ['ACTIVE', 'INACTIVE', 'SUSPENDED']
function statusLabel(status?: string | null): string {
  return status ? t(`allies.status.${status}`, status) : t('common.empty')
}
const statusOptions = computed(() => STATUS_OPTIONS.map(s => ({ label: statusLabel(s), value: s })))

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

// Locale-reactive schema so validation messages follow the UI locale.
const schema = computed(() => {
  const base = {
    name: z.string().min(3, t('validation.minChars', { n: 3 })),
    allyTypeUuid: z.string({ message: t('validation.required') }).min(1, t('validation.required')),
    taxDocumentType: z.string().optional(),
    taxDocumentNumber: z.string().regex(/^\d*$/, t('validation.digitsOnly')).optional(),
    email: z.string().email(t('validation.emailInvalid')).optional().or(z.literal('')),
    phone: z.string().optional(),
    website: z.string().url(t('validation.invalidUrl')).optional().or(z.literal('')),
    address: z.string().optional(),
    description: z.string().optional(),
    joinedAt: z.string().optional(),
  }
  return props.mode === 'create' ? z.object(base) : z.object({ ...base, status: z.string() })
})

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
  state.name = full.name ?? ''
  state.allyTypeUuid = full.allyType?.uuid
  state.taxDocumentType = full.taxDocumentType || undefined
  state.taxDocumentNumber = full.taxDocumentNumber ?? ''
  state.email = full.email ?? ''
  state.phone = full.phone ?? ''
  state.website = full.website ?? ''
  state.address = full.address ?? ''
  pendingCityUuid.value = full.city?.uuid
  selectedStateUuid.value = full.city?.state_Uuid ?? undefined
  state.description = full.description ?? ''
  state.joinedAt = full.joinedAt ?? ''
  state.published = full.published ?? false
  state.status = full.status || 'ACTIVE'
  state.specialtyUuids = (full.specialties ?? []).map(s => s.uuid)
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

async function onSubmit(_event: FormSubmitEvent<Record<string, unknown>>) {
  isSubmitting.value = true
  try {
    let saved: AllyDto
    if (props.mode === 'create') {
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
      saved = await allies.create(body)
      toast.add({ title: t('allies.createdToast'), color: 'success', icon: 'i-lucide-check-circle' })
    }
    else {
      if (!props.ally) return
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
        // Replaces the full specialties set.
        specialtyUuids: state.specialtyUuids,
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
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('allies.form.fields.name')" name="name" required>
            <UInput v-model="state.name" class="w-full" />
          </UFormField>
          <UFormField :label="t('allies.form.fields.allyType')" name="allyTypeUuid" required>
            <div class="flex items-center gap-2">
              <USelectMenu
                v-model="state.allyTypeUuid"
                :items="allyTypeOptions"
                label-key="label"
                value-key="value"
                :placeholder="t('common.select')"
                class="w-full"
              />
              <CommonEntityQuickLinkButton
                :to="state.allyTypeUuid ? `/dashboard/catalogs/ally-types?edit=${state.allyTypeUuid}` : null"
                :can="canViewAllyType"
                @navigate="goToCatalogRecord"
              />
            </div>
          </UFormField>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('allies.form.fields.taxDocumentType')" name="taxDocumentType">
            <div class="flex items-center gap-2">
              <USelectMenu
                v-model="state.taxDocumentType"
                :items="documentTypeOptions"
                label-key="label"
                value-key="value"
                :placeholder="t('common.select')"
                class="w-full"
              />
              <CommonEntityQuickLinkButton
                :to="state.taxDocumentType ? '/dashboard/catalogs/document-types' : null"
                :can="canViewDocumentType"
                @navigate="goToCatalogRecord"
              />
            </div>
          </UFormField>
          <UFormField :label="t('allies.form.fields.taxDocumentNumber')" name="taxDocumentNumber">
            <UInput v-model="state.taxDocumentNumber" class="w-full" />
          </UFormField>
        </div>

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

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('allies.form.fields.state')" name="stateUuid">
            <div class="flex items-center gap-2">
              <USelectMenu
                v-model="selectedStateUuid"
                :items="stateOptions"
                label-key="label"
                value-key="value"
                :placeholder="t('common.select')"
                class="w-full"
              />
              <CommonEntityQuickLinkButton
                :to="selectedStateUuid ? `/dashboard/catalogs/states?edit=${selectedStateUuid}` : null"
                :can="canViewState"
                @navigate="goToCatalogRecord"
              />
            </div>
          </UFormField>
          <UFormField :label="t('allies.form.fields.city')" name="cityUuid">
            <div class="flex items-center gap-2">
              <USelectMenu
                v-model="state.cityUuid"
                :items="cityOptions"
                label-key="label"
                value-key="value"
                :disabled="!selectedStateUuid"
                :placeholder="t('allies.form.selectCityFirst')"
                class="w-full"
              />
              <CommonEntityQuickLinkButton
                :to="state.cityUuid ? `/dashboard/catalogs/cities?edit=${state.cityUuid}` : null"
                :can="canViewCity"
                @navigate="goToCatalogRecord"
              />
            </div>
          </UFormField>
        </div>

        <UFormField :label="t('allies.form.fields.address')" name="address">
          <UInput v-model="state.address" class="w-full" />
        </UFormField>

        <UFormField :label="t('allies.form.fields.description')" name="description">
          <UTextarea v-model="state.description" :rows="2" class="w-full" />
        </UFormField>

        <UFormField :label="t('allies.form.fields.specialties')" name="specialtyUuids">
          <USelectMenu
            v-model="state.specialtyUuids"
            :items="specialtyOptions"
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
          <UFormField :label="t('allies.form.fields.published')" name="published">
            <USwitch v-model="state.published" />
          </UFormField>
          <UFormField v-if="mode === 'edit'" :label="t('allies.form.fields.status')" name="status">
            <USelectMenu
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
