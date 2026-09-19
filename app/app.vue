<script setup lang="ts">
import { es, en } from '@nuxt/ui/locale'

const auth = useAuthStore()
const { fetchMe } = useAuth()
const { locale } = useI18n()
const { applyHint, syncFromUser } = useAppLocale()

// Keep <html lang> in sync with the active UI locale (a11y/SEO).
useHead({ htmlAttrs: { lang: () => locale.value } })

// Pre-login hint: honor the last chosen language before any session exists.
applyHint()

// Authoritative locale: mirror the signed-in user's stored preference into the
// UI on every profile update (hydrate, login, /v1/me, locale swap). Runs once
// immediately for the already-hydrated user, then on each change.
watch(() => auth.user?.locale, () => syncFromUser(auth.user), { immediate: true })

onMounted(() => {
  auth.hydrate()
  // Si hay sesión, refrescar el perfil en segundo plano (datos/roles actualizados).
  if (auth.accessToken) fetchMe()
})

const nuxtUiLocale = computed(() => (locale.value === 'en' ? en : es))
</script>

<template>
  <UApp :locale="nuxtUiLocale">
    <NuxtLoadingIndicator color="#9FD537" />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
