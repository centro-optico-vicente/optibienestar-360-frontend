<script setup lang="ts">
// Weekly opening hours card of the ally portal (V214, hub ADR 0031 §7), shared with the registration wizard.
const props = defineProps<{ allyUuid: string, readonly?: boolean }>()
/** Forwarded from the editor: the profile completeness ("Te falta: Horario") must be reloaded (#316). */
const emit = defineEmits<{ saved: [] }>()

const { t } = useI18n()
</script>

<template>
  <div id="ally-opening-hours" class="bg-white rounded-2xl border border-prohealth-100 p-6 space-y-2 scroll-mt-20">
    <h2 class="font-bold text-prohealth-900">{{ t('allies.openingHours.title') }}</h2>
    <p class="text-xs text-prohealth-500">
      {{ props.readonly ? t('allies.openingHours.portalReadonlyHint') : t('allies.openingHours.portalHint') }}
    </p>
    <AllyOpeningHoursEditor :key="allyUuid" :ally-uuid="allyUuid" scope="portal" :readonly="props.readonly" @saved="emit('saved')" />
  </div>
</template>
