<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })

const { t } = useI18n()

useSeoMeta({ title: () => t('errors.forbidden.seoTitle') })
</script>

<template>
  <div class="min-h-[60vh] grid place-items-center">
    <div class="text-center max-w-md">
      <span class="w-16 h-16 rounded-2xl bg-red-50 text-red-600 grid place-items-center mx-auto">
        <UIcon name="i-lucide-shield-x" class="w-8 h-8" />
      </span>
      <h1 class="mt-6 text-2xl font-extrabold text-prohealth-900">
        {{ $t('errors.forbidden.title') }}
      </h1>
      <p class="mt-2 text-sm text-prohealth-700/70">
        {{ $t('errors.forbidden.description') }}
      </p>
      <UButton
        to="/dashboard"
        color="primary"
        variant="soft"
        icon="i-lucide-arrow-left"
        class="mt-6"
      >
        {{ $t('errors.forbidden.back') }}
      </UButton>
    </div>
  </div>
</template>
