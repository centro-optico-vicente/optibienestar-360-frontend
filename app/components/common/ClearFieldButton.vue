<script setup lang="ts">
// Small "x" to unset an optional select's value, placed next to it alongside
// CommonEntityQuickLinkButton. Only shown while the field actually holds a value.
withDefaults(defineProps<{
  show?: boolean
  tooltip?: string
}>(), {
  show: false,
})

defineEmits<{ clear: [] }>()

const { t } = useI18n()
</script>

<template>
  <UTooltip v-if="show" :text="tooltip || t('common.clearValue')">
    <UButton
      color="neutral"
      variant="ghost"
      size="sm"
      icon="i-lucide-x"
      @click="$emit('clear')"
    />
  </UTooltip>
</template>
