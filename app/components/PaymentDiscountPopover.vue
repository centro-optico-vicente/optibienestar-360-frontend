<script setup lang="ts">
import type { PaymentDto } from '~/types/payments'

/**
 * One-off discount on a PENDING payment (ALLOWS_DISCOUNT). The "% discount"
 * and "total to pay" fields are linked: editing either recomputes the other
 * against the payment amount. Shows the caller's discount-authority cap
 * (rank/promoter type) and blocks going over it; the backend enforces it too.
 */
const props = defineProps<{ payment: PaymentDto }>()
const emit = defineEmits<{ applied: [payment: PaymentDto] }>()

const { t } = useI18n()
const { formatCurrency } = useFormatters()
const payments = usePayments()
const toast = useToast()

const open = ref(false)
const percent = ref<number | null>(null)
const total = ref<number | null>(null)
const reason = ref('')
const touched = ref(false)
const submitting = ref(false)
const maxPct = ref<number | null>(null)

const gross = computed(() => Number(props.payment.amount) || 0)
const currency = computed(() => props.payment.currency_Code || props.payment.currency || 'USD')

const round2 = (v: number) => Math.round(v * 100) / 100

function onPercentInput(value: number | string | null | undefined) {
  const pct = value === '' || value === null || value === undefined ? null : Number(value)
  percent.value = pct
  total.value = pct === null || Number.isNaN(pct) ? null : round2(gross.value * (1 - pct / 100))
}

function onTotalInput(value: number | string | null | undefined) {
  const amount = value === '' || value === null || value === undefined ? null : Number(value)
  total.value = amount
  percent.value = amount === null || Number.isNaN(amount) || gross.value <= 0
    ? null
    : round2((1 - amount / gross.value) * 100)
}

const discount = computed(() => total.value === null ? null : round2(gross.value - total.value))

const amountError = computed(() => {
  if (!touched.value) return undefined
  if (discount.value === null || percent.value === null || discount.value <= 0 || discount.value > gross.value) {
    return t('payments.discount.invalid')
  }
  if (maxPct.value !== null && percent.value > maxPct.value) {
    return t('payments.discount.exceedsCap', { max: maxPct.value })
  }
  return undefined
})
const reasonError = computed(() => touched.value && !reason.value.trim() ? t('payments.discount.reasonRequired') : undefined)

watch(open, async (isOpen) => {
  if (!isOpen) return
  percent.value = null
  total.value = null
  reason.value = ''
  touched.value = false
  try {
    const authority = await payments.discountAuthority()
    maxPct.value = authority.maxDiscountPct === null ? null : Number(authority.maxDiscountPct)
  }
  catch {
    maxPct.value = null   // the backend still enforces the cap on submit
  }
})

async function apply() {
  touched.value = true
  if (amountError.value || reasonError.value || discount.value === null) return
  submitting.value = true
  try {
    const updated = await payments.applyDiscount(props.payment.uuid, { amount: discount.value, reason: reason.value.trim() })
    toast.add({ title: t('payments.discount.appliedToast'), color: 'success', icon: 'i-lucide-badge-percent' })
    emit('applied', updated)
    open.value = false
  }
  catch {
    // useApi already notified (exceeds authority, no longer PENDING, …)
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <UPopover v-model:open="open">
    <UButton color="neutral" variant="soft" icon="i-lucide-badge-percent">
      {{ t('payments.discount.trigger') }}
    </UButton>

    <template #content>
      <div class="p-4 w-80 space-y-3 text-sm">
        <div class="flex justify-between gap-3">
          <span class="text-prohealth-500">{{ t('payments.discount.gross') }}</span>
          <span class="font-semibold text-prohealth-900">{{ formatCurrency(gross, currency) }}</span>
        </div>

        <UFormField :label="t('payments.discount.percent')" :error="amountError">
          <UInput
            :model-value="percent ?? undefined"
            type="number"
            min="0"
            max="100"
            step="0.01"
            trailing-icon="i-lucide-percent"
            class="w-full"
            @update:model-value="onPercentInput"
          />
        </UFormField>

        <UFormField :label="t('payments.discount.total')">
          <UInput
            :model-value="total ?? undefined"
            type="number"
            min="0"
            :max="gross"
            step="0.01"
            class="w-full"
            @update:model-value="onTotalInput"
          />
        </UFormField>

        <p class="text-xs text-prohealth-500">
          <template v-if="discount !== null && discount > 0">
            {{ t('payments.discount.discountLine', { amount: formatCurrency(discount, currency) }) }} ·
          </template>
          {{ maxPct === null ? t('payments.discount.uncapped') : t('payments.discount.maxAllowed', { max: maxPct }) }}
        </p>

        <UFormField :label="t('payments.discount.reason')" required :error="reasonError">
          <UTextarea
            v-model="reason"
            :rows="2"
            :maxlength="500"
            :placeholder="t('payments.discount.reasonPlaceholder')"
            class="w-full"
          />
        </UFormField>

        <div class="flex justify-end gap-2 pt-1">
          <UButton color="neutral" variant="ghost" :disabled="submitting" @click="open = false">
            {{ t('common.cancel') }}
          </UButton>
          <UButton color="primary" icon="i-lucide-check" :loading="submitting" @click="apply">
            {{ t('payments.discount.apply') }}
          </UButton>
        </div>
      </div>
    </template>
  </UPopover>
</template>
