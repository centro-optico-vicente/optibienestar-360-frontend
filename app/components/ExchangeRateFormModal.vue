<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { ExchangeRateDto } from '~/types/currencies'

// Manual entry / correction of an `exchange_rates` row (ADR 0015 §2/§7).
// Create needs base/quote currency codes; edit only ever touches a MANUAL
// row's rate/operationDate (base/quote/source are immutable once created —
// see ExchangeRateService on the backend).
const props = defineProps<{ open: boolean, rate: ExchangeRateDto | null }>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'saved': [rate: ExchangeRateDto]
}>()

const { t } = useI18n()
const exchangeRates = useExchangeRates()
const toast = useToast()

const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})
const isEdit = computed(() => !!props.rate)
const isSubmitting = ref(false)
const formRef = ref<{ submit: () => Promise<void> } | null>(null)

interface FormState {
  baseCurrencyCode: string
  quoteCurrencyCode: string
  rate: string
  operationDate: string
}

const state = reactive<FormState>({
  baseCurrencyCode: '',
  quoteCurrencyCode: '',
  rate: '',
  operationDate: '',
})

const schema = computed(() => z.object({
  baseCurrencyCode: z.string().regex(/^[A-Za-z]{3}$/, t('exchangeRates.form.validation.currencyFormat')),
  quoteCurrencyCode: z.string().regex(/^[A-Za-z]{3}$/, t('exchangeRates.form.validation.currencyFormat')),
  rate: z.string()
    .regex(/^\d+(\.\d{1,8})?$/, t('exchangeRates.form.validation.rateInvalid'))
    .refine(v => Number(v) > 0, t('exchangeRates.form.validation.rateMin')),
  operationDate: z.string().min(1, t('validation.required')),
}))

// Reset/prefill every time the modal opens — same pattern as PaymentFormModal.
watch(() => props.open, (open) => {
  if (!open) return
  if (props.rate) {
    state.baseCurrencyCode = props.rate.baseCurrency_Code
    state.quoteCurrencyCode = props.rate.quoteCurrency_Code
    state.rate = String(props.rate.rate)
    state.operationDate = props.rate.operationDate.slice(0, 10)
  }
  else {
    state.baseCurrencyCode = ''
    state.quoteCurrencyCode = ''
    state.rate = ''
    state.operationDate = ''
  }
})

async function onSubmit(_event: FormSubmitEvent<Record<string, unknown>>) {
  isSubmitting.value = true
  try {
    let result: ExchangeRateDto
    if (isEdit.value && props.rate) {
      result = await exchangeRates.update(props.rate.uuid, {
        rate: state.rate.trim(),
        operationDate: state.operationDate,
      })
      toast.add({ title: t('exchangeRates.form.updatedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    }
    else {
      result = await exchangeRates.create({
        baseCurrencyCode: state.baseCurrencyCode.trim().toUpperCase(),
        quoteCurrencyCode: state.quoteCurrencyCode.trim().toUpperCase(),
        rate: state.rate.trim(),
        operationDate: state.operationDate,
      })
      toast.add({ title: t('exchangeRates.form.createdToast'), color: 'success', icon: 'i-lucide-check-circle' })
    }
    emit('saved', result)
    isOpen.value = false
  }
  catch {
    // useApi already shows the error toast (e.g. currency.not_found, currencies_distinct)
  }
  finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="isOpen"
    :title="isEdit ? t('exchangeRates.form.editTitle') : t('exchangeRates.form.createTitle')"
    :description="isEdit ? t('exchangeRates.form.editDescription') : t('exchangeRates.form.createDescription')"
  >
    <template #body>
      <UForm ref="formRef" :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
        <div class="grid grid-cols-2 gap-4">
          <UFormField :label="t('exchangeRates.form.fields.base')" name="baseCurrencyCode" required>
            <UInput v-model="state.baseCurrencyCode" :disabled="isEdit" placeholder="USD" class="w-full font-mono uppercase" />
          </UFormField>
          <UFormField :label="t('exchangeRates.form.fields.quote')" name="quoteCurrencyCode" required>
            <UInput v-model="state.quoteCurrencyCode" :disabled="isEdit" placeholder="VES" class="w-full font-mono uppercase" />
          </UFormField>
        </div>
        <UFormField :label="t('exchangeRates.form.fields.rate')" name="rate" required :help="t('exchangeRates.form.fields.rateHelp')">
          <UInput v-model="state.rate" placeholder="805.42" class="w-full" />
        </UFormField>
        <UFormField :label="t('exchangeRates.form.fields.operationDate')" name="operationDate" required :help="t('exchangeRates.form.fields.operationDateHelp')">
          <UInput v-model="state.operationDate" type="date" class="w-full" />
        </UFormField>
      </UForm>
    </template>

    <template #footer>
      <div class="w-full space-y-2">
        <p class="text-xs text-prohealth-500">{{ t('common.requiredFieldsHint') }}</p>
        <div class="flex items-center justify-end gap-3">
          <UButton color="neutral" variant="ghost" :disabled="isSubmitting" @click="isOpen = false">
            {{ t('common.cancel') }}
          </UButton>
          <UButton color="primary" variant="outline" :loading="isSubmitting" icon="i-lucide-save" @click="formRef?.submit()">
            {{ t('common.save') }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
