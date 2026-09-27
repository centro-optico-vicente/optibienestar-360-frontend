<script setup lang="ts">
import { DEFAULT_PAGE_SIZE } from '~/utils/pagination'
import type { SelectItem } from '~/types/options'
import type { CompetitiveManualDecisionDto, CompetitiveTieDto, TieStatus } from '~/types/competitiveCommissions'

// D16 — tie-centric winners board. No combined "board" GET endpoint exists
// (GET /ties is the only list); decision history per tie/rule/period is
// fetched lazily via listDecisions(ruleUuid, periodStart) only when a tie
// card is expanded, instead of upfront for every row.
definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'COMPETITIVE_COMMISSION_AWARD_VIEW_ALL',
})

const { t } = useI18n()
const { formatDate } = useFormatters()
const { can } = usePermissions()
const winnersApi = useCompetitiveCommissionWinners()
const rulesApi = useCompetitiveCommissionRules()

useSeoMeta({ title: () => t('common.seoTitle', { page: t('nav.items.competitiveWinners.label') }) })

const canDecide = computed(() => can('COMPETITIVE_COMMISSION_WINNER_DECIDE'))

async function searchRules(q: string): Promise<SelectItem[]> {
  const res = await rulesApi.list({ q, size: 20 })
  return (res.content ?? []).map(r => ({ label: r.name, value: r.uuid }))
}

function tieStatusColor(status: TieStatus): 'warning' | 'success' | 'error' {
  switch (status) {
    case 'OPEN': return 'warning'
    case 'STALE': return 'error'
    default: return 'success'
  }
}

// ---- Filters ----
const statusFilter = ref<'OPEN_OR_STALE' | TieStatus>('OPEN_OR_STALE')
const ruleUuid = ref<string | undefined>(undefined)

const statusFilterOptions = computed(() => [
  { label: t('competitiveWinners.filters.openOrStale'), value: 'OPEN_OR_STALE' },
  { label: t('competitiveWinners.tieStatuses.OPEN'), value: 'OPEN' },
  { label: t('competitiveWinners.tieStatuses.RESOLVED'), value: 'RESOLVED' },
  { label: t('competitiveWinners.tieStatuses.STALE'), value: 'STALE' },
])

function buildFilter(): string | undefined {
  const clauses: string[] = []
  if (statusFilter.value === 'OPEN_OR_STALE') clauses.push('status=in=(OPEN,STALE)')
  else clauses.push(`status==${statusFilter.value}`)
  if (ruleUuid.value) clauses.push(`rule.uuid==${ruleUuid.value}`)
  return clauses.join(';')
}

// ---- Listing + pagination ----
const data = ref<CompetitiveTieDto[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const size = ref(DEFAULT_PAGE_SIZE)

async function load() {
  loading.value = true
  try {
    const res = await winnersApi.listTies({ page: page.value - 1, size: size.value, filter: buildFilter() })
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

onMounted(load)
watch([page, size], load)
watch([statusFilter, ruleUuid], () => { page.value = 1; load() })

// ---- Per-tie lazy decision history ----
const expandedKeys = ref<Set<string>>(new Set())
const decisionsByKey = ref<Record<string, CompetitiveManualDecisionDto[]>>({})
const loadingHistory = ref<Set<string>>(new Set())

function keyFor(tie: CompetitiveTieDto): string {
  return `${tie.rule_Uuid}:${tie.periodStart}`
}

async function toggleHistory(tie: CompetitiveTieDto) {
  const key = keyFor(tie)
  const next = new Set(expandedKeys.value)
  if (next.has(key)) {
    next.delete(key)
    expandedKeys.value = next
    return
  }
  next.add(key)
  expandedKeys.value = next
  if (!decisionsByKey.value[key] && tie.rule_Uuid) {
    const loadingSet = new Set(loadingHistory.value)
    loadingSet.add(key)
    loadingHistory.value = loadingSet
    try {
      decisionsByKey.value = { ...decisionsByKey.value, [key]: await winnersApi.listDecisions(tie.rule_Uuid, tie.periodStart) }
    }
    finally {
      const doneSet = new Set(loadingHistory.value)
      doneSet.delete(key)
      loadingHistory.value = doneSet
    }
  }
}

// ---- Resolve tie modal ----
const resolveOpen = ref(false)
const resolveTarget = ref<CompetitiveTieDto | null>(null)
function openResolve(tie: CompetitiveTieDto) {
  resolveTarget.value = tie
  resolveOpen.value = true
}
function onResolved() {
  load()
  decisionsByKey.value = {}
  expandedKeys.value = new Set()
}

// ---- Standalone manual decision modal ----
const decisionOpen = ref(false)
function onDecided() {
  load()
  decisionsByKey.value = {}
}

// ---- Revert decision ----
const revertTarget = ref<CompetitiveManualDecisionDto | null>(null)
const revertReason = ref('')
const reverting = ref(false)
const revertModalOpen = computed({
  get: () => revertTarget.value !== null,
  set: (v: boolean) => { if (!v) revertTarget.value = null },
})

function openRevert(decision: CompetitiveManualDecisionDto) {
  revertTarget.value = decision
  revertReason.value = ''
}

async function confirmRevert() {
  if (!revertTarget.value || revertReason.value.trim().length < 10) return
  reverting.value = true
  try {
    await winnersApi.revert(revertTarget.value.uuid, revertReason.value.trim())
    revertTarget.value = null
    decisionsByKey.value = {}
    expandedKeys.value = new Set()
    await load()
  }
  catch { /* useApi already notified */ }
  finally { reverting.value = false }
}
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-extrabold text-prohealth-900 flex items-center gap-2">
          <UIcon name="i-lucide-trophy" class="w-6 h-6 text-prohealth-600" />
          {{ t('nav.items.competitiveWinners.label') }}
        </h1>
        <p class="text-sm text-prohealth-500 mt-1">{{ t('competitiveWinners.pageSubtitle') }}</p>
      </div>
      <div class="flex items-center gap-2">
        <UButton v-if="canDecide" color="primary" icon="i-lucide-gavel" @click="decisionOpen = true">
          {{ t('competitiveWinners.newDecision') }}
        </UButton>
        <UButton color="neutral" variant="outline" icon="i-lucide-refresh-cw" :loading="loading" @click="load">
          {{ t('common.refresh') }}
        </UButton>
      </div>
    </div>

    <div class="bg-white rounded-2xl border border-prohealth-100 p-4">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <UFormField :label="t('competitiveWinners.filters.status')">
          <USelectMenu
            v-model="statusFilter"
            :items="statusFilterOptions"
            label-key="label"
            value-key="value"
            icon="i-lucide-flag"
            class="w-full"
          />
        </UFormField>
        <UFormField :label="t('competitiveWinners.filters.rule')">
          <CommonEntityReferenceSelect v-model="ruleUuid" :search="searchRules" icon="i-lucide-trophy" :placeholder="t('common.select')" />
        </UFormField>
      </div>
    </div>

    <div v-if="loading" class="grid gap-4">
      <USkeleton v-for="i in 3" :key="i" class="h-40 w-full rounded-2xl" />
    </div>

    <div v-else-if="data.length === 0" class="bg-white rounded-2xl border border-prohealth-100 p-12 text-center text-prohealth-500">
      <UIcon name="i-lucide-inbox" class="w-8 h-8 mx-auto mb-2 text-prohealth-300" />
      {{ t('competitiveWinners.empty') }}
    </div>

    <div v-else class="grid gap-4">
      <div v-for="tie in data" :key="tie.uuid" class="bg-white rounded-2xl border border-prohealth-100 p-4 space-y-3">
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p class="font-semibold text-prohealth-900">{{ tie.rule_Display }}</p>
            <p class="text-xs text-prohealth-500 mt-0.5">
              {{ formatDate(tie.periodStart) }} – {{ formatDate(tie.periodEnd) }}
              · {{ t('competitiveWinners.positionFrom', { n: tie.positionFrom }) }}
              · {{ t('competitiveWinners.slots', { n: tie.slots }) }}
            </p>
          </div>
          <UBadge :color="tieStatusColor(tie.status)" variant="subtle">
            {{ t(`competitiveWinners.tieStatuses.${tie.status}`) }} · {{ t('competitiveWinners.candidatesCount', { n: tie.candidates.length, slots: tie.slots }) }}
          </UBadge>
        </div>

        <div v-if="tie.reason" class="text-xs text-prohealth-500 italic">{{ tie.reason }}</div>

        <div class="bg-prohealth-50/50 rounded-xl border border-prohealth-100 overflow-hidden">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400">
                <th class="px-4 py-2 font-semibold">{{ t('competitiveWinners.candidateColumns.promoter') }}</th>
                <th class="px-4 py-2 font-semibold text-right">{{ t('competitiveWinners.candidateColumns.metricValue') }}</th>
                <th class="px-4 py-2 font-semibold">{{ t('competitiveWinners.candidateColumns.achievedAt') }}</th>
                <th class="px-4 py-2 font-semibold text-right">{{ t('competitiveWinners.candidateColumns.transactions') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-prohealth-100">
              <tr v-for="candidate in tie.candidates" :key="candidate.promoter_Uuid">
                <td class="px-4 py-2 font-medium text-prohealth-900">
                  {{ candidate.promoter_Display }}
                  <UBadge v-if="candidate.selected" color="success" variant="subtle" size="xs" class="ml-1">
                    {{ t('competitiveWinners.selected') }}
                  </UBadge>
                </td>
                <td class="px-4 py-2 text-right text-prohealth-700">{{ candidate.metricValue }}</td>
                <td class="px-4 py-2 text-prohealth-600">{{ candidate.achievedAt ? formatDate(candidate.achievedAt, 'datetime') : '—' }}</td>
                <td class="px-4 py-2 text-right text-prohealth-700">{{ candidate.metricTransactionCount }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="flex items-center justify-between">
          <UButton size="xs" variant="ghost" color="neutral" :icon="expandedKeys.has(keyFor(tie)) ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" @click="toggleHistory(tie)">
            {{ t('competitiveWinners.history') }}
          </UButton>
          <UButton v-if="canDecide && tie.status !== 'RESOLVED'" size="sm" color="primary" icon="i-lucide-gavel" @click="openResolve(tie)">
            {{ t('competitiveWinners.resolve') }}
          </UButton>
        </div>

        <div v-if="expandedKeys.has(keyFor(tie))" class="border-t border-prohealth-100 pt-3">
          <USkeleton v-if="loadingHistory.has(keyFor(tie))" class="h-16 w-full rounded-xl" />
          <p v-else-if="!decisionsByKey[keyFor(tie)]?.length" class="text-xs text-prohealth-400">
            {{ t('competitiveWinners.decisionHistory.empty') }}
          </p>
          <ul v-else class="space-y-2">
            <li
              v-for="decision in decisionsByKey[keyFor(tie)]"
              :key="decision.uuid"
              class="flex items-center justify-between gap-3 text-sm bg-prohealth-50/40 rounded-lg px-3 py-2"
            >
              <div>
                <span class="font-medium text-prohealth-800">{{ t(`competitiveWinners.decisionKinds.${decision.kind}`) }}</span>
                <span class="text-prohealth-500"> — {{ decision.promoter_Display }}</span>
                <span v-if="decision.replacedPromoter_Display" class="text-prohealth-500"> → {{ decision.replacedPromoter_Display }}</span>
                <UBadge v-if="decision.status !== 'ACTIVE'" color="neutral" variant="subtle" size="xs" class="ml-2">
                  {{ t(`competitiveWinners.decisionStatuses.${decision.status}`) }}
                </UBadge>
                <p class="text-xs text-prohealth-400 mt-0.5">{{ decision.reason }}</p>
              </div>
              <UButton
                v-if="canDecide && decision.status === 'ACTIVE'"
                size="xs"
                color="error"
                variant="ghost"
                icon="i-lucide-undo-2"
                @click="openRevert(decision)"
              >
                {{ t('competitiveWinners.decisionHistory.revert') }}
              </UButton>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <div v-if="!loading && total > size" class="flex justify-center">
      <UPagination v-model:page="page" :total="total" :items-per-page="size" />
    </div>

    <CompetitiveTieResolveModal v-model:open="resolveOpen" :tie="resolveTarget" @done="onResolved" />
    <CompetitiveWinnerDecisionModal v-model:open="decisionOpen" @done="onDecided" />

    <UModal v-model:open="revertModalOpen" :title="t('competitiveWinners.decisionHistory.revertTitle')">
      <template #body>
        <UFormField :label="t('competitiveWinners.decisionHistory.revertReason')" required :help="t('competitiveWinners.reasonHelp')">
          <UTextarea v-model="revertReason" :rows="3" class="w-full" />
        </UFormField>
      </template>
      <template #footer>
        <div class="w-full flex items-center justify-end gap-3">
          <UButton color="neutral" variant="ghost" :disabled="reverting" @click="revertTarget = null">{{ t('common.cancel') }}</UButton>
          <UButton color="error" :loading="reverting" :disabled="revertReason.trim().length < 10" @click="confirmRevert">
            {{ t('competitiveWinners.decisionHistory.revert') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
