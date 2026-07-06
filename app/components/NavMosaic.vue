<script setup lang="ts">
import type { NavLeaf } from '~/utils/nav'

// Mosaico de accesos rápidos: la vista general de un módulo en tarjetas.
// Reutilizado por la página de Catálogos y por cada grupo del menú.
defineProps<{
  title: string
  subtitle?: string
  items: NavLeaf[]
}>()
</script>

<template>
  <div class="space-y-5">
    <div>
      <h1 class="text-2xl font-extrabold text-prohealth-900">{{ title }}</h1>
      <p v-if="subtitle" class="text-sm text-prohealth-700/70 mt-1">{{ subtitle }}</p>
    </div>

    <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <NuxtLink
        v-for="item in items"
        :key="item.to"
        :to="item.to"
        class="group bg-white rounded-2xl border border-prohealth-100 p-5 flex items-center gap-4 hover:border-prohealth-300 hover:shadow-sm transition"
      >
        <span class="w-11 h-11 rounded-xl bg-prohealth-50 grid place-items-center text-prohealth-600 group-hover:bg-prohealth-100 shrink-0">
          <UIcon :name="item.icon" class="w-6 h-6" />
        </span>
        <div class="min-w-0">
          <p class="font-semibold text-prohealth-900 truncate">{{ item.label }}</p>
          <p class="text-xs text-prohealth-500 truncate">{{ item.description ?? 'Gestionar' }}</p>
        </div>
        <UIcon name="i-lucide-chevron-right" class="w-5 h-5 text-prohealth-300 ml-auto shrink-0 group-hover:text-prohealth-500" />
      </NuxtLink>
    </div>
  </div>
</template>
