<script setup lang="ts">
// A bank as shown everywhere (hub ADR 0030): SUDEBAN code + commercial name, with the official / legal name
// as a tooltip when it is known and differs. Without a known official name it is plain text.
const props = withDefaults(defineProps<{
  uuid?: string | null
  code?: string | null
  /** Commercial name, as the DTOs carry it (`bank_Display`). */
  name?: string | null
  showCode?: boolean
}>(), {
  uuid: null,
  code: null,
  name: null,
  showCode: true,
})

const { t } = useI18n()
const { ensureLoaded, officialName } = useBankCatalog()

onMounted(ensureLoaded)

const label = computed(() => [props.showCode ? props.code : null, props.name].filter(Boolean).join(' '))
const official = computed(() => {
  const name = officialName(props.uuid, props.code)
  return name && name !== props.name ? name : null
})
</script>

<template>
  <UTooltip v-if="official && label" :text="t('banks.officialNameTooltip', { name: official })">
    <span class="cursor-help underline decoration-dotted decoration-prohealth-300 underline-offset-2">{{ label }}</span>
  </UTooltip>
  <span v-else-if="label">{{ label }}</span>
</template>
