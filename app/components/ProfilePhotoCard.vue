<script setup lang="ts">
// Self-service profile photo (POST/DELETE /v1/me/photo). Used by the member
// and promoter portals; images only, up to 5 MB (PUBLIC file policy, V55).
const { t } = useI18n()
const toast = useToast()
const auth = useAuthStore()
const { photoUrl, ensure, upload, remove } = useProfilePhoto()

const input = ref<HTMLInputElement | null>(null)
const busy = ref(false)
const MAX_BYTES = 5 * 1024 * 1024

onMounted(ensure)

async function onPick(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  ;(e.target as HTMLInputElement).value = ''
  if (!file) return
  if (!file.type.startsWith('image/')) {
    toast.add({ title: t('profilePhoto.notImage'), color: 'error' })
    return
  }
  if (file.size > MAX_BYTES) {
    toast.add({ title: t('profilePhoto.tooLarge'), color: 'error' })
    return
  }
  busy.value = true
  try {
    await upload(file)
    toast.add({ title: t('profilePhoto.uploaded'), color: 'success' })
  }
  catch {
    // useApi already shows the error toast
  }
  finally {
    busy.value = false
  }
}

async function onRemove() {
  busy.value = true
  try {
    await remove()
    toast.add({ title: t('profilePhoto.removed'), color: 'success' })
  }
  catch {
    // useApi already shows the error toast
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="bg-white rounded-2xl border border-prohealth-100 p-6 flex flex-wrap items-center gap-5">
    <div class="w-20 h-20 rounded-full overflow-hidden bg-prohealth-600 grid place-items-center text-white text-2xl font-bold shrink-0">
      <img v-if="photoUrl" :src="photoUrl" :alt="t('profilePhoto.alt')" class="w-full h-full object-cover">
      <span v-else>{{ auth.initials }}</span>
    </div>
    <div class="min-w-0 flex-1">
      <h2 class="font-bold text-prohealth-900">{{ t('profilePhoto.title') }}</h2>
      <p class="text-xs text-prohealth-500 mt-0.5">{{ t('profilePhoto.hint') }}</p>
    </div>
    <div class="flex items-center gap-2">
      <input ref="input" type="file" accept="image/png,image/jpeg,image/webp" class="hidden" @change="onPick">
      <UButton color="primary" variant="soft" icon="i-lucide-camera" :loading="busy" @click="input?.click()">
        {{ photoUrl ? t('profilePhoto.change') : t('profilePhoto.upload') }}
      </UButton>
      <UButton v-if="photoUrl" color="error" variant="ghost" icon="i-lucide-trash-2" :disabled="busy" @click="onRemove">
        {{ t('profilePhoto.remove') }}
      </UButton>
    </div>
  </div>
</template>
