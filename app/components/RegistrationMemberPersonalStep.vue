<script setup lang="ts">
import type { MyAffiliationRequestDto } from '~/types/affiliationRequests'
import type { StepExit } from '~/types/registration'

// Wizard step "Datos personales" (affiliate): birth date as three selects. National ID and email come from
// step 1 and are shown read-only (they identify the account).
const props = defineProps<{ request: MyAffiliationRequestDto, essential: boolean }>()
const emit = defineEmits<{ done: [request: MyAffiliationRequestDto | null, mode: StepExit] }>()

const { t } = useI18n()
const toast = useToast()
const api = useMyAffiliationRequest()

const state = reactive({
  firstName: props.request.firstName ?? '',
  lastName: props.request.lastName ?? '',
  birthDate: props.request.birthDate ?? '',
  phone: props.request.phone ?? '',
})
const saving = ref(false)

function invalid(): string | null {
  if (!state.firstName.trim() || !state.lastName.trim() || !state.birthDate) return t('registration.required')
  const birth = new Date(`${state.birthDate}T12:00:00`)
  if (birth.getTime() > Date.now()) return t('registration.birthDate.future')
  return null
}

async function finish(mode: StepExit) {
  if (mode === 'back') return emit('done', null, mode)
  const error = invalid()
  if (error) {
    // "Guardar y seguir después" leaves without saving an incomplete form; "Siguiente" asks to complete it.
    if (mode === 'later') return emit('done', null, mode)
    toast.add({ title: error, color: 'error' })
    return
  }
  saving.value = true
  try {
    const saved = await api.savePersonal({
      firstName: state.firstName.trim(),
      lastName: state.lastName.trim(),
      birthDate: state.birthDate,
      phone: state.phone.trim() || undefined,
    })
    emit('done', saved, mode)
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
  <div class="space-y-4">
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <UFormField :label="t('affiliationRequest.firstName')" required>
        <UInput v-model="state.firstName" class="w-full" maxlength="50" autocomplete="given-name" />
      </UFormField>
      <UFormField :label="t('affiliationRequest.lastName')" required>
        <UInput v-model="state.lastName" class="w-full" maxlength="50" autocomplete="family-name" />
      </UFormField>
      <UFormField :label="t('affiliationRequest.document')">
        <UInput :model-value="`${request.documentType}${request.documentNumber}`" class="w-full" disabled />
      </UFormField>
      <UFormField :label="t('affiliationRequest.email')">
        <UInput :model-value="request.email" class="w-full" disabled />
      </UFormField>
      <UFormField :label="t('affiliationRequest.phone')">
        <UInput v-model="state.phone" class="w-full" maxlength="30" autocomplete="tel" />
      </UFormField>
      <UFormField :label="t('affiliationRequest.birthDate')" required>
        <BirthDateSelects v-model="state.birthDate" />
      </UFormField>
    </div>
    <RegistrationStepActions :saving="saving" :essential="essential" @next="finish('next')" @later="finish('later')" @skip="finish('skip')" />
  </div>
</template>
