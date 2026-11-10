<script setup lang="ts">
import type { MyAllyProfileDto } from '~/types/allies'
import type { StepExit } from '~/types/registration'

// Wizard step "Perfil" (ally, not essential): reuses the portal's profile editor, gallery and opening hours
// (hub ADR 0037 §2). The editor saves by itself, so "Siguiente" only moves on. In the advisor's ally capture
// (`assisted`, hub ADR 0037 §5) the advisor edits the draft with the ALLY_DRAFT_UPDATE_ASSISTED permission, adds the
// professional's licenses and leaves out the gallery (the owner adds images once they have their login).
const props = defineProps<{ allyUuid: string, profile: MyAllyProfileDto, essential: boolean, assisted?: boolean }>()
const emit = defineEmits<{ done: [profile: MyAllyProfileDto | null, mode: StepExit], saved: [profile: MyAllyProfileDto] }>()

const { t } = useI18n()
const { can } = usePermissions()
const canEdit = computed(() => props.assisted ? can('ALLY_DRAFT_UPDATE_ASSISTED') : can('ALLY_UPDATE_OWN'))
const canEditHours = computed(() => props.assisted ? can('ALLY_DRAFT_UPDATE_ASSISTED') : can('ALLY_OPENING_HOURS_UPDATE_OWN'))
const missing = computed(() => props.profile.completeness?.missing ?? [])
const percent = computed(() => Math.max(0, Math.min(100, Math.round(props.profile.completeness?.percent ?? 0))))
</script>

<template>
  <div class="space-y-4">
    <p class="text-sm text-prohealth-600">{{ t('registration.ally.profileHint') }}</p>
    <AllyCompletenessCard :percent="percent" :missing="missing" />
    <AllyProfileForm :key="profile.uuid" :ally-uuid="allyUuid" :profile="profile" :readonly="!canEdit" @saved="emit('saved', $event)" />
    <AllyGalleryCard v-if="!assisted" :ally-uuid="allyUuid" :readonly="!canEdit" />
    <AllyOpeningHoursCard :ally-uuid="allyUuid" :readonly="!canEditHours" />
    <AllyLicensesPanel v-if="assisted && profile.segment === 'B2P'" :key="`licenses-${profile.uuid}`" :ally-uuid="allyUuid" :has-holder="true" scope="portal" owner :readonly="!canEdit" />
    <RegistrationStepActions :essential="essential" can-go-back @back="emit('done', null, 'back')" @next="emit('done', null, 'next')" @later="emit('done', null, 'later')" @skip="emit('done', null, 'skip')" />
  </div>
</template>
