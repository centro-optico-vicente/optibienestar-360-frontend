<script setup lang="ts">
import type { SortState } from '~/composables/useTableSort'

defineProps<{
  state: SortState | null
}>()
</script>

<template>
  <span class="inline-flex items-center gap-0.5 align-middle ml-1">
    <UIcon
      :name="state
        ? (state.direction === 'asc' ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down')
        : 'i-lucide-chevrons-up-down'"
      class="w-3.5 h-3.5"
      :class="state ? 'text-prohealth-700' : 'text-prohealth-300'"
    />
    <span
      v-if="state && state.priority > 1"
      class="text-[10px] leading-none font-semibold text-prohealth-500 bg-prohealth-100 rounded-full w-3.5 h-3.5 flex items-center justify-center"
    >
      {{ state.priority }}
    </span>
  </span>
</template>
