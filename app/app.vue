<script setup lang="ts">
const auth = useAuthStore()
const { fetchMe } = useAuth()

onMounted(() => {
  auth.hydrate()
  // Si hay sesión, refrescar el perfil en segundo plano (datos/roles actualizados).
  if (auth.accessToken) fetchMe()
})
</script>

<template>
  <UApp>
    <NuxtLoadingIndicator color="#9FD537" />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
