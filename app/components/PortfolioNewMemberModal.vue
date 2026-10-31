<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { MemberDto } from '~/types/members'

// "New person in my portfolio" (POST /v1/advisors/me/portfolio/members, PROMOTER_PORTFOLIO_CREATE):
// the advisor registers someone who is not an affiliate yet. The person joins the caller's portfolio
// with no membership, so a collection can be registered for them right away (V201). Only the fields
// the backend requires plus a contact pair; the rest of the file is completed later by staff.
const props = defineProps<{ open: boolean }>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'created': [member: MemberDto]
}>()

const { t } = useI18n()
const promoters = usePromoters()
const toast = useToast()

const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})
const isSubmitting = ref(false)
const formRef = ref<{ submit: () => Promise<void> } | null>(null)

// Document types come from the public catalog (the admin one is not readable by an advisor). The backend
// only accepts V / E for a new member, so the list is narrowed to those codes; if the request fails we fall back to them.
const ALLOWED_DOCUMENT_TYPES = ['V', 'E']
const documentTypeOptions = ref(ALLOWED_DOCUMENT_TYPES.map(code => ({ label: t(`members.form.documentTypes.${code}`), value: code })))

onMounted(async () => {
  try {
    const items = await usePublicCatalog('document-types').list()
    const loaded = items
      .filter(item => item.code && ALLOWED_DOCUMENT_TYPES.includes(item.code))
      .map(item => ({ label: t(`members.form.documentTypes.${item.code}`, item.name), value: item.code as string }))
    if (loaded.length) documentTypeOptions.value = loaded
  }
  catch {
    // Keep the V / E fallback.
  }
})

const state = reactive({
  firstName: '',
  lastName: '',
  documentType: 'V',
  documentNumber: '',
  birthDate: '',
  phone: '',
  email: '',
})

/** The holder must be of legal age (@MinimumAge=18 in the backend). */
function isAdult(iso: string): boolean {
  const birth = new Date(iso)
  if (Number.isNaN(birth.getTime())) return false
  const cutoff = new Date()
  cutoff.setFullYear(cutoff.getFullYear() - 18)
  return birth <= cutoff
}

const schema = computed(() => z.object({
  firstName: z.string().min(1, t('validation.required')).max(50, t('validation.maxChars', { n: 50 })),
  lastName: z.string().min(1, t('validation.required')).max(50, t('validation.maxChars', { n: 50 })),
  documentType: z.string().min(1, t('validation.required')),
  documentNumber: z.string().min(1, t('validation.required')).max(20, t('validation.maxChars', { n: 20 })),
  birthDate: z.string().min(1, t('validation.required')).refine(isAdult, t('members.form.validation.adult')),
  phone: z.string().max(30, t('validation.maxChars', { n: 30 })).optional(),
  email: z.string().email(t('validation.emailInvalid')).optional().or(z.literal('')),
}))

watch(() => props.open, (open) => {
  if (!open) return
  Object.assign(state, { firstName: '', lastName: '', documentType: 'V', documentNumber: '', birthDate: '', phone: '', email: '' })
})

async function onSubmit(_event: FormSubmitEvent<Record<string, unknown>>) {
  isSubmitting.value = true
  try {
    const created = await promoters.registerInPortfolio({
      firstName: state.firstName.trim(),
      lastName: state.lastName.trim(),
      documentType: state.documentType,
      documentNumber: state.documentNumber.trim(),
      birthDate: state.birthDate,
      phone: state.phone.trim() || undefined,
      email: state.email.trim() || undefined,
    })
    toast.add({ title: t('promoterSelf.newMember.createdToast'), color: 'success', icon: 'i-lucide-check-circle' })
    emit('created', created)
    isOpen.value = false
  }
  catch {
    // useApi already notified the error (e.g. the person is already enrolled)
  }
  finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="isOpen"
    :title="t('promoterSelf.newMember.title')"
    :description="t('promoterSelf.newMember.description')"
    :ui="{ content: 'max-w-xl' }"
  >
    <template #body>
      <UForm ref="formRef" :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('members.form.fields.firstName')" name="firstName" required>
            <UInput v-model="state.firstName" class="w-full" />
          </UFormField>
          <UFormField :label="t('members.form.fields.lastName')" name="lastName" required>
            <UInput v-model="state.lastName" class="w-full" />
          </UFormField>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('members.form.fields.documentType')" name="documentType" required>
            <USelectMenu v-model="state.documentType" :items="documentTypeOptions" label-key="label" value-key="value" class="w-full" />
          </UFormField>
          <UFormField :label="t('members.form.fields.documentNumber')" name="documentNumber" required>
            <UInput v-model="state.documentNumber" class="w-full" />
          </UFormField>
        </div>
        <UFormField :label="t('members.form.fields.birthDate')" name="birthDate" required>
          <UInput v-model="state.birthDate" type="date" class="w-full" />
        </UFormField>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('members.form.fields.phone')" name="phone">
            <UInput v-model="state.phone" class="w-full" />
          </UFormField>
          <UFormField :label="t('members.form.fields.email')" name="email">
            <UInput v-model="state.email" type="email" class="w-full" />
          </UFormField>
        </div>
      </UForm>
    </template>

    <template #footer>
      <div class="w-full space-y-2">
        <p class="text-xs text-prohealth-500">{{ t('common.requiredFieldsHint') }}</p>
        <div class="flex items-center justify-end gap-3">
          <UButton color="neutral" variant="ghost" :disabled="isSubmitting" @click="isOpen = false">
            {{ t('common.cancel') }}
          </UButton>
          <UButton color="primary" variant="outline" :loading="isSubmitting" icon="i-lucide-user-plus" @click="formRef?.submit()">
            {{ t('promoterSelf.newMember.submit') }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
