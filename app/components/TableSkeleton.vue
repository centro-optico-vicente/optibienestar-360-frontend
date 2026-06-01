<script setup lang="ts">
// Filas de carga (skeleton) para las tablas del panel. Se coloca dentro de <tbody>
// reemplazando la fila de "Cargando…". Usa <USkeleton> de Nuxt UI.
withDefaults(defineProps<{ rows?: number, cols?: number }>(), {
  rows: 6,
  cols: 4,
})

// Anchos variados por columna para un aspecto más natural.
const widths = ['w-3/4', 'w-1/2', 'w-2/3', 'w-1/3', 'w-1/2', 'w-2/5']
</script>

<template>
  <tr v-for="r in rows" :key="r">
    <td v-for="c in cols" :key="c" class="px-5 py-3.5">
      <USkeleton class="h-4 rounded" :class="widths[(c - 1) % widths.length]" />
    </td>
  </tr>
</template>
