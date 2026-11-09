<script setup lang="ts">
// Buttons of a wizard step (hub ADR 0037 §2): "Siguiente" saves and moves on, "Guardar y seguir después"
// saves and leaves, and "Omitir" is offered only when the step is not essential.
defineProps<{
  saving?: boolean
  /** Essential steps cannot be skipped. */
  essential?: boolean
  /** The first step has no "Atrás". */
  canGoBack?: boolean
  nextDisabled?: boolean
  /** Label of the primary button; defaults to "Siguiente". */
  nextLabel?: string
}>()

const emit = defineEmits<{ next: [], later: [], skip: [], back: [] }>()

const { t } = useI18n()
</script>

<template>
  <div class="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
    <div class="flex flex-wrap items-center gap-2">
      <UButton v-if="canGoBack" type="button" color="neutral" variant="ghost" icon="i-lucide-arrow-left" :disabled="saving" @click="emit('back')">
        {{ t('registration.actions.back') }}
      </UButton>
      <UButton type="button" color="neutral" variant="outline" icon="i-lucide-save" :disabled="saving" @click="emit('later')">
        {{ t('registration.actions.later') }}
      </UButton>
      <UButton v-if="!essential" type="button" color="neutral" variant="link" :disabled="saving" @click="emit('skip')">
        {{ t('registration.actions.skip') }}
      </UButton>
    </div>
    <UButton type="button" color="primary" trailing-icon="i-lucide-arrow-right" :loading="saving" :disabled="nextDisabled" @click="emit('next')">
      {{ nextLabel ?? t('registration.actions.next') }}
    </UButton>
  </div>
</template>
