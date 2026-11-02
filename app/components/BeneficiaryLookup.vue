<script setup lang="ts">
import type { BeneficiaryMatchDto } from '~/types/payments'

// Finds the holder a payment is for by exact contract number or document number and makes the payer
// CONFIRM the match (abbreviated name, contract, plan) before it is used — a typo can never silently
// send the money to someone else. The confirmed match is the v-model; the parent decides what to do with it.
// With `requireMembership`, holders without an active membership are shown but cannot be picked.
const props = defineProps<{
  modelValue: BeneficiaryMatchDto | null
  requireMembership?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: BeneficiaryMatchDto | null]
}>()

const { t } = useI18n()
const payments = usePayments()

const mode = ref<'contract' | 'document'>('contract')
const term = ref('')
const searching = ref(false)
const searched = ref(false)
const matches = ref<BeneficiaryMatchDto[]>([])

const modeItems = computed(() => [
  { label: t('payments.beneficiary.byContract'), value: 'contract' },
  { label: t('payments.beneficiary.byDocument'), value: 'document' },
])

watch(mode, () => {
  matches.value = []
  searched.value = false
})

async function search() {
  const value = term.value.trim()
  if (!value) return
  searching.value = true
  try {
    matches.value = await payments.lookupMembership(
      mode.value === 'contract' ? { contractNumber: value } : { documentNumber: value })
    searched.value = true
  }
  catch {
    // useApi already notified the error
  }
  finally {
    searching.value = false
  }
}

function pickable(m: BeneficiaryMatchDto): boolean {
  return !props.requireMembership || m.membershipUuid !== null
}

function confirm(m: BeneficiaryMatchDto) {
  emit('update:modelValue', m)
}

function clear() {
  emit('update:modelValue', null)
  matches.value = []
  searched.value = false
  term.value = ''
}
</script>

<template>
  <div class="space-y-3">
    <!-- Confirmed holder -->
    <div v-if="modelValue" class="rounded-xl border border-green-200 bg-green-50 p-3 flex items-start justify-between gap-3">
      <div class="text-sm">
        <p class="font-semibold text-prohealth-900">{{ modelValue.holderName }}</p>
        <p v-if="modelValue.contractNumber" class="text-prohealth-700">
          {{ t('payments.beneficiary.contract') }}: <span class="font-mono">{{ modelValue.contractNumber }}</span>
          · {{ modelValue.planName }}
        </p>
        <p v-else class="text-prohealth-700">{{ t('payments.beneficiary.creditOnly') }}</p>
      </div>
      <UButton color="neutral" variant="ghost" size="sm" icon="i-lucide-x" @click="clear">
        {{ t('payments.beneficiary.change') }}
      </UButton>
    </div>

    <!-- Search -->
    <template v-else>
      <URadioGroup v-model="mode" orientation="horizontal" :items="modeItems" value-key="value" label-key="label" />
      <div class="flex items-center gap-2">
        <UInput
          v-model="term"
          class="w-full"
          :placeholder="mode === 'contract' ? t('payments.beneficiary.contractPlaceholder') : t('payments.beneficiary.documentPlaceholder')"
          @keyup.enter="search"
        />
        <UButton color="neutral" variant="soft" icon="i-lucide-search" :loading="searching" @click="search">
          {{ t('payments.assignOwn.search') }}
        </UButton>
      </div>
      <p class="text-xs text-prohealth-500">{{ t('payments.beneficiary.exactHelp') }}</p>

      <p v-if="searched && !matches.length" class="text-sm text-prohealth-600">{{ t('payments.beneficiary.notFound') }}</p>

      <ul v-if="matches.length" class="space-y-2">
        <li
          v-for="m in matches"
          :key="m.membershipUuid ?? m.personUuid"
          class="rounded-xl border border-prohealth-100 p-3 flex items-center justify-between gap-3"
        >
          <div class="text-sm">
            <p class="font-semibold text-prohealth-900">{{ m.holderName }}</p>
            <p v-if="m.contractNumber" class="text-prohealth-600">
              <span class="font-mono">{{ m.contractNumber }}</span> · {{ m.planName }}
            </p>
            <p v-else class="text-prohealth-600">{{ t('payments.beneficiary.noMembership') }}</p>
          </div>
          <UTooltip :text="pickable(m) ? '' : t('payments.beneficiary.needsMembership')">
            <UButton size="sm" :disabled="!pickable(m)" icon="i-lucide-check" @click="confirm(m)">
              {{ t('payments.beneficiary.confirm') }}
            </UButton>
          </UTooltip>
        </li>
      </ul>
    </template>
  </div>
</template>
