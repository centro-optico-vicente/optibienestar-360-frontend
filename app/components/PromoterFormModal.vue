<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { UserDto } from '~/types/admin'
import type { MemberDto } from '~/types/members'
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

// ---- User search (create-only; server-side, debounced RSQL) ----
// Feeds state.userUuid directly — the select's value IS the user's uuid.
type Option = { label: string, value: string }
const userSearch = ref('')
const userOptions = ref<Option[]>([])
const searchingUsers = ref(false)

function userLabel(u: UserDto): string {
  return `${u.fullName || u.email} · ${u.email}`
}

let userSearchTimer: ReturnType<typeof setTimeout> | undefined
watch(userSearch, (q) => {
  clearTimeout(userSearchTimer)
  const term = q.trim()
  if (term.length < 2) {
    userOptions.value = []
    return
  }
  userSearchTimer = setTimeout(async () => {
    searchingUsers.value = true
    try {
      const res = await users.list({ size: 10, filter: `fullName=='*${term}*',email=='*${term}*'` })
      userOptions.value = (res.content ?? []).map(u => ({ label: userLabel(u), value: u.uuid }))
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
const personSearch = ref('')
const memberOptions = ref<Option[]>([])
const searchingMembers = ref(false)
const selectedMemberUuid = ref('')
const resolvingPerson = ref(false)

function memberLabel(m: MemberDto): string {
  const doc = m.documentNumber ? ` · ${m.documentType ?? ''} ${m.documentNumber}`.trimEnd() : ''
  return `${m.fullName || t('common.empty')}${doc}`
}

let personSearchTimer: ReturnType<typeof setTimeout> | undefined
watch(personSearch, (q) => {
  clearTimeout(personSearchTimer)
  const term = q.trim()
  if (term.length < 2) {
    memberOptions.value = []
    return
  }
  personSearchTimer = setTimeout(async () => {
    searchingMembers.value = true
    try {
      const res = await members.list({ size: 10, q: term })
      memberOptions.value = (res.content ?? []).map(m => ({ label: memberLabel(m), value: m.uuid }))
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
  userSearch.value = ''
  userOptions.value = []
  personSearch.value = ''
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
            <UFormField :label="t('promoters.form.userSearchLabel')" :help="t('promoters.form.userSearchHelp')">
              <UInput
                v-model="userSearch"
                :placeholder="t('promoters.form.userSearchPlaceholder')"
                icon="i-lucide-search"
                :loading="searchingUsers"
                class="w-full"
              />
            </UFormField>
            <UFormField :label="t('promoters.form.fields.userUuid')" name="userUuid" required>
              <USelectMenu
                v-model="state.userUuid"
                :items="userOptions"
                label-key="label"
                value-key="value"
                :placeholder="userOptions.length ? t('common.select') : t('promoters.form.userPlaceholderSearch')"
                class="w-full"
              />
            </UFormField>

            <UFormField :label="t('promoters.form.personSearchLabel')" :help="t('promoters.form.personSearchHelp')">
              <UInput
                v-model="personSearch"
                :placeholder="t('promoters.form.personSearchPlaceholder')"
                icon="i-lucide-search"
                :loading="searchingMembers"
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
                :items="memberOptions"
                label-key="label"
                value-key="value"
                :loading="resolvingPerson"
                :placeholder="memberOptions.length ? t('common.select') : t('promoters.form.personPlaceholderSearch')"
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

        <div class="flex items-center justify-end gap-3 pt-2">
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
      </UForm>
    </template>
  </UModal>
</template>
