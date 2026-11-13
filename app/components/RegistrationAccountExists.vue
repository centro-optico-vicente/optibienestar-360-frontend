<script setup lang="ts">
// "You already have an account" notice of the public step 1 (ACCOUNT_EXISTS, hub ADR 0037 §2). One person, one
// account (backend#438): signing in brings the person back to this same page, which then offers to go on with the
// account they already have (an advisor who affiliates, a member who becomes an ally).
defineProps<{ message?: string | null }>()

const { t } = useI18n()
const publicPath = usePublicPath()
const route = useRoute()
</script>

<template>
  <UAlert
    color="warning"
    variant="subtle"
    icon="i-lucide-user-check"
    :title="message || t('registration.accountExists.title')"
    :description="t('registration.accountExists.description')"
    :actions="[
      { label: t('registration.accountExists.signIn'), color: 'primary', to: { path: publicPath('/'), query: { redirect: route.fullPath } } },
      { label: t('registration.accountExists.recover'), color: 'neutral', variant: 'outline', to: publicPath('/recuperar-clave') },
    ]"
  />
</template>
