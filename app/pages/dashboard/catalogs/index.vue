<script setup lang="ts">
import { CATALOGS } from '~/utils/catalog-registry'

definePageMeta({
  layout: 'dashboard',
  middleware: 'role',
  roles: ['SYSTEM', 'ADMINISTRADOR'],
})

useSeoMeta({ title: 'Catálogos — OptiSalud Plus' })
</script>

<template>
  <div class="space-y-5">
    <div>
      <h1 class="text-2xl font-extrabold text-prohealth-900">Catálogos</h1>
      <p class="text-sm text-prohealth-700/70 mt-1">
        Datos maestros del sistema: países, ciudades, tipos de documento, especialidades y más.
      </p>
    </div>

    <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <NuxtLink
        v-for="c in CATALOGS"
        :key="c.key"
        :to="`/dashboard/catalogs/${c.key}`"
        class="group bg-white rounded-2xl border border-prohealth-100 p-5 flex items-center gap-4 hover:border-prohealth-300 hover:shadow-sm transition"
      >
        <span class="w-11 h-11 rounded-xl bg-prohealth-50 grid place-items-center text-prohealth-600 group-hover:bg-prohealth-100">
          <UIcon :name="c.icon" class="w-6 h-6" />
        </span>
        <div class="min-w-0">
          <p class="font-semibold text-prohealth-900 truncate">{{ c.label }}</p>
          <p class="text-xs text-prohealth-500">Gestionar</p>
        </div>
        <UIcon name="i-lucide-chevron-right" class="w-5 h-5 text-prohealth-300 ml-auto group-hover:text-prohealth-500" />
      </NuxtLink>
    </div>
  </div>
</template>
