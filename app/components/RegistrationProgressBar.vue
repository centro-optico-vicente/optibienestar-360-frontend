<script setup lang="ts">
// Progress bar of a registration (hub ADR 0037 §2): "Paso X de Y" + a bar. Used by the public step 1
// pages and by the /completar-registro wizard.
const props = defineProps<{
  /** 1-based current step. */
  current: number
  total: number
  /** Optional name of the current step. */
  label?: string
}>()

const { t } = useI18n()
const percent = computed(() => Math.max(0, Math.min(100, Math.round((props.current / Math.max(props.total, 1)) * 100))))
</script>

<template>
  <div class="space-y-1.5" role="group" :aria-label="t('registration.progress.aria')">
    <div class="flex items-center justify-between text-xs text-prohealth-600">
      <span class="font-semibold">{{ t('registration.progress.step', { current, total }) }}</span>
      <span v-if="label">{{ label }}</span>
    </div>
    <UProgress :model-value="percent" :max="100" color="primary" size="sm" />
  </div>
</template>
