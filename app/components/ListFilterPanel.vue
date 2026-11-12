<script setup lang="ts">
// Filter card of a list screen. The default slot is the always-visible row
// (search box, quick toggles such as «Incluir inactivos», the inbox status…);
// the `filters` slot holds the master filters and date ranges, which the user
// can collapse with the «Filtros» button at the top right.
//
// - Starts collapsed unless a filter is active (then it opens so the user sees why
//   the list is narrowed); the user's choice is remembered per screen.
// - The button shows how many filters are active and «Limpiar» resets them
//   (the page's own reset, via `clear`).
// - Collapsed filters stay mounted (hidden) so a picked value keeps its label; their
//   dropdowns still load nothing until opened (useLazyOptions).
const props = withDefaults(defineProps<{
  /** Number of filters with a value inside the `filters` slot. */
  activeCount?: number
  /** Overrides the per-screen key the open/closed choice is stored under (defaults to the route path). */
  storageKey?: string
}>(), {
  activeCount: 0,
  storageKey: undefined,
})

const emit = defineEmits<{ clear: [] }>()

const { t } = useI18n()
const route = useRoute()
const slots = useSlots()

const key = computed(() => `list-filters:${props.storageKey ?? route.path}`)

function readStored(): boolean | null {
  try {
    const v = localStorage.getItem(key.value)
    return v === null ? null : v === '1'
  }
  catch {
    return null
  }
}

const open = ref(readStored() ?? props.activeCount > 0)

// A filter set from elsewhere (a link, «Limpiar» elsewhere) while collapsed: show it.
watch(() => props.activeCount, (n, prev) => {
  if (n > 0 && (prev ?? 0) === 0) open.value = true
})

function toggle() {
  open.value = !open.value
  try {
    localStorage.setItem(key.value, open.value ? '1' : '0')
  }
  catch {
    // storage unavailable: the choice just isn't remembered
  }
}

const panelId = useId()
</script>

<template>
  <div class="bg-white rounded-2xl border border-prohealth-100 p-4 space-y-3">
    <div class="flex flex-wrap items-center gap-3">
      <div class="flex flex-1 min-w-0 flex-wrap items-center gap-3">
        <slot />
      </div>
      <div v-if="slots.filters" class="flex items-center gap-1 ms-auto">
        <UButton
          v-if="activeCount > 0"
          color="neutral"
          variant="link"
          size="sm"
          icon="i-lucide-x"
          @click="emit('clear')"
        >
          {{ t('common.filters.clear') }}
        </UButton>
        <UButton
          color="neutral"
          variant="outline"
          icon="i-lucide-sliders-horizontal"
          :trailing-icon="open ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
          :aria-expanded="open"
          :aria-controls="panelId"
          @click="toggle"
        >
          {{ t('common.filters.toggle') }}
          <UBadge v-if="activeCount > 0" color="primary" variant="solid" size="sm" class="rounded-full">
            {{ activeCount }}
          </UBadge>
        </UButton>
      </div>
    </div>
    <div v-if="slots.filters" v-show="open" :id="panelId" class="border-t border-prohealth-100 pt-3">
      <slot name="filters" />
    </div>
  </div>
</template>
