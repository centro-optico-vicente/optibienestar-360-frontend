<script setup lang="ts">
import type { SelectItem } from '~/types/options'
import type { PaymentDto } from '~/types/payments'
import { memberOptionLabel } from '~/types/members'

// Staff assigns an APPROVED collection that has no membership (credit) to a membership of some
// affiliate — typically the holder, when a relative paid. The parent gates COLLECTION_ASSIGN_MEMBERSHIP.
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
const members = useMembers()
const memberships = useMemberships()

const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})

// ---- Holder search (debounced; options are merged, never wiped, so a picked member keeps its label) ----
const memberSearchTerm = ref('')
const memberOptions = ref<SelectItem[]>([])
const searching = ref(false)
const memberUuid = ref('')

let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(memberSearchTerm, (q) => {
  clearTimeout(searchTimer)
  const term = q.trim()
  if (term.length < 1) return
  searchTimer = setTimeout(async () => {
    searching.value = true
    try {
      const res = await members.options({ q: term, limit: 10 })
      const merged = new Map(memberOptions.value.map(o => [String(o.value), o]))
      for (const o of res) merged.set(o.uuid, { label: memberOptionLabel(o), value: o.uuid })
      memberOptions.value = [...merged.values()]
    }
    catch {
      // useApi already notified the error; keep the options we have
    }
    finally {
      searching.value = false
    }
  }, 400)
})

// ---- The chosen member's memberships ----
const membershipOptions = ref<SelectItem[]>([])
const loadingMemberships = ref(false)
const membershipUuid = ref('')

watch(memberUuid, async (uuid) => {
  membershipUuid.value = ''
  membershipOptions.value = []
  if (!uuid) return
  loadingMemberships.value = true
  try {
    const rows = await memberships.listForMember(uuid)
    membershipOptions.value = rows.map(m => ({
      label: `${m.planName} · ${m.status_Display ?? m.status}`,
      value: m.uuid,
    }))
    // The common case is a single (active) membership — preselect it.
    if (rows.length === 1) membershipUuid.value = rows[0]!.uuid
  }
  catch {
    // useApi already notified the error
  }
  finally {
    loadingMemberships.value = false
  }
})

// yyyy-MM from <input type="month">; lexicographic comparison is safe for that format.
const appliedPeriod = ref('')
const coverageThroughPeriod = ref('')
const coverageError = computed(() =>
  coverageThroughPeriod.value && appliedPeriod.value && coverageThroughPeriod.value < appliedPeriod.value
    ? t('payments.form.validation.coverageThroughPeriodBeforeApplied')
    : undefined)

const submitting = ref(false)
const canSubmit = computed(() => !!membershipUuid.value && !coverageError.value)

watch(() => props.open, (open) => {
  if (open) {
    memberSearchTerm.value = ''
    memberOptions.value = []
    memberUuid.value = ''
    membershipOptions.value = []
    membershipUuid.value = ''
    appliedPeriod.value = ''
    coverageThroughPeriod.value = ''
  }
})

async function confirm() {
  if (!props.payment || !canSubmit.value) return
  submitting.value = true
  try {
    const result = await payments.assignMembership(props.payment.uuid, {
      membershipUuid: membershipUuid.value,
      appliedPeriod: appliedPeriod.value ? `${appliedPeriod.value}-01` : undefined,
      coverageThroughPeriod: coverageThroughPeriod.value ? `${coverageThroughPeriod.value}-01` : undefined,
    })
    toast.add({ title: t('payments.assignMembership.toast'), color: 'success', icon: 'i-lucide-check-circle' })
    emit('assigned', result)
    isOpen.value = false
  }
  catch {
    // useApi already notified the error (422 if it is no longer assignable, etc.)
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <UModal v-model:open="isOpen" :title="t('payments.assignMembership.title')">
    <template #body>
      <div class="space-y-4">
        <p class="text-sm text-prohealth-600">{{ t('payments.assignMembership.description') }}</p>

        <UFormField :label="t('payments.assignMembership.member')" :help="t('payments.assignMembership.memberHelp')">
          <USelectMenu
            v-model="memberUuid"
            v-model:search-term="memberSearchTerm"
            clear
            :items="memberOptions"
            label-key="label"
            value-key="value"
            :loading="searching"
            :placeholder="t('payments.form.memberPlaceholderSearch')"
            class="w-full"
          />
        </UFormField>

        <UFormField :label="t('payments.assignMembership.membership')" required>
          <USelectMenu
            v-model="membershipUuid"
            :items="membershipOptions"
            label-key="label"
            value-key="value"
            :loading="loadingMemberships"
            :disabled="!memberUuid"
            :placeholder="t('payments.assignMembership.membershipPlaceholder')"
            class="w-full"
          />
        </UFormField>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('payments.form.fields.coveredMonth')" :help="t('payments.form.fields.coveredMonthHelp')">
            <UInput v-model="appliedPeriod" type="month" class="w-full" />
          </UFormField>
          <UFormField :label="t('payments.form.fields.coverageThroughPeriod')" :error="coverageError">
            <UInput v-model="coverageThroughPeriod" type="month" class="w-full" />
          </UFormField>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <UButton color="neutral" variant="ghost" @click="isOpen = false">{{ t('common.cancel') }}</UButton>
        <UButton color="primary" icon="i-lucide-link" :loading="submitting" :disabled="!canSubmit" @click="confirm">
          {{ t('payments.assignMembership.confirm') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
