<script setup lang="ts">
import { EMERGENCY_RELATIONSHIP_OPTIONS, type EmergencyContactFieldsState } from '~/types/members'

// Name / phone / relationship of the titular's emergency contact (V212). Plain fields bound
// with v-model, so the member forms and the detail card share the same inputs and labels.

const model = defineModel<EmergencyContactFieldsState>({ required: true })
defineProps<{ disabled?: boolean }>()

const { t } = useI18n()
const relationshipItems = computed(() =>
  EMERGENCY_RELATIONSHIP_OPTIONS.map(o => ({ label: t(o.labelKey), value: o.value })))
</script>

<template>
  <div class="space-y-4">
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <UFormField :label="t('members.emergencyContact.fields.name')">
        <UInput v-model="model.name" :maxlength="200" :disabled="disabled" class="w-full" />
      </UFormField>
      <UFormField :label="t('members.emergencyContact.fields.phone')">
        <UInput v-model="model.phone" :maxlength="30" :disabled="disabled" class="w-full" />
      </UFormField>
    </div>
    <UFormField :label="t('members.emergencyContact.fields.relationship')">
      <USelectMenu
        v-model="model.relationship"
        :items="relationshipItems"
        label-key="label"
        value-key="value"
        :disabled="disabled"
        class="w-full"
      />
    </UFormField>
  </div>
</template>
