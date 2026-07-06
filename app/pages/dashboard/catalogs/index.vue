<script setup lang="ts">
// Mosaico de "Datos maestros". Es el botón mosaico del grupo homónimo del menú:
// reutiliza NavMosaic con las vistas derivadas del registro de catálogos.
const { findGroup } = useNav()
const group = findGroup('datos-maestros')

definePageMeta({
  layout: 'dashboard',
  middleware: 'role',
  roles: ['SYSTEM', 'ADMINISTRADOR'],
})

useSeoMeta({ title: 'Datos maestros — OptiBienestar 360' })
</script>

<template>
  <NavMosaic
    v-if="group"
    :title="group.label"
    :subtitle="group.description"
    :items="group.children"
  />
</template>
