<script setup lang="ts">
import { DEFAULT_PAGE_SIZE } from '~/utils/pagination'
import type { AuditAction, DataChangeAuditLogDto, ReportAuditLogDto } from '~/types/audit'

const props = withDefaults(defineProps<{
  open: boolean
  entityKey: string
  entityUuid: string
  /** Título mostrado en el modal, ej. el nombre/código del registro. */
  entityLabel?: string | null
  /** Código legible del registro (ej. plan.code), si existe. */
  entityCode?: string | null
  /** Si el usuario tiene permiso para ver la bitácora de cambios de esta entidad. */
  canViewChanges?: boolean
  /** Si el usuario tiene permiso para ver el historial de reportes de esta entidad. */
  canViewReports?: boolean
}>(), {
  canViewChanges: true,
  canViewReports: true,
})

const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const isOpen = computed({
  get: () => props.open,
  set: value => emit('update:open', value),
})

const { t } = useI18n()
const { formatDate, formatNumber } = useFormatters()
const audit = useAudit()
const toast = useToast()
const { copied: uuidCopied, copy: copyUuid } = useClipboardCopy()
const { copied: codeCopied, copy: copyCode } = useClipboardCopy()

const tabs = computed(() => [
  ...(props.canViewChanges ? [{ value: 'log', label: t('audit.tabs.log'), icon: 'i-lucide-history' }] : []),
  ...(props.canViewReports ? [{ value: 'reports', label: t('audit.tabs.reports'), icon: 'i-lucide-file-text' }] : []),
])
const activeTab = ref(props.canViewChanges ? 'log' : 'reports')

// ---- Bitácora de cambios ----
const changes = ref<DataChangeAuditLogDto[]>([])
const changesTotal = ref(0)
const changesPage = ref(1)
const changesLoading = ref(false)
const expandedUuids = ref<Set<string>>(new Set())

async function loadChanges() {
  changesLoading.value = true
  try {
    const res = await audit.listDataChanges({
      entityKey: props.entityKey,
      entityUuid: props.entityUuid,
      page: changesPage.value - 1,
      size: DEFAULT_PAGE_SIZE,
    })
    changes.value = res.content ?? []
    changesTotal.value = res.totalElements ?? 0
  }
  catch {
    changes.value = []
    changesTotal.value = 0
  }
  finally {
    changesLoading.value = false
  }
}

function toggleExpand(log: DataChangeAuditLogDto) {
  const next = new Set(expandedUuids.value)
  if (next.has(log.uuid)) next.delete(log.uuid)
  else next.add(log.uuid)
  expandedUuids.value = next
}

function expandAll() {
  expandedUuids.value = new Set(changes.value.map(l => l.uuid))
}

function collapseAll() {
  expandedUuids.value = new Set()
}

const ACTION_META: Record<AuditAction, { icon: string, color: 'success' | 'warning' | 'error' }> = {
  CREATE: { icon: 'i-lucide-plus-circle', color: 'success' },
  UPDATE: { icon: 'i-lucide-pencil', color: 'warning' },
  DELETE: { icon: 'i-lucide-trash-2', color: 'error' },
}

function actionMeta(action: AuditAction) {
  return ACTION_META[action] ?? ACTION_META.UPDATE
}

function actionLabel(log: DataChangeAuditLogDto): string {
  return log.action_Display || t(`audit.actions.${log.action}`, log.action)
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return t('common.empty')
  if (typeof value === 'boolean') return value ? t('common.yes') : t('common.no')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

/** Campos combinados de before/after (unión de claves, ignorando siblings `_Display`). */
function diffFields(log: DataChangeAuditLogDto): Array<{ key: string, before: unknown, after: unknown }> {
  const before = log.beforeJson ?? {}
  const after = log.afterJson ?? {}
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  const fields: Array<{ key: string, before: unknown, after: unknown }> = []
  for (const key of keys) {
    if (key.endsWith('_Display')) continue
    const b = before[key]
    const a = after[key]
    if (JSON.stringify(b) === JSON.stringify(a)) continue
    // "code" is a natural key (UPPER_SNAKE_CASE), never an enum — always show the raw
    // value, ignoring any `_Display` (older audit rows may carry a stale humanized one
    // from a backend bug that mistook a code value for an enum constant).
    const useDisplay = key !== 'code'
    fields.push({
      key,
      before: (useDisplay ? (before[`${key}_Display`] as string | undefined) : undefined) ?? b,
      after: (useDisplay ? (after[`${key}_Display`] as string | undefined) : undefined) ?? a,
    })
  }
  return fields
}

// ---- Historial de reportes ----
const reports = ref<ReportAuditLogDto[]>([])
const reportsTotal = ref(0)
const reportsPage = ref(1)
const reportsLoading = ref(false)
const downloadingUuid = ref<string | null>(null)

async function loadReports() {
  reportsLoading.value = true
  try {
    const res = await audit.listReports({
      entityKey: props.entityKey,
      entityUuid: props.entityUuid,
      page: reportsPage.value - 1,
      size: DEFAULT_PAGE_SIZE,
    })
    reports.value = res.content ?? []
    reportsTotal.value = res.totalElements ?? 0
  }
  catch {
    reports.value = []
    reportsTotal.value = 0
  }
  finally {
    reportsLoading.value = false
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

function formatSize(bytes?: number | null): string {
  if (!bytes) return t('common.empty')
  const kb = bytes / 1024
  return kb < 1024 ? `${formatNumber(Math.round(kb))} KB` : `${formatNumber(Math.round(kb / 1024))} MB`
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

watch(changesPage, loadChanges)
watch(reportsPage, loadReports)

// Each tab's data is fetched only once it's actually viewed — opening the modal
// (which defaults to the "log" tab) shouldn't also fire the "reports" request.
const changesLoaded = ref(false)
const reportsLoaded = ref(false)

watch(activeTab, (tab) => {
  if (tab === 'log' && !changesLoaded.value) { changesLoaded.value = true; loadChanges() }
  if (tab === 'reports' && !reportsLoaded.value) { reportsLoaded.value = true; loadReports() }
})

// Reset on open / when the modal is reused for a different entity.
watch([() => props.open, () => props.entityUuid], ([open]) => {
  if (!open) return
  expandedUuids.value = new Set()
  changesPage.value = 1
  reportsPage.value = 1
  changesLoaded.value = false
  reportsLoaded.value = false
  if (props.canViewChanges) {
    activeTab.value = 'log'
    changesLoaded.value = true
    loadChanges()
  }
  else if (props.canViewReports) {
    activeTab.value = 'reports'
    reportsLoaded.value = true
    loadReports()
  }
}, { immediate: true })
</script>

<template>
  <UModal v-model:open="isOpen" :title="t('audit.title')" :description="entityLabel || undefined" :ui="{ content: 'max-w-3xl' }">
    <template #body>
      <div class="flex flex-wrap items-center gap-x-4 gap-y-1 -mt-2 mb-4 text-xs text-prohealth-500">
        <button v-if="entityCode" type="button" class="flex items-center gap-1 hover:text-prohealth-700" @click="copyCode(entityCode)">
          <span class="font-medium text-prohealth-400">{{ t('audit.entityCode') }}:</span>
          <span class="font-mono">{{ entityCode }}</span>
          <UIcon :name="codeCopied ? 'i-lucide-check' : 'i-lucide-copy'" class="w-3.5 h-3.5" />
        </button>
        <UTooltip :text="t('audit.entityUuidHint')">
          <button type="button" class="flex items-center gap-1 hover:text-prohealth-700" @click="copyUuid(entityUuid)">
            <span class="font-medium text-prohealth-400">{{ t('audit.entityUuid') }}:</span>
            <span class="font-mono">{{ entityUuid }}</span>
            <UIcon :name="uuidCopied ? 'i-lucide-check' : 'i-lucide-copy'" class="w-3.5 h-3.5" />
          </button>
        </UTooltip>
      </div>

      <UTabs v-if="tabs.length > 1" v-model="activeTab" :items="tabs" :content="false" />

      <!-- ============ Bitácora de cambios ============ -->
      <div v-show="activeTab === 'log'" class="mt-4">
        <div class="flex items-center justify-end gap-3 mb-2">
          <UButton v-if="changes.length > 0" color="neutral" variant="link" size="xs" @click="expandAll">
            {{ t('audit.log.expandAll') }}
          </UButton>
          <UButton v-if="changes.length > 0" color="neutral" variant="link" size="xs" @click="collapseAll">
            {{ t('audit.log.collapseAll') }}
          </UButton>
          <UTooltip :text="t('audit.refresh')">
            <UButton color="neutral" variant="ghost" icon="i-lucide-refresh-cw" size="sm" :loading="changesLoading" @click="loadChanges()" />
          </UTooltip>
        </div>
        <div v-if="changesLoading" class="py-10 text-center text-prohealth-500">
          <UIcon name="i-lucide-loader-2" class="w-6 h-6 mx-auto animate-spin" />
        </div>
        <div v-else-if="changes.length === 0" class="py-10 text-center text-prohealth-500">
          <UIcon name="i-lucide-history" class="w-8 h-8 mx-auto mb-2 text-prohealth-300" />
          {{ t('audit.log.empty') }}
        </div>
        <ol v-else class="relative border-l border-prohealth-100 ml-3 space-y-5 max-h-[28rem] overflow-y-auto pr-2">
          <li v-for="log in changes" :key="log.uuid" class="ml-4">
            <span
              class="absolute -translate-x-1/2 flex items-center justify-center w-6 h-6 rounded-full ring-4 ring-white"
              :class="{
                'bg-emerald-100 text-emerald-600': actionMeta(log.action).color === 'success',
                'bg-amber-100 text-amber-600': actionMeta(log.action).color === 'warning',
                'bg-red-100 text-red-600': actionMeta(log.action).color === 'error',
              }"
            >
              <UIcon :name="actionMeta(log.action).icon" class="w-3.5 h-3.5" />
            </span>
            <button
              type="button"
              class="w-full text-left rounded-xl border border-prohealth-100 hover:bg-prohealth-50/50 px-4 py-3 transition-colors"
              @click="toggleExpand(log)"
            >
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="flex items-center gap-2">
                  <UBadge :color="actionMeta(log.action).color" variant="subtle" size="sm">
                    {{ actionLabel(log) }}
                  </UBadge>
                  <span class="text-sm font-medium text-prohealth-900">
                    {{ log.actor_Display || t('audit.log.unknownActor') }}
                  </span>
                </div>
                <span class="text-xs text-prohealth-500">{{ formatDate(log.occurredAt, 'datetime') }}</span>
              </div>

              <div v-if="expandedUuids.has(log.uuid)" class="mt-3 pt-3 border-t border-prohealth-100 space-y-2" @click.stop>
                <div v-if="diffFields(log).length === 0" class="text-xs text-prohealth-500">
                  {{ t('audit.log.noFieldChanges') }}
                </div>
                <div v-for="field in diffFields(log)" :key="field.key" class="text-sm">
                  <div class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ field.key }}</div>
                  <div class="flex flex-wrap items-center gap-2 mt-0.5">
                    <span v-if="log.action !== 'CREATE'" class="text-red-600 line-through">{{ displayValue(field.before) }}</span>
                    <UIcon v-if="log.action === 'UPDATE'" name="i-lucide-arrow-right" class="w-3.5 h-3.5 text-prohealth-400" />
                    <span v-if="log.action !== 'DELETE'" class="text-emerald-700">{{ displayValue(field.after) }}</span>
                  </div>
                </div>
              </div>
            </button>
          </li>
        </ol>

        <div v-if="changesTotal > DEFAULT_PAGE_SIZE" class="flex justify-center pt-4">
          <UPagination v-model:page="changesPage" :total="changesTotal" :items-per-page="DEFAULT_PAGE_SIZE" />
        </div>
      </div>

      <!-- ============ Historial de reportes ============ -->
      <div v-show="activeTab === 'reports'" class="mt-4">
        <div class="flex items-center justify-end mb-2">
          <UTooltip :text="t('audit.refresh')">
            <UButton color="neutral" variant="ghost" icon="i-lucide-refresh-cw" size="sm" :loading="reportsLoading" @click="loadReports()" />
          </UTooltip>
        </div>
        <div v-if="reportsLoading" class="py-10 text-center text-prohealth-500">
          <UIcon name="i-lucide-loader-2" class="w-6 h-6 mx-auto animate-spin" />
        </div>
        <div v-else-if="reports.length === 0" class="py-10 text-center text-prohealth-500">
          <UIcon name="i-lucide-file-text" class="w-8 h-8 mx-auto mb-2 text-prohealth-300" />
          {{ t('audit.reports.empty') }}
        </div>
        <ul v-else class="divide-y divide-prohealth-100 max-h-[28rem] overflow-y-auto">
          <li v-for="report in reports" :key="report.uuid" class="py-3 flex items-center justify-between gap-3">
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <UBadge color="primary" variant="subtle" size="sm">{{ report.format }}</UBadge>
                <span class="text-sm font-medium text-prohealth-900 truncate">
                  {{ report.reportType === 'RECORD' ? t('audit.reports.recordType') : t('audit.reports.tableType') }}
                </span>
              </div>
              <div v-if="reportSubjectLabel(report)" class="text-xs text-prohealth-700 mt-0.5 truncate">
                {{ reportSubjectLabel(report) }}
              </div>
              <div v-if="report.fileName" class="text-xs text-prohealth-500 mt-0.5 truncate">
                {{ report.fileName }}
              </div>
              <div class="text-xs text-prohealth-500 mt-0.5">
                {{ report.actor_Display || t('audit.log.unknownActor') }} · {{ formatDate(report.generatedAt, 'datetime') }} · {{ formatSize(report.sizeBytes) }}
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

        <div v-if="reportsTotal > DEFAULT_PAGE_SIZE" class="flex justify-center pt-4">
          <UPagination v-model:page="reportsPage" :total="reportsTotal" :items-per-page="DEFAULT_PAGE_SIZE" />
        </div>
      </div>
    </template>
  </UModal>
</template>
