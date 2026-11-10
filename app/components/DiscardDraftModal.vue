<script setup lang="ts">
// Confirmation before discarding a registration in progress (hub ADR 0037 §2). Discarding is final: the draft is
// deleted and its national ID and email are free for a new registration.
defineProps<{ title?: string, description: string, loading?: boolean }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ confirm: [] }>()

const { t } = useI18n()
</script>

<template>
  <UModal v-model:open="open" :title="title ?? t('registration.discard.title')">
    <template #body>
      <p class="text-sm text-prohealth-700">{{ description }}</p>
      <div class="flex items-center justify-end gap-3 pt-5">
        <UButton color="neutral" variant="ghost" :disabled="loading" @click="open = false">{{ t('common.cancel') }}</UButton>
        <UButton color="error" :loading="loading" icon="i-lucide-trash-2" @click="emit('confirm')">{{ t('registration.discard.confirm') }}</UButton>
      </div>
    </template>
  </UModal>
</template>
