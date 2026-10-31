<script setup lang="ts">
import type { PaymentClaimDto, PaymentDto } from '~/types/payments'
import { CLAIM_REASONS, type ClaimReason } from '~/types/payments'

// Flags the remaining credit of an approved payment as wrong / overpaid / a refund request (hub ADR 0029).
// While the claim is open that amount is frozen: the automatic credit application does not use it.
// The payer uses it on their own payments (COLLECTION_CLAIM_CREATE_OWN); staff pass `staff` to claim on somebody's
// behalf (COLLECTION_CLAIM_CREATE). The parent decides who sees the trigger.
const props = defineProps<{
  open: boolean
  payment: PaymentDto | null
  staff?: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'claimed': [claim: PaymentClaimDto]
}>()

const { t } = useI18n()
const toast = useToast()
const payments = usePayments()

const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})

const reasonOptions = computed(() => CLAIM_REASONS.map(r => ({ label: t(`payments.claim.reasons.${r}`), value: r })))

const remaining = computed(() => Number(props.payment?.creditRemaining ?? 0))
const reason = ref<ClaimReason>('OVERPAID')
const amount = ref<number | null>(null)
const comment = ref('')
const saving = ref(false)

watch(isOpen, (open) => {
  if (!open) return
  reason.value = 'OVERPAID'
  amount.value = remaining.value > 0 ? remaining.value : null
  comment.value = ''
})

const amountValid = computed(() => amount.value !== null && amount.value > 0 && amount.value <= remaining.value)

async function save() {
  if (!props.payment || !amountValid.value || amount.value === null) return
  saving.value = true
  try {
    const body = { reason: reason.value, claimedAmount: amount.value, comment: comment.value.trim() || undefined }
    const claim = props.staff
      ? await payments.claimAsStaff(props.payment.uuid, body)
      : await payments.claimOwn(props.payment.uuid, body)
    toast.add({ title: t('payments.claim.savedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    emit('claimed', claim)
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
  <UModal v-model:open="isOpen" :title="t('payments.claim.title')" :description="t('payments.claim.description')">
    <template #body>
      <div class="space-y-4">
        <p class="text-sm text-prohealth-700">
          {{ t('payments.claim.remaining', { amount: payment?.creditRemaining_Display ?? payment?.creditRemaining ?? '', currency: payment?.currency_Code ?? '' }) }}
        </p>

        <UFormField :label="t('payments.claim.reasonLabel')">
          <USelectMenu v-model="reason" :items="reasonOptions" label-key="label" value-key="value" class="w-full" />
        </UFormField>

        <UFormField
          :label="t('payments.claim.amountLabel')"
          :error="amount !== null && !amountValid ? t('payments.claim.amountInvalid') : undefined"
        >
          <UInput v-model.number="amount" type="number" step="0.01" min="0" class="w-full" />
        </UFormField>

        <UFormField :label="t('payments.claim.commentLabel')" :help="t('payments.claim.commentHelp')">
          <UTextarea v-model="comment" :rows="3" class="w-full" />
        </UFormField>

        <div class="flex items-center justify-end gap-3 pt-2">
          <UButton color="neutral" variant="ghost" :disabled="saving" @click="isOpen = false">{{ t('common.cancel') }}</UButton>
          <UButton :loading="saving" :disabled="!amountValid" icon="i-lucide-message-square-warning" @click="save">
            {{ t('payments.claim.confirm') }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
