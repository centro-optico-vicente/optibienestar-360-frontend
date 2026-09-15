<script setup lang="ts">
/**
 * Job picker bound to `jobUuid` for the cross-job execution audit page
 * (Seguridad → "Ejecuciones programadas"). Jobs are a small, finite catalog
 * (unlike actors/users) so the full list is fetched once — no server-side
 * search needed. `includeInactive` so history for a since-deactivated job
 * stays filterable.
 */
const props = defineProps<{
  modelValue?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | undefined]
}>()

const { t } = useI18n()
const jobs = useScheduledJobs()
const { can } = usePermissions()
const canViewJob = computed(() => can('JOB_VIEW_ALL'))

const options = ref<{ label: string, value: string }[]>([])
const loading = ref(false)

onMounted(async () => {
  loading.value = true
  try {
    const res = await jobs.list({ size: 200, includeInactive: true, sort: ['displayName,asc'] })
    options.value = (res.content ?? []).map(j => ({ label: j.displayName, value: j.uuid }))
  }
  catch {
    options.value = []
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
  <div class="flex items-center gap-2">
    <USelectMenu
      v-model="value"
      :items="options"
      label-key="label"
      value-key="value"
      clear
      icon="i-lucide-timer"
      :loading="loading"
      :placeholder="t('security.jobRuns.filters.jobPlaceholder')"
      :search-input="{ placeholder: t('security.jobRuns.filters.jobPlaceholder'), icon: 'i-lucide-search' }"
      class="w-64"
    />
    <CommonEntityQuickLinkButton
      :to="value ? `/dashboard/scheduled-jobs/${value}` : null"
      :can="canViewJob"
      @navigate="(to: string) => navigateTo(to)"
    />
  </div>
</template>
