<script setup lang="ts">
import { buildPageSizeItems, DEFAULT_PAGE_SIZE, UNPAGED_PAGE_SIZE } from '~/utils/pagination'
import type { PlanDto } from '~/types/plans'
import type { SortDirection } from '~/composables/useTableSort'

definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'PLAN_VIEW_ALL',
})

const { t } = useI18n()
const { formatCurrency } = useFormatters()

useSeoMeta({ title: () => t('common.seoTitle', { page: t('nav.items.plans.label') }) })

const plans = usePlans()
const { can } = usePermissions()
const toast = useToast()

const canCreate = computed(() => can('PLAN_CREATE'))
const canUpdate = computed(() => can('PLAN_UPDATE'))
const canDelete = computed(() => can('PLAN_DELETE'))
const canViewAuditChanges = computed(() => can('AUDIT_VIEW_ALL') || can('PLAN_RECORD_AUDIT_VIEW'))
const canViewAuditReports = computed(() => can('REPORT_AUDIT_VIEW_ALL') || can('PLAN_REPORT_AUDIT_VIEW'))
const canViewAudit = computed(() => canViewAuditChanges.value || canViewAuditReports.value)

// ---- List + pagination + search ----
const data = ref<PlanDto[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1) // UPagination is 1-based; the API is 0-based
const size = ref(DEFAULT_PAGE_SIZE)
const pageSizeItems = buildPageSizeItems(t)
const search = ref('')
const includeInactive = ref(false)
// Empty by default: no `sort=` is sent until the user clicks a column, so
// the backend's own default-sort fallback (entity_config → system_configs
// → code ASC) applies.
const sort = useTableSort([])
const hasActiveSort = computed(() => sort.hasActiveSort.value)
const isMultiSort = computed(() => sort.orders.value.length > 1)

async function load() {
  loading.value = true
  try {
    const res = await plans.list({
      page: page.value - 1,
      size: size.value,
      sort: sort.sortParam.value,
      q: search.value.trim() || undefined,
      includeInactive: includeInactive.value,
    })
    data.value = res.content ?? []
    total.value = res.totalElements ?? 0
    // No column clicked yet → reflect the server's own default in the header arrows.
    if (sort.orders.value.length === 0 && res.appliedSort?.length) {
      resetting.value = true
      sort.seedServerDefault(res.appliedSort.map(o => ({ field: o.field, direction: o.direction.toLowerCase() as SortDirection })))
      await nextTick()
      resetting.value = false
    }
  }
  catch {
    // useApi already shows the error toast
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
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, () => {
  if (resetting.value) return
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    load()
  }, 400)
})
watch(includeInactive, () => { if (!resetting.value) { page.value = 1; load() } })
watch(sort.orders, () => { if (!resetting.value) load() }, { deep: true })

async function resetFilters() {
  resetting.value = true
  search.value = ''
  includeInactive.value = false
  sort.reset()
  size.value = DEFAULT_PAGE_SIZE
  page.value = 1
  await nextTick()
  resetting.value = false
  load()
}

onMounted(load)

// Amount in USD, formatted in the VE convention (useFormatters). Empty → '—'.
function money(v?: number | string | null): string {
  if (v === null || v === undefined || v === '') return t('common.empty')
  return formatCurrency(Number(v), 'USD')
}

// Plan type badge label; falls back to the raw value for unknown types.
function typeLabel(type?: string | null): string {
  return type ? t(`plans.types.${type}`, type) : t('common.empty')
}

// ---- Create/edit (shared modal) ----
const formOpen = ref(false)
const editingPlan = ref<PlanDto | null>(null)

function openCreate() {
  editingPlan.value = null
  formOpen.value = true
}

function openEdit(p: PlanDto) {
  editingPlan.value = p
  formOpen.value = true
}

async function onSaved() {
  await load()
}

// ---- Delete ----
const deleteOpen = ref(false)
const deleting = ref(false)
const target = ref<PlanDto | null>(null)
const usageChecking = ref(false)
const usageInfo = ref<{ inUse: boolean, count: number } | null>(null)

async function openDelete(p: PlanDto) {
  target.value = p
  deleteOpen.value = true
  usageChecking.value = true
  usageInfo.value = null
  try {
    usageInfo.value = await plans.usage(p.uuid)
  }
  catch {
    // Fallback: treat as "in use" for safety (soft-deactivate instead of physical delete).
    usageInfo.value = null
  }
  finally {
    usageChecking.value = false
  }
}

async function confirmDelete() {
  if (!target.value) return
  deleting.value = true
  const wasPhysical = usageInfo.value?.inUse === false
  try {
    await plans.remove(target.value.uuid, wasPhysical)
    toast.add({
      title: wasPhysical
        ? t('plans.deletedPermanentToast')
        : t('plans.deactivatedToast'),
      color: wasPhysical ? 'success' : 'info',
      icon: wasPhysical ? 'i-lucide-check-circle' : 'i-lucide-info',
    })
    deleteOpen.value = false
    // If the page is left empty after deleting, step back one.
    if (data.value.length === 1 && page.value > 1) page.value -= 1
    else await load()
  }
  catch {
    // toast handled by useApi
  }
  finally {
    deleting.value = false
  }
}

// Shortcut from the edit modal (PlanFormModal emits `delete`); the modal already
// closed itself, so just open the confirmation.
function onDeleteFromEdit(p: PlanDto) {
  openDelete(p)
}

// ---- Audit ----
const auditOpen = ref(false)
const auditTarget = ref<PlanDto | null>(null)

function openAudit(p: PlanDto) {
  auditTarget.value = p
  auditOpen.value = true
}
</script>

<template>
  <div class="space-y-5">
    <!-- Header -->
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-extrabold text-prohealth-900">{{ t('plans.title') }}</h1>
        <p class="text-sm text-prohealth-700/70 mt-1">
          {{ t('plans.subtitle') }}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <ListRefreshMenu :loading="loading" variant="ghost" @refresh="load" @reset="resetFilters" />
        <ReportPrintButton variant="ghost" />
        <UTooltip :text="canCreate ? t('plans.createTooltip') : t('plans.noPermissionCreate')">
          <UButton
            color="primary"
            variant="outline"
            icon="i-lucide-plus"
            :disabled="!canCreate"
            @click="openCreate"
          >
            {{ t('common.new') }}
          </UButton>
        </UTooltip>
      </div>
    </div>

    <!-- Search -->
    <div class="bg-white rounded-2xl border border-prohealth-100 p-4 flex flex-wrap items-center gap-3">
      <UInput
        v-model="search"
        :placeholder="t('plans.searchPlaceholder')"
        icon="i-lucide-search"
        size="lg"
        class="w-full max-w-md"
      />
      <UCheckbox v-model="includeInactive" :label="$t('catalogs.includeInactive')" class="self-center" />
      <UButton
        v-if="hasActiveSort"
        variant="link"
        color="neutral"
        size="sm"
        icon="i-lucide-list-restart"
        :title="t('common.clearSortHint')"
        @click="sort.reset()"
      >
        {{ t('common.clearSort') }}
      </UButton>
    </div>

    <!-- Table -->
    <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden flex flex-col h-[calc(100vh-19rem)] min-h-[24rem]">
      <div class="overflow-auto flex-1">
        <table class="w-full text-sm">
          <thead class="sticky top-0 bg-white z-10">
            <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('code')">
                {{ t('plans.columns.plan') }}
                <SortIndicator :state="sort.stateOf('code')" :multi-active="isMultiSort" @clear="sort.remove('code')" />
              </th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('type')">
                {{ t('plans.columns.type') }}
                <SortIndicator :state="sort.stateOf('type')" :multi-active="isMultiSort" @clear="sort.remove('type')" />
              </th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('inscriptionFee')">
                {{ t('plans.columns.inscription') }}
                <SortIndicator :state="sort.stateOf('inscriptionFee')" :multi-active="isMultiSort" @clear="sort.remove('inscriptionFee')" />
              </th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('monthlyFee')">
                {{ t('plans.columns.monthly') }}
                <SortIndicator :state="sort.stateOf('monthlyFee')" :multi-active="isMultiSort" @clear="sort.remove('monthlyFee')" />
              </th>
              <th class="px-5 py-3 font-semibold">{{ t('plans.columns.beneficiaries') }}</th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('published')">
                {{ t('plans.columns.published') }}
                <SortIndicator :state="sort.stateOf('published')" :multi-active="isMultiSort" @clear="sort.remove('published')" />
              </th>
              <th class="px-5 py-3 font-semibold text-right">{{ t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-prohealth-100">
            <TableSkeleton v-if="loading" :rows="8" :cols="7" />
            <tr v-else-if="data.length === 0">
              <td colspan="7" class="px-5 py-12 text-center text-prohealth-500">
                <UIcon name="i-lucide-package" class="w-8 h-8 mx-auto mb-2 text-prohealth-300" />
                {{ t('plans.empty') }}
              </td>
            </tr>
            <tr
              v-for="p in data"
              v-else
              :key="p.uuid"
              class="hover:bg-prohealth-50/50 cursor-pointer"
              :class="{ 'opacity-60': p.active === false }"
              @click="navigateTo(`/dashboard/plans/${p.uuid}`)"
            >
              <td class="px-5 py-3">
                <div class="font-semibold text-prohealth-900">{{ p.name }}</div>
                <div class="text-xs text-prohealth-500 font-mono">{{ p.code }}</div>
              </td>
              <td class="px-5 py-3">
                <UBadge color="primary" variant="subtle" size="sm">{{ typeLabel(p.type) }}</UBadge>
              </td>
              <td class="px-5 py-3 text-prohealth-700">{{ money(p.inscriptionFee) }}</td>
              <td class="px-5 py-3 text-prohealth-700">{{ money(p.monthlyFee) }}</td>
              <td class="px-5 py-3 text-prohealth-700">
                {{ t('plans.includedShort', { n: p.includedBeneficiaries }) }}
                <span class="text-prohealth-400">· {{ t('plans.maxShort', { n: p.maxBeneficiaries ?? '∞' }) }}</span>
              </td>
              <td class="px-5 py-3">
                <UBadge v-if="p.active === false" color="neutral" variant="subtle" size="sm">
                  {{ t('plans.status.INACTIVE') }}
                </UBadge>
                <UBadge v-else :color="p.published ? 'success' : 'neutral'" variant="subtle" size="sm">
                  {{ p.published ? t('plans.published') : t('plans.draft') }}
                </UBadge>
              </td>
              <td class="px-5 py-3" @click.stop>
                <div class="flex items-center justify-end gap-1">
                  <UTooltip :text="t('plans.viewDetailTooltip')">
                    <UButton
                      color="neutral"
                      variant="ghost"
                      icon="i-lucide-eye"
                      size="sm"
                      :to="`/dashboard/plans/${p.uuid}`"
                    />
                  </UTooltip>
                  <UTooltip :text="canUpdate ? t('common.edit') : t('plans.noPermissionEdit')">
                    <UButton
                      color="info"
                      variant="ghost"
                      icon="i-lucide-pencil"
                      size="sm"
                      :disabled="!canUpdate"
                      @click="openEdit(p)"
                    />
                  </UTooltip>
                  <ReportPrintButton
                    table-name="plans"
                    :record-uuid="p.uuid"
                    icon-only
                    variant="ghost"
                    size="sm"
                  />
                  <UTooltip v-if="canViewAudit" :text="t('audit.trigger')">
                    <UButton
                      color="neutral"
                      variant="ghost"
                      icon="i-lucide-history"
                      size="sm"
                      @click="openAudit(p)"
                    />
                  </UTooltip>
                  <UTooltip :text="canDelete ? t('common.delete') : t('plans.noPermissionDelete')">
                    <UButton
                      color="error"
                      variant="ghost"
                      icon="i-lucide-trash-2"
                      size="sm"
                      class="ms-2"
                      :disabled="!canDelete"
                      @click="openDelete(p)"
                    />
                  </UTooltip>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="flex items-center flex-wrap justify-between gap-3 px-5 py-3 border-t border-prohealth-100 shrink-0">
        <p class="text-xs text-prohealth-500">
          {{ t('plans.paginationSummary', { shown: data.length, total }) }}
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

    <!-- Create/edit modal (shared with the detail page) -->
    <PlanFormModal v-model:open="formOpen" :plan="editingPlan" @saved="onSaved" @delete="onDeleteFromEdit" />

    <!-- Delete confirmation modal -->
    <UModal v-model:open="deleteOpen" :title="t('plans.deleteTitle')">
      <template #body>
        <div v-if="usageChecking" class="flex items-center gap-2 text-sm text-prohealth-600">
          <UIcon name="i-lucide-loader-2" class="w-4 h-4 animate-spin" />
          {{ t('common.loading') }}
        </div>
        <p v-else class="text-sm text-prohealth-700">
          {{
            usageInfo?.inUse === false
              ? t('plans.deleteConfirmPermanent')
              : t('plans.deleteConfirmDeactivate', { count: usageInfo?.count ?? 0 })
          }}
        </p>
        <div class="flex items-center justify-end gap-3 pt-5">
          <UButton color="neutral" variant="ghost" :disabled="deleting" @click="deleteOpen = false">
            {{ t('common.cancel') }}
          </UButton>
          <UButton color="error" :loading="deleting" :disabled="usageChecking" icon="i-lucide-trash-2" @click="confirmDelete">
            {{ t('common.delete') }}
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Audit modal -->
    <AuditModal
      v-if="auditTarget"
      v-model:open="auditOpen"
      entity-key="plan"
      :entity-uuid="auditTarget.uuid"
      :entity-label="auditTarget.name"
      :entity-code="auditTarget.code"
      :can-view-changes="canViewAuditChanges"
      :can-view-reports="canViewAuditReports"
    />
  </div>
</template>
