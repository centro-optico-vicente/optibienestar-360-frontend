<script setup lang="ts">
// Catch-all del dashboard: cualquier ruta /dashboard/* que aún NO tenga su página
// (módulos pendientes del sidebar: reportes, afiliados, aliados, planes, etc.)
// cae aquí. En vez de un 404 crudo, avisamos y devolvemos al panel.
// Las rutas con página propia (users, roles, catalogs/...) tienen prioridad sobre este.
definePageMeta({ layout: 'dashboard' })

const route = useRoute()
const toast = useToast()

onMounted(async () => {
  toast.add({
    title: 'Módulo en construcción',
    description: `La sección "${route.path}" todavía no está disponible.`,
    color: 'info',
    icon: 'i-lucide-construction',
  })
  await navigateTo('/dashboard')
})
</script>

<template>
  <div class="py-20 text-center text-prohealth-500">
    <UIcon name="i-lucide-construction" class="w-10 h-10 mx-auto mb-3 text-prohealth-300" />
    <p>Este módulo aún no está disponible. Te llevamos al panel…</p>
  </div>
</template>
