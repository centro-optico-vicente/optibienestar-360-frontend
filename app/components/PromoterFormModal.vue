<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { SelectItem } from '~/types/options'
import type {
  PromoterCreateRequest,
  PromoterDto,
  PromoterStatus,
  PromoterUpdateRequest,
} from '~/types/promoters'
import { PROMOTER_STATUS_OPTIONS } from '~/types/promoters'

// Promoter create/edit form, shared by the list (/dashboard/promoters) and the detail
// (/dashboard/promoters/[uuid]) so the fields + validation aren't duplicated.
// The parent controls opening (v-model:open) and gates the permission of the button
// that opens it (PROMOTER_CREATE / PROMOTER_UPDATE); on save it emits `saved` to reload.
//
// The system row (INSTITUCION) can't be edited — the parent disables its edit button,
// so this modal only ever handles human promoters. On create the referralCode +
// userUuid are required (the linked Person is derived server-side from the user);
// on edit (PATCH) they are read-only/hidden.
const props = defineProps<{
  open: boolean
  /** If provided, the modal is in edit mode; if null/undefined, in create mode. */
  promoter?: PromoterDto | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'saved': [promoter: PromoterDto]
  /** Shortcut so the parent can close this modal and open its delete confirmation. */
  'delete': [promoter: PromoterDto]
}>()

const { t } = useI18n()
const promoters = usePromoters()
const users = useUsers()
const promoterTypeOptions = useCatalogOptions('promoter-types')
const toast = useToast()
const { can } = usePermissions()

const canDelete = computed(() => can('PROMOTER_DELETE'))

const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})
const mode = computed<'create' | 'edit'>(() => (props.promoter ? 'edit' : 'create'))
const isSubmitting = ref(false)
// Save button lives in the modal's #footer slot, outside the <UForm> element,
// so it can't use type="submit"; it triggers validation via this instead.
const formRef = ref<{ submit: () => Promise<void> } | null>(null)

// Status options localized at the consumption point (labelKey → i18n).
const statusOptions = computed(() =>
  PROMOTER_STATUS_OPTIONS.map(o => ({ label: t(o.labelKey), value: o.value })),
)

interface FormState {
  displayName: string
  referralCode: string
  userUuid: string
  description: string
  email: string
  phone: string
  promoterTypeUuid: string
  status: PromoterStatus | undefined
  active: boolean
}

const state = reactive<FormState>({
  displayName: '',
  referralCode: '',
  userUuid: '',
  description: '',
  email: '',
  phone: '',
  promoterTypeUuid: '',
  status: 'ACTIVE',
  active: true,
})

// Loaded once when the modal opens — small fixed catalog, no search needed.
const promoterTypeItems = ref<SelectItem[]>([])
watch(() => props.open, async (open) => {
  if (!open || promoterTypeItems.value.length) return
  try {
    const res = await promoterTypeOptions.options({ limit: 100 })
    promoterTypeItems.value = res.map(o => ({ label: o.label, value: o.uuid }))
  }
  catch {
    promoterTypeItems.value = []
  }
})

// ---- User search (create-only; server-side, debounced) ----
// Feeds state.userUuid directly — the select's value IS the user's uuid.
// Search box lives inside the USelectMenu itself (search-term) so typing and
// picking a result happen in the same field instead of two separate widgets.
const userSearchTerm = ref('')
const userOptions = ref<SelectItem[]>([])
const searchingUsers = ref(false)

let userSearchTimer: ReturnType<typeof setTimeout> | undefined
watch(userSearchTerm, (q) => {
  clearTimeout(userSearchTimer)
  const term = q.trim()
  // Don't clear userOptions here: USelectMenu resets search-term to '' right after a
  // pick (resetSearchTermOnSelect/Blur), and wiping the list at that point would drop
  // the just-selected item, making the trigger fall back to showing the raw uuid
  // instead of its label.
  if (term.length < 2) return
  userSearchTimer = setTimeout(async () => {
    searchingUsers.value = true
    try {
      const res = await users.options({ q: term, limit: 10 })
      userOptions.value = res.map(o => ({ label: o.label, value: o.uuid }))
    }
    catch {
      userOptions.value = []
    }
    finally {
      searchingUsers.value = false
    }
  }, 400)
})

// Autofill name/email/phone from the selected user (create-only). The Person linked
// to the promoter is derived server-side from the user (User → Person is a mandatory
// 1:1 FK), so the frontend never picks/sends a personUuid — only fills empty fields
// so it never clobbers a manual edit made before or after picking the user; the
// operator can still change any of them before saving.
watch(() => state.userUuid, async (userUuid) => {
  if (mode.value !== 'create' || !userUuid) return
  try {
    const detail = await users.get(userUuid)
    if (!state.displayName) state.displayName = detail.fullName ?? ''
    if (!state.email) state.email = detail.email ?? ''
    if (!state.phone) state.phone = detail.phone ?? ''
  }
  catch {
    // Silent: autofill is a convenience, not required for the form to work.
  }
})

function resetSearchState() {
  userSearchTerm.value = ''
  userOptions.value = []
}

// Locale-reactive schema. On create the referralCode/userUuid are required; on edit
// (PATCH) only the editable subset is validated. Wrapped in computed so the
// validation messages follow the UI locale.
const schema = computed(() => {
  const base = {
    displayName: z.string().min(1, t('validation.required')).max(120, t('validation.maxChars', { n: 120 })),
    description: z.string().optional(),
    email: z.string().email(t('validation.emailInvalid')).optional().or(z.literal('')),
    phone: z.string().optional(),
  }
  if (mode.value === 'create') {
    return z.object({
      ...base,
      referralCode: z.string().regex(/^[A-Z0-9-]{4,20}$/, t('promoters.form.referralCodeFormat')),
      userUuid: z.string().min(1, t('validation.required')).uuid(t('validation.invalidUuid')),
    })
  }
  return z.object(base)
})

// True while the detail loads when opening in edit mode.
const loadingDetail = ref(false)

// Snapshot of the last-loaded edit state, used to warn before a refresh
// discards unsaved changes.
const editSnapshot = ref('')
function snapEditState() { return JSON.stringify(state) }
const isEditDirty = computed(() => editSnapshot.value !== '' && snapEditState() !== editSnapshot.value)
const discardConfirmOpen = ref(false)
const reloading = ref(false)

function populateFrom(p: PromoterDto | null) {
  if (!p) {
    editSnapshot.value = ''
    state.displayName = ''
    state.referralCode = ''
    state.userUuid = ''
    state.description = ''
    state.email = ''
    state.phone = ''
    state.promoterTypeUuid = ''
    state.status = 'ACTIVE'
    state.active = true
    return
  }
  state.displayName = p.displayName ?? ''
  state.referralCode = p.referralCode ?? ''
  state.userUuid = p.user_Uuid ?? ''
  state.description = p.description ?? ''
  state.email = p.email ?? ''
  state.phone = p.phone ?? ''
  state.promoterTypeUuid = p.promoterType_Uuid ?? ''
  state.status = (p.status as PromoterStatus) ?? 'ACTIVE'
  state.active = p.active ?? true
  editSnapshot.value = snapEditState()
}

async function reloadForm() {
  if (!props.promoter) return
  reloading.value = true
  try { populateFrom(await promoters.get(props.promoter.uuid)) }
  catch { /* useApi already notified */ }
  finally { reloading.value = false }
}
function onRefresh() {
  if (isEditDirty.value) discardConfirmOpen.value = true
  else reloadForm()
}
function discardAndRefresh() {
  discardConfirmOpen.value = false
  reloadForm()
}

// On open: in create mode clear the form; in edit mode load the full detail by UUID
// (the received `promoter` may be a list row) to populate reliably.
watch(() => props.open, async (open) => {
  if (!open) return
  resetSearchState()
  if (!props.promoter) {
    populateFrom(null)
    return
  }
  loadingDetail.value = true
  try {
    populateFrom(await promoters.get(props.promoter.uuid))
  }
  catch {
    // If the detail fails to load, use the received record as a fallback.
    populateFrom(props.promoter)
  }
  finally {
    loadingDetail.value = false
  }
})

async function onSubmit(_event: FormSubmitEvent<Record<string, unknown>>) {
  isSubmitting.value = true
  try {
    let result: PromoterDto
    if (mode.value === 'create') {
      const body: PromoterCreateRequest = {
        displayName: state.displayName.trim(),
        referralCode: state.referralCode.trim(),
        userUuid: state.userUuid.trim(),
        description: state.description.trim() || undefined,
        email: state.email.trim() || undefined,
        phone: state.phone.trim() || undefined,
        promoterTypeUuid: state.promoterTypeUuid || undefined,
      }
      result = await promoters.create(body)
      toast.add({ title: t('promoters.createdToast'), color: 'success', icon: 'i-lucide-check-circle' })
    }
    else {
      const body: PromoterUpdateRequest = {
        displayName: state.displayName.trim(),
        description: state.description.trim() || undefined,
        email: state.email.trim() || undefined,
        phone: state.phone.trim() || undefined,
        promoterTypeUuid: state.promoterTypeUuid || undefined,
        status: state.status,
        active: state.active,
      }
      result = await promoters.update(props.promoter!.uuid, body)
      toast.add({ title: t('promoters.updatedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    }
    emit('saved', result)
    isOpen.value = false
  }
  catch {
    // useApi already notified the error (422 duplicate code, validations, etc.)
  }
  finally {
    isSubmitting.value = false
  }
}

// Shortcut from the edit modal so the user doesn't have to close it first
// and hunt for the row's trash icon. Closes this modal and lets the parent
// open its own delete confirmation, so the two dialogs never stack.
function openDeleteFromEdit() {
  if (!props.promoter) return
  isOpen.value = false
  emit('delete', props.promoter)
}

// One-click reactivation for soft-deleted (active === false) promoters — a shortcut
// on top of the `active` switch above, kept consistent with the pattern used across
// every other entity's edit modal.
const restoring = ref(false)

async function restorePromoter() {
  if (!props.promoter) return
  restoring.value = true
  try {
    const result = await promoters.update(props.promoter.uuid, { active: true })
    toast.add({ title: t('promoters.restoredToast'), color: 'success', icon: 'i-lucide-check-circle' })
    emit('saved', result)
    isOpen.value = false
  }
  catch {
    // toast handled by useApi
  }
  finally {
    restoring.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="isOpen"
    :title="mode === 'create' ? t('promoters.form.createTitle') : t('promoters.form.editTitle')"
    :description="mode === 'create' ? t('promoters.form.createDescription') : t('promoters.form.editDescription')"
    :ui="{ content: 'max-w-2xl' }"
  >
    <template #body>
      <div v-if="loadingDetail" class="py-12 flex flex-col items-center justify-center gap-2 text-prohealth-500">
        <UIcon name="i-lucide-loader-circle" class="w-6 h-6 animate-spin" />
        <span class="text-sm">{{ t('promoters.form.loadingDetail') }}</span>
      </div>
      <UForm
        v-else
        ref="formRef"
        :schema="schema"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <template v-if="mode === 'create'">
          <div class="rounded-xl border border-prohealth-100 p-4 space-y-4">
            <UFormField
              :label="t('promoters.form.fields.userUuid')"
              name="userUuid"
              required
              :help="t('promoters.form.userSearchHelp')"
            >
              <USelectMenu
                v-model="state.userUuid"
                v-model:search-term="userSearchTerm"
                :items="userOptions"
                label-key="label"
                value-key="value"
                ignore-filter
                icon="i-lucide-search"
                :loading="searchingUsers"
                :placeholder="t('promoters.form.userPlaceholderSearch')"
                :search-input="{ placeholder: t('promoters.form.userSearchPlaceholder'), icon: 'i-lucide-search' }"
                class="w-full"
              />
            </UFormField>
          </div>
        </template>
        <UFormField :label="t('promoters.form.fields.displayName')" name="displayName" required>
          <UInput v-model="state.displayName" class="w-full" />
        </UFormField>

        <!-- Create-only identity fields (immutable once the promoter exists). -->
        <template v-if="mode === 'create'">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField
              :label="t('promoters.form.fields.referralCode')"
              name="referralCode"
              required
              :help="t('promoters.form.referralCodeHelp')"
            >
              <UInput v-model="state.referralCode" placeholder="PROMO-2026" class="w-full font-mono" />
            </UFormField>
            <UFormField :label="t('promoters.form.fields.promoterTypeUuid')" name="promoterTypeUuid">
              <USelectMenu
                v-model="state.promoterTypeUuid"
                :items="promoterTypeItems"
                label-key="label"
                value-key="value"
                :placeholder="t('common.select')"
                class="w-full"
              />
            </UFormField>
          </div>
        </template>

        <!-- Edit-only: referralCode shown read-only for context; status + active editable. -->
        <template v-else>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField :label="t('promoters.form.fields.referralCode')" name="referralCode">
              <UInput v-model="state.referralCode" class="w-full font-mono" disabled />
            </UFormField>
            <UFormField :label="t('promoters.form.fields.promoterTypeUuid')" name="promoterTypeUuid">
              <USelectMenu
                v-model="state.promoterTypeUuid"
                :items="promoterTypeItems"
                label-key="label"
                value-key="value"
                :placeholder="t('common.select')"
                class="w-full"
              />
            </UFormField>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField :label="t('promoters.form.fields.status')" name="status">
              <USelectMenu
                v-model="state.status"
                :items="statusOptions"
                label-key="label"
                value-key="value"
                :placeholder="t('common.select')"
                class="w-full"
              />
            </UFormField>
            <UFormField :label="t('promoters.form.fields.active')" name="active">
              <USwitch v-model="state.active" />
            </UFormField>
          </div>
        </template>

        <UFormField :label="t('promoters.form.fields.description')" name="description">
          <UTextarea v-model="state.description" :rows="3" class="w-full" />
        </UFormField>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('promoters.form.fields.email')" name="email">
            <UInput v-model="state.email" type="email" class="w-full" />
          </UFormField>
          <UFormField :label="t('promoters.form.fields.phone')" name="phone">
            <UInput v-model="state.phone" class="w-full" />
          </UFormField>
        </div>

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
      </UForm>
    </template>

    <template #footer>
      <div class="w-full space-y-2">
        <p class="text-xs text-prohealth-500">{{ t('common.requiredFieldsHint') }}</p>

        <div class="flex items-center justify-between gap-3">
          <div v-if="mode === 'edit' && promoter">
            <RestoreButton
              v-if="promoter.active === false"
              :active="promoter.active"
              :allowed="canDelete"
              :loading="restoring"
              :disabled="isSubmitting"
              @restore="restorePromoter"
            />
            <UButton
              v-else
              color="error"
              variant="ghost"
              icon="i-lucide-trash-2"
              size="sm"
              :label="t('common.delete')"
              :disabled="isSubmitting"
              @click="openDeleteFromEdit"
            />
          </div>
          <div v-else />

          <div class="flex items-center gap-3">
            <RefreshButton
              v-if="mode === 'edit'"
              :icon-only="false"
              :label="t('common.refresh')"
              :title="t('common.refresh')"
              :loading="reloading"
              :disabled="isSubmitting"
              @refresh="onRefresh"
            />
            <UButton color="neutral" variant="ghost" :disabled="isSubmitting" @click="isOpen = false">
              {{ t('common.cancel') }}
            </UButton>
            <UButton
              :color="mode === 'create' ? 'primary' : 'info'"
              variant="outline"
              :loading="isSubmitting"
              :disabled="loadingDetail"
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
