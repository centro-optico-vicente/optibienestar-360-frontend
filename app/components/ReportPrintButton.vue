<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    /** Nombre de la tabla o slug del recurso (ej: 'allies', 'members', 'payments'). Opcional: si se omite, se deduce automáticamente de la ruta. */
    tableName?: string
    /** UUID del registro para la ficha individual. Si se omite, genera el reporte del listado completo de la tabla. */
    recordUuid?: string
    /** Título opcional para personalizar el reporte */
    title?: string
    /** Color del botón (estilo Nuxt UI) */
    color?: string
    /** Variante del botón */
    variant?: string
    /** Etiqueta del botón */
    label?: string
  }>(),
  {
    color: 'neutral',
    variant: 'outline',
  }
)

const route = useRoute()
const reports = useDocumentReports()
const loading = ref(false)

// Deducción automática del nombre de la tabla desde la ruta actual si no se pasa explícitamente
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
      {{ label || (recordUuid ? 'Imprimir Ficha' : 'Imprimir Listado') }}
    </UButton>

    <UButton
      :color="(color as any)"
      :variant="(variant as any)"
      icon="i-lucide-file-spreadsheet"
      :loading="loading"
      square
      title="Exportar a Excel (XLSX)"
      @click="handleDownload('XLSX')"
    />
  </div>
</template>
