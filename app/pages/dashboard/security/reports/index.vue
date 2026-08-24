<script setup lang="ts">
import { buildPageSizeItems, DEFAULT_PAGE_SIZE, UNPAGED_PAGE_SIZE } from '~/utils/pagination'
import { defaultTodayRange } from '~/utils/date'
import type { ReportAuditLogDto } from '~/types/audit'

definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'REPORT_AUDIT_VIEW_ALL',
})

const { t } = useI18n()

useSeoMeta({ title: () => t('security.reportsAudit.seoTitle') })

const audit = useAudit()
const { formatDate, formatNumber } = useFormatters()
const toast = useToast()

const data = ref<ReportAuditLogDto[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1) // UPagination es 1-based; la API es 0-based
const size = ref(DEFAULT_PAGE_SIZE)
const pageSizeItems = buildPageSizeItems(t)
const downloadingUuid = ref<string | null>(null)

const entityKeyFilter = ref<string[]>([])
const actorUuidFilter = ref<string | undefined>(undefined)
const FORMAT_OPTIONS: { label: string, value: string }[] = [
  { label: t('security.reportsAudit.filters.formats.PDF'), value: 'PDF' },
  { label: t('security.reportsAudit.filters.formats.XLSX'), value: 'XLSX' },
]
const formatFilter = ref<string[]>([])
const dateRange = ref(defaultTodayRange())

function formatSize(bytes?: number | null): string {
  if (!bytes) return t('common.empty')
  const kb = bytes / 1024
  return kb < 1024 ? `${formatNumber(Math.round(kb))} KB` : `${formatNumber(Math.round(kb / 1024))} MB`
}

async function load() {
  loading.value = true
  try {
    const res = await audit.listReports({
      entityKey: entityKeyFilter.value,
      actorUuid: actorUuidFilter.value,
      format: formatFilter.value,
      from: dateRange.value.from,
      to: dateRange.value.to,
      page: page.value - 1,
      size: size.value,
    })
    data.value = res.content ?? []
    total.value = res.totalElements ?? 0
  }
  catch {
    data.value = []
    total.value = 0
  }
  finally {
    loading.value = false
  }
}

async function downloadReport(report: ReportAuditLogDto) {
  downloadingUuid.value = report.uuid
  try {
    const { url } = await audit.downloadReportUrl(report.uuid)
    window.open(url, '_blank')
  }
  catch {
    toast.add({
      title: t('audit.reports.downloadError'),
      color: 'error',
      icon: 'i-lucide-circle-alert',
    })
  }
  finally {
    downloadingUuid.value = null
  }
}

watch(size, () => { page.value = 1 })
watch([page, size], load)
watch([entityKeyFilter, actorUuidFilter, formatFilter, dateRange], () => { page.value = 1; load() }, { deep: true })

onMounted(load)
</script>

<template>
  <div class="space-y-5">
    <!-- Header -->
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-extrabold text-prohealth-900">{{ $t('security.reportsAudit.title') }}</h1>
        <p class="text-sm text-prohealth-700/70 mt-1">
          {{ $t('security.reportsAudit.subtitle') }}
        </p>
      </div>
    </div>

    <!-- Filtros -->
    <div class="bg-white rounded-2xl border border-prohealth-100 p-4 flex flex-wrap items-center gap-3">
      <AuditEntityKeyMultiSelect v-model="entityKeyFilter" />
      <AuditActorSelect v-model="actorUuidFilter" />
      <USelectMenu
        v-model="formatFilter"
        :items="FORMAT_OPTIONS"
        label-key="label"
        value-key="value"
        multiple
        clear
        icon="i-lucide-file-type"
        :placeholder="$t('security.reportsAudit.filters.format')"
        class="w-48"
      />
      <AuditDateRangePicker v-model="dateRange" />
    </div>

    <!-- Listado -->
    <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden flex flex-col min-h-[20rem]">
      <div v-if="loading" class="py-10 text-center text-prohealth-500">
        <UIcon name="i-lucide-loader-2" class="w-6 h-6 mx-auto animate-spin" />
      </div>
      <div v-else-if="data.length === 0" class="py-12 text-center text-prohealth-500">
        <UIcon name="i-lucide-file-text" class="w-8 h-8 mx-auto mb-2 text-prohealth-300" />
        {{ $t('security.reportsAudit.empty') }}
      </div>
      <ul v-else class="divide-y divide-prohealth-100">
        <li v-for="report in data" :key="report.uuid" class="py-3 px-5 flex items-center justify-between gap-3">
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <UBadge color="primary" variant="subtle" size="sm">{{ report.format }}</UBadge>
              <span class="text-sm font-medium text-prohealth-900 truncate">{{ report.reportType }}</span>
              <UBadge v-if="report.entityKey" color="neutral" variant="subtle" size="sm">{{ report.entityKey }}</UBadge>
            </div>
            <div class="text-xs text-prohealth-500 mt-0.5">
              {{ report.actor_Display || $t('audit.log.unknownActor') }} · {{ formatDate(report.generatedAt, 'datetime') }} · {{ formatSize(report.sizeBytes) }}
              <span v-if="report.entityDisplay"> · {{ report.entityDisplay }}</span>
            </div>
          </div>
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-download"
            size="sm"
            :loading="downloadingUuid === report.uuid"
            @click="downloadReport(report)"
          />
        </li>
      </ul>

      <!-- Paginación -->
      <div class="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t border-prohealth-100 shrink-0">
        <p class="text-xs text-prohealth-500">
          {{ $t('security.reportsAudit.paginationSummary', { shown: data.length, total }) }}
        </p>
        <div class="flex items-center gap-3">
          <UPagination
            v-if="size !== UNPAGED_PAGE_SIZE"
            v-model:page="page"
            :total="total"
            :items-per-page="size"
          />
          <UTooltip :text="$t('catalogs.pageSizeLabel')">
            <USelectMenu
              v-model="size"
              :items="pageSizeItems"
              label-key="label"
              value-key="value"
              icon="i-lucide-list"
              :search-input="false"
              :aria-label="$t('catalogs.pageSizeLabel')"
              class="w-40"
            />
          </UTooltip>
        </div>
      </div>
    </div>
  </div>
</template>
