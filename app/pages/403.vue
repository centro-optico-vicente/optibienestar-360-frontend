<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })

useSeoMeta({ title: 'Sin permiso — OptiBienestar 360' })
</script>

<template>
  <div class="min-h-[60vh] grid place-items-center">
    <div class="text-center max-w-md">
      <span class="w-16 h-16 rounded-2xl bg-red-50 text-red-600 grid place-items-center mx-auto">
        <UIcon name="i-lucide-shield-x" class="w-8 h-8" />
      </span>
      <h1 class="mt-6 text-2xl font-extrabold text-prohealth-900">
        No tienes permiso
      </h1>
      <p class="mt-2 text-sm text-prohealth-700/70">
        Tu cuenta no cuenta con los permisos necesarios para ver esta sección.
        Si crees que es un error, contacta a un administrador.
      </p>
      <UButton
        to="/dashboard"
        color="primary"
        variant="soft"
        icon="i-lucide-arrow-left"
        class="mt-6"
      >
        Volver al panel
      </UButton>
    </div>
  </div>
</template>
