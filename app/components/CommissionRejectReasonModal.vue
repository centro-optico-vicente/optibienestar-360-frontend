<script setup lang="ts">
/**
 * Pide el motivo obligatorio antes de rechazar las filas seleccionadas —
 * `reason` cascada a los overrides jerárquicos dependientes (V107).
 */
const props = defineProps<{
  open: boolean
  count: number
  submitting: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'confirm': [reason: string]
}>()

const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})

const { t } = useI18n()
const reason = ref('')
const touched = ref(false)

const reasonError = computed(() =>
  touched.value && !reason.value.trim() ? t('validation.required') : undefined)

watch(() => props.open, (open) => {
  if (open) {
    reason.value = ''
    touched.value = false
  }
})

function confirm() {
  touched.value = true
  const text = reason.value.trim()
  if (!text) return
  emit('confirm', text)
}
</script>

<template>
  <UModal v-model:open="isOpen" :title="t('commissions.approval.reject.title', { count })">
    <template #body>
      <div class="space-y-4">
        <p class="text-sm text-prohealth-700">{{ t('commissions.approval.reject.notice') }}</p>
        <UFormField :label="t('commissions.approval.reject.reasonLabel')" required :error="reasonError">
          <UTextarea
            v-model="reason"
            :rows="3"
            :maxlength="2000"
            class="w-full"
            @blur="touched = true"
          />
        </UFormField>
        <div class="flex items-center justify-end gap-3 pt-1">
          <UButton color="neutral" variant="ghost" :disabled="submitting" @click="isOpen = false">
            {{ t('common.cancel') }}
          </UButton>
          <UButton color="error" icon="i-lucide-x" :loading="submitting" @click="confirm">
            {{ t('commissions.approval.reject.confirmButton') }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
