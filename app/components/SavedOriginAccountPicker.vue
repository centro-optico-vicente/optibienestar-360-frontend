<script setup lang="ts">
import type { SavedOriginAccountDto } from '~/types/payments'

// "Mis cuentas guardadas" (V204/V217): the origin accounts the payer chose to remember. Only the accounts that accept the
// payment method selected in the form are offered (a Pago Móvil account makes no sense for a transfer), so the
// picker hides itself when none match. Picking one asks the parent to fill the origin fields of the payment
// line (it stays editable); a trash button forgets an account.
const props = defineProps<{
  /** Payment method selected in the form; the list only shows accounts of that method. */
  methodUuid?: string
}>()
const emit = defineEmits<{ pick: [account: SavedOriginAccountDto | null] }>()
const model = defineModel<string>({ default: '' })

const { t } = useI18n()
const toast = useToast()
const api = useMyBankAccounts()

const accounts = ref<SavedOriginAccountDto[]>([])
const loading = ref(false)

const matching = computed(() => accounts.value.filter(a => !props.methodUuid || a.paymentMethods.some(m => m.uuid === props.methodUuid)))

/** What identifies the account: its number (transfers), phone (Pago Móvil) or email (Zelle and similar). */
function keyOf(a: SavedOriginAccountDto): string {
  return a.accountIdentifier || a.phone || a.email || ''
}

const options = computed(() => matching.value.map(a => ({
  label: [a.alias, [a.bank_Display ?? a.bank_Code, keyOf(a)].filter(Boolean).join(' · ')].filter(Boolean).join(' — '),
  value: a.uuid,
})))

// A selection that no longer matches the method (the user changed it) is dropped.
watch(() => props.methodUuid, () => {
  if (model.value && !matching.value.some(a => a.uuid === model.value)) onSelect(undefined)
})

async function load() {
  loading.value = true
  try {
    accounts.value = (await api.list()) ?? []
  }
  catch {
    accounts.value = []
  }
  finally {
    loading.value = false
  }
}

onMounted(load)

function onSelect(uuid: string | null | undefined) {
  model.value = uuid ?? ''
  emit('pick', accounts.value.find(a => a.uuid === uuid) ?? null)
}

async function forget() {
  const uuid = model.value
  if (!uuid) return
  try {
    await api.remove(uuid)
    toast.add({ title: t('payments.savedAccounts.removedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    accounts.value = accounts.value.filter(a => a.uuid !== uuid)
    onSelect(undefined)
  }
  catch {
    // useApi already notified the error
  }
}
</script>

<template>
  <UFormField v-if="loading || matching.length > 0" :label="t('payments.savedAccounts.label')" :help="t('payments.savedAccounts.help')">
    <div class="flex items-center gap-1">
      <USelectMenu
        :model-value="model"
        clear
        :items="options"
        label-key="label"
        value-key="value"
        :loading="loading"
        :placeholder="t('payments.savedAccounts.placeholder')"
        class="w-full"
        @update:model-value="onSelect"
      />
      <UTooltip v-if="model" :text="t('payments.savedAccounts.forget')">
        <UButton color="error" variant="ghost" icon="i-lucide-trash-2" size="sm" @click="forget" />
      </UTooltip>
    </div>
  </UFormField>
</template>
