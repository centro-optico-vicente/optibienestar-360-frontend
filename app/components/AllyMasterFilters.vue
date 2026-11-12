<script setup lang="ts">
import type { SelectItem } from '~/types/options'
import type { AllyMasterFilterState } from '~/utils/allyFilters'

// Master-table filters for ally lists: ally type, profession, state/department and city (cascading from the state).
// Emits a plain state object; pages map it onto the query via `allyFilterQuery()`.
const model = defineModel<AllyMasterFilterState>({ required: true })

const { t } = useI18n()

// Each dropdown fetches its list the first time it is opened, not when the list mounts.
const lazyCatalog = (resource: string) => useLazyOptions(async () =>
  (await useCatalogOptions(resource).options({ limit: 200 })).map(o => ({ label: o.label, value: o.uuid })))
const types = lazyCatalog('ally-types')
const professions = lazyCatalog('professions')
const states = lazyCatalog('states')

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
</script>

<template>
  <div class="flex flex-wrap items-center gap-3">
    <USelectMenu
      :model-value="model.allyTypeUuid || undefined"
      clear
      :items="types.items.value"
      :loading="types.loading.value"
      @update:open="types.onOpen"
      label-key="label"
      value-key="value"
      icon="i-lucide-tag"
      :placeholder="t('allies.filters.allyType')"
      class="w-52"
      @update:model-value="patch({ allyTypeUuid: $event ?? '' })"
    />
    <USelectMenu
      :model-value="model.professionUuid || undefined"
      clear
      :items="professions.items.value"
      :loading="professions.loading.value"
      @update:open="professions.onOpen"
      label-key="label"
      value-key="value"
      icon="i-lucide-stethoscope"
      :placeholder="t('allies.filters.profession')"
      class="w-52"
      @update:model-value="patch({ professionUuid: $event ?? '' })"
    />
    <USelectMenu
      :model-value="model.stateUuid || undefined"
      clear
      :items="states.items.value"
      :loading="states.loading.value"
      @update:open="states.onOpen"
      label-key="label"
      value-key="value"
      icon="i-lucide-map-pin"
      :placeholder="t('allies.filters.state')"
      class="w-52"
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
      class="w-52"
      @update:model-value="patch({ cityUuid: $event ?? '' })"
    />
  </div>
</template>
