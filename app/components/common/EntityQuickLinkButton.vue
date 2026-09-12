<script setup lang="ts">
// Small icon-button to jump from a form's select/field straight to the master
// screen of the currently-selected value (same pattern the user liked on the
// Promotor link in members/index.vue, generalized to forms). Emits `navigate`
// only when the user has permission; otherwise it warns via toast instead of
// silently doing nothing or navigating into a 403.
const props = withDefaults(defineProps<{
  /** Target route for the currently-selected value; `null`/empty hides the button. */
  to?: string | null
  /** Whether the current user can view the target screen. */
  can?: boolean
  tooltip?: string
}>(), {
  to: null,
  can: true,
})

const emit = defineEmits<{ navigate: [string] }>()

const { t } = useI18n()
const toast = useToast()

function onClick() {
  if (!props.to) return
  if (!props.can) {
    toast.add({ title: t('common.noAccessToScreen'), color: 'warning', icon: 'i-lucide-lock' })
    return
  }
  emit('navigate', props.to)
}
</script>

<template>
  <UTooltip v-if="to" :text="can ? (tooltip || t('common.viewMaster')) : t('common.noAccessToScreen')">
    <UButton
      color="neutral"
      variant="outline"
      size="sm"
      icon="i-lucide-external-link"
      :class="{ 'opacity-50': !can }"
      @click="onClick"
    />
  </UTooltip>
</template>
