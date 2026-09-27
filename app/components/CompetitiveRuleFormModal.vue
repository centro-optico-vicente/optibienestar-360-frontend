<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type {
  AchievementDateBasis,
  CompetitionType,
  CompetitiveMetric,
  CompetitivePeriodAxisStrategy,
  CompetitiveRuleDto,
  CompetitiveRuleRequest,
  TiePolicy,
} from '~/types/competitiveCommissions'
import {
  ACHIEVEMENT_DATE_BASIS_OPTIONS,
  COMPETITION_TYPE_OPTIONS,
  COMPETITIVE_METRIC_OPTIONS,
  COMPETITIVE_PERIOD_AXIS_OPTIONS,
  COMPETITIVE_REWARD_TYPE_OPTIONS,
  isCountMetric,
  TIE_POLICY_OPTIONS,
} from '~/types/competitiveCommissions'
import type { SelectItem } from '~/types/options'
import { READONLY_FIELD_UI } from '~/utils/formFieldStyles'

// Create/edit form for a competitive commission rule (FIRST_TO_REACH / RANKING
// by position — hub plan competitive-commission-rules). PUT is a full replace.
const props = defineProps<{
  open: boolean
  rule?: CompetitiveRuleDto | null
  campaignUuid?: string | null
  campaignDisplay?: string | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'saved': [rule: CompetitiveRuleDto]
  'delete': [rule: CompetitiveRuleDto]
}>()

const { t } = useI18n()
const rulesApi = useCompetitiveCommissionRules()
const campaignsApi = useCampaigns()
const currencies = useCurrencies()
const promoterTypeOptions = useCatalogOptions('promoter-types')
const hierarchyApi = usePromoterHierarchy()
const toast = useToast()

const promoterTypeItems = ref<SelectItem[]>([])
const loadingPromoterTypes = ref(false)
async function loadPromoterTypeOptions() {
  loadingPromoterTypes.value = true
  try {
    const options = await promoterTypeOptions.options({ limit: 100 })
    promoterTypeItems.value = options.map(o => ({ label: o.label, value: o.uuid }))
  }
  catch { promoterTypeItems.value = [] }
  finally { loadingPromoterTypes.value = false }
}

const rankItems = ref<SelectItem[]>([])
const loadingRanks = ref(false)
async function loadRankOptions() {
  loadingRanks.value = true
  try {
    const options = await hierarchyApi.rankOptions({ limit: 100 })
    rankItems.value = options.map(o => ({ label: o.label, value: o.uuid }))
  }
  catch { rankItems.value = [] }
  finally { loadingRanks.value = false }
}

const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})

const currencyItems = ref<SelectItem[]>([])
const loadingCurrencies = ref(false)
async function loadCurrencyOptions() {
  loadingCurrencies.value = true
  try {
    const options = await currencies.options()
    currencyItems.value = options.filter(o => o.code).map(o => ({ label: o.label, value: o.uuid }))
  }
  catch { currencyItems.value = [] }
  finally { loadingCurrencies.value = false }
}

async function searchCampaigns(q: string): Promise<SelectItem[]> {
  const res = await campaignsApi.list({ q, size: 20 })
  return (res.content ?? []).map(c => ({ label: c.name, value: c.uuid }))
}
function goToCampaign(to: string) {
  isOpen.value = false
  navigateTo(to)
}
function goToCurrency(to: string) {
  isOpen.value = false
  navigateTo(to)
}
function isoToDatetimeLocal(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function datetimeLocalToIso(value: string): string | undefined {
  if (!value) return undefined
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
}

const suppressCampaignAutofill = ref(false)
const mode = computed<'create' | 'edit'>(() => (props.rule ? 'edit' : 'create'))
const campaignLocked = computed(() => mode.value === 'create' && !!props.campaignUuid)
const isSubmitting = ref(false)
const formRef = ref<{ submit: () => Promise<void> } | null>(null)

const metricOptions = computed(() => COMPETITIVE_METRIC_OPTIONS.map(o => ({ label: t(o.labelKey), value: o.value })))
const competitionTypeOptions = computed(() => COMPETITION_TYPE_OPTIONS.map(o => ({ label: t(o.labelKey), value: o.value })))
const dateBasisOptions = computed(() => ACHIEVEMENT_DATE_BASIS_OPTIONS.map(o => ({ label: t(o.labelKey), value: o.value })))
const tiePolicyOptions = computed(() => TIE_POLICY_OPTIONS.map(o => ({ label: t(o.labelKey), value: o.value })))
const rewardTypeOptions = computed(() => COMPETITIVE_REWARD_TYPE_OPTIONS.map(o => ({ label: t(o.labelKey), value: o.value })))

interface FormState {
  name: string
  description: string
  metric: CompetitiveMetric | undefined
  competitionType: CompetitionType | undefined
  thresholdCount: string
  thresholdAmount: string
  thresholdCurrencyUuid: string
  achievementDateBasis: AchievementDateBasis | undefined
  tiePolicy: TiePolicy | undefined
  competitionGroup: string
  groupPriority: string
  accrualPeriodStrategy: CompetitivePeriodAxisStrategy | undefined
  accrualPeriodAnchor: string
  partialSettlementPeriodStrategy: CompetitivePeriodAxisStrategy | undefined
  partialSettlementPeriodAnchor: string
  finalSettlementPeriodStrategy: CompetitivePeriodAxisStrategy | undefined
  finalSettlementPeriodAnchor: string
  retroactiveSettlementPeriodStrategy: CompetitivePeriodAxisStrategy | undefined
  retroactiveSettlementPeriodAnchor: string
  confirmationDelayDays: string
  includeSystemPromoters: boolean
  promoterTypeUuids: string[]
  rankUuids: string[]
  campaignUuid: string
  startsAt: string
  endsAt: string
}

const state = reactive<FormState>({
  name: '',
  description: '',
  metric: 'NEW_SUBSCRIBERS',
  competitionType: 'FIRST_TO_REACH',
  thresholdCount: '',
  thresholdAmount: '',
  thresholdCurrencyUuid: '',
  achievementDateBasis: 'APPROVED_AT',
  tiePolicy: 'MANUAL',
  competitionGroup: '',
  groupPriority: '',
  accrualPeriodStrategy: 'MONTHLY',
  accrualPeriodAnchor: '',
  partialSettlementPeriodStrategy: 'MONTHLY',
  partialSettlementPeriodAnchor: '',
  finalSettlementPeriodStrategy: 'MONTHLY',
  finalSettlementPeriodAnchor: '',
  retroactiveSettlementPeriodStrategy: 'MONTHLY',
  retroactiveSettlementPeriodAnchor: '',
  confirmationDelayDays: '0',
  includeSystemPromoters: false,
  promoterTypeUuids: [],
  rankUuids: [],
  campaignUuid: '',
  startsAt: '',
  endsAt: '',
})

const positionsEditor = usePositionRangesEditor()

const isCountMetricSelected = computed(() => isCountMetric(state.metric))
const isRanking = computed(() => state.competitionType === 'RANKING')
/** D8/D14/D15: END_DATE is only legal on an axis when the rule actually has an end date. */
const hasEndDate = computed(() => !!state.endsAt)

const axisOptionsBase = computed(() => COMPETITIVE_PERIOD_AXIS_OPTIONS
  .filter(o => o.value !== 'END_DATE' || hasEndDate.value)
  .map(o => ({ label: t(o.labelKey), value: o.value })))

/** RANKING (D14): partial/final only ever offer "at accrual close" or END_DATE — never a finer cadence. */
const rankingCloseOptions = computed(() => {
  const items = [{ label: t('commissionRules.competitiveRules.form.atAccrualClose'), value: state.accrualPeriodStrategy ?? 'MONTHLY' }]
  if (hasEndDate.value) items.push({ label: t('commissionRules.competitiveRules.periodAxis.END_DATE'), value: 'END_DATE' as const })
  return items
})

const { retroactiveEnabled, retroactiveOptions: retroactiveOptionsBase } = useSettlementAxes(
  toRef(state, 'accrualPeriodStrategy'),
  toRef(state, 'partialSettlementPeriodStrategy'),
  toRef(state, 'retroactiveSettlementPeriodStrategy'),
  axisOptionsBase,
)
/** useSettlementAxes doesn't know about END_DATE — append it manually when the rule has one. */
const retroactiveOptions = computed(() => hasEndDate.value
  ? [...retroactiveOptionsBase.value, { label: t('commissionRules.competitiveRules.periodAxis.END_DATE'), value: 'END_DATE' }]
  : retroactiveOptionsBase.value)

type AnchorKind = 'weekday' | 'monthday' | 'none'
function anchorKindFor(strategy: CompetitivePeriodAxisStrategy | undefined): AnchorKind {
  if (!strategy || strategy === 'DAILY' || strategy === 'END_DATE') return 'none'
  if (strategy === 'WEEKLY' || strategy === 'BIWEEKLY') return 'weekday'
  return 'monthday'
}
const weekdayOptions = computed(() => [
  { label: t('commissionRules.bonusRules.form.weekday.1'), value: '1' },
  { label: t('commissionRules.bonusRules.form.weekday.2'), value: '2' },
  { label: t('commissionRules.bonusRules.form.weekday.3'), value: '3' },
  { label: t('commissionRules.bonusRules.form.weekday.4'), value: '4' },
  { label: t('commissionRules.bonusRules.form.weekday.5'), value: '5' },
  { label: t('commissionRules.bonusRules.form.weekday.6'), value: '6' },
  { label: t('commissionRules.bonusRules.form.weekday.7'), value: '7' },
])
const showAdvanced = ref(false)

// RANKING (D14): partial/final always track accrual (or END_DATE) — no independent cadence, retroactive disabled.
watch([() => state.competitionType, () => state.accrualPeriodStrategy], ([type, accrual]) => {
  if (type !== 'RANKING') return
  if (state.partialSettlementPeriodStrategy !== 'END_DATE') state.partialSettlementPeriodStrategy = accrual
  if (state.finalSettlementPeriodStrategy !== 'END_DATE') state.finalSettlementPeriodStrategy = accrual
  state.retroactiveSettlementPeriodStrategy = accrual ?? 'MONTHLY'
})

watch(() => state.campaignUuid, async (uuid) => {
  if (suppressCampaignAutofill.value || !uuid) return
  try {
    const campaign = await campaignsApi.get(uuid)
    state.startsAt = isoToDatetimeLocal(campaign.startsAt)
    state.endsAt = isoToDatetimeLocal(campaign.endsAt)
  }
  catch { /* useApi already notified */ }
})

const schema = computed(() => {
  const money = z.string().regex(/^\d+(\.\d{1,2})?$/, t('commissionRules.form.invalidAmount'))
  const int = z.string().regex(/^\d+$/, t('commissionRules.form.integersOnly'))
  const anchor = z.string().optional().refine(v => !v || /^\d{1,2}$/.test(v), t('commissionRules.form.integersOnly'))
  return z.object({
    name: z.string().min(3, t('validation.minChars', { n: 3 })).max(150, t('validation.maxChars', { n: 150 })),
    description: z.string().optional(),
    metric: z.string({ message: t('validation.required') }).min(1, t('validation.required')),
    competitionType: z.string({ message: t('validation.required') }).min(1, t('validation.required')),
    thresholdCount: !isCountMetricSelected.value ? z.string().optional() : z.string().optional().refine(v => !v || /^\d+$/.test(v), t('commissionRules.form.integersOnly')),
    thresholdAmount: isCountMetricSelected.value ? z.string().optional() : z.string().optional().refine(v => !v || /^\d+(\.\d{1,2})?$/.test(v), t('commissionRules.form.invalidAmount')),
    achievementDateBasis: z.string({ message: t('validation.required') }).min(1, t('validation.required')),
    tiePolicy: z.string({ message: t('validation.required') }).min(1, t('validation.required')),
    accrualPeriodStrategy: z.string({ message: t('validation.required') }).min(1, t('validation.required')),
    accrualPeriodAnchor: anchor,
    partialSettlementPeriodStrategy: z.string({ message: t('validation.required') }).min(1, t('validation.required')),
    partialSettlementPeriodAnchor: anchor,
    finalSettlementPeriodStrategy: z.string({ message: t('validation.required') }).min(1, t('validation.required')),
    finalSettlementPeriodAnchor: anchor,
    retroactiveSettlementPeriodStrategy: z.string({ message: t('validation.required') }).min(1, t('validation.required')),
    retroactiveSettlementPeriodAnchor: anchor,
    confirmationDelayDays: int,
  })
})

const editSnapshot = ref('')
function snapEditState() { return JSON.stringify({ ...state, positions: positionsEditor.ranges.value }) }
const isEditDirty = computed(() => editSnapshot.value !== '' && snapEditState() !== editSnapshot.value)
const discardConfirmOpen = ref(false)
const reloading = ref(false)

function populateFrom(rule: CompetitiveRuleDto | null) {
  suppressCampaignAutofill.value = true
  if (!rule) {
    editSnapshot.value = ''
    state.name = ''
    state.description = ''
    state.metric = 'NEW_SUBSCRIBERS'
    state.competitionType = 'FIRST_TO_REACH'
    state.thresholdCount = ''
    state.thresholdAmount = ''
    state.thresholdCurrencyUuid = ''
    state.achievementDateBasis = 'APPROVED_AT'
    state.tiePolicy = 'MANUAL'
    state.competitionGroup = ''
    state.groupPriority = ''
    state.accrualPeriodStrategy = 'MONTHLY'
    state.accrualPeriodAnchor = ''
    state.partialSettlementPeriodStrategy = 'MONTHLY'
    state.partialSettlementPeriodAnchor = ''
    state.finalSettlementPeriodStrategy = 'MONTHLY'
    state.finalSettlementPeriodAnchor = ''
    state.retroactiveSettlementPeriodStrategy = 'MONTHLY'
    state.retroactiveSettlementPeriodAnchor = ''
    state.confirmationDelayDays = '0'
    state.includeSystemPromoters = false
    state.promoterTypeUuids = []
    state.rankUuids = []
    state.campaignUuid = props.campaignUuid ?? ''
    state.startsAt = ''
    state.endsAt = ''
    showAdvanced.value = false
    positionsEditor.reset([{ from: '1', to: '1', label: '', rewardType: 'FLAT', flatAmount: '', rewardPct: '', currencyUuid: '', min: '', max: '', minThreshold: '' }])
    nextTick(() => { suppressCampaignAutofill.value = false })
    return
  }
  state.name = rule.name
  state.description = rule.description ?? ''
  state.metric = rule.metric
  state.competitionType = rule.competitionType
  state.thresholdCount = rule.thresholdCount != null ? String(rule.thresholdCount) : ''
  state.thresholdAmount = rule.thresholdAmount != null ? String(rule.thresholdAmount) : ''
  state.thresholdCurrencyUuid = rule.thresholdCurrency_Uuid ?? ''
  state.achievementDateBasis = rule.achievementDateBasis
  state.tiePolicy = rule.tiePolicy
  state.competitionGroup = rule.competitionGroup ?? ''
  state.groupPriority = rule.groupPriority != null ? String(rule.groupPriority) : ''
  state.accrualPeriodStrategy = rule.accrualPeriodStrategy
  state.accrualPeriodAnchor = rule.accrualPeriodAnchor != null ? String(rule.accrualPeriodAnchor) : ''
  state.partialSettlementPeriodStrategy = rule.partialSettlementPeriodStrategy
  state.partialSettlementPeriodAnchor = rule.partialSettlementPeriodAnchor != null ? String(rule.partialSettlementPeriodAnchor) : ''
  state.finalSettlementPeriodStrategy = rule.finalSettlementPeriodStrategy
  state.finalSettlementPeriodAnchor = rule.finalSettlementPeriodAnchor != null ? String(rule.finalSettlementPeriodAnchor) : ''
  state.retroactiveSettlementPeriodStrategy = rule.retroactiveSettlementPeriodStrategy
  state.retroactiveSettlementPeriodAnchor = rule.retroactiveSettlementPeriodAnchor != null ? String(rule.retroactiveSettlementPeriodAnchor) : ''
  state.confirmationDelayDays = String(rule.confirmationDelayDays ?? 0)
  state.includeSystemPromoters = rule.includeSystemPromoters ?? false
  state.promoterTypeUuids = (rule.promoterTypes ?? []).map(p => p.uuid)
  state.rankUuids = (rule.ranks ?? []).map(r => r.uuid)
  state.campaignUuid = rule.campaign_Uuid ?? ''
  state.startsAt = rule.startsAt ? isoToDatetimeLocal(rule.startsAt) : ''
  state.endsAt = rule.endsAt ? isoToDatetimeLocal(rule.endsAt) : ''
  positionsEditor.reset((rule.positions ?? []).map(p => ({
    from: String(p.positionFrom),
    to: String(p.positionTo),
    label: p.label ?? '',
    rewardType: p.rewardType,
    flatAmount: p.flatAmount != null ? String(p.flatAmount) : '',
    rewardPct: p.rewardPct != null ? String(p.rewardPct) : '',
    currencyUuid: p.rewardCurrency_Uuid ?? '',
    min: p.rewardMinAmount != null ? String(p.rewardMinAmount) : '',
    max: p.rewardMaxAmount != null ? String(p.rewardMaxAmount) : '',
    minThreshold: p.minThresholdCount != null ? String(p.minThresholdCount) : (p.minThresholdAmount != null ? String(p.minThresholdAmount) : ''),
  })))
  editSnapshot.value = snapEditState()
  nextTick(() => { suppressCampaignAutofill.value = false })
}

watch(() => props.open, async (open) => {
  if (!open) return
  populateFrom(props.rule ?? null)
  if (currencyItems.value.length === 0) await loadCurrencyOptions()
  if (promoterTypeItems.value.length === 0) await loadPromoterTypeOptions()
  if (rankItems.value.length === 0) await loadRankOptions()
})

async function reloadForm() {
  if (!props.rule) return
  reloading.value = true
  try { populateFrom(await rulesApi.get(props.rule.uuid)) }
  catch { /* useApi already notified */ }
  finally { reloading.value = false }
}
function onRefresh() {
  if (isEditDirty.value) discardConfirmOpen.value = true
  else reloadForm()
}
function discardAndRefresh() {
  discardConfirmOpen.value = false
  reloadForm()
}

async function onSubmit(_e: FormSubmitEvent<Record<string, unknown>>) {
  isSubmitting.value = true
  try {
    const body: CompetitiveRuleRequest = {
      name: state.name.trim(),
      description: state.description.trim() || undefined,
      metric: state.metric!,
      competitionType: state.competitionType!,
      thresholdCount: isCountMetricSelected.value && state.thresholdCount ? Number(state.thresholdCount) : null,
      thresholdAmount: !isCountMetricSelected.value && state.thresholdAmount ? state.thresholdAmount.trim() : null,
      thresholdCurrencyUuid: !isCountMetricSelected.value ? (state.thresholdCurrencyUuid || null) : null,
      achievementDateBasis: state.achievementDateBasis!,
      tiePolicy: state.tiePolicy!,
      competitionGroup: state.competitionGroup.trim() || null,
      groupPriority: state.groupPriority ? Number(state.groupPriority) : null,
      accrualPeriodStrategy: state.accrualPeriodStrategy!,
      accrualPeriodAnchor: state.accrualPeriodAnchor ? Number(state.accrualPeriodAnchor) : null,
      partialSettlementPeriodStrategy: state.partialSettlementPeriodStrategy!,
      partialSettlementPeriodAnchor: state.partialSettlementPeriodAnchor ? Number(state.partialSettlementPeriodAnchor) : null,
      finalSettlementPeriodStrategy: state.finalSettlementPeriodStrategy!,
      finalSettlementPeriodAnchor: state.finalSettlementPeriodAnchor ? Number(state.finalSettlementPeriodAnchor) : null,
      retroactiveSettlementPeriodStrategy: state.retroactiveSettlementPeriodStrategy!,
      retroactiveSettlementPeriodAnchor: state.retroactiveSettlementPeriodAnchor ? Number(state.retroactiveSettlementPeriodAnchor) : null,
      confirmationDelayDays: Number(state.confirmationDelayDays || 0),
      includeSystemPromoters: state.includeSystemPromoters,
      promoterTypeUuids: state.promoterTypeUuids,
      rankUuids: state.rankUuids,
      campaignUuid: state.campaignUuid || null,
      startsAt: datetimeLocalToIso(state.startsAt) ?? null,
      endsAt: datetimeLocalToIso(state.endsAt) ?? null,
      positions: positionsEditor.toRequests(isCountMetricSelected.value),
    }
    let result: CompetitiveRuleDto
    if (mode.value === 'create') {
      result = await rulesApi.create(body)
      toast.add({ title: t('commissionRules.competitiveRules.createdToast'), color: 'success', icon: 'i-lucide-check-circle' })
    }
    else {
      result = await rulesApi.update(props.rule!.uuid, { ...body, active: props.rule!.active })
      toast.add({ title: t('commissionRules.competitiveRules.updatedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    }
    emit('saved', result)
    isOpen.value = false
  }
  catch {
    // useApi already notified the error
  }
  finally {
    isSubmitting.value = false
  }
}

function openDeleteFromEdit() {
  if (!props.rule) return
  isOpen.value = false
  emit('delete', props.rule)
}
</script>

<template>
  <UModal
    v-model:open="isOpen"
    :title="mode === 'create' ? t('commissionRules.competitiveRules.form.createTitle') : t('commissionRules.competitiveRules.form.editTitle')"
    :ui="{ content: 'max-w-3xl' }"
  >
    <template #body>
      <UForm ref="formRef" :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
        <UAlert v-if="rule?.hasFrozenAwards" color="warning" variant="soft" icon="i-lucide-lock"
                :title="t('commissionRules.competitiveRules.form.frozenTitle')"
                :description="t('commissionRules.competitiveRules.form.frozenHelp')" />

        <UFormField :label="t('commissionRules.competitiveRules.form.name')" name="name" required>
          <UInput v-model="state.name" :disabled="rule?.hasFrozenAwards" class="w-full" />
        </UFormField>
        <UFormField :label="t('commissionRules.competitiveRules.form.description')" name="description">
          <UTextarea v-model="state.description" :rows="2" class="w-full" />
        </UFormField>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('commissionRules.competitiveRules.form.metric')" name="metric" required :disabled="rule?.hasFrozenAwards">
            <USelectMenu clear v-model="state.metric" :items="metricOptions" label-key="label" value-key="value" :disabled="rule?.hasFrozenAwards" class="w-full" />
          </UFormField>
          <UFormField :label="t('commissionRules.competitiveRules.form.competitionType')" name="competitionType" required>
            <USelectMenu clear v-model="state.competitionType" :items="competitionTypeOptions" label-key="label" value-key="value" :disabled="rule?.hasFrozenAwards" class="w-full" />
          </UFormField>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField v-if="isCountMetricSelected" :label="t('commissionRules.competitiveRules.form.thresholdCount')" name="thresholdCount"
                      :help="state.competitionType === 'RANKING' ? t('commissionRules.competitiveRules.form.thresholdOptionalRanking') : undefined">
            <UInput v-model="state.thresholdCount" inputmode="numeric" class="w-full" />
          </UFormField>
          <template v-else>
            <UFormField :label="t('commissionRules.competitiveRules.form.thresholdAmount')" name="thresholdAmount">
              <UInput v-model="state.thresholdAmount" placeholder="400.00" class="w-full">
                <template #leading><span class="text-prohealth-400 text-sm">$</span></template>
              </UInput>
            </UFormField>
            <UFormField :label="t('commissionRules.competitiveRules.form.thresholdCurrency')" name="thresholdCurrencyUuid">
              <CommonEntityReferenceSelect v-model="state.thresholdCurrencyUuid" :items="currencyItems" entity="currency"
                                           :loading="loadingCurrencies" :placeholder="t('common.select')" icon="i-lucide-coins" @navigate="goToCurrency" />
            </UFormField>
          </template>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('commissionRules.competitiveRules.form.achievementDateBasis')" name="achievementDateBasis" required>
            <USelectMenu clear v-model="state.achievementDateBasis" :items="dateBasisOptions" label-key="label" value-key="value" class="w-full" />
          </UFormField>
          <UFormField :label="t('commissionRules.competitiveRules.form.tiePolicy')" name="tiePolicy" required>
            <USelectMenu clear v-model="state.tiePolicy" :items="tiePolicyOptions" label-key="label" value-key="value" class="w-full" />
          </UFormField>
        </div>

        <!-- ─── D2/D3: position ranges + prizes ────────────────────────────── -->
        <div class="rounded-xl border border-prohealth-100 p-4 space-y-3">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-semibold text-prohealth-800">{{ t('commissionRules.competitiveRules.form.positions') }}</p>
              <p class="text-xs text-prohealth-500">{{ t('commissionRules.competitiveRules.form.positionsHelp') }}</p>
            </div>
            <UButton color="neutral" variant="soft" size="xs" icon="i-lucide-plus" @click="positionsEditor.addRange()">
              {{ t('commissionRules.competitiveRules.form.addPosition') }}
            </UButton>
          </div>

          <UAlert v-if="positionsEditor.hasOverlaps.value" color="error" variant="soft" icon="i-lucide-alert-triangle"
                  :title="t('commissionRules.competitiveRules.form.overlapError')" />

          <div v-for="(range, index) in positionsEditor.ranges.value" :key="index"
               class="rounded-lg bg-prohealth-50/60 p-3 space-y-3"
               :class="{ 'ring-1 ring-error-400': positionsEditor.overlaps.value.has(index) }">
            <div class="grid grid-cols-2 sm:grid-cols-6 gap-3 items-end">
              <UFormField class="sm:col-span-1" :label="t('commissionRules.competitiveRules.form.positionFrom')">
                <UInput v-model="range.from" inputmode="numeric" class="w-full" />
              </UFormField>
              <UFormField class="sm:col-span-1" :label="t('commissionRules.competitiveRules.form.positionTo')">
                <UInput v-model="range.to" inputmode="numeric" class="w-full" />
              </UFormField>
              <UFormField class="sm:col-span-2" :label="t('commissionRules.competitiveRules.form.positionLabel')">
                <UInput v-model="range.label" class="w-full" />
              </UFormField>
              <UFormField class="sm:col-span-1" :label="t('commissionRules.competitiveRules.form.rewardType')">
                <USelectMenu clear v-model="range.rewardType" :items="rewardTypeOptions" label-key="label" value-key="value" class="w-full" />
              </UFormField>
              <div class="sm:col-span-1 flex justify-end">
                <UButton color="error" variant="ghost" icon="i-lucide-trash-2" size="xs" @click="positionsEditor.removeRange(index)">
                  {{ t('common.delete') }}
                </UButton>
              </div>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <UFormField v-if="range.rewardType === 'FLAT'" :label="t('commissionRules.competitiveRules.form.flatAmount')">
                <UInput v-model="range.flatAmount" placeholder="100.00" class="w-full" />
              </UFormField>
              <template v-else>
                <UFormField :label="t('commissionRules.competitiveRules.form.rewardPct')">
                  <UInput v-model="range.rewardPct" placeholder="5.00" class="w-full">
                    <template #trailing><span class="text-prohealth-400 text-sm">%</span></template>
                  </UInput>
                </UFormField>
                <UFormField :label="t('commissionRules.competitiveRules.form.rewardMin')">
                  <UInput v-model="range.min" class="w-full" />
                </UFormField>
                <UFormField :label="t('commissionRules.competitiveRules.form.rewardMax')">
                  <UInput v-model="range.max" class="w-full" />
                </UFormField>
              </template>
              <UFormField :label="t('commissionRules.competitiveRules.form.rewardCurrency')">
                <CommonEntityReferenceSelect v-model="range.currencyUuid" :items="currencyItems" entity="currency"
                                             :loading="loadingCurrencies" :placeholder="t('common.select')" icon="i-lucide-coins" @navigate="goToCurrency" />
              </UFormField>
              <UFormField v-if="isRanking" :label="t('commissionRules.competitiveRules.form.minThreshold')" :help="t('commissionRules.competitiveRules.form.minThresholdHelp')">
                <UInput v-model="range.minThreshold" class="w-full" />
              </UFormField>
            </div>
          </div>

          <p v-if="positionsEditor.ranges.value.length > 0" class="text-xs text-prohealth-500">
            {{ t('commissionRules.competitiveRules.form.maxWinners', { n: positionsEditor.maxWinners.value }) }}
          </p>
        </div>

        <div>
          <UButton color="neutral" variant="ghost" size="sm"
                   :icon="showAdvanced ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
                   :label="showAdvanced ? t('commissionRules.bonusRules.form.hideAdvanced') : t('commissionRules.bonusRules.form.showAdvanced')"
                   @click="showAdvanced = !showAdvanced" />
        </div>

        <div v-if="showAdvanced" class="space-y-4 rounded-lg border border-prohealth-200 p-4">
          <p class="text-sm font-medium text-prohealth-700">{{ t('commissionRules.competitiveRules.form.advancedSection') }}</p>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField :label="t('commissionRules.competitiveRules.form.competitionGroup')" name="competitionGroup" :help="t('commissionRules.competitiveRules.form.competitionGroupHelp')">
              <UInput v-model="state.competitionGroup" class="w-full" />
            </UFormField>
            <UFormField v-if="state.competitionGroup" :label="t('commissionRules.competitiveRules.form.groupPriority')" name="groupPriority" required>
              <UInput v-model="state.groupPriority" inputmode="numeric" class="w-full" />
            </UFormField>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField :label="t('commissionRules.competitiveRules.form.accrualPeriodStrategy')" name="accrualPeriodStrategy" required>
              <USelectMenu clear v-model="state.accrualPeriodStrategy" :items="axisOptionsBase" label-key="label" value-key="value" class="w-full" />
            </UFormField>
            <UFormField v-if="anchorKindFor(state.accrualPeriodStrategy) === 'weekday'" :label="t('commissionRules.bonusRules.form.anchorWeekday')" name="accrualPeriodAnchor">
              <USelectMenu clear v-model="state.accrualPeriodAnchor" :items="weekdayOptions" label-key="label" value-key="value" class="w-full" />
            </UFormField>
            <UFormField v-else-if="anchorKindFor(state.accrualPeriodStrategy) === 'monthday'" :label="t('commissionRules.bonusRules.form.anchorMonthday')" name="accrualPeriodAnchor">
              <UInput v-model="state.accrualPeriodAnchor" inputmode="numeric" min="1" max="31" class="w-full" />
            </UFormField>
          </div>

          <div v-if="isRanking" class="text-xs text-prohealth-500 rounded bg-prohealth-50 p-3">
            {{ t('commissionRules.competitiveRules.form.rankingCloseOnlyHelp') }}
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField :label="t('commissionRules.competitiveRules.form.partialSettlementPeriodStrategy')" name="partialSettlementPeriodStrategy" required>
              <USelectMenu clear v-model="state.partialSettlementPeriodStrategy" :items="isRanking ? rankingCloseOptions : axisOptionsBase" label-key="label" value-key="value" class="w-full" />
            </UFormField>
            <template v-if="!isRanking">
              <UFormField v-if="anchorKindFor(state.partialSettlementPeriodStrategy) === 'weekday'" :label="t('commissionRules.bonusRules.form.anchorWeekday')" name="partialSettlementPeriodAnchor">
                <USelectMenu clear v-model="state.partialSettlementPeriodAnchor" :items="weekdayOptions" label-key="label" value-key="value" class="w-full" />
              </UFormField>
              <UFormField v-else-if="anchorKindFor(state.partialSettlementPeriodStrategy) === 'monthday'" :label="t('commissionRules.bonusRules.form.anchorMonthday')" name="partialSettlementPeriodAnchor">
                <UInput v-model="state.partialSettlementPeriodAnchor" inputmode="numeric" min="1" max="31" class="w-full" />
              </UFormField>
            </template>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField :label="t('commissionRules.competitiveRules.form.finalSettlementPeriodStrategy')" name="finalSettlementPeriodStrategy" required>
              <USelectMenu clear v-model="state.finalSettlementPeriodStrategy" :items="isRanking ? rankingCloseOptions : axisOptionsBase" label-key="label" value-key="value" class="w-full" />
            </UFormField>
            <template v-if="!isRanking">
              <UFormField v-if="anchorKindFor(state.finalSettlementPeriodStrategy) === 'weekday'" :label="t('commissionRules.bonusRules.form.anchorWeekday')" name="finalSettlementPeriodAnchor">
                <USelectMenu clear v-model="state.finalSettlementPeriodAnchor" :items="weekdayOptions" label-key="label" value-key="value" class="w-full" />
              </UFormField>
              <UFormField v-else-if="anchorKindFor(state.finalSettlementPeriodStrategy) === 'monthday'" :label="t('commissionRules.bonusRules.form.anchorMonthday')" name="finalSettlementPeriodAnchor">
                <UInput v-model="state.finalSettlementPeriodAnchor" inputmode="numeric" min="1" max="31" class="w-full" />
              </UFormField>
            </template>
          </div>

          <div v-if="!isRanking" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField :label="t('commissionRules.competitiveRules.form.retroactiveSettlementPeriodStrategy')" name="retroactiveSettlementPeriodStrategy"
                        :required="retroactiveEnabled" :help="!retroactiveEnabled ? t('commissionRules.bonusRules.form.retroactiveDisabledHelp') : undefined">
              <USelectMenu clear v-model="state.retroactiveSettlementPeriodStrategy" :items="retroactiveOptions" :disabled="!retroactiveEnabled" label-key="label" value-key="value" class="w-full" />
            </UFormField>
            <UFormField v-if="anchorKindFor(state.retroactiveSettlementPeriodStrategy) === 'weekday'" :label="t('commissionRules.bonusRules.form.anchorWeekday')" name="retroactiveSettlementPeriodAnchor">
              <USelectMenu clear v-model="state.retroactiveSettlementPeriodAnchor" :items="weekdayOptions" label-key="label" value-key="value" class="w-full" />
            </UFormField>
            <UFormField v-else-if="anchorKindFor(state.retroactiveSettlementPeriodStrategy) === 'monthday'" :label="t('commissionRules.bonusRules.form.anchorMonthday')" name="retroactiveSettlementPeriodAnchor">
              <UInput v-model="state.retroactiveSettlementPeriodAnchor" inputmode="numeric" min="1" max="31" class="w-full" />
            </UFormField>
          </div>

          <UFormField :label="t('commissionRules.competitiveRules.form.confirmationDelayDays')" name="confirmationDelayDays" :help="t('commissionRules.competitiveRules.form.confirmationDelayDaysHelp')">
            <UInput v-model="state.confirmationDelayDays" inputmode="numeric" class="w-full" />
          </UFormField>
        </div>

        <UFormField :label="t('commissionRules.competitiveRules.form.includeSystemPromoters')" name="includeSystemPromoters">
          <USwitch v-model="state.includeSystemPromoters" />
        </UFormField>

        <UFormField :label="t('commissionRules.form.promoterTypes')" name="promoterTypeUuids" :help="t('commissionRules.form.promoterTypesHelp')">
          <USelectMenu clear v-model="state.promoterTypeUuids" :items="promoterTypeItems" label-key="label" value-key="value" multiple
                       :loading="loadingPromoterTypes" icon="i-lucide-tags" :placeholder="t('commissionRules.form.promoterTypesPlaceholder')" class="w-full" />
        </UFormField>

        <UFormField :label="t('commissionRules.competitiveRules.form.ranks')" name="rankUuids">
          <USelectMenu clear v-model="state.rankUuids" :items="rankItems" label-key="label" value-key="value" multiple
                       :loading="loadingRanks" icon="i-lucide-network" :placeholder="t('common.select')" class="w-full" />
        </UFormField>

        <UFormField :label="t('campaigns.form.campaign')" name="campaignUuid" :help="t('campaigns.form.campaignHelp')">
          <UInput v-if="campaignLocked" :model-value="props.campaignDisplay || state.campaignUuid" disabled readonly icon="i-lucide-rocket" :ui="READONLY_FIELD_UI" class="w-full">
            <template #trailing><UIcon name="i-lucide-lock-keyhole" class="text-prohealth-400" /></template>
          </UInput>
          <CommonEntityReferenceSelect v-else v-model="state.campaignUuid" :search="searchCampaigns" entity="campaign"
                                       :placeholder="t('common.select')" :search-placeholder="t('campaigns.searchPlaceholder')" icon="i-lucide-rocket" @navigate="goToCampaign" />
        </UFormField>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('commissionRules.bonusRules.form.startsAt')" name="startsAt">
            <AppDateTimePicker v-model="state.startsAt" />
          </UFormField>
          <UFormField :label="t('commissionRules.bonusRules.form.endsAt')" name="endsAt">
            <AppDateTimePicker v-model="state.endsAt" />
          </UFormField>
        </div>

        <UModal v-model:open="discardConfirmOpen" :title="t('common.discardChangesTitle')">
          <template #body>
            <p class="text-sm text-prohealth-700">{{ t('common.discardChangesBody') }}</p>
            <div class="flex items-center justify-end gap-3 pt-5">
              <UButton color="neutral" variant="ghost" @click="discardConfirmOpen = false">{{ t('common.cancel') }}</UButton>
              <UButton color="warning" icon="i-lucide-refresh-cw" @click="discardAndRefresh">{{ t('common.discardAndRefresh') }}</UButton>
            </div>
          </template>
        </UModal>
      </UForm>
    </template>

    <template #footer>
      <div class="w-full space-y-2">
        <p class="text-xs text-prohealth-500">{{ t('common.requiredFieldsHint') }}</p>
        <div class="flex items-center justify-between gap-3">
          <div v-if="mode === 'edit' && rule">
            <UButton color="error" variant="ghost" icon="i-lucide-trash-2" size="sm" :label="t('common.delete')" :disabled="isSubmitting" @click="openDeleteFromEdit" />
          </div>
          <div v-else />
          <div class="flex items-center gap-3">
            <RefreshButton v-if="mode === 'edit'" :icon-only="false" :label="t('common.refresh')" :title="t('common.refresh')" :loading="reloading" :disabled="isSubmitting" @refresh="onRefresh" />
            <UButton color="neutral" variant="ghost" :disabled="isSubmitting" @click="isOpen = false">{{ t('common.cancel') }}</UButton>
            <UButton :color="mode === 'create' ? 'primary' : 'info'" variant="outline" :loading="isSubmitting" icon="i-lucide-save" :disabled="positionsEditor.hasOverlaps.value" @click="formRef?.submit()">
              {{ mode === 'create' ? t('common.saveNew') : t('common.saveChanges') }}
            </UButton>
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>
