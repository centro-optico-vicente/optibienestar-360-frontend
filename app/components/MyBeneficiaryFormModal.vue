<script setup lang="ts">
import { z } from 'zod'
import type { BeneficiaryDto, BeneficiaryRelationship, CreateBeneficiaryRequest } from '~/types/members'
import { RELATIONSHIP_OPTIONS } from '~/types/members'

// Self-service beneficiary add (POST /v1/me/family, MEMBER_BENEFICIARY_CREATE_OWN).
// The backend applies the plan's cap and bills the extra inscription; errors
// (cap reached, no active membership) surface through the useApi toast.
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ created: [BeneficiaryDto] }>()

const { t } = useI18n()
const toast = useToast()
const members = useMembers()
const { options: documentTypeOptions, load: loadDocumentTypes } = useDocumentTypes()

const relationshipOptions = computed(() => RELATIONSHIP_OPTIONS.map(o => ({ label: t(o.labelKey), value: o.value })))

const submitting = ref(false)
// Save button lives in the modal footer, outside the <UForm>; it triggers validation via this.
const formRef = ref<{ submit: () => Promise<void> } | null>(null)

interface FormState {
  firstName: string
  middleName: string
  lastName: string
  secondLastName: string
  documentType: string | undefined
  documentNumber: string
  birthDate: string
  relationship: BeneficiaryRelationship | undefined
}

const state = reactive<FormState>({
  firstName: '',
  middleName: '',
  lastName: '',
  secondLastName: '',
  documentType: 'V',
  documentNumber: '',
  birthDate: '',
  relationship: undefined,
})

const schema = computed(() => z.object({
  firstName: z.string().min(2, t('validation.minChars', { n: 2 })),
  middleName: z.string().optional(),
  lastName: z.string().min(2, t('validation.minChars', { n: 2 })),
  secondLastName: z.string().optional(),
  documentType: z.string({ message: t('validation.required') }).min(1, t('validation.required')),
  documentNumber: z.string().min(1, t('validation.required')).regex(/^\d+$/, t('validation.digitsOnly')),
  birthDate: z.string().optional(),
  relationship: z.string({ message: t('validation.required') }).min(1, t('validation.required')),
}))

watch(open, (isOpen) => {
  if (!isOpen) return
  Object.assign(state, {
    firstName: '', middleName: '', lastName: '', secondLastName: '',
    documentType: 'V', documentNumber: '', birthDate: '', relationship: undefined,
  })
  loadDocumentTypes()
})

async function onSubmit() {
  submitting.value = true
  try {
    const body: CreateBeneficiaryRequest = {
      firstName: state.firstName,
      middleName: state.middleName || undefined,
      lastName: state.lastName,
      secondLastName: state.secondLastName || undefined,
      documentType: state.documentType,
      documentNumber: state.documentNumber,
      birthDate: state.birthDate || undefined,
      relationship: state.relationship as CreateBeneficiaryRequest['relationship'],
    }
    const created = await members.addMyBeneficiary(body)
    toast.add({ title: t('members.portal.beneficiaries.createdToast'), color: 'success', icon: 'i-lucide-check-circle' })
    emit('created', created)
    open.value = false
  }
  catch {
    // useApi already toasted the backend message (e.g. plan cap reached).
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="t('members.portal.beneficiaries.formTitle')"
    :description="t('members.portal.beneficiaries.formDescription')"
  >
    <template #body>
      <UForm ref="formRef" :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
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
            <UInput v-model="state.documentNumber" inputmode="numeric" class="w-full" />
          </UFormField>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('members.form.fields.birthDate')" name="birthDate">
            <UInput v-model="state.birthDate" type="date" class="w-full" />
          </UFormField>
          <UFormField :label="t('members.beneficiaries.form.relationship')" name="relationship" required>
            <USelectMenu
              v-model="state.relationship"
              :items="relationshipOptions"
              label-key="label"
              value-key="value"
              :placeholder="t('common.select')"
              class="w-full"
            />
          </UFormField>
        </div>
      </UForm>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-3">
        <UButton color="neutral" variant="ghost" :disabled="submitting" @click="open = false">
          {{ t('common.cancel') }}
        </UButton>
        <UButton color="primary" variant="outline" icon="i-lucide-save" :loading="submitting" @click="formRef?.submit()">
          {{ t('common.saveNew') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
