<script setup lang="ts">
// Promoter profile: profile photo + the promoter's unique affiliation QR
// (GET /v1/promoter/me/qr, PROMOTER_VIEW_OWN). The QR encodes the public
// /afiliarse link carrying the promoter's referral code.
definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'PROMOTER_VIEW_OWN',
})

interface PromoterQr {
  displayName: string
  referralCode: string
  affiliationUrl: string
  qrCodeDataUri: string
}

const { t } = useI18n()
const toast = useToast()

useSeoMeta({ title: () => t('common.seoTitle', { page: t('promoterSelf.profile.title') }) })

const qr = ref<PromoterQr | null>(null)
const loading = ref(true)

onMounted(async () => {
  try {
    qr.value = await useApi<PromoterQr>('/v1/promoter/me/qr')
  }
  catch {
    qr.value = null
  }
  finally {
    loading.value = false
  }
})

async function copyLink() {
  if (!qr.value) return
  try {
    await navigator.clipboard.writeText(qr.value.affiliationUrl)
    toast.add({ title: t('promoterSelf.profile.copied'), color: 'success' })
  }
  catch {
    toast.add({ title: t('promoterSelf.profile.copyFailed'), color: 'error' })
  }
}
</script>

<template>
  <div class="space-y-6 max-w-3xl">
    <div>
      <h1 class="text-2xl font-extrabold text-prohealth-900">{{ t('promoterSelf.profile.title') }}</h1>
      <p class="text-sm text-prohealth-700/70 mt-1">{{ t('promoterSelf.profile.subtitle') }}</p>
    </div>

    <ProfilePhotoCard />

    <div class="bg-white rounded-2xl border border-prohealth-100 p-6">
      <div v-if="loading" class="flex gap-6">
        <USkeleton class="w-48 h-48 rounded-xl" />
        <div class="flex-1 space-y-3">
          <USkeleton class="h-5 w-48 rounded" />
          <USkeleton class="h-4 w-full rounded" />
        </div>
      </div>

      <div v-else-if="!qr" class="py-6 text-center text-prohealth-500">
        <UIcon name="i-lucide-qr-code" class="w-8 h-8 mx-auto mb-2 text-prohealth-300" />
        <p class="text-sm">{{ t('promoterSelf.profile.qrUnavailable') }}</p>
      </div>

      <div v-else class="flex flex-wrap items-start gap-6">
        <img :src="qr.qrCodeDataUri" :alt="t('promoterSelf.profile.qrAlt')" class="w-48 h-48 rounded-xl border border-prohealth-100">
        <div class="min-w-0 flex-1 space-y-3">
          <h2 class="font-bold text-prohealth-900">{{ t('promoterSelf.profile.qrTitle') }}</h2>
          <p class="text-sm text-prohealth-600">{{ t('promoterSelf.profile.qrBody') }}</p>
          <div>
            <p class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('promoterSelf.profile.code') }}</p>
            <p class="font-mono font-bold text-lg text-prohealth-900">{{ qr.referralCode }}</p>
          </div>
          <p class="text-xs text-prohealth-500 break-all">{{ qr.affiliationUrl }}</p>
          <div class="flex flex-wrap gap-2">
            <UButton :href="qr.qrCodeDataUri" :download="`qr-${qr.referralCode}.png`" color="primary" variant="soft" size="sm" icon="i-lucide-download">
              {{ t('promoterSelf.profile.download') }}
            </UButton>
            <UButton color="neutral" variant="outline" size="sm" icon="i-lucide-copy" @click="copyLink">
              {{ t('promoterSelf.profile.copy') }}
            </UButton>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
