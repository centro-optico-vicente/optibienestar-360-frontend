<script setup lang="ts">
import type { PaymentDto } from '~/types/payments'
import { paymentMethodLabel } from '~/types/payments'

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
  !isApprove.value && touched.value && !reason.value.trim() ? 'El motivo es obligatorio' : undefined)

watch(() => props.open, (open) => {
  if (open) {
    reason.value = ''
    touched.value = false
  }
})

function formatMoney(v?: number | string | null, currency?: string | null): string {
  if (v === null || v === undefined || v === '') return '—'
  return `${Number(v).toFixed(2)} ${currency ?? ''}`.trim()
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
      title: isApprove.value ? 'Pago aprobado' : 'Pago rechazado',
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
    :title="isApprove ? 'Aprobar pago' : 'Rechazar pago'"
  >
    <template #body>
      <div class="space-y-4">
        <!-- Payment summary -->
        <div v-if="payment" class="rounded-xl border border-prohealth-100 bg-prohealth-50/40 p-4 text-sm space-y-1">
          <div class="flex items-center justify-between">
            <span class="text-prohealth-500">Monto</span>
            <span class="font-semibold text-prohealth-900">{{ formatMoney(payment.amount, payment.currency) }}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-prohealth-500">Método</span>
            <span class="text-prohealth-800">{{ paymentMethodLabel(payment.paymentMethod) }}</span>
          </div>
          <div v-if="payment.referenceNumber" class="flex items-center justify-between">
            <span class="text-prohealth-500">Referencia</span>
            <span class="text-prohealth-800 font-mono">{{ payment.referenceNumber }}</span>
          </div>
          <div v-if="payment.planCode" class="flex items-center justify-between">
            <span class="text-prohealth-500">Plan</span>
            <span class="text-prohealth-800 font-mono">{{ payment.planCode }}</span>
          </div>
        </div>

        <p class="text-sm text-prohealth-700">
          <template v-if="isApprove">
            El pago se marcará como <span class="font-semibold text-green-700">aprobado</span> y se notificará al afiliado por correo.
          </template>
          <template v-else>
            El pago se marcará como <span class="font-semibold text-red-700">rechazado</span>. El motivo se enviará al afiliado para que pueda reenviar.
          </template>
        </p>

        <UFormField
          :label="isApprove ? 'Nota de aprobación (opcional)' : 'Motivo del rechazo'"
          :required="!isApprove"
          :error="reasonError"
        >
          <UTextarea
            v-model="reason"
            :rows="3"
            :maxlength="500"
            :placeholder="isApprove ? 'Observación opcional para el afiliado.' : 'Explica por qué se rechaza (comprobante ilegible, monto incorrecto…).'"
            class="w-full"
            @blur="touched = true"
          />
        </UFormField>

        <div class="flex items-center justify-end gap-3 pt-1">
          <UButton color="neutral" variant="ghost" :disabled="submitting" @click="isOpen = false">
            Cancelar
          </UButton>
          <UButton
            :color="isApprove ? 'success' : 'error'"
            :icon="isApprove ? 'i-lucide-check' : 'i-lucide-x'"
            :loading="submitting"
            @click="confirm"
          >
            {{ isApprove ? 'Aprobar pago' : 'Rechazar pago' }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
