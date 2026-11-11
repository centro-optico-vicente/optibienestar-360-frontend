<script setup lang="ts">
import type { MyAllyProfileDto } from '~/types/allies'
import type { RegistrationProgressDto } from '~/types/registration'
import { missingFromError } from '~/utils/registrationMissing'

// Last wizard step (ally): send to review. POST /v1/me/allies/{uuid}/submit validates the essentials and
// applies ally_approval_mode / ally_publish_mode of the onboarding policy (hub ADR 0037). The advisor's ally capture
// reuses it with its own endpoint (`submitUrl`, POST /v1/me/advisor/ally-requests/drafts/{uuid}/submit).
const props = defineProps<{ allyUuid: string, profile: MyAllyProfileDto, progress: RegistrationProgressDto | null, submitUrl?: string }>()
const emit = defineEmits<{ submitted: [], back: [], later: [], goto: [step: string] }>()

const { t } = useI18n()
const notifyApiError = useNotifyApiError()
const sending = ref(false)
// The 422 of a submit with essentials missing: shown as a list with a jump to each step (hub ADR 0037).
const missingKeys = ref<string[]>([])
const missing = computed(() => (props.progress?.steps ?? []).filter(s => s.essential && !s.done && s.key !== 'submit'))

async function send() {
  sending.value = true
  missingKeys.value = []
  try {
    await useApi(props.submitUrl ?? `/v1/me/allies/${props.allyUuid}/submit`, { method: 'POST' })
    emit('submitted')
  }
  catch (error) {
    // When it is "incomplete" the list says what and where; otherwise show the reason useApi left untold (400 / 404).
    missingKeys.value = missingFromError(error) ?? []
    if (!missingKeys.value.length) notifyApiError(error)
  }
  finally {
    sending.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <dl class="rounded-xl border border-prohealth-100 divide-y divide-prohealth-100 text-sm">
      <div class="flex justify-between gap-3 p-3"><dt class="text-prohealth-500">{{ t('registration.review.name') }}</dt><dd class="font-medium">{{ profile.name }}</dd></div>
      <div class="flex justify-between gap-3 p-3"><dt class="text-prohealth-500">{{ t('allyRequestForm.fields.city') }}</dt><dd class="font-medium">{{ profile.city_Display ?? '—' }}</dd></div>
      <div class="flex justify-between gap-3 p-3"><dt class="text-prohealth-500">{{ t('allyRequestForm.fields.allyType') }}</dt><dd class="font-medium">{{ (profile.allyTypeNames ?? []).join(', ') || '—' }}</dd></div>
    </dl>
    <RegistrationMissingAlert v-if="missingKeys.length" kind="ALLY" :missing="missingKeys" @goto="emit('goto', $event)" />
    <UAlert v-if="missing.length" color="warning" variant="subtle" icon="i-lucide-circle-alert" :title="t('registration.review.missing')" :description="missing.map(s => t(`registration.steps.${s.key}`)).join(', ')" />
    <p class="text-xs text-prohealth-500">{{ t('allyRequestForm.reviewNote') }}</p>
    <div class="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
      <div class="flex gap-2">
        <UButton type="button" color="neutral" variant="ghost" icon="i-lucide-arrow-left" :disabled="sending" @click="emit('back')">{{ t('registration.actions.back') }}</UButton>
        <UButton type="button" color="neutral" variant="outline" icon="i-lucide-save" :disabled="sending" @click="emit('later')">{{ t('registration.actions.later') }}</UButton>
      </div>
      <UButton type="button" color="primary" icon="i-lucide-send" :loading="sending" :disabled="missing.length > 0" @click="send">{{ t('registration.actions.submit') }}</UButton>
    </div>
  </div>
</template>
