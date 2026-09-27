<script setup lang="ts">
import type { CompetitionType, CompetitiveMetric, CompetitiveRuleDto, CompetitiveRuleListItemDto } from '~/types/competitiveCommissions'
import { COMPETITION_TYPE_OPTIONS, COMPETITIVE_METRIC_OPTIONS } from '~/types/competitiveCommissions'
import type { SortDirection } from '~/composables/useTableSort'

// "Reglas competitivas" tab body (hub plan competitive-commission-rules, Fase 4)
// — kept out of commission-rules/index.vue (already 1800+ lines across 5
// verticals) per the plan's own instruction not to grow that file further.
const { t } = useI18n()
const { can } = usePermissions()
const toast = useToast()
const rulesApi = useCompetitiveCommissionRules()

const canView = computed(() => can('COMPETITIVE_COMMISSION_RULE_VIEW_ALL'))
const canCreate = computed(() => can('COMPETITIVE_COMMISSION_RULE_CREATE'))
const canUpdate = computed(() => can('COMPETITIVE_COMMISSION_RULE_UPDATE'))
const canDelete = computed(() => can('COMPETITIVE_COMMISSION_RULE_DELETE'))
const canViewAudit = computed(() => can('AUDIT_VIEW_ALL') || can('COMMISSION_RECORD_AUDIT_VIEW'))
const canViewAuditReports = computed(() => can('REPORT_AUDIT_VIEW_ALL') || can('COMMISSION_REPORT_AUDIT_VIEW'))

const data = ref<CompetitiveRuleListItemDto[]>([])
const total = ref(0)
const loading = ref(false)
const search = ref('')
const includeInactive = ref(false)
const campaignOnly = ref(false)
const metricFilter = ref<CompetitiveMetric | undefined>(undefined)
const competitionTypeFilter = ref<CompetitionType | undefined>(undefined)
const page = ref(1)
const size = ref(DEFAULT_PAGE_SIZE)
const resetting = ref(false)

const sort = useTableSort([])
const hasActiveSort = computed(() => sort.hasActiveSort.value)
const isMultiSort = computed(() => sort.orders.value.length > 1)

const metricFilterItems = computed(() => [
  { label: t('commissionRules.filters.allMetrics'), value: undefined },
  ...COMPETITIVE_METRIC_OPTIONS.map(o => ({ label: t(o.labelKey), value: o.value })),
])
const competitionTypeFilterItems = computed(() => [
  { label: t('commissionRules.filters.allCompetitionTypes'), value: undefined },
  ...COMPETITION_TYPE_OPTIONS.map(o => ({ label: t(o.labelKey), value: o.value })),
])

async function loadRules() {
  loading.value = true
  try {
    const res = await rulesApi.list({
      page: page.value - 1,
      size: size.value,
      sort: sort.sortParam.value,
      q: search.value.trim() || undefined,
      includeInactive: includeInactive.value,
      campaignLinked: campaignOnly.value || undefined,
      metric: metricFilter.value,
      competitionType: competitionTypeFilter.value,
    })
    data.value = res.content ?? []
    total.value = res.totalElements ?? 0
    if (sort.orders.value.length === 0 && res.appliedSort?.length) {
      resetting.value = true
      sort.seedServerDefault(res.appliedSort.map(o => ({ field: o.field, direction: o.direction.toLowerCase() as SortDirection })))
      await nextTick()
      resetting.value = false
    }
  }
  catch {
    data.value = []
    total.value = 0
  }
  finally {
    loading.value = false
  }
}

onMounted(loadRules)
watch(size, () => { if (!resetting.value) page.value = 1 })
watch([page, size], () => { if (!resetting.value) loadRules() })
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, () => {
  if (resetting.value) return
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { page.value = 1; loadRules() }, 400)
})
watch([includeInactive, campaignOnly, metricFilter, competitionTypeFilter], () => {
  if (resetting.value) return
  page.value = 1
  loadRules()
})
watch(sort.orders, () => { if (!resetting.value) loadRules() }, { deep: true })

async function resetFilters() {
  resetting.value = true
  search.value = ''
  includeInactive.value = false
  campaignOnly.value = false
  metricFilter.value = undefined
  competitionTypeFilter.value = undefined
  sort.reset()
  size.value = DEFAULT_PAGE_SIZE
  page.value = 1
  await nextTick()
  resetting.value = false
  loadRules()
}

const formOpen = ref(false)
const editingRule = ref<CompetitiveRuleDto | null>(null)
function openCreate() {
  editingRule.value = null
  formOpen.value = true
}
async function openEdit(item: CompetitiveRuleListItemDto) {
  if (!canUpdate.value) return
  try {
    editingRule.value = await rulesApi.get(item.uuid)
    formOpen.value = true
  }
  catch { /* useApi already notified */ }
}
async function onSaved() { await loadRules() }

const deleteOpen = ref(false)
const deleting = ref(false)
const deleteTarget = ref<{ uuid: string, name: string } | null>(null)
function openDelete(rule: { uuid: string, name: string }) { deleteTarget.value = rule; deleteOpen.value = true }
async function confirmDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await rulesApi.remove(deleteTarget.value.uuid)
    toast.add({ title: t('commissionRules.competitiveRules.deletedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    deleteOpen.value = false
    await loadRules()
  }
  catch { /* toast handled by useApi */ }
  finally { deleting.value = false }
}

const auditOpen = ref(false)
const auditTarget = ref<{ uuid: string, name: string } | null>(null)
function openAudit(item: { uuid: string, name: string }) {
  auditTarget.value = item
  auditOpen.value = true
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-end gap-2">
      <ListRefreshMenu :loading="loading" variant="ghost" @refresh="loadRules" @reset="resetFilters" />
      <UButton v-if="canCreate" color="primary" variant="outline" icon="i-lucide-plus" @click="openCreate">
        {{ t('common.new') }}
      </UButton>
    </div>

    <div class="bg-white rounded-2xl border border-prohealth-100 p-4 flex flex-wrap items-center gap-3">
      <UInput v-model="search" :placeholder="t('commissionRules.competitiveRules.searchPlaceholder')" icon="i-lucide-search" size="lg" class="w-full max-w-md" />
      <USelectMenu clear v-model="metricFilter" :items="metricFilterItems" label-key="label" value-key="value" icon="i-lucide-target" class="w-56" />
      <USelectMenu clear v-model="competitionTypeFilter" :items="competitionTypeFilterItems" label-key="label" value-key="value" icon="i-lucide-flag" class="w-52" />
      <UCheckbox v-model="includeInactive" :label="$t('catalogs.includeInactive')" class="self-center" />
      <UCheckbox v-model="campaignOnly" :label="t('commissionRules.filters.campaignOnly')" class="self-center" />
      <UButton v-if="hasActiveSort" variant="link" color="neutral" size="sm" icon="i-lucide-list-restart" :title="t('common.clearSortHint')" @click="sort.reset()">
        {{ t('common.clearSort') }}
      </UButton>
    </div>

    <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-prohealth-50/60">
          <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
            <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('name')">
              {{ t('commissionRules.competitiveRules.columns.name') }}
              <SortIndicator :state="sort.stateOf('name')" :multi-active="isMultiSort" @clear="sort.remove('name')" />
            </th>
            <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('metric')">
              {{ t('commissionRules.competitiveRules.columns.metric') }}
              <SortIndicator :state="sort.stateOf('metric')" :multi-active="isMultiSort" @clear="sort.remove('metric')" />
            </th>
            <th class="px-5 py-3 font-semibold">{{ t('commissionRules.competitiveRules.columns.competitionType') }}</th>
            <th class="px-5 py-3 font-semibold">{{ t('commissionRules.competitiveRules.columns.threshold') }}</th>
            <th class="px-5 py-3 font-semibold">{{ t('commissionRules.competitiveRules.columns.positions') }}</th>
            <th class="px-5 py-3 font-semibold">{{ t('commissionRules.bonusRules.columns.campaign') }}</th>
            <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('active')">
              {{ t('catalogs.columns.status') }}
              <SortIndicator :state="sort.stateOf('active')" :multi-active="isMultiSort" @clear="sort.remove('active')" />
            </th>
            <th class="px-5 py-3 font-semibold text-right">{{ t('common.actions') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-prohealth-100">
          <TableSkeleton v-if="loading" :rows="4" :cols="8" />
          <tr v-else-if="data.length === 0">
            <td colspan="8" class="px-5 py-10 text-center text-prohealth-500">{{ t('commissionRules.competitiveRules.empty') }}</td>
          </tr>
          <tr v-for="rule in data" v-else :key="rule.uuid" class="hover:bg-prohealth-50/50"
              :class="{ 'opacity-60': !rule.active, 'cursor-pointer': canUpdate }" @click="canUpdate && openEdit(rule)">
            <td class="px-5 py-3 font-medium text-prohealth-900">{{ rule.name }}</td>
            <td class="px-5 py-3 text-prohealth-600">{{ t(`commissionRules.competitiveRules.metrics.${rule.metric}`) }}</td>
            <td class="px-5 py-3 text-prohealth-600">{{ t(`commissionRules.competitiveRules.competitionTypes.${rule.competitionType}`) }}</td>
            <td class="px-5 py-3 text-prohealth-600">
              <span v-if="rule.thresholdCount != null">{{ rule.thresholdCount }}</span>
              <span v-else-if="rule.thresholdAmount != null">{{ rule.thresholdAmount }} {{ rule.thresholdCurrency_Display }}</span>
              <span v-else class="text-prohealth-300">—</span>
            </td>
            <td class="px-5 py-3 text-prohealth-600">{{ rule.positionsSummary }}</td>
            <td class="px-5 py-3 text-prohealth-600" @click.stop>
              <CommonEntityLinkCell :to="rule.campaign_Uuid ? `/dashboard/campaigns/${rule.campaign_Uuid}` : null" :label="rule.campaign_Display" :can="can('CAMPAIGN_VIEW_ALL')" />
            </td>
            <td class="px-5 py-3">
              <UBadge :color="rule.active ? 'success' : 'neutral'" variant="subtle" size="sm">
                {{ rule.active ? t('catalogs.status.active') : t('catalogs.status.inactive') }}
              </UBadge>
            </td>
            <td class="px-5 py-3" @click.stop>
              <div class="flex items-center justify-end gap-1">
                <UButton v-if="canUpdate" color="info" variant="ghost" icon="i-lucide-pencil" size="sm" @click="openEdit(rule)" />
                <UTooltip v-if="canViewAudit || canViewAuditReports" :text="t('audit.trigger')">
                  <UButton color="neutral" variant="ghost" icon="i-lucide-history" size="sm" @click="openAudit(rule)" />
                </UTooltip>
                <UButton v-if="canDelete" color="error" variant="ghost" icon="i-lucide-trash-2" size="sm" class="ms-2" @click="openDelete(rule)" />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <div class="flex items-center flex-wrap justify-between gap-3 px-5 py-3 border-t border-prohealth-100 shrink-0">
        <p class="text-xs text-prohealth-500">
          {{ t('commissionRules.competitiveRules.paginationSummary', { shown: data.length, total }) }}
        </p>
        <div class="flex items-center gap-3">
          <USelectMenu clear v-model="size" :items="buildPageSizeItems(t)" label-key="label" value-key="value" class="w-32" />
          <UPagination v-model:page="page" :total="total" :items-per-page="size" />
        </div>
      </div>
    </div>

    <CompetitiveRuleFormModal
      v-model:open="formOpen"
      :rule="editingRule"
      @saved="onSaved"
      @delete="openDelete"
    />

    <UModal v-model:open="deleteOpen" :title="t('commissionRules.competitiveRules.deleteTitle')">
      <template #body>
        <p class="text-sm text-prohealth-700">{{ t('commissionRules.competitiveRules.deleteConfirm', { name: deleteTarget?.name ?? '' }) }}</p>
        <div class="flex items-center justify-end gap-3 pt-5">
          <UButton color="neutral" variant="ghost" :disabled="deleting" @click="deleteOpen = false">{{ t('common.cancel') }}</UButton>
          <UButton color="error" icon="i-lucide-trash-2" :loading="deleting" @click="confirmDelete">{{ t('common.delete') }}</UButton>
        </div>
      </template>
    </UModal>

    <AuditModal
      v-if="auditTarget"
      v-model:open="auditOpen"
      entity-key="competitive_commission_rule"
      :entity-uuid="auditTarget.uuid"
      :entity-label="auditTarget.name"
      :can-view-changes="canViewAudit"
      :can-view-reports="canViewAuditReports"
    />
  </div>
</template>
