<script setup lang="ts">
import type { MyAffiliationFamilyMember, MyAffiliationRequestDto } from '~/types/affiliationRequests'
import type { StepExit } from '~/types/registration'
import { RELATIONSHIP_OPTIONS, type BeneficiaryRelationship } from '~/types/members'

// Wizard step "Familia" (affiliate, not essential): beneficiaries added with the request. The seat limits of the
// plan are validated by the backend (same rules as the portal).
const props = defineProps<{ request: MyAffiliationRequestDto, essential: boolean }>()
const emit = defineEmits<{ done: [request: MyAffiliationRequestDto | null, mode: StepExit] }>()

const { t } = useI18n()
const toast = useToast()
const api = useMyAffiliationRequest()

const MAX_ROWS = 10
const relationshipOptions = computed(() => RELATIONSHIP_OPTIONS.map(o => ({ label: t(o.labelKey), value: o.value })))
const docTypes = [{ value: 'V', label: 'V' }, { value: 'E', label: 'E' }]

interface Row extends Omit<MyAffiliationFamilyMember, 'relationship'> {
  key: number
  relationship: BeneficiaryRelationship | undefined
}
let seq = 0
const blank = (): Row => ({ key: ++seq, firstName: '', lastName: '', documentType: 'V', documentNumber: '', birthDate: '', relationship: undefined })
const rows = ref<Row[]>((props.request.family ?? []).map(m => ({ ...m, key: ++seq, relationship: m.relationship as BeneficiaryRelationship })))
const saving = ref(false)

function add() {
  if (rows.value.length < MAX_ROWS) rows.value.push(blank())
}
function remove(key: number) {
  rows.value = rows.value.filter(r => r.key !== key)
}

function invalid(): string | null {
  for (const r of rows.value) {
    if (!r.firstName.trim() || !r.lastName.trim() || !r.relationship || !r.birthDate) return t('registration.family.incomplete')
    if (r.documentNumber && !/^\d{1,9}$/.test(r.documentNumber.trim())) return t('affiliationRequest.badDocument')
  }
  return null
}

async function finish(mode: StepExit) {
  if (mode === 'back') return emit('done', null, mode)
  if (mode === 'skip') return emit('done', null, mode)
  const error = invalid()
  if (error) {
    if (mode === 'later') return emit('done', null, mode)
    toast.add({ title: error, color: 'error' })
    return
  }
  // Nothing added and nothing saved before: nothing to send.
  if (!rows.value.length && !(props.request.family?.length)) return emit('done', null, mode)
  saving.value = true
  try {
    const members = rows.value.map(r => ({
      firstName: r.firstName.trim(),
      lastName: r.lastName.trim(),
      documentType: r.documentNumber ? r.documentType : undefined,
      documentNumber: r.documentNumber?.trim() || undefined,
      birthDate: r.birthDate || undefined,
      relationship: r.relationship!,
    }))
    emit('done', await api.saveFamily({ members }), mode)
  }
  catch {
    // useApi toasted the reason (e.g. the plan's seat limit).
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <p class="text-sm text-prohealth-600">{{ t('registration.family.hint') }}</p>
    <div v-for="(r, i) in rows" :key="r.key" class="rounded-xl border border-prohealth-100 p-4 space-y-3">
      <div class="flex items-center justify-between">
        <p class="text-sm font-semibold text-prohealth-900">{{ t('registration.family.member', { n: i + 1 }) }}</p>
        <UButton type="button" color="error" variant="ghost" size="xs" icon="i-lucide-trash-2" :aria-label="t('registration.family.remove')" @click="remove(r.key)" />
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <UFormField :label="t('affiliationRequest.firstName')" required>
          <UInput v-model="r.firstName" class="w-full" maxlength="50" />
        </UFormField>
        <UFormField :label="t('affiliationRequest.lastName')" required>
          <UInput v-model="r.lastName" class="w-full" maxlength="50" />
        </UFormField>
        <UFormField :label="t('registration.family.relationship')" required>
          <USelectMenu v-model="r.relationship" :items="relationshipOptions" label-key="label" value-key="value" class="w-full" />
        </UFormField>
        <UFormField :label="t('affiliationRequest.document')">
          <div class="flex gap-2">
            <USelect v-model="r.documentType" :items="docTypes" class="w-20" />
            <UInput v-model="r.documentNumber" class="flex-1" maxlength="9" inputmode="numeric" />
          </div>
        </UFormField>
        <UFormField :label="t('affiliationRequest.birthDate')" required class="sm:col-span-2">
          <BirthDateSelects v-model="r.birthDate" />
        </UFormField>
      </div>
    </div>
    <UButton v-if="rows.length < MAX_ROWS" type="button" color="neutral" variant="outline" icon="i-lucide-user-plus" @click="add">
      {{ t('registration.family.add') }}
    </UButton>
    <RegistrationStepActions :saving="saving" :essential="essential" can-go-back @back="finish('back')" @next="finish('next')" @later="finish('later')" @skip="finish('skip')" />
  </div>
</template>
