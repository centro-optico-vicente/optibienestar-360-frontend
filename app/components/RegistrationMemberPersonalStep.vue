<script setup lang="ts">
import type { MyAffiliationRequestDto } from '~/types/affiliationRequests'
import type { StepExit } from '~/types/registration'

// Wizard step "Datos personales" (affiliate): birth date as three selects. National ID and email come from
// step 1 and are shown read-only (they identify the account). An advisor's assisted draft has no account yet, so
// there (`api.editableIdentity`) they are editable to fix a typo.
const props = defineProps<{ request: MyAffiliationRequestDto, essential: boolean }>()
const emit = defineEmits<{ done: [request: MyAffiliationRequestDto | null, mode: StepExit] }>()

const { t } = useI18n()
const notifyApiError = useNotifyApiError()
const toast = useToast()
const api = useMemberRegistrationApi()

const state = reactive({
  firstName: props.request.firstName ?? '',
  lastName: props.request.lastName ?? '',
  birthDate: props.request.birthDate ?? '',
  phone: props.request.phone ?? '',
  documentType: props.request.documentType || 'V',
  documentNumber: props.request.documentNumber ?? '',
  email: props.request.email ?? '',
})
const docTypes = [{ value: 'V', label: 'V' }, { value: 'E', label: 'E' }]
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const saving = ref(false)

function invalid(): string | null {
  if (!state.firstName.trim() || !state.lastName.trim() || !state.birthDate) return t('registration.required')
  const birth = new Date(`${state.birthDate}T12:00:00`)
  if (birth.getTime() > Date.now()) return t('registration.birthDate.future')
  if (api.editableIdentity) {
    if (!/^\d{1,9}$/.test(state.documentNumber.trim())) return t('affiliationRequest.badDocument')
    if (!EMAIL_RE.test(state.email.trim())) return t('registration.step1.badEmail')
  }
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
      ...(api.editableIdentity
        ? { documentType: state.documentType, documentNumber: state.documentNumber.trim(), email: state.email.trim() }
        : {}),
    })
    emit('done', saved, mode)
  }
  catch (err) {
    // useApi does not toast 400 / 404: say why the step was not saved.
    notifyApiError(err)
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
      <UFormField :label="t('affiliationRequest.document')" :required="api.editableIdentity">
        <div v-if="api.editableIdentity" class="flex gap-2">
          <USelect v-model="state.documentType" :items="docTypes" class="w-20" />
          <UInput v-model="state.documentNumber" class="flex-1" maxlength="9" inputmode="numeric" />
        </div>
        <UInput v-else :model-value="`${request.documentType}${request.documentNumber}`" class="w-full" disabled />
      </UFormField>
      <UFormField :label="t('affiliationRequest.email')" :required="api.editableIdentity">
        <UInput v-if="api.editableIdentity" v-model="state.email" type="email" class="w-full" maxlength="254" />
        <UInput v-else :model-value="request.email" class="w-full" disabled />
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
