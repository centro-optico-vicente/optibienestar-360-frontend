<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    /** Table or resource slug (e.g. 'allies', 'members', 'payments'). Inferred from route if omitted. */
    tableName?: string
    /** Record UUID for individual record report. Generates full table list report if omitted. */
    recordUuid?: string
    /** Optional title to customize the report header */
    title?: string
    /** Button color (Nuxt UI style) */
    color?: string
    /** Button variant style */
    variant?: string
    /** Button label */
    label?: string
  }>(),
  {
    color: 'neutral',
    variant: 'outline',
  }
)

const { t } = useI18n()
const route = useRoute()
const reports = useDocumentReports()
const loading = ref(false)

// Deduce table name automatically from current route path if not passed explicitly
const effectiveTableName = computed(() => {
  if (props.tableName) return props.tableName
  const cleanPath = route.path.replace(/^\/dashboard\//, '').split('?')[0] || ''
  return cleanPath.split('/')[0] || ''
})

async function handleDownload(format: 'PDF' | 'XLSX') {
  if (!effectiveTableName.value) return
  loading.value = true
  try {
    if (props.recordUuid) {
      await reports.downloadRecordReport(effectiveTableName.value, props.recordUuid, format, props.title)
    } else {
      await reports.downloadTableReport(effectiveTableName.value, props.recordUuid ? undefined : format, props.title)
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="inline-flex items-center gap-1">
    <UButton
      :color="(color as any)"
      :variant="(variant as any)"
      icon="i-lucide-printer"
      :loading="loading"
      @click="handleDownload('PDF')"
    >
      {{ label || (recordUuid ? t('reports.printRecord') : t('reports.printList')) }}
    </UButton>

    <UButton
      :color="(color as any)"
      :variant="(variant as any)"
      icon="i-lucide-file-spreadsheet"
      :loading="loading"
      square
      :title="t('reports.exportExcel')"
      @click="handleDownload('XLSX')"
    />
  </div>
</template>
