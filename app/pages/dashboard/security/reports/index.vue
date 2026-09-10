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
const { copy: copyUuid } = useClipboardCopy()
const { can } = usePermissions()
const canViewSessions = computed(() => can('AUDIT_VIEW_LOGIN'))

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

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return t('common.empty')
  if (typeof value === 'boolean') return value ? t('common.yes') : t('common.no')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

/** Etiqueta legible del sujeto del reporte: identificador/nombre para RECORD, filtros aplicados para TABLE. */
function reportSubjectLabel(report: ReportAuditLogDto): string | null {
  if (report.reportType === 'RECORD') {
    return report.entityIdentifier || report.entityDisplay || null
  }
  const params = report.parametersJson
  if (!params || Object.keys(params).length === 0) return null
  return Object.entries(params)
    .map(([key, value]) => `${key}: ${displayValue(value)}`)
    .join(' · ')
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

// Guards the filter watchers so "clear filters and refresh" fires a single reload.
const resetting = ref(false)

watch(size, () => { if (!resetting.value) page.value = 1 })
watch([page, size], () => { if (!resetting.value) load() })
watch([entityKeyFilter, actorUuidFilter, formatFilter, dateRange], () => {
  if (!resetting.value) { page.value = 1; load() }
}, { deep: true })

async function resetFilters() {
  resetting.value = true
  entityKeyFilter.value = []
  actorUuidFilter.value = undefined
  formatFilter.value = []
  dateRange.value = defaultTodayRange()
  size.value = DEFAULT_PAGE_SIZE
  page.value = 1
  await nextTick()
  resetting.value = false
  load()
}

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
      <ListRefreshMenu :loading="loading" variant="ghost" @refresh="load" @reset="resetFilters" />
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
              <span class="text-sm font-medium text-prohealth-900 truncate">
                {{ report.reportType === 'RECORD' ? $t('audit.reports.recordType') : $t('audit.reports.tableType') }}
              </span>
              <UBadge v-if="report.entityKey" color="neutral" variant="subtle" size="sm">{{ report.entityKey }}</UBadge>
            </div>
            <div v-if="reportSubjectLabel(report)" class="text-xs text-prohealth-700 mt-0.5 truncate">
              {{ reportSubjectLabel(report) }}
            </div>
            <div v-if="report.fileName" class="text-xs text-prohealth-500 mt-0.5 truncate">
              {{ report.fileName }}
            </div>
            <div class="text-xs text-prohealth-500 mt-0.5 flex items-center gap-1">
              <span class="truncate">
                {{ report.actor_Display || $t('audit.log.unknownActor') }} · {{ formatDate(report.generatedAt, 'datetime') }} · {{ formatSize(report.sizeBytes) }}
              </span>
              <template v-if="report.sessionUuid && canViewSessions">
                <span>·</span>
                <NuxtLink
                  :to="`/dashboard/security/sessions?sessionUuid=${report.sessionUuid}`"
                  class="text-primary-600 hover:underline shrink-0"
                >
                  {{ $t('audit.log.viewSession') }}
                </NuxtLink>
              </template>
              <template v-if="report.entityUuid">
                <span>·</span>
                <span class="font-mono">{{ report.entityUuid }}</span>
                <UButton
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-copy"
                  size="xs"
                  :padded="false"
                  class="p-0.5"
                  @click="copyUuid(report.entityUuid!)"
                />
              </template>
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
