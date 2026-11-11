<script setup lang="ts">
import type { CatalogItem } from '~/types/catalogs'
import type { MyAllyProfileDto } from '~/types/allies'
import type { StepExit } from '~/types/registration'
import { TAX_DOCUMENT_TYPES } from '~/types/allyRequests'
import { professionTreeItems } from '~/utils/professionLabel'

// Wizard step "Datos fiscales o profesionales" (ally): rubro plus the RIF (B2B) or the profession (B2P) — what
// the ADR 0036 single-step form used to ask (hub ADR 0037 §2). Saved through the own profile.
const props = defineProps<{ allyUuid: string, profile: MyAllyProfileDto, essential: boolean }>()
const emit = defineEmits<{ done: [profile: MyAllyProfileDto | null, mode: StepExit] }>()

const { t } = useI18n()
const toast = useToast()
const notifyApiError = useNotifyApiError()
const myAllies = useMyAllies()

const isB2B = computed(() => props.profile.segment === 'B2B')
const state = reactive({
  allyTypeUuid: props.profile.allyType_Uuid ?? '',
  taxDocumentType: (props.profile.taxDocumentType ?? 'J') as (typeof TAX_DOCUMENT_TYPES)[number],
  taxDocumentNumber: props.profile.taxDocumentNumber ?? '',
  professionUuid: props.profile.profession_Uuid ?? '',
})
const allyTypes = ref<CatalogItem[]>([])
const professions = ref<CatalogItem[]>([])
const saving = ref(false)
const taxDocTypes = TAX_DOCUMENT_TYPES.map(v => ({ value: v, label: v }))

// A type without segment fits both (same rule as the admin ally form).
const allyTypeItems = computed(() => allyTypes.value
  .filter(i => !i.segment || i.segment === props.profile.segment)
  .map(i => ({ value: i.uuid, label: i.name })))
const professionItems = computed(() => professionTreeItems(professions.value))

async function safeList(resource: string): Promise<CatalogItem[]> {
  try {
    return (await usePublicCatalog(resource).list()).filter(i => i.active !== false)
  }
  catch {
    return []
  }
}

onMounted(async () => {
  const [types, profs] = await Promise.all([safeList('ally-types'), safeList('professions')])
  allyTypes.value = types
  professions.value = profs
})

// The RIF is typed as the placeholder suggests ("12345678-9") but the backend stores digits only (#310): hyphens and
// spaces are dropped before validating and sending.
const taxDigits = computed(() => state.taxDocumentNumber.replace(/[\s-]/g, ''))

function invalid(): string | null {
  if (!state.allyTypeUuid) return t('registration.required')
  if (isB2B.value) {
    if (!state.taxDocumentNumber.trim()) return t('registration.required')
    if (!/^[\d\s-]+$/.test(state.taxDocumentNumber.trim()) || !/^\d{5,15}$/.test(taxDigits.value)) return t('allyRequestForm.badTaxDocument')
  }
  else if (!state.professionUuid) {
    return t('registration.required')
  }
  return null
}

async function finish(mode: StepExit) {
  if (mode === 'back' || mode === 'skip') return emit('done', null, mode)
  const error = invalid()
  if (error) {
    if (mode === 'later') return emit('done', null, mode)
    toast.add({ title: error, color: 'error' })
    return
  }
  saving.value = true
  try {
    emit('done', await myAllies.updateProfile(props.allyUuid, isB2B.value
      ? { allyTypeUuid: state.allyTypeUuid, taxDocumentType: state.taxDocumentType, taxDocumentNumber: taxDigits.value }
      : { allyTypeUuid: state.allyTypeUuid, professionUuid: state.professionUuid }), mode)
  }
  catch (err) {
    // useApi does not toast 400 / 404 (e.g. a duplicated RIF): say why the step was not saved.
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
      <UFormField :label="t('allyRequestForm.fields.allyType')" required class="sm:col-span-2">
        <USelectMenu v-model="state.allyTypeUuid" :items="allyTypeItems" label-key="label" value-key="value" :placeholder="t('allyRequestForm.fields.allyTypePlaceholder')" class="w-full" />
      </UFormField>
      <UFormField v-if="isB2B" :label="t('allyRequestForm.fields.taxDocument')" required class="sm:col-span-2">
        <div class="flex gap-2">
          <USelect v-model="state.taxDocumentType" :items="taxDocTypes" class="w-20" />
          <UInput v-model="state.taxDocumentNumber" class="flex-1" maxlength="15" placeholder="12345678-9" />
        </div>
      </UFormField>
      <UFormField v-else :label="t('allyRequestForm.fields.profession')" required class="sm:col-span-2">
        <USelectMenu
          v-model="state.professionUuid"
          :items="professionItems"
          label-key="label"
          value-key="value"
          icon="i-lucide-search"
          :placeholder="t('allyRequestForm.fields.professionPlaceholder')"
          :search-input="{ placeholder: t('allyRequestForm.fields.professionSearch') }"
          class="w-full"
        />
      </UFormField>
    </div>
    <RegistrationStepActions :saving="saving" :essential="essential" can-go-back @back="finish('back')" @next="finish('next')" @later="finish('later')" @skip="finish('skip')" />
  </div>
</template>
