<script setup lang="ts">
import type { SavedOriginAccountDto } from '~/types/payments'

// "Mis cuentas guardadas" (V204): the origin accounts the payer chose to remember. Picking one asks the parent to
// fill the origin fields of the payment line (it stays editable); a trash button forgets an account. Hidden when empty.
const emit = defineEmits<{ pick: [account: SavedOriginAccountDto | null] }>()
const model = defineModel<string>({ default: '' })

const { t } = useI18n()
const toast = useToast()
const api = useMyBankAccounts()

const accounts = ref<SavedOriginAccountDto[]>([])
const loading = ref(false)

const options = computed(() => accounts.value.map(a => ({
  label: `${a.bank_Display ?? a.bank_Code ?? ''} · ${a.accountIdentifier}`,
  value: a.uuid,
})))

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

function onSelect(uuid: string | undefined) {
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
  <UFormField v-if="loading || accounts.length > 0" :label="t('payments.savedAccounts.label')" :help="t('payments.savedAccounts.help')">
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
