<script setup lang="ts">
// Per-module mosaic page: renders a menu group's visible views as cards (pattern
// inherited from Catalogs). It's data-driven — a single page serves every group
// (afiliaciones, aliados, comercial, seguridad, etc.).
definePageMeta({ layout: 'dashboard' })

const { t } = useI18n()
const route = useRoute()
const { visibleGroup } = useNav()

// Visible group with filtered children and labels already resolved to i18n.
const group = computed(() => visibleGroup(String(route.params.group)))
const items = computed(() => group.value?.children ?? [])

// Nonexistent group or no views visible to this user → back to the dashboard.
// (The backend is the real wall; this is only UX.)
watchEffect(() => {
  if (import.meta.client && (!group.value || items.value.length === 0)) {
    navigateTo('/dashboard')
  }
})

useSeoMeta({
  title: () => (group.value ? t('common.seoTitle', { page: group.value.label }) : t('app.name')),
})
</script>

<template>
  <NavMosaic
    v-if="group && items.length"
    :title="group.label"
    :subtitle="group.description"
    :items="items"
  />
</template>
