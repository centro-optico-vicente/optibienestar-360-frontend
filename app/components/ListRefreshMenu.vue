<script setup lang="ts">
// Split control for list pages: the main button reloads with the current
// filters; the dropdown offers that same action plus a "clear filters and
// reload" one. The caller wires `refresh` to its `load()` and `reset` to a
// function that restores the default filters before reloading.
const props = withDefaults(defineProps<{
  loading?: boolean
  size?: 'xs' | 'sm' | 'md' | 'lg'
  variant?: 'solid' | 'outline' | 'soft' | 'subtle' | 'ghost' | 'link'
  color?: 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral'
}>(), {
  loading: false,
  size: 'md',
  variant: 'outline',
  color: 'neutral',
})

const emit = defineEmits<{ refresh: []; reset: [] }>()

const { t } = useI18n()

const items = computed(() => [
  [
    {
      label: t('common.refreshKeepFilters'),
      icon: 'i-lucide-refresh-cw',
      hint: t('common.refreshKeepFiltersHint'),
      onSelect: () => emit('refresh'),
    },
    {
      label: t('common.clearFiltersAndRefresh'),
      icon: 'i-lucide-filter-x',
      hint: t('common.clearFiltersAndRefreshHint'),
      onSelect: () => emit('reset'),
    },
  ],
])
</script>

<template>
  <div class="inline-flex items-center">
    <UButtonGroup>
      <UButton
        :color="color"
        :variant="variant"
        :size="size"
        icon="i-lucide-refresh-cw"
        :loading="loading"
        :title="t('common.refreshKeepFiltersHint')"
        @click="emit('refresh')"
      >
        {{ t('common.refresh') }}
      </UButton>

      <UDropdownMenu :items="items" :content="{ align: 'end' }">
        <UButton
          :color="color"
          :variant="variant"
          :size="size"
          icon="i-lucide-chevron-down"
          :disabled="loading"
          :aria-label="t('common.refresh')"
        />

        <template #item="{ item }">
          <span :title="item.hint" class="flex items-center gap-2 w-full">
            <UIcon :name="item.icon" class="size-4 shrink-0" />
            <span class="truncate">{{ item.label }}</span>
          </span>
        </template>
      </UDropdownMenu>
    </UButtonGroup>
  </div>
</template>
