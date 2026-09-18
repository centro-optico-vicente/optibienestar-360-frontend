<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { DownlinePaymentCreateRequest, PaymentDto, PaymentMethod } from '~/types/payments'
import { PAYMENT_CURRENCY_OPTIONS, PAYMENT_METHOD_OPTIONS } from '~/types/payments'

// Promoter self-service registration on behalf of a downline affiliate
// (POST /v1/promoter/me/payments, multipart, PAYMENT_CREATE_DOWNLINE). The
// member picker is the caller's own portfolio (GET /v1/promoter/me) rather
// than a global member search — a promoter only ever registers for their
// own downline, and the backend re-verifies that ownership regardless.
const props = defineProps<{ open: boolean }>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'saved': [payment: PaymentDto]
}>()

const { t } = useI18n()
const payments = usePayments()
const promoters = usePromoters()
const toast = useToast()

const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})
const isSubmitting = ref(false)
const formRef = ref<{ submit: () => Promise<void> } | null>(null)

const methodOptions = computed(() => PAYMENT_METHOD_OPTIONS.map(o => ({ label: t(o.labelKey), value: o.value })))
const currencyOptions = PAYMENT_CURRENCY_OPTIONS

// ---- Own portfolio (member picker) ----
const memberOptions = ref<{ label: string, value: string }[]>([])
const loadingMembers = ref(false)

async function loadPortfolio() {
  loadingMembers.value = true
  try {
    const dashboard = await promoters.me()
    // Only affiliates with an active membership can receive a collection —
    // the backend rejects the rest with membership.active.not_found.
    memberOptions.value = dashboard.portfolio
      .filter(row => row.membershipStatus !== null)
      .map(row => ({ label: row.memberName, value: row.memberUuid }))
  }
  catch {
    memberOptions.value = []
  }
  finally {
    loadingMembers.value = false
  }
}

interface FormState {
  memberUuid: string
  amount: string
  currency: string
  paymentMethod: PaymentMethod | undefined
  referenceNumber: string
  paymentDate: string
  inscription: boolean
  appliedPeriod: string
  adminNotes: string
}

const state = reactive<FormState>({
  memberUuid: '',
  amount: '',
  currency: 'USD',
  paymentMethod: undefined,
  referenceNumber: '',
  paymentDate: '',
  inscription: false,
  appliedPeriod: '',
  adminNotes: '',
})

// ---- Proof of payment (optional) ----
const supportFile = ref<File | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  supportFile.value = input.files?.[0] ?? null
}

function clearFile() {
  supportFile.value = null
  if (fileInput.value) fileInput.value.value = ''
}

function formatSize(bytes?: number | null): string {
  if (bytes === null || bytes === undefined) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function notFuture(v: string): boolean {
  if (!v) return true
  const today = new Date()
  today.setHours(23, 59, 59, 999)
  return new Date(v) <= today
}

const schema = computed(() => z.object({
  memberUuid: z.string({ message: t('validation.required') }).min(1, t('payments.form.validation.member')),
  amount: z.string()
    .regex(/^\d+(\.\d{1,2})?$/, t('payments.form.validation.amountInvalid'))
    .refine(v => Number(v) >= 0.01, t('payments.form.validation.amountMin')),
  currency: z.string().min(1, t('validation.required')),
  paymentMethod: z.string({ message: t('validation.required') }).min(1, t('validation.required')),
  referenceNumber: z.string().max(80, t('validation.maxChars', { n: 80 })).optional(),
  paymentDate: z.string().min(1, t('validation.required')).refine(notFuture, t('payments.form.validation.dateFuture')),
  appliedPeriod: z.string().optional(),
  adminNotes: z.string().optional(),
}))

function resetForm() {
  state.memberUuid = ''
  state.amount = ''
  state.currency = 'USD'
  state.paymentMethod = undefined
  state.referenceNumber = ''
  state.paymentDate = ''
  state.inscription = false
  state.appliedPeriod = ''
  state.adminNotes = ''
  clearFile()
}

watch(() => props.open, (open) => {
  if (open) {
    resetForm()
    loadPortfolio()
  }
})

async function onSubmit(_event: FormSubmitEvent<Record<string, unknown>>) {
  isSubmitting.value = true
  try {
    const payload: DownlinePaymentCreateRequest = {
      memberUuid: state.memberUuid,
      amount: state.amount.trim(),
      currency: state.currency.trim() ? state.currency.trim().toUpperCase() : undefined,
      paymentMethod: state.paymentMethod!,
      referenceNumber: state.referenceNumber.trim() || undefined,
      paymentDate: state.paymentDate,
      inscription: state.inscription,
      appliedPeriod: state.inscription
        ? undefined
        : (state.appliedPeriod ? `${state.appliedPeriod}-01` : undefined),
      adminNotes: state.adminNotes.trim() || undefined,
    }
    const result = await payments.registerForDownline(payload, supportFile.value)
    toast.add({ title: t('payments.form.registeredToast'), description: t('payments.form.registeredToastDescription'), color: 'success', icon: 'i-lucide-check-circle' })
    emit('saved', result)
    isOpen.value = false
  }
  catch {
    // useApi already notified the error (404 not in portfolio, 422 rules)
  }
  finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="isOpen"
    :title="t('promoterSelf.collections.form.title')"
    :description="t('promoterSelf.collections.form.description')"
    :ui="{ content: 'max-w-2xl' }"
  >
    <template #body>
      <UForm ref="formRef" :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
        <UFormField :label="t('payments.form.fields.member')" name="memberUuid" required>
          <USelectMenu
            clear
            v-model="state.memberUuid"
            :items="memberOptions"
            label-key="label"
            value-key="value"
            :loading="loadingMembers"
            :placeholder="t('payments.form.memberPlaceholderSearch')"
            class="w-full"
          />
        </UFormField>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <UFormField :label="t('payments.form.fields.amount')" name="amount" required class="sm:col-span-1">
            <UInput v-model="state.amount" placeholder="10.00" class="w-full">
              <template #leading>
                <span class="text-prohealth-400 text-sm">$</span>
              </template>
            </UInput>
          </UFormField>
          <UFormField :label="t('payments.form.fields.currency')" name="currency" required>
            <USelectMenu
              clear
              v-model="state.currency"
              :items="currencyOptions"
              label-key="label"
              value-key="value"
              class="w-full font-mono"
            />
          </UFormField>
          <UFormField :label="t('payments.form.fields.method')" name="paymentMethod" required>
            <USelectMenu
              clear
              v-model="state.paymentMethod"
              :items="methodOptions"
              label-key="label"
              value-key="value"
              :placeholder="t('common.select')"
              class="w-full"
            />
          </UFormField>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('payments.form.fields.reference')" name="referenceNumber" :help="t('payments.form.fields.referenceHelp')">
            <UInput v-model="state.referenceNumber" :placeholder="t('payments.form.placeholders.reference')" class="w-full" />
          </UFormField>
          <UFormField :label="t('payments.form.fields.paymentDate')" name="paymentDate" required :help="t('payments.form.fields.paymentDateHelp')">
            <UInput v-model="state.paymentDate" type="date" class="w-full" />
          </UFormField>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
          <UFormField :label="t('payments.form.fields.inscription')" name="inscription" :help="t('payments.form.fields.inscriptionHelp')">
            <USwitch v-model="state.inscription" />
          </UFormField>
          <UFormField
            v-if="!state.inscription"
            :label="t('payments.form.fields.coveredMonth')"
            name="appliedPeriod"
            :help="t('payments.form.fields.coveredMonthHelp')"
          >
            <UInput v-model="state.appliedPeriod" type="month" class="w-full" />
          </UFormField>
        </div>

        <UFormField :label="t('payments.form.fields.adminNotes')" name="adminNotes">
          <UTextarea v-model="state.adminNotes" :rows="2" class="w-full" :placeholder="t('payments.form.placeholders.adminNotes')" />
        </UFormField>

        <UFormField :label="t('payments.form.fields.proof')" :help="t('payments.form.fields.proofHelp')">
          <div class="flex flex-wrap items-center gap-3">
            <input
              ref="fileInput"
              type="file"
              accept="image/*,application/pdf"
              class="block w-full max-w-xs text-sm text-prohealth-600 file:mr-3 file:rounded-lg file:border-0 file:bg-prohealth-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-prohealth-700 hover:file:bg-prohealth-100"
              @change="onFileChange"
            >
            <div v-if="supportFile" class="flex items-center gap-2 text-xs text-prohealth-600">
              <UIcon name="i-lucide-paperclip" class="w-4 h-4" />
              <span class="font-medium">{{ supportFile.name }}</span>
              <span class="text-prohealth-400">({{ formatSize(supportFile.size) }})</span>
              <UButton color="neutral" variant="ghost" icon="i-lucide-x" size="xs" @click="clearFile" />
            </div>
          </div>
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
            {{ t('common.saveNew') }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
