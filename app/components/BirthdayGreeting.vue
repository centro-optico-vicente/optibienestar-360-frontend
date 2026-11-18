<script setup lang="ts">
// Birthday greeting from Grupo OptiBienestar for the signed-in affiliate or
// beneficiary (GET /v1/me/birthdays → `self.birthdayToday`). Shown as a modal the
// first time the portal opens that day, and as a banner for the rest of the day.
import type { SelfBirthday } from '~/composables/useBirthdays'

const { t } = useI18n()
const birthdays = useBirthdays()

const self = ref<SelfBirthday | null>(null)
const modalOpen = ref(false)

const storageKey = (date: string) => `ob360.birthdayGreeting.${date}`

onMounted(async () => {
  const res = await birthdays.fetchMine().catch(() => null)
  if (!res?.self?.birthdayToday) return
  self.value = res.self
  let seen = false
  try {
    seen = localStorage.getItem(storageKey(res.today)) === '1'
    localStorage.setItem(storageKey(res.today), '1')
  }
  catch {
    // Storage blocked: show the modal every time, the banner covers the rest.
  }
  modalOpen.value = !seen
})
</script>

<template>
  <template v-if="self">
    <div
      class="relative overflow-hidden rounded-2xl border border-lime-200 bg-gradient-to-r from-prohealth-50 via-white to-lime-50 p-5"
      role="status"
    >
      <div class="flex items-center gap-4">
        <span class="text-4xl shrink-0" aria-hidden="true">🎂</span>
        <div class="min-w-0">
          <p class="font-extrabold text-prohealth-900 text-lg">
            {{ t('birthdays.greeting.title', { name: self.firstName }) }}
          </p>
          <p class="text-sm text-prohealth-700">{{ t('birthdays.greeting.short') }}</p>
        </div>
        <UButton class="ml-auto shrink-0" color="primary" variant="soft" size="sm" icon="i-lucide-party-popper" @click="modalOpen = true">
          {{ t('birthdays.greeting.open') }}
        </UButton>
      </div>
    </div>

    <UModal v-model:open="modalOpen" :title="t('birthdays.greeting.modalTitle')">
      <template #body>
        <div class="text-center space-y-4 py-2">
          <p class="text-6xl" aria-hidden="true">🎉🎂🎈</p>
          <h2 class="text-2xl font-extrabold text-prohealth-900">
            {{ t('birthdays.greeting.title', { name: self.firstName }) }}
          </h2>
          <p class="text-prohealth-700 leading-relaxed">{{ t('birthdays.greeting.message') }}</p>
          <p class="text-sm font-semibold text-prohealth-600">{{ t('birthdays.greeting.signature') }}</p>
        </div>
      </template>
      <template #footer>
        <UButton block color="primary" @click="modalOpen = false">{{ t('birthdays.greeting.thanks') }}</UButton>
      </template>
    </UModal>
  </template>
</template>
