<script setup lang="ts">
import type { MyAllyDto } from '~/types/allies'
import type { BenefitUsageDto } from '~/types/benefits'
import type { ValidationResultDto } from '~/types/validator'

// Registers a consumed benefit at the counter. Opened from the validator page only
// after an ACTIVE result, so `membershipUuid` is always the one the backend just
// vouched for. The parent gates ALLY_REGISTER_USAGE.
const props = defineProps<{
  open: boolean
  ally: MyAllyDto | null
  validation: ValidationResultDto | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'registered': [usage: BenefitUsageDto]
}>()

const { t } = useI18n()
const { formatCurrency } = useFormatters()
const benefitUsage = useBenefitUsage()
const publicAllies = usePublicAllies()
const toast = useToast()

const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})

// ---- Form state ----
const allyServiceUuid = ref<string | undefined>(undefined)
const usageDate = ref('')
const copayAmount = ref('')
const copayCurrency = ref('USD')
const notes = ref('')
const submitting = ref(false)
const touched = ref(false)

/**
 * Today in the VE convention (ADR 0010). `en-CA` renders as yyyy-MM-dd, which is
 * what the backend's LocalDate expects — building it off the browser's timezone
 * would send tomorrow's date to a @PastOrPresent field for anyone east of Caracas.
 */
function todayInCaracas(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Caracas',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

// ---- Service catalog ----
// An ALIADO user has no ALLY_VIEW_ALL, so the admin sub-resource
// (/v1/admin/allies/{uuid}/services) is closed to them. The public detail endpoint
// is the only catalog they can read — it returns just APPROVED + PUBLISHED
// services, and 404s for an unpublished ally. Both are acceptable: allyServiceUuid
// is optional (the backend allows non-catalogued usage), so a failure here
// degrades to "no service selected" instead of blocking the counter.
const serviceOptions = ref<{ label: string, value: string }[]>([])
const servicesUnavailable = ref(false)

async function loadServices(allyUuid: string) {
  serviceOptions.value = []
  servicesUnavailable.value = false
  try {
    const detail = await publicAllies.get(allyUuid)
    serviceOptions.value = (detail.services ?? []).map(s => ({ label: s.name, value: s.uuid }))
    servicesUnavailable.value = serviceOptions.value.length === 0
  }
  catch {
    servicesUnavailable.value = true
  }
}

watch(() => props.open, (open) => {
  if (!open) return
  allyServiceUuid.value = undefined
  usageDate.value = todayInCaracas()
  copayAmount.value = ''
  copayCurrency.value = 'USD'
  notes.value = ''
  touched.value = false
  if (props.ally) loadServices(props.ally.uuid)
})

// ---- Validation ----
// Co-pay is all-or-nothing (mirrors the V24 chk_benefit_usages_copay_paired CHECK).
// Currency is preset to USD, so in practice only the amount can be half-filled —
// but a cleared currency must still be caught here rather than as a backend 422.
const amountPattern = /^\d{1,8}(\.\d{1,2})?$/

const amountError = computed(() => {
  if (!touched.value) return undefined
  const raw = copayAmount.value.trim()
  if (!raw) return undefined
  if (!amountPattern.test(raw)) return t('validation.invalidAmount')
  return undefined
})

const currencyError = computed(() => {
  if (!touched.value) return undefined
  if (copayAmount.value.trim() && !copayCurrency.value.trim()) return t('validation.required')
  return undefined
})

const canSubmit = computed(() =>
  !!props.ally && !!props.validation?.membershipUuid && !amountError.value && !currencyError.value)

// ---- Display helpers ----
function money(v?: number | string | null, currency?: string | null): string {
  if (v === null || v === undefined || v === '') return t('common.empty')
  return formatCurrency(Number(v), currency || 'USD')
}

async function confirm() {
  touched.value = true
  const ally = props.ally
  const membershipUuid = props.validation?.membershipUuid
  if (!ally || !membershipUuid) return
  if (amountError.value || currencyError.value) return

  submitting.value = true
  try {
    const amount = copayAmount.value.trim()
    const usage = await benefitUsage.register({
      membershipUuid,
      allyUuid: ally.uuid,
      ...(allyServiceUuid.value ? { allyServiceUuid: allyServiceUuid.value } : {}),
      ...(usageDate.value ? { usageDate: usageDate.value } : {}),
      // Both sides or neither — never one.
      ...(amount ? { copayAmount: amount, copayCurrency: copayCurrency.value.trim().toUpperCase() } : {}),
      ...(notes.value.trim() ? { notes: notes.value.trim() } : {}),
    })
    toast.add({
      title: t('validator.usage.registeredToast'),
      description: t('validator.usage.registeredToastDescription', { name: props.validation?.memberFullName ?? '' }),
      color: 'success',
      icon: 'i-lucide-check-circle',
    })
    emit('registered', usage)
    isOpen.value = false
  }
  catch {
    // useApi already notified. A 422 here means the membership stopped being
    // ACTIVE between the validation and this POST — the page re-validates.
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <UModal v-model:open="isOpen" :title="t('validator.usage.title')">
    <template #body>
      <div class="space-y-4">
        <!-- What is being registered, and against whom -->
        <div v-if="validation" class="rounded-xl border border-prohealth-100 bg-prohealth-50/40 p-4 text-sm space-y-1">
          <div class="flex items-center justify-between">
            <span class="text-prohealth-500">{{ t('validator.result.member') }}</span>
            <span class="font-semibold text-prohealth-900">{{ validation.memberFullName || t('common.empty') }}</span>
          </div>
          <div v-if="validation.planName" class="flex items-center justify-between">
            <span class="text-prohealth-500">{{ t('validator.result.plan') }}</span>
            <span class="text-prohealth-800">{{ validation.planName }}</span>
          </div>
          <div v-if="ally" class="flex items-center justify-between">
            <span class="text-prohealth-500">{{ t('validator.usage.ally') }}</span>
            <span class="text-prohealth-800">{{ ally.name }}</span>
          </div>
        </div>

        <UFormField :label="t('validator.usage.fields.service')" :help="t('validator.usage.fields.serviceHelp')">
          <USelectMenu
            clear
            v-model="allyServiceUuid"
            :items="serviceOptions"
            label-key="label"
            value-key="value"
            :disabled="servicesUnavailable"
            :placeholder="servicesUnavailable ? t('validator.usage.noServices') : t('common.select')"
            class="w-full"
          />
        </UFormField>

        <UFormField :label="t('validator.usage.fields.usageDate')" :help="t('validator.usage.fields.usageDateHelp')">
          <UInput v-model="usageDate" type="date" :max="todayInCaracas()" class="w-full" />
        </UFormField>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <UFormField
            :label="t('validator.usage.fields.copayAmount')"
            :help="t('validator.usage.fields.copayHelp')"
            :error="amountError"
            class="sm:col-span-2"
          >
            <UInput v-model="copayAmount" placeholder="0.00" inputmode="decimal" class="w-full" />
          </UFormField>
          <UFormField :label="t('validator.usage.fields.copayCurrency')" :error="currencyError">
            <UInput v-model="copayCurrency" maxlength="3" class="w-full font-mono uppercase" />
          </UFormField>
        </div>

        <p v-if="copayAmount.trim() && !amountError" class="text-xs text-prohealth-500 -mt-2">
          {{ t('validator.usage.copayPreview', { amount: money(copayAmount, copayCurrency) }) }}
        </p>

        <UFormField :label="t('validator.usage.fields.notes')">
          <UTextarea v-model="notes" :rows="2" :maxlength="500" class="w-full" />
        </UFormField>

        <div class="flex items-center justify-end gap-3 pt-1">
          <UButton color="neutral" variant="ghost" :disabled="submitting" @click="isOpen = false">
            {{ t('common.cancel') }}
          </UButton>
          <UButton
            color="primary"
            icon="i-lucide-check"
            :loading="submitting"
            :disabled="!canSubmit"
            @click="confirm"
          >
            {{ t('validator.usage.submit') }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
