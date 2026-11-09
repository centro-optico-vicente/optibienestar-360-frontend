<script setup lang="ts">
import type { CatalogItem } from '~/types/catalogs'
import type { MyAllyProfileDto } from '~/types/allies'
import type { StepExit } from '~/types/registration'

// Wizard step "Ubicación" (ally): state, city and address, saved through the own profile
// (PUT /v1/me/allies/{uuid}/profile, hub ADR 0037 §2).
const props = defineProps<{ allyUuid: string, profile: MyAllyProfileDto, essential: boolean }>()
const emit = defineEmits<{ done: [profile: MyAllyProfileDto | null, mode: StepExit] }>()

const { t } = useI18n()
const toast = useToast()
const myAllies = useMyAllies()

const state = reactive({
  stateUuid: props.profile.state_Uuid ?? '',
  cityUuid: props.profile.city_Uuid ?? '',
  address: props.profile.address ?? '',
})
const states = ref<CatalogItem[]>([])
const cities = ref<CatalogItem[]>([])
const loadingCities = ref(false)
const saving = ref(false)
const stateItems = computed(() => states.value.map(s => ({ value: s.uuid, label: s.name })))
const cityItems = computed(() => cities.value.map(c => ({ value: c.uuid, label: c.name })))

async function safeList(resource: string, query?: Record<string, string | undefined>): Promise<CatalogItem[]> {
  try {
    return (await usePublicCatalog(resource).list(query)).filter(i => i.active !== false).sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }
  catch {
    return []
  }
}

async function loadCities(stateUuid: string) {
  cities.value = []
  if (!stateUuid) return
  loadingCities.value = true
  cities.value = await safeList('cities', { stateUuid })
  loadingCities.value = false
}

let restoring = true
onMounted(async () => {
  states.value = await safeList('states')
  await loadCities(state.stateUuid)
  restoring = false
})
watch(() => state.stateUuid, async (uuid) => {
  if (!restoring) state.cityUuid = ''
  await loadCities(uuid)
})

async function finish(mode: StepExit) {
  if (mode === 'back' || mode === 'skip') return emit('done', null, mode)
  if (!state.cityUuid) {
    if (mode === 'later') return emit('done', null, mode)
    toast.add({ title: t('registration.required'), color: 'error' })
    return
  }
  saving.value = true
  try {
    emit('done', await myAllies.updateProfile(props.allyUuid, { cityUuid: state.cityUuid, address: state.address.trim() }), mode)
  }
  catch {
    // useApi toasted the reason.
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <UFormField :label="t('allyRequestForm.fields.state')" required>
        <USelectMenu v-model="state.stateUuid" :items="stateItems" label-key="label" value-key="value" :placeholder="t('allyRequestForm.fields.statePlaceholder')" class="w-full" />
      </UFormField>
      <UFormField :label="t('allyRequestForm.fields.city')" required>
        <USelectMenu
          v-model="state.cityUuid"
          :items="cityItems"
          label-key="label"
          value-key="value"
          :loading="loadingCities"
          :disabled="!state.stateUuid"
          :placeholder="state.stateUuid ? t('allyRequestForm.fields.cityPlaceholder') : t('allyRequestForm.fields.selectStateFirst')"
          class="w-full"
        />
      </UFormField>
      <UFormField :label="t('registration.ally.address')" class="sm:col-span-2">
        <UTextarea v-model="state.address" :rows="2" :maxlength="300" class="w-full" />
      </UFormField>
    </div>
    <RegistrationStepActions :saving="saving" :essential="essential" @next="finish('next')" @later="finish('later')" @skip="finish('skip')" />
  </div>
</template>
