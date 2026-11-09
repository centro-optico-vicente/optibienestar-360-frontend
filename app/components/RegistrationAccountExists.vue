<script setup lang="ts">
// "You already have an account" notice of the public step 1 (ACCOUNT_EXISTS, hub ADR 0037 §2).
defineProps<{ message?: string | null }>()

const { t } = useI18n()
const publicPath = usePublicPath()
</script>

<template>
  <UAlert
    color="warning"
    variant="subtle"
    icon="i-lucide-user-check"
    :title="message || t('registration.accountExists.title')"
    :description="t('registration.accountExists.description')"
    :actions="[
      { label: t('registration.accountExists.signIn'), color: 'primary', to: publicPath('/') },
      { label: t('registration.accountExists.recover'), color: 'neutral', variant: 'outline', to: publicPath('/recuperar-clave') },
    ]"
  />
</template>
