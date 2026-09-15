<script setup lang="ts">
import { buildPageSizeItems, DEFAULT_PAGE_SIZE, UNPAGED_PAGE_SIZE } from '~/utils/pagination'
import { defaultTodayRange } from '~/utils/date'
import { resolveAuditEntityLink } from '~/utils/audit-entity-link'
import type { AuditAction, DataChangeAuditLogDto } from '~/types/audit'

definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'AUDIT_VIEW_ALL',
})

const { t } = useI18n()

useSeoMeta({ title: () => t('security.dataChanges.seoTitle') })

const audit = useAudit()
const { formatDate } = useFormatters()
const { can } = usePermissions()
const canViewSessions = computed(() => can('AUDIT_VIEW_LOGIN'))

// Resolves the log's entityKey/entityUuid to its own screen (see resolveAuditEntityLink).
function entityLink(log: DataChangeAuditLogDto) {
  return resolveAuditEntityLink(log.entityKey, log.entityUuid)
}
function canViewEntity(log: DataChangeAuditLogDto): boolean {
  const link = entityLink(log)
  return link ? can(link.permission) : false
}

const data = ref<DataChangeAuditLogDto[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1) // UPagination es 1-based; la API es 0-based
const size = ref(DEFAULT_PAGE_SIZE)
const pageSizeItems = buildPageSizeItems(t)
const expandedUuids = ref<Set<string>>(new Set())

const entityKeyFilter = ref<string[]>([])
const actorUuidFilter = ref<string | undefined>(undefined)
const ACTION_OPTIONS: { label: string, value: AuditAction }[] = [
  { label: t('audit.actions.CREATE'), value: 'CREATE' },
  { label: t('audit.actions.UPDATE'), value: 'UPDATE' },
  { label: t('audit.actions.DELETE'), value: 'DELETE' },
]
const actionFilter = ref<AuditAction[]>([])
const dateRange = ref(defaultTodayRange())

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
    const useDisplay = key !== 'code'
    fields.push({
      key,
      before: (useDisplay ? (before[`${key}_Display`] as string | undefined) : undefined) ?? b,
      after: (useDisplay ? (after[`${key}_Display`] as string | undefined) : undefined) ?? a,
    })
  }
  return fields
}

function toggleExpand(log: DataChangeAuditLogDto) {
  const next = new Set(expandedUuids.value)
  if (next.has(log.uuid)) next.delete(log.uuid)
  else next.add(log.uuid)
  expandedUuids.value = next
}

async function load() {
  loading.value = true
  try {
    const res = await audit.listDataChanges({
      entityKey: entityKeyFilter.value,
      actorUuid: actorUuidFilter.value,
      action: actionFilter.value,
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

// Guards the filter watchers so "clear filters and refresh" fires a single reload.
const resetting = ref(false)

watch(size, () => { if (!resetting.value) page.value = 1 })
watch([page, size], () => { if (!resetting.value) load() })
watch([entityKeyFilter, actorUuidFilter, actionFilter, dateRange], () => {
  if (!resetting.value) { page.value = 1; load() }
}, { deep: true })

async function resetFilters() {
  resetting.value = true
  entityKeyFilter.value = []
  actorUuidFilter.value = undefined
  actionFilter.value = []
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
        <h1 class="text-2xl font-extrabold text-prohealth-900">{{ $t('security.dataChanges.title') }}</h1>
        <p class="text-sm text-prohealth-700/70 mt-1">
          {{ $t('security.dataChanges.subtitle') }}
        </p>
      </div>
      <ListRefreshMenu :loading="loading" variant="ghost" @refresh="load" @reset="resetFilters" />
    </div>

    <!-- Filtros -->
    <div class="bg-white rounded-2xl border border-prohealth-100 p-4 flex flex-wrap items-center gap-3">
      <AuditEntityKeyMultiSelect v-model="entityKeyFilter" />
      <AuditActorSelect v-model="actorUuidFilter" />
      <USelectMenu
        v-model="actionFilter"
        :items="ACTION_OPTIONS"
        label-key="label"
        value-key="value"
        multiple
        clear
        :placeholder="$t('security.dataChanges.filters.action')"
        class="w-52"
      />
      <AuditDateRangePicker v-model="dateRange" />
    </div>

    <!-- Listado -->
    <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden flex flex-col min-h-[20rem]">
      <div v-if="loading" class="py-10 text-center text-prohealth-500">
        <UIcon name="i-lucide-loader-2" class="w-6 h-6 mx-auto animate-spin" />
      </div>
      <div v-else-if="data.length === 0" class="py-12 text-center text-prohealth-500">
        <UIcon name="i-lucide-history" class="w-8 h-8 mx-auto mb-2 text-prohealth-300" />
        {{ $t('security.dataChanges.empty') }}
      </div>
      <ul v-else class="divide-y divide-prohealth-100">
        <li v-for="log in data" :key="log.uuid">
          <button
            type="button"
            class="w-full text-left px-5 py-3 hover:bg-prohealth-50/50 transition-colors"
            @click="toggleExpand(log)"
          >
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex items-center gap-2 min-w-0">
                <UBadge :color="actionMeta(log.action).color" variant="subtle" size="sm">
                  <UIcon :name="actionMeta(log.action).icon" class="w-3.5 h-3.5 mr-1" />
                  {{ actionLabel(log) }}
                </UBadge>
                <UBadge color="neutral" variant="subtle" size="sm">{{ log.entityKey }}</UBadge>
                <span class="text-sm font-medium truncate" @click.stop>
                  <CommonEntityLinkCell
                    :to="entityLink(log)?.to ?? null"
                    :label="log.entityDisplay || log.entityUuid"
                    :can="canViewEntity(log)"
                  />
                </span>
                <span class="text-xs text-prohealth-500">· {{ log.actor_Display || $t('audit.log.unknownActor') }}</span>
                <NuxtLink
                  v-if="log.sessionUuid && canViewSessions"
                  :to="`/dashboard/security/sessions?sessionUuid=${log.sessionUuid}`"
                  class="text-xs text-primary-600 hover:underline shrink-0"
                  @click.stop
                >
                  {{ $t('audit.log.viewSession') }}
                </NuxtLink>
              </div>
              <span class="text-xs text-prohealth-500 shrink-0">{{ formatDate(log.occurredAt, 'datetime') }}</span>
            </div>

            <div v-if="expandedUuids.has(log.uuid)" class="mt-3 pt-3 border-t border-prohealth-100 space-y-2" @click.stop>
              <div v-if="diffFields(log).length === 0" class="text-xs text-prohealth-500">
                {{ $t('audit.log.noFieldChanges') }}
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
      </ul>

      <!-- Paginación -->
      <div class="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t border-prohealth-100 shrink-0">
        <p class="text-xs text-prohealth-500">
          {{ $t('security.dataChanges.paginationSummary', { shown: data.length, total }) }}
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
