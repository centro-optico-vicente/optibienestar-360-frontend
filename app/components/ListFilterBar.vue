<script setup lang="ts">
import type { ListFilterField, ListFilterState } from '~/utils/listFilters'

// Generic master-table filter row for admin lists: one control per field
// (select, server-side typeahead or date), all bound to a single state object
// keyed by query-param name. The page maps the state onto the list request
// with `listFilterQuery()` (utils/listFilters.ts).
defineProps<{ fields: ListFilterField[] }>()
const model = defineModel<ListFilterState>({ required: true })

function patchRange(fromKey: string, toKey: string, range: { from: string, to: string }) {
  model.value = { ...model.value, [fromKey]: range.from, [toKey]: range.to }
}

function patch(key: string, value: unknown) {
  model.value = { ...model.value, [key]: value == null ? '' : String(value) }
}
</script>

<template>
  <!-- `contents`: each control is a direct cell of the ListFilterPanel grid. -->
  <div class="contents">
    <template v-for="f in fields" :key="f.key">
      <DateRangeFilter
        v-if="f.type === 'dateRange' && f.toKey"
        :from="model[f.key]"
        :to="model[f.toKey]"
        :from-label="f.label"
        :to-label="f.toLabel ?? f.label"
        @change="patchRange(f.key, f.toKey, $event)"
      />
      <UInput
        v-else-if="f.type === 'date'"
        :model-value="model[f.key]"
        type="date"
        :aria-label="f.label"
        :title="f.label"
        :class="f.class ?? 'w-full'"
        @update:model-value="patch(f.key, $event)"
      />
      <CommonEntityReferenceSelect
        v-else-if="f.search"
        :model-value="model[f.key] || undefined"
        :search="f.search"
        :icon="f.icon"
        :placeholder="f.label"
        :class="f.class ?? 'w-full'"
        @update:model-value="patch(f.key, $event)"
      />
      <USelectMenu
        v-else
        :model-value="model[f.key] || undefined"
        clear
        :items="f.lazy ? f.lazy.items.value : (f.items ?? [])"
        :loading="f.lazy?.loading.value"
        label-key="label"
        value-key="value"
        :icon="f.icon"
        :placeholder="f.label"
        :class="f.class ?? 'w-full'"
        @update:model-value="patch(f.key, $event)"
        @update:open="f.lazy?.onOpen($event)"
      />
    </template>
  </div>
</template>
