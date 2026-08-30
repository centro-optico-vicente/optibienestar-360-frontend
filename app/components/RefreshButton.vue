<script setup lang="ts">
// Generic "reload this section / record" action. The caller owns the fetch
// function and its loading ref; this component only renders the button +
// tooltip + spinner and emits `refresh` on click.
const props = withDefaults(defineProps<{
  loading?: boolean
  disabled?: boolean
  /** Visible text when `iconOnly` is false; also the tooltip fallback. */
  label?: string
  /** Tooltip text; defaults to `label` or `common.refresh`. */
  title?: string
  iconOnly?: boolean
  size?: 'xs' | 'sm' | 'md' | 'lg'
  variant?: 'solid' | 'outline' | 'soft' | 'subtle' | 'ghost' | 'link'
  color?: 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral'
}>(), {
  loading: false,
  disabled: false,
  label: undefined,
  title: undefined,
  iconOnly: true,
  size: 'sm',
  variant: 'ghost',
  color: 'neutral',
})

const emit = defineEmits<{ refresh: [] }>()

const { t } = useI18n()

const tooltip = computed(() => props.title ?? props.label ?? t('common.refresh'))
</script>

<template>
  <UTooltip :text="tooltip">
    <UButton
      :color="color"
      :variant="variant"
      :size="size"
      icon="i-lucide-refresh-cw"
      :label="iconOnly ? undefined : (label ?? t('common.refresh'))"
      :aria-label="tooltip"
      :loading="loading"
      :disabled="disabled || loading"
      @click="emit('refresh')"
    />
  </UTooltip>
</template>
