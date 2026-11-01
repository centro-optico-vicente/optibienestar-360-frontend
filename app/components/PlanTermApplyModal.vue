<script setup lang="ts">
import type { PlanTermApplyResult } from '~/types/planTerms'

// Apply the plan's term rule to existing memberships (hub ADR 0034). The admin chooses the first expiry date
// (one for all); it is prefilled with the date the plan's rule suggests. The parent gates the button that opens
// it on MEMBERSHIP_TERM_UPDATE and reloads on `applied`.
const props = defineProps<{
  open: boolean
  planUuid: string
  /** Memberships that will be updated (the selection, or every one that differs when nothing is selected). */
  count: number
  /** Selected membership UUIDs; empty = all that differ. */
  membershipUuids: string[]
  suggestedExpiresAt?: string | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'applied': [result: PlanTermApplyResult]
}>()

const { t } = useI18n()
const planTerms = usePlanTerms()
const toast = useToast()

const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})

const expiresAt = ref('')
const confirmed = ref(false)
const submitting = ref(false)

/** Local-date ISO (yyyy-MM-dd) of tomorrow: the earliest date the backend accepts. */
function tomorrowIso(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
const minDate = computed(() => tomorrowIso())

watch(() => props.open, (open) => {
  if (!open) return
  expiresAt.value = props.suggestedExpiresAt ?? ''
  confirmed.value = false
})

const dateInvalid = computed(() => !expiresAt.value || expiresAt.value < minDate.value)
const canSubmit = computed(() => !dateInvalid.value && confirmed.value && props.count > 0 && !submitting.value)

async function submit() {
  if (!canSubmit.value) return
  submitting.value = true
  try {
    const result = await planTerms.apply(props.planUuid, {
      membershipUuids: props.membershipUuids.length ? props.membershipUuids : undefined,
      expiresAt: expiresAt.value,
    })
    toast.add({
      title: t('plans.termCompliance.appliedToast', { applied: result.applied, skipped: result.skipped }),
      color: result.skipped > 0 ? 'warning' : 'success',
      icon: 'i-lucide-check-circle',
    })
    emit('applied', result)
    isOpen.value = false
  }
  catch {
    // useApi already notified the error (422: plan without re-inscription, date not in the future)
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="isOpen"
    :title="t('plans.termCompliance.applyTitle')"
    :description="t('plans.termCompliance.applyDescription')"
  >
    <template #body>
      <div class="space-y-4">
        <UAlert
          color="info"
          variant="subtle"
          icon="i-lucide-info"
          :description="membershipUuids.length
            ? t('plans.termCompliance.affectedSelected', { count })
            : t('plans.termCompliance.affectedAllDiffer', { count })"
        />
        <UFormField
          :label="t('plans.termCompliance.expiresAt')"
          required
          :help="t('plans.termCompliance.expiresAtHelp')"
          :error="expiresAt && dateInvalid ? t('plans.termCompliance.expiresInvalid') : undefined"
        >
          <UInput v-model="expiresAt" type="date" :min="minDate" class="w-full" />
        </UFormField>
        <UCheckbox v-model="confirmed" :label="t('plans.termCompliance.confirm', { count })" />
      </div>
    </template>
    <template #footer>
      <div class="w-full flex items-center justify-end gap-3">
        <UButton color="neutral" variant="ghost" :disabled="submitting" @click="isOpen = false">
          {{ t('common.cancel') }}
        </UButton>
        <UButton
          color="info"
          icon="i-lucide-calendar-check"
          :loading="submitting"
          :disabled="!canSubmit"
          @click="submit"
        >
          {{ t('plans.termCompliance.apply') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
