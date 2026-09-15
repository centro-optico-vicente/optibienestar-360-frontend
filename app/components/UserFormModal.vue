<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type {
  AdminCreateUserRequest,
  AdminUpdateUserRequest,
  UserDto,
} from '~/types/admin'

// Shared create/edit form, used by both users/index.vue (row actions) and
// users/[uuid].vue ("Editar" button) so the latter no longer has to navigate
// away to the list page just to reopen the modal.
const props = defineProps<{
  open: boolean
  mode: 'create' | 'edit'
  user: UserDto | null
  canDelete: boolean
}>()

const emit = defineEmits<{
  'update:open': [boolean]
  saved: [UserDto]
  restored: [UserDto]
  'delete-requested': [UserDto]
}>()

const { t } = useI18n()
const usersApi = useUsers()
const roles = useRoles()
const toast = useToast()
const { can } = usePermissions()
const canViewDocumentType = computed(() => can('DOCUMENT_TYPE_VIEW_ALL'))

const isOpen = computed({
  get: () => props.open,
  set: v => emit('update:open', v),
})

function goToCatalogRecord(to: string) {
  isOpen.value = false
  navigateTo(to)
}

const isSubmitting = ref(false)
// Save button lives in the modal's #footer slot, outside the <UForm> element,
// so it can't use type="submit"; it triggers validation via this instead.
const formRef = ref<{ submit: () => Promise<void> } | null>(null)

// ---- Lazy-loaded catalogs (roles + document types), fetched only when the modal opens ----
const roleOptions = ref<{ label: string, value: string }[]>([])
const { options: documentTypeOptions, load: loadDocumentTypes } = useDocumentTypes()
const catalogsLoaded = ref(false)

async function loadCatalogs() {
  if (catalogsLoaded.value) return
  try {
    const res = await roles.options({ limit: 200 })
    roleOptions.value = res.map(o => ({ label: o.label, value: o.uuid }))
  }
  catch {
    roleOptions.value = []
  }
  await loadDocumentTypes()
  catalogsLoaded.value = true
}

// Backend only accepts these (AdminUpdateUserRequest.status pattern).
const STATUS_VALUES = ['ACTIVE', 'SUSPENDED', 'LOCKED']
const statusOptions = computed(() =>
  STATUS_VALUES.map(s => ({ label: t(`security.users.status.${s}`), value: s })),
)

interface FormState {
  email: string
  firstName: string
  middleName: string
  lastName: string
  secondLastName: string
  password: string
  documentType: string | undefined
  documentNumber: string
  phone: string
  status: string
  active: boolean
  roleIds: string[]
}

const state = reactive<FormState>({
  email: '',
  firstName: '',
  middleName: '',
  lastName: '',
  secondLastName: '',
  password: '',
  documentType: undefined,
  documentNumber: '',
  phone: '',
  status: 'ACTIVE',
  active: true,
  roleIds: [],
})

const createSchema = computed(() => z.object({
  email: z.string().email(t('validation.emailInvalid')),
  firstName: z.string().min(1, t('validation.required')).max(50, t('validation.maxChars', { n: 50 })),
  middleName: z.string().max(50, t('validation.maxChars', { n: 50 })).optional(),
  lastName: z.string().min(1, t('validation.required')).max(50, t('validation.maxChars', { n: 50 })),
  secondLastName: z.string().max(50, t('validation.maxChars', { n: 50 })).optional(),
  password: z
    .string()
    .min(10, t('validation.minChars', { n: 10 }))
    .regex(/[A-Z]/, t('validation.passwordUppercase'))
    .regex(/[a-z]/, t('validation.passwordLowercase'))
    .regex(/[0-9]/, t('validation.passwordNumber'))
    .regex(/[^A-Za-z0-9]/, t('validation.passwordSymbol')),
  documentType: z.string().min(1, t('validation.required')),
  documentNumber: z.string().min(1, t('validation.required')),
  phone: z.string().optional(),
  roleIds: z.array(z.string()).min(1, t('security.users.selectAtLeastOneRole')),
}))

const editSchema = computed(() => z.object({
  email: z.string().email(t('validation.emailInvalid')).optional(),
  firstName: z.string().min(1, t('validation.required')).max(50, t('validation.maxChars', { n: 50 })),
  middleName: z.string().max(50, t('validation.maxChars', { n: 50 })).optional(),
  lastName: z.string().min(1, t('validation.required')).max(50, t('validation.maxChars', { n: 50 })),
  secondLastName: z.string().max(50, t('validation.maxChars', { n: 50 })).optional(),
  documentType: z.string().optional(),
  documentNumber: z.string().optional(),
  phone: z.string().optional(),
  status: z.string(),
  roleIds: z.array(z.string()).min(1, t('security.users.selectAtLeastOneRole')),
}))

const schema = computed(() => (props.mode === 'create' ? createSchema.value : editSchema.value))

function resetForm() {
  state.email = ''
  state.firstName = ''
  state.middleName = ''
  state.lastName = ''
  state.secondLastName = ''
  state.password = ''
  state.documentType = undefined
  state.documentNumber = ''
  state.phone = ''
  state.status = 'ACTIVE'
  state.active = true
  state.roleIds = []
}

// Snapshot of the last-loaded edit state, used to warn before a refresh
// discards unsaved changes.
const editSnapshot = ref('')
function snapEditState() { return JSON.stringify(state) }
const isEditDirty = computed(() => editSnapshot.value !== '' && snapEditState() !== editSnapshot.value)
const discardConfirmOpen = ref(false)
const editReloading = ref(false)

function populateEditForm(u: UserDto) {
  resetForm()
  state.email = u.email
  state.firstName = u.firstName ?? ''
  state.middleName = u.middleName ?? ''
  state.lastName = u.lastName ?? ''
  state.secondLastName = u.secondLastName ?? ''
  state.documentType = u.documentType || undefined
  state.documentNumber = u.documentNumber ?? ''
  state.phone = u.phone ?? ''
  state.status = u.status || 'ACTIVE'
  state.active = u.active ?? true
  state.roleIds = (u.roles ?? []).map(r => r.uuid)
  editSnapshot.value = snapEditState()
}

// Populate/reset the form whenever the modal opens (mode/user are set by the parent beforehand).
watch(() => props.open, async (open) => {
  if (!open) return
  await loadCatalogs()
  if (props.mode === 'edit' && props.user) populateEditForm(props.user)
  else resetForm()
})

async function reloadEditForm() {
  if (!props.user) return
  editReloading.value = true
  try { populateEditForm(await usersApi.get(props.user.uuid)) }
  catch { /* useApi already notified */ }
  finally { editReloading.value = false }
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
    let saved: UserDto
    if (props.mode === 'create') {
      const body: AdminCreateUserRequest = {
        email: state.email,
        firstName: state.firstName,
        middleName: state.middleName || undefined,
        lastName: state.lastName,
        secondLastName: state.secondLastName || undefined,
        password: state.password,
        documentType: state.documentType!,
        documentNumber: state.documentNumber,
        phone: state.phone || undefined,
        roleIds: state.roleIds,
      }
      saved = await usersApi.create(body)
      toast.add({ title: t('security.users.createdToast'), color: 'success', icon: 'i-lucide-check-circle' })
    }
    else {
      if (!props.user) return
      const body: AdminUpdateUserRequest = {
        firstName: state.firstName,
        middleName: state.middleName || undefined,
        lastName: state.lastName,
        secondLastName: state.secondLastName || undefined,
        documentType: state.documentType || undefined,
        documentNumber: state.documentNumber || undefined,
        phone: state.phone || undefined,
        status: state.status,
        active: state.active,
        roleIds: state.roleIds,
      }
      saved = await usersApi.update(props.user.uuid, body)
      toast.add({ title: t('security.users.updatedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    }
    isOpen.value = false
    emit('saved', saved)
  }
  catch {
    // useApi ya notificó el error (409 email duplicado, 422, etc.)
  }
  finally {
    isSubmitting.value = false
  }
}

const restoring = ref(false)
async function restoreUser() {
  if (!props.user) return
  restoring.value = true
  try {
    const updated = await usersApi.update(props.user.uuid, { active: true })
    toast.add({ title: t('security.users.restoredToast'), color: 'success', icon: 'i-lucide-check-circle' })
    isOpen.value = false
    emit('restored', updated)
  }
  catch {
    // toast handled by useApi
  }
  finally {
    restoring.value = false
  }
}

function requestDelete() {
  if (!props.user) return
  isOpen.value = false
  emit('delete-requested', props.user)
}
</script>

<template>
  <UModal
    v-model:open="isOpen"
    :title="mode === 'create' ? t('security.users.modalCreateTitle') : t('security.users.modalEditTitle')"
    :description="mode === 'create' ? t('security.users.modalCreateDescription') : t('security.users.modalEditDescription')"
  >
    <template #body>
      <UForm
        ref="formRef"
        :schema="schema"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <UFormField :label="t('security.users.fields.email')" name="email" :required="mode === 'create'">
          <UInput
            v-model="state.email"
            type="email"
            autocomplete="off"
            class="w-full"
            :disabled="mode === 'edit'"
          />
        </UFormField>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('security.users.fields.firstName')" name="firstName" required>
            <UInput v-model="state.firstName" class="w-full" />
          </UFormField>
          <UFormField :label="t('security.users.fields.middleName')" name="middleName">
            <UInput v-model="state.middleName" class="w-full" />
          </UFormField>
          <UFormField :label="t('security.users.fields.lastName')" name="lastName" required>
            <UInput v-model="state.lastName" class="w-full" />
          </UFormField>
          <UFormField :label="t('security.users.fields.secondLastName')" name="secondLastName">
            <UInput v-model="state.secondLastName" class="w-full" />
          </UFormField>
        </div>

        <UFormField v-if="mode === 'create'" :label="t('security.users.fields.password')" name="password" required>
          <UInput v-model="state.password" type="password" autocomplete="new-password" class="w-full" />
        </UFormField>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('security.users.fields.documentType')" name="documentType">
            <div class="flex items-center gap-2">
              <USelectMenu
                v-model="state.documentType"
                :items="documentTypeOptions"
                label-key="label"
                value-key="value"
                :placeholder="t('common.select')"
                class="w-full"
              />
              <CommonEntityQuickLinkButton
                :to="state.documentType ? '/dashboard/catalogs/document-types' : null"
                :can="canViewDocumentType"
                @navigate="goToCatalogRecord"
              />
            </div>
          </UFormField>
          <UFormField :label="t('security.users.fields.documentNumber')" name="documentNumber">
            <UInput v-model="state.documentNumber" class="w-full" />
          </UFormField>
        </div>

        <UFormField :label="t('security.users.fields.phone')" name="phone">
          <UInput v-model="state.phone" class="w-full" />
        </UFormField>

        <div v-if="mode === 'edit'" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('security.users.fields.status')" name="status">
            <USelectMenu
              v-model="state.status"
              :items="statusOptions"
              label-key="label"
              value-key="value"
              class="w-full"
            />
          </UFormField>
          <UFormField :label="t('security.users.fields.active')" name="active">
            <USwitch v-model="state.active" />
          </UFormField>
        </div>

        <UFormField :label="t('security.users.fields.roles')" name="roleIds" required>
          <USelectMenu
            v-model="state.roleIds"
            :items="roleOptions"
            label-key="label"
            value-key="value"
            multiple
            icon="i-lucide-list-checks"
            :placeholder="t('security.users.selectRolesPlaceholder')"
            class="w-full"
          />
        </UFormField>

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

    <template #footer>
      <div class="w-full space-y-2">
        <p class="text-xs text-prohealth-500">{{ t('common.requiredFieldsHint') }}</p>

        <div class="flex items-center justify-between gap-3">
          <div v-if="mode === 'edit' && user">
            <RestoreButton
              v-if="user.active === false"
              :active="user.active"
              :allowed="canDelete"
              :loading="restoring"
              :disabled="isSubmitting"
              @restore="restoreUser"
            />
            <UTooltip v-else :text="canDelete ? t('common.delete') : t('security.users.noPermissionDelete')">
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
              :loading="editReloading"
              :disabled="isSubmitting"
              @refresh="onEditRefresh"
            />
            <UButton color="neutral" variant="ghost" :disabled="isSubmitting" @click="isOpen = false">
              {{ t('common.cancel') }}
            </UButton>
            <UButton
              :color="mode === 'create' ? 'primary' : 'info'"
              variant="outline"
              :loading="isSubmitting"
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
