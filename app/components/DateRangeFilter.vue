<script setup lang="ts">
// Shared inclusive date-range filter (`yyyy-MM-dd`) for operational/transactional
// lists — sent to the API as `dateFrom` / `dateTo`. Two native date inputs, each
// clearable. Dates are discrete values, so changes are emitted immediately (no
// debounce). If the user picks a range whose start is after its end, the two
// ends are swapped so the query is never empty by mistake.
//
// Usage: <DateRangeFilter v-model:from="dateFrom" v-model:to="dateTo" />
// Bound to an object: v-model:from="filters.dateFrom" v-model:to="filters.dateTo"
const from = defineModel<string>('from', { default: '' })
const to = defineModel<string>('to', { default: '' })

defineProps<{
  fromLabel?: string
  toLabel?: string
}>()

// Emits the final range at once. Use it (instead of the two v-models) when the
// parent keeps both ends in one object, so a swap cannot overwrite itself.
const emit = defineEmits<{ change: [range: { from: string, to: string }] }>()

const { t } = useI18n()

function normalize(nextFrom: string, nextTo: string) {
  if (nextFrom && nextTo && nextFrom > nextTo) {
    [nextFrom, nextTo] = [nextTo, nextFrom]
  }
  from.value = nextFrom
  to.value = nextTo
  emit('change', { from: nextFrom, to: nextTo })
}

function onFrom(v: unknown) {
  normalize(v == null ? '' : String(v), to.value)
}

function onTo(v: unknown) {
  normalize(from.value, v == null ? '' : String(v))
}
</script>

<template>
  <div class="inline-flex flex-wrap items-center gap-2">
    <UInput
      :model-value="from"
      type="date"
      :max="to || undefined"
      :aria-label="fromLabel ?? t('common.dateRange.from')"
      :title="fromLabel ?? t('common.dateRange.from')"
      class="w-40"
      @update:model-value="onFrom"
    >
      <template v-if="from" #trailing>
        <UButton
          color="neutral"
          variant="link"
          size="xs"
          icon="i-lucide-x"
          :aria-label="t('common.dateRange.clear')"
          @click="onFrom('')"
        />
      </template>
    </UInput>
    <UInput
      :model-value="to"
      type="date"
      :min="from || undefined"
      :aria-label="toLabel ?? t('common.dateRange.to')"
      :title="toLabel ?? t('common.dateRange.to')"
      class="w-40"
      @update:model-value="onTo"
    >
      <template v-if="to" #trailing>
        <UButton
          color="neutral"
          variant="link"
          size="xs"
          icon="i-lucide-x"
          :aria-label="t('common.dateRange.clear')"
          @click="onTo('')"
        />
      </template>
    </UInput>
  </div>
</template>
