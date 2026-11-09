<script setup lang="ts">
import type { ApiError } from '~/types/auth'

// Landing of the emailed login link (hub ADR 0037 §3). English pair: `/en/access`.
definePageMeta({ layout: 'auth', alias: ['/en/access'], key: 'public-access' })

const { t } = useI18n()
const publicPath = usePublicPath()

useSeoMeta({ title: () => t('auth.access.seoTitle') })

// The token is a credential: keep it away from third parties via the Referer header.
useHead({ meta: [{ name: 'referrer', content: 'no-referrer' }] })

const { consumeMagicLink } = useAuth()
const route = useRoute()
const router = useRouter()
const toast = useToast()

// Read once and kept in memory; the URL is cleaned right away so the token does
// not linger in the address bar or the history. It is single-use anyway.
const token = typeof route.query.token === 'string' ? route.query.token.trim() : ''
const failed = ref<boolean>(token === '')
const errorMessage = ref<string | null>(null)

onMounted(async () => {
  if (route.query.token !== undefined) {
    const query = { ...route.query }
    delete query.token
    router.replace({ path: route.path, query, hash: route.hash })
  }
  if (!token) return
  try {
    const result = await consumeMagicLink(token)
    toast.add({
      title: t('auth.login.welcomeTitle'),
      description: t('auth.login.welcomeDescription', { name: result.user.fullName || result.user.email }),
      color: 'success',
      icon: 'i-lucide-check-circle',
    })
    await router.replace(roleHome(useAuthStore().activeRole))
  }
  catch (err: unknown) {
    failed.value = true
    errorMessage.value = (err as ApiError)?.message || null
  }
})
</script>

<template>
  <div>
    <div class="mb-8">
      <h2 class="text-2xl md:text-3xl font-extrabold text-prohealth-900">
        {{ $t('auth.access.heading') }}
      </h2>
      <p v-if="!failed" class="text-sm text-prohealth-700/70 mt-1">
        {{ $t('auth.access.signingIn') }}
      </p>
    </div>

    <UAlert
      v-if="failed"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      :title="$t('auth.access.invalidTitle')"
      :description="errorMessage || $t('auth.access.invalidDescription')"
    />
    <div v-else class="flex justify-center py-6">
      <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin text-prohealth-600" />
    </div>

    <p class="text-center text-sm text-prohealth-700/70 pt-6">
      <NuxtLink :to="publicPath('/')" class="text-prohealth-600 hover:text-prohealth-700 font-medium">
        {{ $t('auth.backToLogin') }}
      </NuxtLink>
    </p>
  </div>
</template>
