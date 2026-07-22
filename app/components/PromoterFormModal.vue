<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
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
// userUuid + personUuid are required; on edit (PATCH) they are read-only/hidden.
const props = defineProps<{
  open: boolean
  /** If provided, the modal is in edit mode; if null/undefined, in create mode. */
  promoter?: PromoterDto | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'saved': [promoter: PromoterDto]
}>()

const { t } = useI18n()
const promoters = usePromoters()
const toast = useToast()

const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})
const mode = computed<'create' | 'edit'>(() => (props.promoter ? 'edit' : 'create'))
const isSubmitting = ref(false)

// Status options localized at the consumption point (labelKey → i18n).
const statusOptions = computed(() =>
  PROMOTER_STATUS_OPTIONS.map(o => ({ label: t(o.labelKey), value: o.value })),
)

interface FormState {
  displayName: string
  referralCode: string
  userUuid: string
  personUuid: string
  description: string
  email: string
  phone: string
  status: PromoterStatus | undefined
  active: boolean
}

const state = reactive<FormState>({
  displayName: '',
  referralCode: '',
  userUuid: '',
  personUuid: '',
  description: '',
  email: '',
  phone: '',
  status: 'ACTIVE',
  active: true,
})

// Locale-reactive schema. On create the referralCode/userUuid/personUuid are required;
// on edit (PATCH) only the editable subset is validated. Wrapped in computed so the
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
      userUuid: z.string().uuid(t('validation.invalidUuid')),
      personUuid: z.string().uuid(t('validation.invalidUuid')),
    })
  }
  return z.object(base)
})

// True while the detail loads when opening in edit mode.
const loadingDetail = ref(false)

function populateFrom(p: PromoterDto | null) {
  if (!p) {
    state.displayName = ''
    state.referralCode = ''
    state.userUuid = ''
    state.personUuid = ''
    state.description = ''
    state.email = ''
    state.phone = ''
    state.status = 'ACTIVE'
    state.active = true
    return
  }
  state.displayName = p.displayName ?? ''
  state.referralCode = p.referralCode ?? ''
  state.userUuid = p.userUuid ?? ''
  state.personUuid = p.personUuid ?? ''
  state.description = p.description ?? ''
  state.email = p.email ?? ''
  state.phone = p.phone ?? ''
  state.status = (p.status as PromoterStatus) ?? 'ACTIVE'
  state.active = p.active ?? true
}

// On open: in create mode clear the form; in edit mode load the full detail by UUID
// (the received `promoter` may be a list row) to populate reliably.
watch(() => props.open, async (open) => {
  if (!open) return
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
        personUuid: state.personUuid.trim(),
        description: state.description.trim() || undefined,
        email: state.email.trim() || undefined,
        phone: state.phone.trim() || undefined,
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
        :schema="schema"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <UFormField :label="t('promoters.form.fields.displayName')" name="displayName" required>
          <UInput v-model="state.displayName" class="w-full" />
        </UFormField>

        <!-- Create-only identity fields (immutable once the promoter exists). -->
        <template v-if="mode === 'create'">
          <UFormField
            :label="t('promoters.form.fields.referralCode')"
            name="referralCode"
            required
            :help="t('promoters.form.referralCodeHelp')"
          >
            <UInput v-model="state.referralCode" placeholder="PROMO-2026" class="w-full font-mono" />
          </UFormField>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField :label="t('promoters.form.fields.userUuid')" name="userUuid" required :help="t('promoters.form.uuidHelp')">
              <UInput v-model="state.userUuid" class="w-full font-mono" />
            </UFormField>
            <UFormField :label="t('promoters.form.fields.personUuid')" name="personUuid" required :help="t('promoters.form.uuidHelp')">
              <UInput v-model="state.personUuid" class="w-full font-mono" />
            </UFormField>
          </div>
        </template>

        <!-- Edit-only: referralCode shown read-only for context; status + active editable. -->
        <template v-else>
          <UFormField :label="t('promoters.form.fields.referralCode')" name="referralCode">
            <UInput v-model="state.referralCode" class="w-full font-mono" disabled />
          </UFormField>

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

        <div class="flex items-center justify-end gap-3 pt-2">
          <UButton color="neutral" variant="ghost" :disabled="isSubmitting" @click="isOpen = false">
            {{ t('common.cancel') }}
          </UButton>
          <UButton type="submit" color="primary" :loading="isSubmitting" icon="i-lucide-save">
            {{ mode === 'create' ? t('promoters.form.submitCreate') : t('common.saveChanges') }}
          </UButton>
        </div>
      </UForm>
    </template>
  </UModal>
</template>
