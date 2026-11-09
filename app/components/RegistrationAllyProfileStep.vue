<script setup lang="ts">
import type { MyAllyProfileDto } from '~/types/allies'
import type { StepExit } from '~/types/registration'

// Wizard step "Perfil" (ally, not essential): reuses the portal's profile editor, gallery and opening hours
// (hub ADR 0037 §2). The editor saves by itself, so "Siguiente" only moves on.
const props = defineProps<{ allyUuid: string, profile: MyAllyProfileDto, essential: boolean }>()
const emit = defineEmits<{ done: [profile: MyAllyProfileDto | null, mode: StepExit], saved: [profile: MyAllyProfileDto] }>()

const { t } = useI18n()
const { can } = usePermissions()
const canEdit = computed(() => can('ALLY_UPDATE_OWN'))
const canEditHours = computed(() => can('ALLY_OPENING_HOURS_UPDATE_OWN'))
const missing = computed(() => props.profile.completeness?.missing ?? [])
const percent = computed(() => Math.max(0, Math.min(100, Math.round(props.profile.completeness?.percent ?? 0))))
</script>

<template>
  <div class="space-y-4">
    <p class="text-sm text-prohealth-600">{{ t('registration.ally.profileHint') }}</p>
    <AllyCompletenessCard :percent="percent" :missing="missing" />
    <AllyProfileForm :key="profile.uuid" :ally-uuid="allyUuid" :profile="profile" :readonly="!canEdit" @saved="emit('saved', $event)" />
    <AllyGalleryCard :ally-uuid="allyUuid" :readonly="!canEdit" />
    <AllyOpeningHoursCard :ally-uuid="allyUuid" :readonly="!canEditHours" />
    <RegistrationStepActions :essential="essential" can-go-back @back="emit('done', null, 'back')" @next="emit('done', null, 'next')" @later="emit('done', null, 'later')" @skip="emit('done', null, 'skip')" />
  </div>
</template>
