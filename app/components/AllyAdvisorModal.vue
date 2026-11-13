<script setup lang="ts">
import type { AllyDto } from '~/types/allies'

// Assign, change or clear the advisor who brought an ally into OptiBienestar 360
// (PUT /v1/admin/allies/{uuid}/advisor, ALLY_ASSIGN_PROMOTER). It is audited like any other ally change.
const props = defineProps<{ open: boolean, ally: AllyDto | null }>()
const emit = defineEmits<{ 'update:open': [boolean], saved: [AllyDto] }>()

const { t } = useI18n()
const toast = useToast()
const allies = useAllies()
const advisors = useAdvisorOptions()

const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})

const selected = ref<string | undefined>(undefined)
const saving = ref(false)

// Searched on the server (`q`), loaded when the dropdown opens.
const advisorItems = useLazyOptions(q => advisors.search(q))

watch(() => props.open, (open) => {
  if (!open) return
  selected.value = props.ally?.capturedByPromoter_Uuid ?? undefined
})

// Keep the current advisor selectable even when it is not in the loaded page.
const items = computed(() => {
  const current = props.ally?.capturedByPromoter_Uuid
  if (current && !advisorItems.items.value.some(o => o.value === current)) {
    return [{ label: props.ally?.capturedByPromoter_Display ?? current, value: current }, ...advisorItems.items.value]
  }
  return advisorItems.items.value
})

async function save() {
  if (!props.ally) return
  saving.value = true
  try {
    const saved = await allies.assignAdvisor(props.ally.uuid, selected.value ?? null)
    toast.add({ title: t('allies.advisor.savedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    isOpen.value = false
    emit('saved', saved)
  }
  catch {
    // useApi already toasted the backend's reason.
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal v-model:open="isOpen" :title="t('allies.advisor.modalTitle')" :description="t('allies.advisor.modalHelp')" :ui="{ content: 'max-w-md' }">
    <template #body>
      <UFormField :label="t('allies.form.fields.capturedByPromoter')">
        <USelectMenu
          v-model="selected"
          clear
          :items="items"
          :loading="advisorItems.loading.value"
          v-model:search-term="advisorItems.searchTerm.value"
          ignore-filter
          label-key="label"
          value-key="value"
          icon="i-lucide-user-check"
          :placeholder="t('allies.advisor.none')"
          class="w-full"
          @update:open="advisorItems.onOpen"
          @update:model-value="advisorItems.remember($event)"
        />
      </UFormField>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <UButton color="neutral" variant="outline" :disabled="saving" @click="isOpen = false">{{ t('common.cancel') }}</UButton>
        <UButton color="primary" :loading="saving" @click="save">{{ t('common.save') }}</UButton>
      </div>
    </template>
  </UModal>
</template>
