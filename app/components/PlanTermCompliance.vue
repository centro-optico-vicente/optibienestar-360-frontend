<script setup lang="ts">
import { membershipStatusColor } from '~/types/memberships'
import type { MembershipTermRowDto, PlanTermSummaryDto, TermCompliance } from '~/types/planTerms'

// "Vigencia de las membresías" section of the plan detail (hub ADR 0034): counts of live memberships that
// comply / differ from the plan's current term rule, a filterable table, and bulk application of the rule.
// The parent mounts it only with MEMBERSHIP_TERM_VIEW_ALL; applying needs MEMBERSHIP_TERM_UPDATE.
const props = defineProps<{ planUuid: string }>()

const { t, locale } = useI18n()
const { can } = usePermissions()
const planTerms = usePlanTerms()

const canApply = computed(() => can('MEMBERSHIP_TERM_UPDATE'))

const summary = ref<PlanTermSummaryDto | null>(null)
const rows = ref<MembershipTermRowDto[]>([])
const total = ref(0)
const loading = ref(true)
const page = ref(1) // UPagination is 1-based; the API is 0-based
const size = 10
const compliance = ref<TermCompliance | ''>('DIFFERS')
const search = ref('')

// Selection survives page changes and filter changes; it is cleared after applying.
const selected = ref<Set<string>>(new Set())
const applyOpen = ref(false)

const complianceOptions = computed(() => [
  { label: t('plans.termCompliance.filter.all'), value: '' },
  { label: t('plans.termCompliance.filter.DIFFERS'), value: 'DIFFERS' },
  { label: t('plans.termCompliance.filter.COMPLIES'), value: 'COMPLIES' },
])

const requiresReinscription = computed(() => summary.value?.planRequiresReinscription === true)
const affectedCount = computed(() => (selected.value.size > 0 ? selected.value.size : summary.value?.differs ?? 0))
const applyDisabled = computed(() => !canApply.value || !requiresReinscription.value || affectedCount.value === 0)

async function loadSummary() {
  try {
    summary.value = await planTerms.summary(props.planUuid)
  }
  catch {
    summary.value = null
  }
}

async function loadRows() {
  loading.value = true
  try {
    const res = await planTerms.list(props.planUuid, {
      page: page.value - 1,
      size,
      compliance: compliance.value,
      q: search.value.trim() || undefined,
    })
    rows.value = res.content
    total.value = res.totalElements
  }
  catch {
    rows.value = []
    total.value = 0
  }
  finally {
    loading.value = false
  }
}

async function reload() {
  await Promise.all([loadSummary(), loadRows()])
}

onMounted(reload)

watch(page, loadRows)
watch(compliance, () => {
  if (page.value !== 1) page.value = 1
  else loadRows()
})
// Typing resets to page 1 — a filtered result set on page 3 would render empty.
const debouncedSearch = useDebounceFn(() => {
  if (page.value !== 1) page.value = 1
  else loadRows()
}, 350)
watch(search, debouncedSearch)

// ---- Selection ----
const allOnPageSelected = computed(() => rows.value.length > 0 && rows.value.every(r => selected.value.has(r.uuid)))
const someOnPageSelected = computed(() => rows.value.some(r => selected.value.has(r.uuid)))

function toggleRow(uuid: string, value: boolean | 'indeterminate') {
  const next = new Set(selected.value)
  if (value === true) next.add(uuid)
  else next.delete(uuid)
  selected.value = next
}

function togglePage(value: boolean | 'indeterminate') {
  const next = new Set(selected.value)
  for (const r of rows.value) {
    if (value === true) next.add(r.uuid)
    else next.delete(r.uuid)
  }
  selected.value = next
}

async function onApplied() {
  selected.value = new Set()
  await reload()
}

/** Snapshot rule of a membership: "Annual expiry: 1 December" / "12 months after enrollment" / open-ended. */
function ruleLabel(row: MembershipTermRowDto): string {
  if (!row.reinscriptionRequired) return t('plans.termCompliance.ruleOpenEnded')
  if (row.termMode === 'FIXED_DATE' && row.termFixedMonth && row.termFixedDay) {
    const month = new Date(2000, row.termFixedMonth - 1, 1).toLocaleString(locale.value, { month: 'long' })
    return t('plans.termCompliance.ruleFixedDate', { day: row.termFixedDay, month })
  }
  if (row.termMode === 'PERIOD' && row.termPeriodMonths) {
    return t('plans.termCompliance.rulePeriod', { n: row.termPeriodMonths })
  }
  return t('common.empty')
}
</script>

<template>
  <div class="bg-white rounded-2xl border border-prohealth-100 p-6 space-y-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 class="font-bold text-prohealth-900">{{ t('plans.termCompliance.title') }}</h2>
        <p class="text-sm text-prohealth-600 mt-1 max-w-2xl">{{ t('plans.termCompliance.subtitle') }}</p>
      </div>
      <UTooltip
        v-if="canApply"
        :text="requiresReinscription ? t('plans.termCompliance.applyTooltip') : t('plans.termCompliance.requiresReinscription')"
      >
        <UButton
          color="primary"
          icon="i-lucide-calendar-check"
          :disabled="applyDisabled"
          @click="applyOpen = true"
        >
          {{ t('plans.termCompliance.apply') }}
          <span v-if="affectedCount > 0 && requiresReinscription">({{ affectedCount }})</span>
        </UButton>
      </UTooltip>
    </div>

    <!-- Plan without re-inscription: informative state, no application possible -->
    <UAlert
      v-if="summary && !requiresReinscription"
      color="info"
      variant="subtle"
      icon="i-lucide-info"
      :title="t('plans.termCompliance.requiresReinscription')"
      :description="t('plans.termCompliance.requiresReinscriptionHelp')"
    />

    <!-- Counts -->
    <dl class="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
      <div class="rounded-xl border border-prohealth-100 p-4">
        <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('plans.termCompliance.counts.total') }}</dt>
        <dd class="text-2xl font-extrabold text-prohealth-900 mt-1">{{ summary?.total ?? '—' }}</dd>
      </div>
      <div class="rounded-xl border border-prohealth-100 p-4">
        <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('plans.termCompliance.counts.complies') }}</dt>
        <dd class="text-2xl font-extrabold text-emerald-700 mt-1">{{ summary?.complies ?? '—' }}</dd>
      </div>
      <div class="rounded-xl border border-prohealth-100 p-4">
        <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('plans.termCompliance.counts.differs') }}</dt>
        <dd class="text-2xl font-extrabold text-amber-700 mt-1">{{ summary?.differs ?? '—' }}</dd>
      </div>
    </dl>

    <!-- Filters -->
    <div class="flex flex-wrap items-center gap-3">
      <USelectMenu
        v-model="compliance"
        :items="complianceOptions"
        label-key="label"
        value-key="value"
        class="w-full sm:w-64"
      />
      <UInput
        v-model="search"
        icon="i-lucide-search"
        :placeholder="t('plans.termCompliance.searchPlaceholder')"
        class="w-full sm:w-72"
      />
      <p v-if="selected.size > 0" class="text-xs text-prohealth-600">
        {{ t('plans.termCompliance.selectedCount', { count: selected.size }) }}
        <UButton color="neutral" variant="link" size="xs" @click="selected = new Set()">
          {{ t('plans.termCompliance.clearSelection') }}
        </UButton>
      </p>
    </div>

    <!-- Table -->
    <div class="rounded-xl border border-prohealth-100 overflow-hidden">
      <div class="overflow-auto">
        <table class="w-full text-sm">
          <thead class="bg-white">
            <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
              <th class="px-4 py-3 w-10">
                <UCheckbox
                  v-if="canApply"
                  :model-value="allOnPageSelected ? true : someOnPageSelected ? 'indeterminate' : false"
                  :disabled="rows.length === 0"
                  :aria-label="t('plans.termCompliance.selectPage')"
                  @update:model-value="togglePage"
                />
              </th>
              <th class="px-4 py-3 font-semibold">{{ t('plans.termCompliance.columns.member') }}</th>
              <th class="px-4 py-3 font-semibold">{{ t('plans.termCompliance.columns.contract') }}</th>
              <th class="px-4 py-3 font-semibold">{{ t('plans.termCompliance.columns.status') }}</th>
              <th class="px-4 py-3 font-semibold">{{ t('plans.termCompliance.columns.enrolledAt') }}</th>
              <th class="px-4 py-3 font-semibold">{{ t('plans.termCompliance.columns.expiresAt') }}</th>
              <th class="px-4 py-3 font-semibold">{{ t('plans.termCompliance.columns.rule') }}</th>
              <th class="px-4 py-3 font-semibold">{{ t('plans.termCompliance.columns.complies') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-prohealth-100">
            <TableSkeleton v-if="loading" :rows="5" :cols="8" />
            <tr v-else-if="rows.length === 0">
              <td colspan="8" class="px-4 py-10 text-center text-prohealth-500">
                <UIcon name="i-lucide-calendar-check" class="w-8 h-8 mx-auto mb-2 text-prohealth-300" />
                {{ t('plans.termCompliance.empty') }}
              </td>
            </tr>
            <tr v-for="r in rows" v-else :key="r.uuid" class="hover:bg-prohealth-50/50 align-top">
              <td class="px-4 py-3">
                <UCheckbox
                  v-if="canApply"
                  :model-value="selected.has(r.uuid)"
                  @update:model-value="(v: boolean | 'indeterminate') => toggleRow(r.uuid, v)"
                />
              </td>
              <td class="px-4 py-3 text-prohealth-800">
                {{ r.member_Display ?? t('common.empty') }}
                <span v-if="r.documentNumber" class="block text-xs text-prohealth-500">{{ r.documentNumber }}</span>
              </td>
              <td class="px-4 py-3 font-mono text-xs text-prohealth-700">{{ r.contractNumber ?? t('common.empty') }}</td>
              <td class="px-4 py-3">
                <UBadge :color="membershipStatusColor(r.status)" variant="subtle" size="sm">
                  {{ r.status_Display ?? r.status }}
                </UBadge>
              </td>
              <td class="px-4 py-3 text-prohealth-600">{{ r.enrolledAt_Display ?? r.enrolledAt ?? t('common.empty') }}</td>
              <td class="px-4 py-3 text-prohealth-600">{{ r.expiresAt_Display ?? r.expiresAt ?? t('plans.termCompliance.noExpiry') }}</td>
              <td class="px-4 py-3 text-prohealth-700">{{ ruleLabel(r) }}</td>
              <td class="px-4 py-3">
                <UBadge :color="r.complies ? 'success' : 'warning'" variant="subtle" size="sm">
                  {{ r.complies ? t('plans.termCompliance.complies') : t('plans.termCompliance.differs') }}
                </UBadge>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="flex items-center justify-between gap-3 px-4 py-3 border-t border-prohealth-100">
        <p class="text-xs text-prohealth-500">{{ t('catalogs.recordCount', { count: total }) }}</p>
        <UPagination v-model:page="page" :total="total" :items-per-page="size" />
      </div>
    </div>

    <PlanTermApplyModal
      v-model:open="applyOpen"
      :plan-uuid="planUuid"
      :count="affectedCount"
      :membership-uuids="[...selected]"
      :suggested-expires-at="summary?.suggestedExpiresAt"
      @applied="onApplied"
    />
  </div>
</template>
