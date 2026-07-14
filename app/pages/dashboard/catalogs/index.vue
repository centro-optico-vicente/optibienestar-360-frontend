<script setup lang="ts">
// "Master data" mosaic. It's the mosaic button of the menu group with the same
// name: reuses NavMosaic with the views derived from the catalog registry.
// `visibleGroup` resolves labels to i18n and filters children by permission.
const { t } = useI18n()
const { visibleGroup } = useNav()
const group = computed(() => visibleGroup('datos-maestros'))

definePageMeta({
  layout: 'dashboard',
  middleware: 'role',
  roles: ['SYSTEM', 'ADMINISTRADOR'],
})

useSeoMeta({ title: () => t('common.seoTitle', { page: t('nav.groups.datosMaestros.label') }) })
</script>

<template>
  <NavMosaic
    v-if="group"
    :title="group.label"
    :subtitle="group.description"
    :items="group.children"
  />
</template>
