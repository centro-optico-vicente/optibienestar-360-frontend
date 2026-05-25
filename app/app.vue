<script setup lang="ts">
const auth = useAuthStore()

onMounted(() => {
  auth.hydrate()
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
