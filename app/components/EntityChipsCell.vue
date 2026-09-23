<script setup lang="ts">
import type { DisplayRefItem } from '~/types/options'

// Compact "first item + N more" chip list for an M:N scope column (hub plan
// Part F — promoterTypes on CommissionTier/CommissionBonusRule/CollectionCommissionTier).
// Empty list = "applies to all" (server-side semantics), shown as a neutral badge
// instead of an empty cell so it doesn't read as missing data.
const props = defineProps<{
  items: DisplayRefItem[] | null | undefined
  /** Label shown when the list is empty — defaults to "Todos" via the caller's i18n. */
  emptyLabel: string
}>()

const list = computed(() => props.items ?? [])
const first = computed(() => list.value[0])
const restCount = computed(() => Math.max(0, list.value.length - 1))
const restLabel = computed(() => list.value.slice(1).map(i => i.name ?? i.code ?? i.uuid).join(', '))
</script>

<template>
  <div v-if="list.length === 0" class="flex">
    <UBadge color="neutral" variant="subtle" size="sm">{{ emptyLabel }}</UBadge>
  </div>
  <div v-else class="flex items-center gap-1">
    <UBadge color="primary" variant="subtle" size="sm">{{ first?.name ?? first?.code ?? first?.uuid }}</UBadge>
    <UTooltip v-if="restCount > 0" :text="restLabel">
      <UBadge color="neutral" variant="subtle" size="sm">+{{ restCount }}</UBadge>
    </UTooltip>
  </div>
</template>
