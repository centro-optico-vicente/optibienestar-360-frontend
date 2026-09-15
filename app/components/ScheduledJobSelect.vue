<script setup lang="ts">
/**
 * Job picker bound to `jobUuid` for the cross-job execution audit page
 * (Seguridad → "Ejecuciones programadas"). Jobs are a small, finite catalog
 * (unlike actors/users) so the full list is fetched once and passed as static
 * `items` to CommonEntityReferenceSelect — no server-side search needed.
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

const items = ref<{ label: string, value: string }[]>([])
const loading = ref(false)

onMounted(async () => {
  loading.value = true
  try {
    const res = await jobs.list({ size: 200, includeInactive: true, sort: ['displayName,asc'] })
    items.value = (res.content ?? []).map(j => ({ label: j.displayName, value: j.uuid }))
  }
  catch {
    items.value = []
  }
  finally {
    loading.value = false
  }
})

const value = computed({
  get: () => props.modelValue,
  set: (v: string | undefined) => emit('update:modelValue', v),
})
</script>

<template>
  <CommonEntityReferenceSelect
    v-model="value"
    :items="items"
    :loading="loading"
    entity="scheduled_job"
    icon="i-lucide-timer"
    :placeholder="t('security.jobRuns.filters.jobPlaceholder')"
    class="w-64"
    @navigate="(to: string) => navigateTo(to)"
  />
</template>
