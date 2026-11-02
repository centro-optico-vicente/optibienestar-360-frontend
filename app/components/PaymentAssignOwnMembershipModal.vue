<script setup lang="ts">
import type { BeneficiaryMatchDto, PaymentDto } from '~/types/payments'

// The payer points their own DRAFT/PENDING payment at a membership — typically a relative paying the holder's
// plan. The holder is confirmed by exact document number (the name comes back abbreviated); the reviewer still
// verifies the payment on approval. The parent gates COLLECTION_CREATE_OWN.
const props = defineProps<{
  open: boolean
  payment: PaymentDto | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'assigned': [payment: PaymentDto]
}>()

const { t } = useI18n()
const toast = useToast()
const payments = usePayments()

const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})

const beneficiary = ref<BeneficiaryMatchDto | null>(null)
const saving = ref(false)

watch(isOpen, (open) => {
  if (open) beneficiary.value = null
})

async function save() {
  const membershipUuid = beneficiary.value?.membershipUuid
  if (!props.payment || !membershipUuid) return
  saving.value = true
  try {
    const updated = await payments.assignOwnMembership(props.payment.uuid, membershipUuid)
    toast.add({ title: t('payments.assignOwn.savedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    emit('assigned', updated)
    isOpen.value = false
  }
  catch {
    // useApi already notified the error
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal v-model:open="isOpen" :title="t('payments.assignOwn.title')" :description="t('payments.assignOwn.description')">
    <template #body>
      <div class="space-y-4">
        <BeneficiaryLookup v-model="beneficiary" require-membership />

        <div class="flex items-center justify-end gap-3 pt-2">
          <UButton color="neutral" variant="ghost" :disabled="saving" @click="isOpen = false">{{ t('common.cancel') }}</UButton>
          <UButton :loading="saving" :disabled="!beneficiary?.membershipUuid" icon="i-lucide-link" @click="save">
            {{ t('payments.assignOwn.confirm') }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
