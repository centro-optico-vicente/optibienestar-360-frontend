<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import { memberOptionLabel } from '~/types/members'
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
const users = useUsers()
const members = useMembers()
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

// ---- Person search (create-only) ----
// There is no standalone "search persons" endpoint — personUuid is only exposed via
// the member detail (GET /v1/admin/members/{uuid}), not the list. So this searches
// members (afiliados) by name/document, then resolves the actual personUuid from the
// selected member's detail. This assumes the promoter's person is also a member; if
// it isn't (or doesn't match the selected user), the operator must correct it.
const personSearchTerm = ref('')
const memberOptions = ref<SelectItem[]>([])
const searchingMembers = ref(false)
const selectedMemberUuid = ref('')
const resolvingPerson = ref(false)

let personSearchTimer: ReturnType<typeof setTimeout> | undefined
watch(personSearchTerm, (q) => {
  clearTimeout(personSearchTimer)
  const term = q.trim()
  // See userSearchTerm watch above: don't clear on the post-select reset to '',
  // or the trigger loses the selected item's label and shows the raw uuid.
  if (term.length < 2) return
  personSearchTimer = setTimeout(async () => {
    searchingMembers.value = true
    try {
      const res = await members.options({ q: term, limit: 10 })
      memberOptions.value = res.map(o => ({ label: memberOptionLabel(o), value: o.uuid }))
    }
    catch {
      memberOptions.value = []
    }
    finally {
      searchingMembers.value = false
    }
  }, 400)
})

watch(selectedMemberUuid, async (memberUuid) => {
  state.personUuid = ''
  if (!memberUuid) return
  resolvingPerson.value = true
  try {
    const detail = await members.get(memberUuid)
    state.personUuid = detail.personUuid ?? ''
  }
  catch {
    state.personUuid = ''
  }
  finally {
    resolvingPerson.value = false
  }
})

function resetSearchState() {
  userSearchTerm.value = ''
  userOptions.value = []
  personSearchTerm.value = ''
  memberOptions.value = []
  selectedMemberUuid.value = ''
}

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
      userUuid: z.string().min(1, t('validation.required')).uuid(t('validation.invalidUuid')),
      personUuid: z.string().min(1, t('validation.required')).uuid(t('validation.invalidUuid')),
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

            <UFormField
              :label="t('promoters.form.fields.personUuid')"
              name="personUuid"
              required
              :help="t('promoters.form.personHelp')"
            >
              <USelectMenu
                v-model="selectedMemberUuid"
                v-model:search-term="personSearchTerm"
                :items="memberOptions"
                label-key="label"
                value-key="value"
                ignore-filter
                icon="i-lucide-search"
                :loading="searchingMembers || resolvingPerson"
                :placeholder="t('promoters.form.personPlaceholderSearch')"
                :search-input="{ placeholder: t('promoters.form.personSearchPlaceholder'), icon: 'i-lucide-search' }"
                class="w-full"
              />
            </UFormField>
            <p v-if="selectedMemberUuid && !resolvingPerson && !state.personUuid" class="text-xs text-red-600">
              {{ t('promoters.form.personResolveError') }}
            </p>
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

        <div class="flex items-center justify-between gap-3 pt-2">
          <p class="text-xs text-prohealth-500">{{ t('common.requiredFieldsHint') }}</p>
          <div class="flex items-center gap-3">
            <UButton color="neutral" variant="ghost" :disabled="isSubmitting" @click="isOpen = false">
              {{ t('common.cancel') }}
            </UButton>
            <UButton
              type="submit"
              color="primary"
              :loading="isSubmitting"
              :disabled="mode === 'create' && resolvingPerson"
              icon="i-lucide-save"
            >
              {{ mode === 'create' ? t('promoters.form.submitCreate') : t('common.saveChanges') }}
            </UButton>
          </div>
        </div>
      </UForm>
    </template>
  </UModal>
</template>
