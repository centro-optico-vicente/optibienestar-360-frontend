<script setup lang="ts">
import type { MembershipDto, MembershipTermUpdateRequest } from '~/types/memberships'

// Edit the term of a membership (hub ADR 0034): expiry of the current term and the re-inscription flag.
// The parent gates the button that opens it on MEMBERSHIP_TERM_UPDATE and reloads on `saved`.
const props = defineProps<{
  open: boolean
  membership: MembershipDto | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'saved': [membership: MembershipDto]
}>()

const { t, locale } = useI18n()
const memberships = useMemberships()
const toast = useToast()

const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})

const reinscriptionRequired = ref(false)
const expiresAt = ref('')
const submitting = ref(false)

watch(() => [props.open, props.membership] as const, ([open, m]) => {
  if (!open || !m) return
  reinscriptionRequired.value = m.reinscriptionRequired ?? false
  expiresAt.value = m.expiresAt ?? ''
})

const ruleLabel = computed(() => (props.membership ? describeTermRule(props.membership, t, locale.value) : null))
// Without a snapshot rule, switching re-inscription on needs an explicit expiry (renews every 12 months).
const needsExpiry = computed(() => reinscriptionRequired.value && !ruleLabel.value && !expiresAt.value)

async function save() {
  const m = props.membership
  if (!m || needsExpiry.value) return
  submitting.value = true
  try {
    const body: MembershipTermUpdateRequest = {
      reinscriptionRequired: reinscriptionRequired.value,
      expiresAt: expiresAt.value || undefined,
    }
    const result = await memberships.updateTerm(m.uuid, body)
    toast.add({ title: t('memberships.term.savedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    emit('saved', result)
    isOpen.value = false
  }
  catch {
    // useApi already notified the error (422 expiry before enrollment, etc.)
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="isOpen"
    :title="t('memberships.term.editTitle')"
    :description="t('memberships.term.editDescription')"
  >
    <template #body>
      <div v-if="membership" class="space-y-4">
        <p v-if="ruleLabel" class="text-sm text-prohealth-600">
          {{ t('memberships.term.snapshotRule', { rule: ruleLabel }) }}
        </p>
        <UFormField :label="t('memberships.term.reinscriptionLabel')" :help="t('memberships.term.reinscriptionHelp')">
          <USwitch v-model="reinscriptionRequired" />
        </UFormField>
        <UFormField
          :label="t('memberships.term.expiresAt')"
          :required="reinscriptionRequired && !ruleLabel"
          :help="reinscriptionRequired ? t('memberships.term.expiresAtHelp') : t('memberships.term.expiresAtOpenHelp')"
          :error="needsExpiry ? t('memberships.term.expiresRequired') : undefined"
        >
          <UInput v-model="expiresAt" type="date" class="w-full" />
        </UFormField>
        <UAlert
          v-if="membership.inscriptionDue && !reinscriptionRequired"
          color="info"
          variant="subtle"
          icon="i-lucide-info"
          :description="t('memberships.term.clearsPendingNotice')"
        />
      </div>
    </template>
    <template #footer>
      <div class="w-full flex items-center justify-end gap-3">
        <UButton color="neutral" variant="ghost" :disabled="submitting" @click="isOpen = false">
          {{ t('common.cancel') }}
        </UButton>
        <UButton
          color="info"
          variant="outline"
          icon="i-lucide-save"
          :loading="submitting"
          :disabled="needsExpiry"
          @click="save"
        >
          {{ t('common.saveChanges') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
