<script setup lang="ts">
// Generic "reactivate" action for soft-deleted (active === false) records.
// The caller resolves the permission check and performs the actual restore
// request (each entity has its own composable/endpoint) — this component
// only renders the conditional button + tooltip + loading state.
const props = withDefaults(defineProps<{
  active?: boolean | null
  allowed: boolean
  loading?: boolean
  disabled?: boolean
  label?: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  variant?: 'solid' | 'outline' | 'soft' | 'subtle' | 'ghost' | 'link'
}>(), {
  active: undefined,
  loading: false,
  disabled: false,
  label: undefined,
  size: 'sm',
  variant: 'ghost',
})

const emit = defineEmits<{ restore: [] }>()

const { t } = useI18n()

const visible = computed(() => props.active === false)
</script>

<template>
  <UTooltip
    v-if="visible"
    :text="allowed ? t('common.restore') : t('common.noPermissionRestore')"
  >
    <UButton
      color="success"
      :variant="variant"
      icon="i-lucide-rotate-ccw"
      :size="size"
      :label="label ?? t('common.restore')"
      :loading="loading"
      :disabled="disabled || !allowed || loading"
      @click="emit('restore')"
    />
  </UTooltip>
</template>
