<script setup lang="ts" generic="C extends string">
import { PERSON_DOCUMENT_TYPE_CODES, documentTypeItems } from '~/utils/documentTypes'

/**
 * Narrow document type select that sits in front of the document number ("V" | 12345678).
 * The menu lists `<code> — <name>` ("V — Cédula de identidad venezolana", spec 07-forms
 * "Código en selects"); the trigger keeps only the code so the narrow field does not overflow.
 * class / disabled / aria-label fall through to the USelect.
 */
const props = withDefaults(defineProps<{
  codes?: readonly C[]
  placeholder?: string
}>(), {
  codes: () => PERSON_DOCUMENT_TYPE_CODES as unknown as readonly C[],
  placeholder: undefined,
})
const model = defineModel<C | null | undefined>()

const { t } = useI18n()
const items = computed(() => documentTypeItems(t, props.codes))
</script>

<template>
  <USelect v-model="model" :items="items" :placeholder="placeholder" :ui="{ content: 'min-w-72' }">
    <template #default="{ modelValue }">
      {{ modelValue || placeholder || ' ' }}
    </template>
  </USelect>
</template>
