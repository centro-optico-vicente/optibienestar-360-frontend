<script setup lang="ts">
// "Mantener registro" (backend V237): marks one registration in progress so the abandoned-draft cleanup job skips it
// (open negotiation, waiting for information). A checkbox plus an optional short note; the caller makes the call.
const props = defineProps<{ retained: boolean, note?: string | null, loading?: boolean }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ confirm: [payload: { retain: boolean, note: string }] }>()

const { t } = useI18n()

const keep = ref(false)
const note = ref('')

// Each time it opens, start from what the record has now.
watch(open, (isOpen) => {
  if (isOpen) {
    keep.value = props.retained
    note.value = props.note ?? ''
  }
})
</script>

<template>
  <UModal v-model:open="open" :title="t('keepRecord.title')">
    <template #body>
      <div class="space-y-4">
        <UCheckbox v-model="keep" :label="t('keepRecord.label')" :description="t('keepRecord.hint')" />
        <UFormField v-if="keep" :label="t('keepRecord.noteLabel')" :help="t('keepRecord.noteHelp')">
          <UTextarea v-model="note" :rows="2" :maxlength="200" class="w-full" :placeholder="t('keepRecord.notePlaceholder')" />
        </UFormField>
      </div>
      <div class="flex items-center justify-end gap-3 pt-5">
        <UButton color="neutral" variant="ghost" :disabled="loading" @click="open = false">{{ t('common.cancel') }}</UButton>
        <UButton color="primary" :loading="loading" icon="i-lucide-save" @click="emit('confirm', { retain: keep, note })">{{ t('common.save') }}</UButton>
      </div>
    </template>
  </UModal>
</template>
