<script setup lang="ts">
import type { SelectItem } from '~/types/options'
import type { AllyMasterFilterState } from '~/utils/allyFilters'

// Master-table filters for ally lists: ally type, profession, state/department and city (cascading from the state).
// Emits a plain state object; pages map it onto the query via `allyFilterQuery()`.
const model = defineModel<AllyMasterFilterState>({ required: true })

const { t } = useI18n()

const typeOptions = ref<SelectItem[]>([])
const professionOptions = ref<SelectItem[]>([])
const stateOptions = ref<SelectItem[]>([])

/** Cities of the chosen state (server-side search; `q` is debounced by the select). */
async function searchCities(q: string): Promise<SelectItem[]> {
  if (!model.value.stateUuid) return []
  const res = await useCatalogOptions('cities').options({
    ...(q ? { q } : {}),
    limit: 20,
    parentUuid: model.value.stateUuid,
  })
  return res.map(o => ({ label: o.label, value: o.uuid }))
}

function patch(partial: Partial<AllyMasterFilterState>) {
  model.value = { ...model.value, ...partial }
}

onMounted(async () => {
  try {
    const [types, professions, states] = await Promise.all([
      useCatalogOptions('ally-types').options({ limit: 200 }),
      useCatalogOptions('professions').options({ limit: 200 }),
      useCatalogOptions('states').options({ limit: 200 }),
    ])
    typeOptions.value = types.map(o => ({ label: o.label, value: o.uuid }))
    professionOptions.value = professions.map(o => ({ label: o.label, value: o.uuid }))
    stateOptions.value = states.map(o => ({ label: o.label, value: o.uuid }))
  }
  catch {
    // useApi already notified; the dropdowns just stay empty
  }
})
</script>

<template>
  <!-- `contents`: each control is a direct cell of the ListFilterPanel grid. -->
  <div class="contents">
    <USelectMenu
      :model-value="model.allyTypeUuid || undefined"
      clear
      :items="typeOptions"
      label-key="label"
      value-key="value"
      icon="i-lucide-tag"
      :placeholder="t('allies.filters.allyType')"
      class="w-full"
      @update:model-value="patch({ allyTypeUuid: $event ?? '' })"
    />
    <USelectMenu
      :model-value="model.professionUuid || undefined"
      clear
      :items="professionOptions"
      label-key="label"
      value-key="value"
      icon="i-lucide-stethoscope"
      :placeholder="t('allies.filters.profession')"
      class="w-full"
      @update:model-value="patch({ professionUuid: $event ?? '' })"
    />
    <USelectMenu
      :model-value="model.stateUuid || undefined"
      clear
      :items="stateOptions"
      label-key="label"
      value-key="value"
      icon="i-lucide-map-pin"
      :placeholder="t('allies.filters.state')"
      class="w-full"
      @update:model-value="patch({ stateUuid: $event ?? '', cityUuid: '' })"
    />
    <!-- Keyed by the state so the typeahead drops the previous state's cached cities. -->
    <CommonEntityReferenceSelect
      :key="model.stateUuid"
      :model-value="model.cityUuid || undefined"
      :search="searchCities"
      :disabled="!model.stateUuid"
      icon="i-lucide-building-2"
      :placeholder="t('allies.filters.city')"
      class="w-full"
      @update:model-value="patch({ cityUuid: $event ?? '' })"
    />
  </div>
</template>
