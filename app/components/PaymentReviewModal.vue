<script setup lang="ts">
import type { PaymentDto } from '~/types/payments'

// Review modal for a PENDING payment: approve (optional reason) or reject (mandatory
// reason, the member will see it to resubmit). Shared by the queue (/dashboard/payments)
// and the detail page. The parent gates PAYMENT_APPROVE / PAYMENT_REJECT.
const props = defineProps<{
  open: boolean
  action: 'approve' | 'reject'
  payment: PaymentDto | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'reviewed': [payment: PaymentDto]
}>()

const { t } = useI18n()
const { formatCurrency } = useFormatters()
const payments = usePayments()
const toast = useToast()

const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})

const isApprove = computed(() => props.action === 'approve')
const reason = ref('')
const submitting = ref(false)
const touched = ref(false)

// Rejection requires a reason; the inline error shows after the first attempt.
const reasonError = computed(() =>
  !isApprove.value && touched.value && !reason.value.trim() ? t('payments.review.reasonRequired') : undefined)

watch(() => props.open, (open) => {
  if (open) {
    reason.value = ''
    touched.value = false
  }
})

// Amount in the payment's currency, formatted in the VE convention. Empty → '—'.
function money(v?: number | string | null, currency?: string | null): string {
  if (v === null || v === undefined || v === '') return t('common.empty')
  return formatCurrency(Number(v), currency || 'USD')
}

// Payment method label; falls back to the raw value.
function methodLabel(m?: string | null): string {
  return m ? t(`payments.methods.${m}`, m) : t('common.empty')
}

async function confirm() {
  if (!props.payment) return
  touched.value = true
  const text = reason.value.trim()
  if (!isApprove.value && !text) return
  submitting.value = true
  try {
    const result = isApprove.value
      ? await payments.approve(props.payment.uuid, text || undefined)
      : await payments.reject(props.payment.uuid, text)
    toast.add({
      title: isApprove.value ? t('payments.review.approvedToast') : t('payments.review.rejectedToast'),
      color: isApprove.value ? 'success' : 'warning',
      icon: isApprove.value ? 'i-lucide-check-circle' : 'i-lucide-circle-x',
    })
    emit('reviewed', result)
    isOpen.value = false
  }
  catch {
    // useApi already notified the error (422 if no longer PENDING, etc.)
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="isOpen"
    :title="isApprove ? t('payments.review.approveTitle') : t('payments.review.rejectTitle')"
  >
    <template #body>
      <div class="space-y-4">
        <!-- Payment summary -->
        <div v-if="payment" class="rounded-xl border border-prohealth-100 bg-prohealth-50/40 p-4 text-sm space-y-1">
          <div class="flex items-center justify-between">
            <span class="text-prohealth-500">{{ t('payments.detail.fields.amount') }}</span>
            <span class="font-semibold text-prohealth-900">{{ money(payment.amount, payment.currency) }}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-prohealth-500">{{ t('payments.detail.fields.method') }}</span>
            <span class="text-prohealth-800">{{ methodLabel(payment.paymentMethod) }}</span>
          </div>
          <div v-if="payment.referenceNumber" class="flex items-center justify-between">
            <span class="text-prohealth-500">{{ t('payments.detail.fields.reference') }}</span>
            <span class="text-prohealth-800 font-mono">{{ payment.referenceNumber }}</span>
          </div>
          <div v-if="payment.plan_Code" class="flex items-center justify-between">
            <span class="text-prohealth-500">{{ t('payments.detail.fields.plan') }}</span>
            <span class="text-prohealth-800 font-mono">{{ payment.plan_Code }}</span>
          </div>
        </div>

        <p class="text-sm text-prohealth-700">
          <i18n-t v-if="isApprove" keypath="payments.review.approveNotice" tag="span" scope="global">
            <template #status>
              <span class="font-semibold text-green-700">{{ t('payments.review.approvedWord') }}</span>
            </template>
          </i18n-t>
          <i18n-t v-else keypath="payments.review.rejectNotice" tag="span" scope="global">
            <template #status>
              <span class="font-semibold text-red-700">{{ t('payments.review.rejectedWord') }}</span>
            </template>
          </i18n-t>
        </p>

        <UFormField
          :label="isApprove ? t('payments.review.reasonLabelApprove') : t('payments.review.reasonLabelReject')"
          :required="!isApprove"
          :error="reasonError"
        >
          <UTextarea
            v-model="reason"
            :rows="3"
            :maxlength="500"
            :placeholder="isApprove ? t('payments.review.placeholderApprove') : t('payments.review.placeholderReject')"
            class="w-full"
            @blur="touched = true"
          />
        </UFormField>

        <div class="flex items-center justify-end gap-3 pt-1">
          <UButton color="neutral" variant="ghost" :disabled="submitting" @click="isOpen = false">
            {{ t('common.cancel') }}
          </UButton>
          <UButton
            :color="isApprove ? 'success' : 'error'"
            :icon="isApprove ? 'i-lucide-check' : 'i-lucide-x'"
            :loading="submitting"
            @click="confirm"
          >
            {{ isApprove ? t('payments.review.approveButton') : t('payments.review.rejectButton') }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
