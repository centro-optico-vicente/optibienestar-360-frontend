<script setup lang="ts">
import type { SelectItem } from '~/types/options'
import type { AllyMasterFilterState } from '~/utils/allyFilters'

// Master-table filters for ally lists: ally type, profession and state/department.
// Emits a plain state object; pages map it onto the query via `allyFilterQuery()`.
const model = defineModel<AllyMasterFilterState>({ required: true })

const { t } = useI18n()

const typeOptions = ref<SelectItem[]>([])
const professionOptions = ref<SelectItem[]>([])
const stateOptions = ref<SelectItem[]>([])

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
  <div class="flex flex-wrap items-center gap-3">
    <USelectMenu
      :model-value="model.allyTypeUuid || undefined"
      clear
      :items="typeOptions"
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
      :items="professionOptions"
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
      :items="stateOptions"
      label-key="label"
      value-key="value"
      icon="i-lucide-map-pin"
      :placeholder="t('allies.filters.state')"
      class="w-52"
      @update:model-value="patch({ stateUuid: $event ?? '' })"
    />
  </div>
</template>
