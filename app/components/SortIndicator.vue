<script setup lang="ts">
import type { SortState } from '~/composables/useTableSort'

const props = withDefaults(defineProps<{
  state: SortState | null
  /** Whether more than one column is active — the priority badge is only meaningful with 2+ columns, but it must then show on *every* active column, including priority 1, or the first one looks indistinguishable from "unsorted" next to the others. */
  multiActive?: boolean
}>(), {
  multiActive: false,
})

// Lets a single active column be dropped straight from the header — without
// this, removing it would mean clicking through asc → desc → removed on the
// header itself, since a bare click always advances the cycle forward.
const emit = defineEmits<{ clear: [] }>()

const { t } = useI18n()

const directionTooltip = computed(() => {
  if (!props.state) return t('common.sortUnsorted')
  return props.state.direction === 'asc' ? t('common.sortAscending') : t('common.sortDescending')
})

// e.g. "Columna nº2 del ordenado — descendente" — states the direction too,
// since the priority badge sits right next to the direction arrow and a
// reader glancing at just the badge shouldn't have to also decode the arrow.
const priorityTooltip = computed(() => {
  if (!props.state) return ''
  const direction = props.state.direction === 'asc' ? t('common.sortDirectionAsc') : t('common.sortDirectionDesc')
  return t('common.sortPriority', { n: props.state.priority, direction })
})
</script>

<template>
  <span class="inline-flex items-center gap-0.5 align-middle ml-1">
    <!--
      Dedicated ascending/descending glyphs (not a plain chevron pair) — at
      this size a chevron-up next to a chevron-down reads as "some arrow",
      not legibly which way. `list-sort-ascending`/`list-sort-descending`
      are Lucide's standard "sort A→Z"/"sort Z→A" icons, distinct at a glance.
    -->
    <UIcon
      :name="state
        ? (state.direction === 'asc' ? 'i-lucide-list-sort-ascending' : 'i-lucide-list-sort-descending')
        : 'i-lucide-chevrons-up-down'"
      :title="directionTooltip"
      class="w-4 h-4"
      :class="state ? 'text-prohealth-700' : 'text-prohealth-300'"
    />
    <span
      v-if="state && multiActive"
      :title="priorityTooltip"
      class="text-[10px] leading-none font-semibold text-prohealth-500 bg-prohealth-100 rounded-full w-3.5 h-3.5 flex items-center justify-center"
    >
      {{ state.priority }}
    </span>
    <UIcon
      v-if="state"
      name="i-lucide-x"
      :title="t('common.sortClear')"
      class="w-3 h-3 text-prohealth-300 hover:text-prohealth-600"
      @click.stop="emit('clear')"
    />
  </span>
</template>
