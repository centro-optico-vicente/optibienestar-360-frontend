<script setup lang="ts">
// "Reportes" mosaic. It's the mosaic button of the menu group with the same
// name: reuses NavMosaic with the views derived from nav.ts (pattern inherited
// from Datos maestros / Catálogos).
const { t } = useI18n()
const { visibleGroup } = useNav()
const group = computed(() => visibleGroup('reportes'))

definePageMeta({ layout: 'dashboard' })

watchEffect(() => {
  if (import.meta.client && !group.value) {
    navigateTo('/dashboard')
  }
})

useSeoMeta({
  title: () => (group.value ? t('common.seoTitle', { page: group.value.label }) : t('app.name')),
})
</script>

<template>
  <NavMosaic
    v-if="group"
    :title="group.label"
    :subtitle="group.description"
    :items="group.children"
  />
</template>
