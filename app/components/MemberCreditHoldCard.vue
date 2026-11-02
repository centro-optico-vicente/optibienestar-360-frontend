<script setup lang="ts">
// Freezes (or releases) the whole credit balance of a person (hub ADR 0029): while frozen, the automatic
// application of credit to their monthly fees is off. Staff can still assign credit by hand, which implies an
// agreement with the person. Gated by PERSON_CREDIT_HOLD_UPDATE; the reason is mandatory when freezing.
const props = defineProps<{
  memberUuid: string
  /** `false` = frozen. `undefined` (older backend) is treated as not frozen. */
  creditAutoApply?: boolean
  holdReason?: string | null
  holdAtDisplay?: string | null
}>()

const emit = defineEmits<{ changed: [] }>()

const { t } = useI18n()
const { can } = usePermissions()
const toast = useToast()
const members = useMembers()

const canHold = computed(() => can('PERSON_CREDIT_HOLD_UPDATE'))
const frozen = computed(() => props.creditAutoApply === false)

const open = ref(false)
const reason = ref('')
const saving = ref(false)

function openFreeze() {
  reason.value = ''
  open.value = true
}

async function setHold(hold: boolean) {
  if (hold && !reason.value.trim()) return
  saving.value = true
  try {
    await members.setCreditHold(props.memberUuid, hold, hold ? reason.value.trim() : undefined)
    toast.add({ title: t(hold ? 'members.creditHold.frozenToast' : 'members.creditHold.releasedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    open.value = false
    emit('changed')
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
  <div v-if="canHold || frozen" class="rounded-2xl border px-5 py-3 flex flex-wrap items-center justify-between gap-3" :class="frozen ? 'border-amber-200 bg-amber-50' : 'border-prohealth-100 bg-white'">
    <div>
      <p class="text-sm font-semibold" :class="frozen ? 'text-amber-800' : 'text-prohealth-900'">
        {{ frozen ? t('members.creditHold.frozenTitle') : t('members.creditHold.title') }}
      </p>
      <p class="text-xs mt-0.5" :class="frozen ? 'text-amber-700' : 'text-prohealth-500'">
        <template v-if="frozen">
          {{ holdReason }}<span v-if="holdAtDisplay"> · {{ holdAtDisplay }}</span>
        </template>
        <template v-else>{{ t('members.creditHold.help') }}</template>
      </p>
    </div>
    <UButton
      v-if="canHold"
      :color="frozen ? 'primary' : 'warning'"
      variant="soft"
      size="sm"
      :icon="frozen ? 'i-lucide-play' : 'i-lucide-pause'"
      :loading="saving && frozen"
      @click="frozen ? setHold(false) : openFreeze()"
    >
      {{ frozen ? t('members.creditHold.release') : t('members.creditHold.freeze') }}
    </UButton>

    <UModal v-model:open="open" :title="t('members.creditHold.modalTitle')" :description="t('members.creditHold.modalDescription')">
      <template #body>
        <div class="space-y-4">
          <UFormField :label="t('members.creditHold.reasonLabel')" required>
            <UTextarea v-model="reason" :rows="3" class="w-full" />
          </UFormField>
          <div class="flex items-center justify-end gap-3 pt-2">
            <UButton color="neutral" variant="ghost" :disabled="saving" @click="open = false">{{ t('common.cancel') }}</UButton>
            <UButton color="warning" :loading="saving" :disabled="!reason.trim()" icon="i-lucide-pause" @click="setHold(true)">
              {{ t('members.creditHold.confirm') }}
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
