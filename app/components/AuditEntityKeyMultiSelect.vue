<script setup lang="ts">
import { AUDIT_ENTITY_KEYS } from '~/utils/audit-entity-keys'

/**
 * Multi-select searchable dropdown for the audit `entityKey` filter (data-changes
 * and reports pages) — replaces the previous free-text input. Options are the
 * canonical entityKey strings actually passed to `AuditModal`/`useAudit` elsewhere
 * in the app (see `~/utils/audit-entity-keys`), not free-typed variants.
 */
defineProps<{
  modelValue: string[]
}>()

defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const { t } = useI18n()

const items = computed((): { label: string, value: string }[] =>
  AUDIT_ENTITY_KEYS.map(key => ({
    label: t(`audit.entityKeys.${key}`, key),
    value: key as string,
  })),
)
</script>

<template>
  <USelectMenu
    :model-value="modelValue"
    :items="items"
    label-key="label"
    value-key="value"
    multiple
    :placeholder="t('security.dataChanges.filters.entityKeyAll')"
    class="w-64"
    @update:model-value="(v: string[]) => $emit('update:modelValue', v)"
  />
</template>
