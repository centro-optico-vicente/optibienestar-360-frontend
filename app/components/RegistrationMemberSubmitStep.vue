<script setup lang="ts">
import type { MyAffiliationRequestDto } from '~/types/affiliationRequests'
import type { PublicPlan, RegistrationProgressDto } from '~/types/registration'

// Last wizard step (affiliate): review and send. Sending moves the DRAFT to PENDING and applies the onboarding
// policy (it may be approved on the spot).
const props = defineProps<{ request: MyAffiliationRequestDto, plans: PublicPlan[], progress: RegistrationProgressDto | null }>()
const emit = defineEmits<{ submitted: [request: MyAffiliationRequestDto], back: [], later: [] }>()

const { t } = useI18n()
const api = useMemberRegistrationApi()

const plan = computed(() => props.plans.find(p => p.uuid === props.request.plan_Uuid) ?? null)
const missing = computed(() => (props.progress?.steps ?? []).filter(s => s.essential && !s.done && s.key !== 'submit'))
const sending = ref(false)

async function send() {
  sending.value = true
  try {
    emit('submitted', await api.submit())
  }
  catch {
    // useApi toasted what is missing.
  }
  finally {
    sending.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <dl class="rounded-xl border border-prohealth-100 divide-y divide-prohealth-100 text-sm">
      <div class="flex justify-between gap-3 p-3"><dt class="text-prohealth-500">{{ t('registration.review.name') }}</dt><dd class="font-medium">{{ request.firstName }} {{ request.lastName }}</dd></div>
      <div class="flex justify-between gap-3 p-3"><dt class="text-prohealth-500">{{ t('affiliationRequest.document') }}</dt><dd class="font-medium">{{ request.documentType }}{{ request.documentNumber }}</dd></div>
      <div class="flex justify-between gap-3 p-3"><dt class="text-prohealth-500">{{ t('affiliationRequest.plan') }}</dt><dd class="font-medium">{{ plan?.name ?? request.plan_Display ?? '—' }}</dd></div>
      <div class="flex justify-between gap-3 p-3"><dt class="text-prohealth-500">{{ t('registration.review.payment') }}</dt><dd class="font-medium">{{ request.payment ? t('registration.review.paymentReported') : t('registration.review.paymentLater') }}</dd></div>
      <div class="flex justify-between gap-3 p-3"><dt class="text-prohealth-500">{{ t('registration.review.family') }}</dt><dd class="font-medium">{{ request.family?.length ?? 0 }}</dd></div>
    </dl>
    <UAlert v-if="missing.length" color="warning" variant="subtle" icon="i-lucide-circle-alert" :title="t('registration.review.missing')" :description="missing.map(s => t(`registration.steps.${s.key}`)).join(', ')" />
    <p class="text-xs text-prohealth-500">{{ t('registration.review.note') }}</p>
    <div class="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
      <div class="flex gap-2">
        <UButton type="button" color="neutral" variant="ghost" icon="i-lucide-arrow-left" :disabled="sending" @click="emit('back')">{{ t('registration.actions.back') }}</UButton>
        <UButton type="button" color="neutral" variant="outline" icon="i-lucide-save" :disabled="sending" @click="emit('later')">{{ t('registration.actions.later') }}</UButton>
      </div>
      <UButton type="button" color="primary" icon="i-lucide-send" :loading="sending" :disabled="missing.length > 0" @click="send">{{ t('registration.actions.submit') }}</UButton>
    </div>
  </div>
</template>
