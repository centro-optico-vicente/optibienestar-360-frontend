<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { CampaignDto, CampaignExceptionAction, CampaignExceptionRequest } from '~/types/campaign'
import type { SelectItem } from '~/types/options'

// Shared "Agregar excepción" modal for manual campaign transaction exceptions
// (Part G — createException already existed in useCampaigns.ts but was never
// invoked from any component until now). Used from two entry points:
//  1) campaigns/[id].vue "Agregar excepción" button: campaignUuid is locked
//     (the ficha's own campaign), reference (payment/membership) is picked
//     by the user.
//  2) A row action on payments/index.vue or MemberMembershipsCard.vue: the
//     reference (paymentUuid/membershipUuid) is locked from that row, and
//     the user instead picks which campaign to attach the exception to.
// Exactly one of campaignUuid or (paymentUuid|membershipUuid) is locked —
// never both, since that would need no form at all.
const props = defineProps<{
  open: boolean
  /** Locks the campaign field when set (campaign ficha entry point). */
  campaignUuid?: string | null
  campaignDisplay?: string | null
  /** Locks the reference to a payment when set (Pagos row action entry point). */
  paymentUuid?: string | null
  paymentDisplay?: string | null
  /** Locks the reference to a membership when set (Membresías row action entry point). */
  membershipUuid?: string | null
  membershipDisplay?: string | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'success': [campaign: CampaignDto]
}>()

const { t } = useI18n()
const campaignsApi = useCampaigns()
const toast = useToast()

const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})

const campaignLocked = computed(() => !!props.campaignUuid)
const referenceLocked = computed(() => !!props.paymentUuid || !!props.membershipUuid)

type ReferenceType = 'PAYMENT' | 'MEMBERSHIP'

interface FormState {
  campaignUuid: string
  referenceType: ReferenceType
  referenceUuid: string
  action: CampaignExceptionAction
  reason: string
}

const state = reactive<FormState>({
  campaignUuid: '',
  referenceType: 'PAYMENT',
  referenceUuid: '',
  action: 'INCLUDE',
  reason: '',
})

const actionOptions = computed(() => [
  { label: t('campaigns.scope.INCLUDE'), value: 'INCLUDE' as CampaignExceptionAction },
  { label: t('campaigns.scope.EXCLUDE'), value: 'EXCLUDE' as CampaignExceptionAction },
])
const referenceTypeOptions = computed(() => [
  { label: t('payments.title'), value: 'PAYMENT' as ReferenceType },
  { label: t('memberships.page.title'), value: 'MEMBERSHIP' as ReferenceType },
])

async function searchCampaigns(q: string): Promise<SelectItem[]> {
  const res = await campaignsApi.list({ q, size: 20 })
  return (res.content ?? []).map(c => ({ label: c.name, value: c.uuid }))
}

const schema = computed(() =>
  z.object({
    campaignUuid: campaignLocked.value ? z.string().optional() : z.string().min(1, t('validation.required')),
    referenceUuid: referenceLocked.value ? z.string().optional() : z.string().min(1, t('validation.required')),
    action: z.string({ message: t('validation.required') }).min(1, t('validation.required')),
    reason: z.string().max(255, t('validation.maxChars', { n: 255 })).optional(),
  }),
)

const isSubmitting = ref(false)
const formRef = ref<{ submit: () => Promise<void> } | null>(null)

watch(() => props.open, (open) => {
  if (!open) return
  state.campaignUuid = props.campaignUuid ?? ''
  state.referenceType = props.membershipUuid ? 'MEMBERSHIP' : 'PAYMENT'
  state.referenceUuid = props.paymentUuid ?? props.membershipUuid ?? ''
  state.action = 'INCLUDE'
  state.reason = ''
})

async function onSubmit(_e: FormSubmitEvent<Record<string, unknown>>) {
  const campaignUuid = props.campaignUuid ?? state.campaignUuid
  if (!campaignUuid) return
  isSubmitting.value = true
  try {
    const body: CampaignExceptionRequest = {
      paymentUuid: props.paymentUuid ?? (state.referenceType === 'PAYMENT' ? state.referenceUuid : null),
      membershipUuid: props.membershipUuid ?? (state.referenceType === 'MEMBERSHIP' ? state.referenceUuid : null),
      action: state.action,
      reason: state.reason.trim() || null,
    }
    const result = await campaignsApi.createException(campaignUuid, body)
    toast.add({ title: t('campaigns.exceptions.createdToast'), color: 'success', icon: 'i-lucide-check-circle' })
    emit('success', result)
    isOpen.value = false
  }
  catch {
    // useApi already notified the error
  }
  finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="isOpen"
    :title="t('campaigns.exceptions.addTitle')"
  >
    <template #body>
      <UForm ref="formRef" :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
        <UFormField v-if="!campaignLocked" :label="t('campaigns.form.campaign')" name="campaignUuid" required>
          <CommonEntityReferenceSelect
            v-model="state.campaignUuid"
            :search="searchCampaigns"
            entity="campaign"
            icon="i-lucide-rocket"
            :placeholder="t('common.select')"
          />
        </UFormField>
        <UFormField v-else :label="t('campaigns.form.campaign')">
          <UInput :model-value="campaignDisplay || campaignUuid" disabled readonly icon="i-lucide-rocket" class="w-full" />
        </UFormField>

        <template v-if="!referenceLocked">
          <UFormField :label="t('campaigns.exceptions.type')" name="referenceType" required>
            <USelectMenu
              v-model="state.referenceType"
              :items="referenceTypeOptions"
              label-key="label"
              value-key="value"
              class="w-full"
            />
          </UFormField>
          <UFormField :label="t('campaigns.exceptions.transaction')" name="referenceUuid" required :help="t('campaigns.exceptions.transactionHelp')">
            <UInput v-model="state.referenceUuid" placeholder="UUID" class="w-full font-mono" />
          </UFormField>
        </template>
        <UFormField v-else :label="t('campaigns.exceptions.transaction')">
          <UInput
            :model-value="paymentDisplay || membershipDisplay || paymentUuid || membershipUuid"
            disabled
            readonly
            icon="i-lucide-receipt"
            class="w-full"
          />
        </UFormField>

        <UFormField :label="t('campaigns.exceptions.type')" name="action" required>
          <USelectMenu
            v-model="state.action"
            :items="actionOptions"
            label-key="label"
            value-key="value"
            class="w-full"
          />
        </UFormField>

        <UFormField :label="t('campaigns.exceptions.reason')" name="reason">
          <UTextarea v-model="state.reason" :rows="2" class="w-full" />
        </UFormField>
      </UForm>
    </template>

    <template #footer>
      <div class="w-full flex items-center justify-end gap-3">
        <UButton color="neutral" variant="ghost" :disabled="isSubmitting" @click="isOpen = false">{{ t('common.cancel') }}</UButton>
        <UButton color="primary" variant="outline" :loading="isSubmitting" icon="i-lucide-save" @click="formRef?.submit()">
          {{ t('common.save') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
