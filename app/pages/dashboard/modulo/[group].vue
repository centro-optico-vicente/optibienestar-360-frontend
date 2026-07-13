<script setup lang="ts">
// Página de mosaico por módulo: pinta las vistas visibles de un grupo del menú
// como tarjetas (patrón heredado de Catálogos). Es data-driven — una sola página
// sirve a todos los grupos (afiliaciones, aliados, comercial, seguridad, etc.).
definePageMeta({ layout: 'dashboard' })

const { t } = useI18n()
const route = useRoute()
const { visibleGroup } = useNav()

// Grupo visible con hijos filtrados y labels ya resueltos a i18n.
const group = computed(() => visibleGroup(String(route.params.group)))
const items = computed(() => group.value?.children ?? [])

// Grupo inexistente o sin vistas visibles para este usuario → de vuelta al panel.
// (El backend es el muro real; esto es solo experiencia de usuario.)
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
