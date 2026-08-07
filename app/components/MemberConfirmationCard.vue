<script setup lang="ts">
// Creation/confirmation status (project chat 2026-08-06): confirmedAt is stamped
// automatically on the member's first approved payment, or manually here for members
// fully covered by a subsidy that never generate a payment. Embedded in the member
// detail page like MemberPromoterCard; self-gated on MEMBER_CONFIRM for the action.
const props = defineProps<{
  memberUuid: string
  memberName?: string | null
  createdAt?: string | null
  confirmedAt?: string | null
}>()

const emit = defineEmits<{ confirmed: [] }>()

const { t } = useI18n()
const { formatDate } = useFormatters()
const members = useMembers()
const { can } = usePermissions()
const toast = useToast()

const canConfirm = computed(() => can('MEMBER_CONFIRM'))

const confirmOpen = ref(false)
const confirming = ref(false)

async function doConfirm() {
  confirming.value = true
  try {
    await members.confirm(props.memberUuid)
    toast.add({ title: t('members.confirmation.confirmedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    confirmOpen.value = false
    emit('confirmed')
  }
  catch {
    // toast handled by useApi
  }
  finally {
    confirming.value = false
  }
}
</script>

<template>
  <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden">
    <div class="flex items-center justify-between px-6 py-4 border-b border-prohealth-100">
      <h2 class="font-bold text-prohealth-900">{{ t('members.confirmation.title') }}</h2>
      <UButton
        v-if="canConfirm && !confirmedAt"
        color="primary"
        variant="soft"
        icon="i-lucide-badge-check"
        size="sm"
        @click="confirmOpen = true"
      >
        {{ t('members.confirmation.confirmButton') }}
      </UButton>
    </div>

    <dl class="px-6 py-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
      <div>
        <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('members.confirmation.createdAt') }}</dt>
        <dd class="text-prohealth-800 mt-0.5">{{ formatDate(createdAt, 'short') }}</dd>
      </div>
      <div>
        <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('members.confirmation.confirmedAt') }}</dt>
        <dd class="mt-0.5">
          <span v-if="confirmedAt" class="text-prohealth-800">{{ formatDate(confirmedAt, 'short') }}</span>
          <UBadge v-else color="warning" variant="subtle" size="sm">{{ t('members.confirmation.pending') }}</UBadge>
        </dd>
      </div>
    </dl>

    <UModal v-model:open="confirmOpen" :title="t('members.confirmation.confirm.title')">
      <template #body>
        <p class="text-sm text-prohealth-700">{{ t('members.confirmation.confirm.confirm', { name: memberName || memberUuid }) }}</p>
        <div class="flex items-center justify-end gap-3 pt-5">
          <UButton color="neutral" variant="ghost" :disabled="confirming" @click="confirmOpen = false">
            {{ t('common.cancel') }}
          </UButton>
          <UButton color="primary" :loading="confirming" icon="i-lucide-badge-check" @click="doConfirm">
            {{ t('members.confirmation.confirmButton') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
