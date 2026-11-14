<script setup lang="ts">
import type { CampaignDto } from '~/types/campaign'

/**
 * Lifecycle buttons of the campaign detail (hub ADR 0038): activate a draft,
 * pause/resume, close manually and reopen. Each button is gated by its own
 * permission and only shown in the statuses where the transition is valid;
 * the backend re-checks both and answers 409/422 otherwise.
 */
const props = defineProps<{ campaign: CampaignDto }>()
const emit = defineEmits<{ updated: [campaign: CampaignDto] }>()

const { t } = useI18n()
const { can } = usePermissions()
const campaignsApi = useCampaigns()
const toast = useToast()
const { formatDate } = useFormatters()

const status = computed(() => props.campaign.lifecycleStatus ?? null)
const canActivate = computed(() => status.value === 'DRAFT' && can('CAMPAIGN_UPDATE'))
const canPause = computed(() => (status.value === 'ACTIVE' || status.value === 'SOLD_OUT') && can('CAMPAIGN_PAUSE'))
const canResume = computed(() => status.value === 'PAUSED' && can('CAMPAIGN_PAUSE'))
const canClose = computed(() => !!status.value && status.value !== 'CLOSED' && can('CAMPAIGN_CLOSE'))
const canReopen = computed(() => status.value === 'CLOSED' && can('CAMPAIGN_REOPEN'))

const busy = ref<'activate' | 'pause' | 'resume' | null>(null)
async function run(action: 'activate' | 'pause' | 'resume') {
  busy.value = action
  try {
    const updated = await campaignsApi[action](props.campaign.uuid)
    toast.add({ title: t(`campaigns.lifecycleActions.${action}Toast`), color: 'success', icon: 'i-lucide-check-circle' })
    emit('updated', updated)
  }
  catch {
    // useApi already notified (invalid transition, etc.)
  }
  finally {
    busy.value = null
  }
}

// ---- Manual close ----
const closeOpen = ref(false)
const closeCancelPending = ref(false)
const closeNote = ref('')
const closing = ref(false)
function openClose() {
  closeCancelPending.value = false
  closeNote.value = ''
  closeOpen.value = true
}
async function confirmClose() {
  closing.value = true
  try {
    const updated = await campaignsApi.close(props.campaign.uuid, {
      cancelPending: closeCancelPending.value,
      note: closeNote.value.trim() || null,
    })
    toast.add({ title: t('campaigns.lifecycleActions.closeToast'), color: 'success', icon: 'i-lucide-lock' })
    closeOpen.value = false
    emit('updated', updated)
  }
  catch {
    // useApi already notified
  }
  finally {
    closing.value = false
  }
}

// ---- Reopen: must enlarge the max and/or move the end date later ----
const reopenOpen = ref(false)
const reopenMax = ref('')
const reopenEndsAt = ref('')
const reopenTouched = ref(false)
const reopening = ref(false)
function openReopen() {
  reopenMax.value = ''
  reopenEndsAt.value = ''
  reopenTouched.value = false
  reopenOpen.value = true
}
const reopenMaxValue = computed(() => (reopenMax.value.trim() ? Number(reopenMax.value) : null))
const reopenEndsAtIso = computed(() => {
  if (!reopenEndsAt.value) return null
  const d = new Date(reopenEndsAt.value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
})
const raisesMax = computed(() => {
  const v = reopenMaxValue.value
  if (v === null || !Number.isInteger(v) || v < 1) return false
  const current = props.campaign.maxRedemptions
  return current == null || v > current
})
const extendsEnd = computed(() => {
  const iso = reopenEndsAtIso.value
  if (!iso) return false
  const time = new Date(iso).getTime()
  if (time <= Date.now()) return false
  const current = props.campaign.endsAt ? new Date(props.campaign.endsAt).getTime() : null
  return current === null || time > current
})
const reopenError = computed(() => {
  if (!reopenTouched.value) return undefined
  if (reopenMaxValue.value !== null && !raisesMax.value) return t('campaigns.lifecycleActions.reopenMaxInvalid')
  if (reopenEndsAtIso.value !== null && !extendsEnd.value) return t('campaigns.lifecycleActions.reopenEndsAtInvalid')
  if (!raisesMax.value && !extendsEnd.value) return t('campaigns.lifecycleActions.reopenNothingEnlarged')
  return undefined
})
async function confirmReopen() {
  reopenTouched.value = true
  if (reopenError.value) return
  reopening.value = true
  try {
    const updated = await campaignsApi.reopen(props.campaign.uuid, {
      maxRedemptions: raisesMax.value ? reopenMaxValue.value : null,
      endsAt: extendsEnd.value ? reopenEndsAtIso.value : null,
    })
    toast.add({ title: t('campaigns.lifecycleActions.reopenToast'), color: 'success', icon: 'i-lucide-lock-open' })
    reopenOpen.value = false
    emit('updated', updated)
  }
  catch {
    // useApi already notified
  }
  finally {
    reopening.value = false
  }
}
</script>

<template>
  <div class="contents">
    <UButton v-if="canActivate" color="success" variant="ghost" icon="i-lucide-play" :loading="busy === 'activate'" @click="run('activate')">
      {{ t('campaigns.lifecycleActions.activate') }}
    </UButton>
    <UButton v-if="canPause" color="warning" variant="ghost" icon="i-lucide-pause" :loading="busy === 'pause'" @click="run('pause')">
      {{ t('campaigns.lifecycleActions.pause') }}
    </UButton>
    <UButton v-if="canResume" color="success" variant="ghost" icon="i-lucide-play" :loading="busy === 'resume'" @click="run('resume')">
      {{ t('campaigns.lifecycleActions.resume') }}
    </UButton>
    <UButton v-if="canClose" color="error" variant="ghost" icon="i-lucide-lock" @click="openClose">
      {{ t('campaigns.lifecycleActions.close') }}
    </UButton>
    <UButton v-if="canReopen" color="primary" variant="ghost" icon="i-lucide-lock-open" @click="openReopen">
      {{ t('campaigns.lifecycleActions.reopen') }}
    </UButton>

    <UModal v-model:open="closeOpen" :title="t('campaigns.lifecycleActions.closeTitle')">
      <template #body>
        <div class="space-y-4">
          <p class="text-sm text-prohealth-700">{{ t('campaigns.lifecycleActions.closeNotice', { name: campaign.name }) }}</p>
          <UCheckbox
            v-model="closeCancelPending"
            :label="t('campaigns.lifecycleActions.cancelPending')"
            :description="t('campaigns.lifecycleActions.cancelPendingHelp')"
          />
          <UFormField :label="t('campaigns.lifecycleActions.note')">
            <UTextarea v-model="closeNote" :rows="2" :maxlength="500" class="w-full" />
          </UFormField>
          <div class="flex items-center justify-end gap-3 pt-1">
            <UButton color="neutral" variant="ghost" :disabled="closing" @click="closeOpen = false">{{ t('common.cancel') }}</UButton>
            <UButton color="error" icon="i-lucide-lock" :loading="closing" @click="confirmClose">
              {{ t('campaigns.lifecycleActions.close') }}
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <UModal v-model:open="reopenOpen" :title="t('campaigns.lifecycleActions.reopenTitle')">
      <template #body>
        <div class="space-y-4">
          <p class="text-sm text-prohealth-700">{{ t('campaigns.lifecycleActions.reopenNotice') }}</p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField
              :label="t('campaigns.lifecycleActions.newMax')"
              :help="campaign.maxRedemptions != null ? t('campaigns.lifecycleActions.currentMax', { n: campaign.maxRedemptions }) : t('campaigns.quota.unlimited')"
            >
              <UInput v-model="reopenMax" inputmode="numeric" class="w-full" />
            </UFormField>
            <UFormField
              :label="t('campaigns.lifecycleActions.newEndsAt')"
              :help="campaign.endsAt ? t('campaigns.lifecycleActions.currentEndsAt', { date: formatDate(campaign.endsAt) }) : t('campaigns.openEnded')"
            >
              <UInput v-model="reopenEndsAt" type="datetime-local" class="w-full" />
            </UFormField>
          </div>
          <p v-if="reopenError" class="text-xs text-red-600">{{ reopenError }}</p>
          <div class="flex items-center justify-end gap-3 pt-1">
            <UButton color="neutral" variant="ghost" :disabled="reopening" @click="reopenOpen = false">{{ t('common.cancel') }}</UButton>
            <UButton color="primary" icon="i-lucide-lock-open" :loading="reopening" @click="confirmReopen">
              {{ t('campaigns.lifecycleActions.reopen') }}
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
