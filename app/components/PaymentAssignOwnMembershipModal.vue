<script setup lang="ts">
import type { PaymentDto } from '~/types/payments'

// The payer points their own DRAFT/PENDING payment at a membership — typically a relative paying the holder's
// plan. The holder is confirmed by exact document number (the name comes back abbreviated); the reviewer still
// verifies the payment on approval. The parent gates COLLECTION_CREATE_OWN.
const props = defineProps<{
  open: boolean
  payment: PaymentDto | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'assigned': [payment: PaymentDto]
}>()

const { t } = useI18n()
const toast = useToast()
const payments = usePayments()

const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})

const documentNumber = ref('')
const searching = ref(false)
const searched = ref(false)
const found = ref<{ membershipUuid: string, holderName: string, planName: string }[]>([])
const membershipUuid = ref('')
const saving = ref(false)

watch(isOpen, (open) => {
  if (!open) return
  documentNumber.value = ''
  searched.value = false
  found.value = []
  membershipUuid.value = ''
})

const items = computed(() => found.value.map(f => ({
  label: `${f.holderName} — ${f.planName}`,
  value: f.membershipUuid,
})))

async function search() {
  const term = documentNumber.value.trim()
  if (!term) return
  searching.value = true
  try {
    found.value = await payments.lookupMembership(term)
    membershipUuid.value = found.value.length === 1 ? found.value[0]!.membershipUuid : ''
    searched.value = true
  }
  catch {
    // useApi already notified the error
  }
  finally {
    searching.value = false
  }
}

async function save() {
  if (!props.payment || !membershipUuid.value) return
  saving.value = true
  try {
    const updated = await payments.assignOwnMembership(props.payment.uuid, membershipUuid.value)
    toast.add({ title: t('payments.assignOwn.savedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    emit('assigned', updated)
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
  <UModal v-model:open="isOpen" :title="t('payments.assignOwn.title')" :description="t('payments.assignOwn.description')">
    <template #body>
      <div class="space-y-4">
        <UFormField :label="t('payments.assignOwn.documentLabel')" :help="t('payments.assignOwn.documentHelp')">
          <div class="flex items-center gap-2">
            <UInput v-model="documentNumber" class="w-full" inputmode="numeric" @keyup.enter="search" />
            <UButton color="neutral" variant="soft" icon="i-lucide-search" :loading="searching" @click="search">
              {{ t('payments.assignOwn.search') }}
            </UButton>
          </div>
        </UFormField>

        <p v-if="searched && !found.length" class="text-sm text-prohealth-600">{{ t('payments.assignOwn.notFound') }}</p>

        <UFormField v-if="found.length" :label="t('payments.assignOwn.membershipLabel')">
          <USelectMenu v-model="membershipUuid" :items="items" label-key="label" value-key="value" class="w-full" />
        </UFormField>

        <div class="flex items-center justify-end gap-3 pt-2">
          <UButton color="neutral" variant="ghost" :disabled="saving" @click="isOpen = false">{{ t('common.cancel') }}</UButton>
          <UButton :loading="saving" :disabled="!membershipUuid" icon="i-lucide-link" @click="save">
            {{ t('payments.assignOwn.confirm') }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
