<script setup lang="ts">
/**
 * Job picker bound to `jobUuid` for the cross-job execution audit page
 * (Seguridad → "Ejecuciones programadas"). Jobs are a small, finite catalog
 * (unlike actors/users) so the full list is fetched once — the first time the
 * dropdown opens — and passed as `items` to CommonEntityReferenceSelect.
 * `includeInactive` so history for a since-deactivated job stays filterable.
 */
const props = defineProps<{
  modelValue?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | undefined]
}>()

const { t } = useI18n()
const jobs = useScheduledJobs()

// Fetched the first time the dropdown opens (or when a value is preset, so its label shows).
const options = useLazyOptions(async () => {
  const res = await jobs.list({ size: 200, includeInactive: true, sort: ['displayName,asc'] })
  return (res.content ?? []).map(j => ({ label: j.displayName, value: j.uuid }))
})
watch(() => props.modelValue, (v) => {
  if (v) void options.ensureLoaded()
}, { immediate: true })

const value = computed({
  get: () => props.modelValue,
  set: (v: string | undefined) => emit('update:modelValue', v),
})
</script>

<template>
  <CommonEntityReferenceSelect
    v-model="value"
    :items="options.items.value"
    :loading="options.loading.value"
    entity="scheduled_job"
    icon="i-lucide-timer"
    :placeholder="t('security.jobRuns.filters.jobPlaceholder')"
    class="w-64"
    @navigate="(to: string) => navigateTo(to)"
    @open="options.onOpen"
  />
</template>
