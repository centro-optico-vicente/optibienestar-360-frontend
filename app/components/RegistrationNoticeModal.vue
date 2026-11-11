<script setup lang="ts">
import { COMPLETE_REGISTRATION_PATH } from '~/utils/roleHome'

// Login notice (hub ADR 0037 §3): when registration data is missing, offer to finish it. It opens after the
// terms modal is out of the way. "Completar ahora" goes to the wizard; "Recordar luego" closes it until the next
// session (sessionStorage).
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const registration = useRegistrationProgress()
const terms = usePendingTerms()

const isOpen = computed(() =>
  auth.isAuthenticated
  && registration.loaded.value
  && registration.hasPendingWork.value
  && !registration.dismissed.value
  && terms.checked.value
  && terms.visible.value.length === 0
  && route.path !== COMPLETE_REGISTRATION_PATH,
)

function completeNow() {
  registration.dismissNotice()
  void router.push(COMPLETE_REGISTRATION_PATH)
}
</script>

<template>
  <UModal :open="isOpen" :dismissible="false" :close="false" :ui="{ content: 'max-w-md' }">
    <template #content>
      <div class="p-6 space-y-4">
        <div class="flex items-center gap-3">
          <UIcon name="i-lucide-clipboard-list" class="w-8 h-8 text-prohealth-600" />
          <h2 class="text-lg font-extrabold text-prohealth-900">{{ t('registration.notice.title') }}</h2>
        </div>
        <p class="text-sm text-prohealth-700">
          {{ registration.percent.value >= 100 && registration.notSubmitted.value
            ? t('registration.notice.bodyReady')
            : t('registration.notice.body', { percent: registration.percent.value }) }}
        </p>
        <UProgress :model-value="registration.percent.value" :max="100" size="sm" />
        <div class="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <UButton color="neutral" variant="outline" @click="registration.dismissNotice()">{{ t('registration.notice.later') }}</UButton>
          <UButton color="primary" icon="i-lucide-arrow-right" trailing @click="completeNow">{{ t('registration.notice.now') }}</UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
