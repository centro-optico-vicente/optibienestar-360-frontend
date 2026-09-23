<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type {
  AccrualMode,
  BonusMetric,
  BonusRuleDto,
  BonusRuleRequest,
  RewardType,
  SettlementPeriodStrategy,
  WindowStrategy,
} from '~/types/bonusRules'
import {
  ACCRUAL_MODE_OPTIONS,
  BONUS_METRIC_OPTIONS,
  isAmountCollectedMetric,
  REWARD_TYPE_OPTIONS,
  SETTLEMENT_PERIOD_STRATEGY_OPTIONS,
  WINDOW_STRATEGY_OPTIONS,
} from '~/types/bonusRules'
import type { SelectItem } from '~/types/options'
import { clampTodayToRange } from '~/utils/date'

// Create/edit form for a bonus rule (bono por escala, ADR 0013 §2). The backend
// replaces the whole row on PUT (no PATCH semantics), so both create and update
// send the same full BonusRuleRequest shape.
const props = defineProps<{
  open: boolean
  rule?: BonusRuleDto | null
  /** Preset campaign when created from the campaign ficha's "Add rule" flow. */
  campaignUuid?: string | null
  campaignDisplay?: string | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'saved': [rule: BonusRuleDto]
  'delete': [rule: BonusRuleDto]
}>()

const { t } = useI18n()
const bonusRules = useBonusRules()
const campaignsApi = useCampaigns()
const currencies = useCurrencies()
const promoterTypeOptions = useCatalogOptions('promoter-types')
const toast = useToast()

// ---- Promoter-type scope (M:N, hub plan Part F) — empty selection = applies to every type ----
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

const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})

// ---- Currency options (flat-amount reward) ----
const currencyItems = ref<SelectItem[]>([])
const currencyCodeByUuid = ref<Record<string, string>>({})
const loadingCurrencies = ref(false)
async function loadCurrencyOptions() {
  loadingCurrencies.value = true
  try {
    const options = await currencies.options()
    const withCode = options.filter(o => o.code)
    currencyItems.value = withCode.map(o => ({ label: o.label, value: o.uuid }))
    currencyCodeByUuid.value = Object.fromEntries(withCode.map(o => [o.uuid, o.code as string]))
  }
  catch { currencyItems.value = [] }
  finally { loadingCurrencies.value = false }
}

/** Resolves `rewardCurrencyUuid` to its ISO code for `CurrencyConverterDisplay`. */
const rewardCurrencyCode = computed(() => currencyCodeByUuid.value[state.rewardCurrencyUuid] ?? null)
/** Resolves `thresholdCurrencyUuid` (metric=AMOUNT_COLLECTED threshold) to its ISO code. */
const thresholdCurrencyCode = computed(() => currencyCodeByUuid.value[state.thresholdCurrencyUuid] ?? null)
/** Same reasoning as `CommissionTierFormModal` — clamp "today" into the rule's own window. */
const flatAmountConversionDate = computed(() => clampTodayToRange(state.startsAt, state.endsAt))

// ---- Campaign selector (async search) + date autofill ----
// NOTE: this is the NEW campaign/startsAt/endsAt anchor — distinct from the
// legacy campaignStart/campaignEnd fields below (WindowStrategy.CAMPAIGN).
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
// Guards the campaign-select watcher during populateFrom so it doesn't
// overwrite the rule's own snapshot dates when the modal opens.
const suppressCampaignAutofill = ref(false)
const mode = computed<'create' | 'edit'>(() => (props.rule ? 'edit' : 'create'))
const campaignLocked = computed(() => mode.value === 'create' && !!props.campaignUuid)
const isSubmitting = ref(false)
// Save button lives in the modal's #footer slot, outside the <UForm> element,
// so it can't use type="submit"; it triggers validation via this instead.
const formRef = ref<{ submit: () => Promise<void> } | null>(null)

const metricOptions = computed(() => BONUS_METRIC_OPTIONS.map(o => ({ label: t(o.labelKey), value: o.value })))
const accrualOptions = computed(() => ACCRUAL_MODE_OPTIONS.map(o => ({ label: t(o.labelKey), value: o.value })))
// Accrual-period axis — the only one that may offer CAMPAIGN (legacy fixed range).
const windowOptions = computed(() => WINDOW_STRATEGY_OPTIONS.map(o => ({ label: t(o.labelKey), value: o.value })))
// Settlement axes (partial/final/retroactive) — CAMPAIGN excluded, same contract as
// CommissionTierFormModal / CollectionCommissionTierFormModal.
const settlementPeriodOptions = computed(() => SETTLEMENT_PERIOD_STRATEGY_OPTIONS.map(o => ({ label: t(o.labelKey), value: o.value })))
const rewardTypeOptions = computed(() => REWARD_TYPE_OPTIONS.map(o => ({ label: t(o.labelKey), value: o.value })))

// ---- Settlement-frequency anchors (unified 4-axis model) ----
// Contextual "anchor day" per axis: weekday select (1-7) when the axis's own
// strategy is WEEKLY/BIWEEKLY, day-of-month number input (1-31) when it's
// MONTHLY or coarser, hidden when DAILY, LIFETIME or CAMPAIGN (no periodic anchor).
type AnchorKind = 'weekday' | 'monthday' | 'none'
function anchorKindFor(strategy: WindowStrategy | SettlementPeriodStrategy | undefined): AnchorKind {
  if (!strategy || strategy === 'DAILY' || strategy === 'LIFETIME' || strategy === 'CAMPAIGN') return 'none'
  if (strategy === 'WEEKLY' || strategy === 'BIWEEKLY') return 'weekday'
  return 'monthday'
}
// Values are kept as strings ('1'..'7') so they share the same string-typed
// anchor field as the day-of-month input, avoiding a type split per axis.
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

interface FormState {
  name: string
  description: string
  metric: BonusMetric | undefined
  accrual: AccrualMode | undefined
  thresholdCount: string
  thresholdAmount: string
  thresholdCurrencyUuid: string
  accrualPeriodStrategy: WindowStrategy | undefined
  accrualPeriodAnchor: string
  partialSettlementPeriodStrategy: SettlementPeriodStrategy | undefined
  partialSettlementPeriodAnchor: string
  finalSettlementPeriodStrategy: SettlementPeriodStrategy | undefined
  finalSettlementPeriodAnchor: string
  retroactiveSettlementPeriodStrategy: SettlementPeriodStrategy | undefined
  retroactiveSettlementPeriodAnchor: string
  campaignStart: string
  campaignEnd: string
  rewardType: RewardType | undefined
  flatAmount: string
  rewardPct: string
  rewardCurrencyUuid: string
  includeSystemPromoters: boolean
  promoterTypeUuids: string[]
  campaignUuid: string
  startsAt: string
  endsAt: string
}

const state = reactive<FormState>({
  name: '',
  description: '',
  metric: 'NEW_SUBSCRIBERS',
  accrual: 'THRESHOLD',
  thresholdCount: '',
  thresholdAmount: '',
  thresholdCurrencyUuid: '',
  accrualPeriodStrategy: 'MONTHLY',
  accrualPeriodAnchor: '',
  // New settlement axes default to the same value as accrualPeriodStrategy so
  // a rule created without touching "advanced settings" behaves exactly like
  // before (no-op).
  partialSettlementPeriodStrategy: 'MONTHLY',
  partialSettlementPeriodAnchor: '',
  finalSettlementPeriodStrategy: 'MONTHLY',
  finalSettlementPeriodAnchor: '',
  retroactiveSettlementPeriodStrategy: 'MONTHLY',
  retroactiveSettlementPeriodAnchor: '',
  campaignStart: '',
  campaignEnd: '',
  rewardType: 'FLAT',
  flatAmount: '',
  rewardPct: '',
  rewardCurrencyUuid: '',
  includeSystemPromoters: false,
  promoterTypeUuids: [],
  campaignUuid: '',
  startsAt: '',
  endsAt: '',
})

// Selecting a campaign defaults startsAt/endsAt from it (still overridable);
// clearing the campaign does NOT clear already-set dates.
watch(() => state.campaignUuid, async (uuid) => {
  if (suppressCampaignAutofill.value || !uuid) return
  try {
    const campaign = await campaignsApi.get(uuid)
    state.startsAt = isoToDatetimeLocal(campaign.startsAt)
    state.endsAt = isoToDatetimeLocal(campaign.endsAt)
  }
  catch { /* useApi already notified */ }
})

const isCampaign = computed(() => state.accrualPeriodStrategy === 'CAMPAIGN')
const isAmountCollected = computed(() => isAmountCollectedMetric(state.metric))

const schema = computed(() => {
  const money = z.string().regex(/^\d+(\.\d{1,2})?$/, t('commissionRules.form.invalidAmount'))
  const int = z.string().regex(/^\d+$/, t('commissionRules.form.integersOnly'))
  const anchor = z.string().optional().refine(v => !v || /^\d{1,2}$/.test(v), t('commissionRules.form.integersOnly'))
  return z.object({
    name: z.string().min(3, t('validation.minChars', { n: 3 })).max(150, t('validation.maxChars', { n: 150 })),
    description: z.string().optional(),
    metric: z.string({ message: t('validation.required') }).min(1, t('validation.required')),
    accrual: z.string({ message: t('validation.required') }).min(1, t('validation.required')),
    thresholdCount: isAmountCollected.value ? z.string().optional() : int,
    thresholdAmount: isAmountCollected.value ? money : z.string().optional(),
    thresholdCurrencyUuid: isAmountCollected.value ? z.string().min(1, t('validation.required')) : z.string().optional(),
    accrualPeriodStrategy: z.string({ message: t('validation.required') }).min(1, t('validation.required')),
    accrualPeriodAnchor: anchor,
    partialSettlementPeriodStrategy: z.string({ message: t('validation.required') }).min(1, t('validation.required')),
    partialSettlementPeriodAnchor: anchor,
    finalSettlementPeriodStrategy: z.string({ message: t('validation.required') }).min(1, t('validation.required')),
    finalSettlementPeriodAnchor: anchor,
    retroactiveSettlementPeriodStrategy: z.string({ message: t('validation.required') }).min(1, t('validation.required')),
    retroactiveSettlementPeriodAnchor: anchor,
    campaignStart: isCampaign.value ? z.string().min(1, t('validation.required')) : z.string().optional(),
    campaignEnd: isCampaign.value ? z.string().min(1, t('validation.required')) : z.string().optional(),
    rewardType: z.string({ message: t('validation.required') }).min(1, t('validation.required')),
    flatAmount: state.rewardType === 'FLAT' ? money : z.string().optional(),
    rewardPct: state.rewardType === 'PERCENTAGE' ? money : z.string().optional(),
    rewardCurrencyUuid: state.rewardType === 'FLAT' ? z.string().min(1, t('validation.required')) : z.string().optional(),
  })
})

// Snapshot of the last-loaded edit state, used to warn before a refresh
// discards unsaved changes.
const editSnapshot = ref('')
function snapEditState() { return JSON.stringify({ ...state }) }
const isEditDirty = computed(() => editSnapshot.value !== '' && snapEditState() !== editSnapshot.value)
const discardConfirmOpen = ref(false)
const reloading = ref(false)

function populateFrom(rule: BonusRuleDto | null) {
  suppressCampaignAutofill.value = true
  if (!rule) {
    editSnapshot.value = ''
    state.name = ''
    state.description = ''
    state.metric = 'NEW_SUBSCRIBERS'
    state.accrual = 'THRESHOLD'
    state.thresholdCount = ''
    state.thresholdAmount = ''
    state.thresholdCurrencyUuid = ''
    state.accrualPeriodStrategy = 'MONTHLY'
    state.accrualPeriodAnchor = ''
    state.partialSettlementPeriodStrategy = 'MONTHLY'
    state.partialSettlementPeriodAnchor = ''
    state.finalSettlementPeriodStrategy = 'MONTHLY'
    state.finalSettlementPeriodAnchor = ''
    state.retroactiveSettlementPeriodStrategy = 'MONTHLY'
    state.retroactiveSettlementPeriodAnchor = ''
    state.campaignStart = ''
    state.campaignEnd = ''
    state.rewardType = 'FLAT'
    state.flatAmount = ''
    state.rewardPct = ''
    state.rewardCurrencyUuid = ''
    state.includeSystemPromoters = false
    state.promoterTypeUuids = []
    state.campaignUuid = props.campaignUuid ?? ''
    state.startsAt = ''
    state.endsAt = ''
    showAdvanced.value = false
    nextTick(() => { suppressCampaignAutofill.value = false })
    return
  }
  state.name = rule.name
  state.description = rule.description ?? ''
  state.metric = rule.metric
  state.accrual = rule.accrual
  state.thresholdCount = rule.thresholdCount != null ? String(rule.thresholdCount) : ''
  state.thresholdAmount = rule.thresholdAmount != null ? String(rule.thresholdAmount) : ''
  state.thresholdCurrencyUuid = rule.thresholdCurrency_Uuid ?? ''
  state.accrualPeriodStrategy = rule.accrualPeriodStrategy
  state.accrualPeriodAnchor = rule.accrualPeriodAnchor != null ? String(rule.accrualPeriodAnchor) : ''
  state.partialSettlementPeriodStrategy = rule.partialSettlementPeriodStrategy ?? (rule.accrualPeriodStrategy === 'CAMPAIGN' ? 'MONTHLY' : rule.accrualPeriodStrategy)
  state.partialSettlementPeriodAnchor = rule.partialSettlementPeriodAnchor != null ? String(rule.partialSettlementPeriodAnchor) : ''
  state.finalSettlementPeriodStrategy = rule.finalSettlementPeriodStrategy ?? (rule.accrualPeriodStrategy === 'CAMPAIGN' ? 'MONTHLY' : rule.accrualPeriodStrategy)
  state.finalSettlementPeriodAnchor = rule.finalSettlementPeriodAnchor != null ? String(rule.finalSettlementPeriodAnchor) : ''
  state.retroactiveSettlementPeriodStrategy = rule.retroactiveSettlementPeriodStrategy ?? (rule.accrualPeriodStrategy === 'CAMPAIGN' ? 'MONTHLY' : rule.accrualPeriodStrategy)
  state.retroactiveSettlementPeriodAnchor = rule.retroactiveSettlementPeriodAnchor != null ? String(rule.retroactiveSettlementPeriodAnchor) : ''
  state.campaignStart = rule.campaignStart ?? ''
  state.campaignEnd = rule.campaignEnd ?? ''
  state.rewardType = rule.rewardType
  state.flatAmount = rule.flatAmount != null ? String(rule.flatAmount) : ''
  state.rewardPct = rule.rewardPct != null ? String(rule.rewardPct) : ''
  state.rewardCurrencyUuid = rule.rewardCurrencyRef_Uuid ?? ''
  state.includeSystemPromoters = rule.includeSystemPromoters ?? false
  state.promoterTypeUuids = (rule.promoterTypes ?? []).map(p => p.uuid)
  state.campaignUuid = rule.campaign_Uuid ?? ''
  state.startsAt = rule.startsAt ? isoToDatetimeLocal(rule.startsAt) : ''
  state.endsAt = rule.endsAt ? isoToDatetimeLocal(rule.endsAt) : ''
  editSnapshot.value = snapEditState()
  nextTick(() => { suppressCampaignAutofill.value = false })
}

watch(() => props.open, async (open) => {
  if (!open) return
  populateFrom(props.rule ?? null)
  if (currencyItems.value.length === 0) await loadCurrencyOptions()
  if (promoterTypeItems.value.length === 0) await loadPromoterTypeOptions()
})

async function reloadForm() {
  if (!props.rule) return
  reloading.value = true
  try { populateFrom(await bonusRules.get(props.rule.uuid)) }
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
    const body: BonusRuleRequest = {
      name: state.name.trim(),
      description: state.description.trim() || undefined,
      metric: state.metric!,
      accrual: state.accrual!,
      thresholdCount: isAmountCollected.value ? null : Number(state.thresholdCount),
      thresholdAmount: isAmountCollected.value ? state.thresholdAmount.trim() : null,
      thresholdCurrencyUuid: isAmountCollected.value ? state.thresholdCurrencyUuid : null,
      accrualPeriodStrategy: state.accrualPeriodStrategy!,
      accrualPeriodAnchor: state.accrualPeriodAnchor ? Number(state.accrualPeriodAnchor) : null,
      partialSettlementPeriodStrategy: state.partialSettlementPeriodStrategy!,
      partialSettlementPeriodAnchor: state.partialSettlementPeriodAnchor ? Number(state.partialSettlementPeriodAnchor) : null,
      finalSettlementPeriodStrategy: state.finalSettlementPeriodStrategy!,
      finalSettlementPeriodAnchor: state.finalSettlementPeriodAnchor ? Number(state.finalSettlementPeriodAnchor) : null,
      retroactiveSettlementPeriodStrategy: state.retroactiveSettlementPeriodStrategy!,
      retroactiveSettlementPeriodAnchor: state.retroactiveSettlementPeriodAnchor ? Number(state.retroactiveSettlementPeriodAnchor) : null,
      campaignStart: isCampaign.value ? state.campaignStart : null,
      campaignEnd: isCampaign.value ? state.campaignEnd : null,
      rewardType: state.rewardType!,
      flatAmount: state.rewardType === 'FLAT' ? state.flatAmount.trim() : null,
      rewardPct: state.rewardType === 'PERCENTAGE' ? state.rewardPct.trim() : null,
      rewardCurrencyUuid: state.rewardType === 'FLAT' ? state.rewardCurrencyUuid : null,
      includeSystemPromoters: state.includeSystemPromoters,
      promoterTypeUuids: state.promoterTypeUuids,
      campaignUuid: state.campaignUuid || null,
      startsAt: datetimeLocalToIso(state.startsAt) ?? null,
      endsAt: datetimeLocalToIso(state.endsAt) ?? null,
    }
    let result: BonusRuleDto
    if (mode.value === 'create') {
      result = await bonusRules.create(body)
      toast.add({ title: t('commissionRules.bonusRules.createdToast'), color: 'success', icon: 'i-lucide-check-circle' })
    }
    else {
      result = await bonusRules.update(props.rule!.uuid, body)
      toast.add({ title: t('commissionRules.bonusRules.updatedToast'), color: 'success', icon: 'i-lucide-check-circle' })
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
    :title="mode === 'create' ? t('commissionRules.bonusRules.form.createTitle') : t('commissionRules.bonusRules.form.editTitle')"
    :ui="{ content: 'max-w-2xl' }"
  >
    <template #body>
      <UForm ref="formRef" :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
        <UFormField :label="t('commissionRules.bonusRules.form.name')" name="name" required>
          <UInput v-model="state.name" class="w-full" />
        </UFormField>

        <UFormField :label="t('commissionRules.bonusRules.form.description')" name="description">
          <UTextarea v-model="state.description" :rows="2" class="w-full" />
        </UFormField>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('commissionRules.bonusRules.form.metric')" name="metric" required>
            <USelectMenu clear v-model="state.metric" :items="metricOptions" label-key="label" value-key="value" class="w-full" />
          </UFormField>
          <UFormField :label="t('commissionRules.bonusRules.form.accrual')" name="accrual" required>
            <USelectMenu clear v-model="state.accrual" :items="accrualOptions" label-key="label" value-key="value" class="w-full" />
          </UFormField>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField v-if="!isAmountCollected" :label="t('commissionRules.bonusRules.form.thresholdCount')" name="thresholdCount" required>
            <UInput v-model="state.thresholdCount" inputmode="numeric" class="w-full" />
          </UFormField>
          <UFormField v-else :label="t('commissionRules.bonusRules.form.thresholdAmount')" name="thresholdAmount" required>
            <CurrencyConverterDisplay :amount="state.thresholdAmount" :currency="thresholdCurrencyCode" :date="flatAmountConversionDate" v-slot="{ result }">
              <UInput v-model="state.thresholdAmount" placeholder="400.00" class="w-full">
                <template #leading><span class="text-prohealth-400 text-sm">$</span></template>
                <template #trailing>
                  <CurrencyConverterTrigger :result="result" />
                </template>
              </UInput>
            </CurrencyConverterDisplay>
          </UFormField>
          <UFormField :label="t('commissionRules.bonusRules.form.accrualPeriodStrategy')" name="accrualPeriodStrategy" required :help="t('commissionRules.bonusRules.form.accrualPeriodStrategyHelp')">
            <USelectMenu clear v-model="state.accrualPeriodStrategy" :items="windowOptions" label-key="label" value-key="value" class="w-full" />
          </UFormField>
        </div>
        <UFormField v-if="anchorKindFor(state.accrualPeriodStrategy) === 'weekday'" :label="t('commissionRules.bonusRules.form.anchorWeekday')" name="accrualPeriodAnchor">
          <USelectMenu clear v-model="state.accrualPeriodAnchor" :items="weekdayOptions" label-key="label" value-key="value" class="w-full" />
        </UFormField>
        <UFormField v-else-if="anchorKindFor(state.accrualPeriodStrategy) === 'monthday'" :label="t('commissionRules.bonusRules.form.anchorMonthday')" name="accrualPeriodAnchor" :help="t('commissionRules.bonusRules.form.anchorMonthdayHelp')">
          <UInput v-model="state.accrualPeriodAnchor" inputmode="numeric" min="1" max="31" class="w-full" />
        </UFormField>

        <UFormField
          v-if="isAmountCollected"
          :label="t('commissionRules.bonusRules.form.thresholdCurrency')"
          name="thresholdCurrencyUuid"
          required
          :help="t('commissionRules.bonusRules.form.thresholdCurrencyHelp')"
        >
          <CommonEntityReferenceSelect
            v-model="state.thresholdCurrencyUuid"
            :items="currencyItems"
            entity="currency"
            :loading="loadingCurrencies"
            :placeholder="t('common.select')"
            icon="i-lucide-coins"
            @navigate="goToCurrency"
          />
        </UFormField>

        <div v-if="isCampaign" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('commissionRules.bonusRules.form.campaignStart')" name="campaignStart" required>
            <UInput v-model="state.campaignStart" type="date" class="w-full" />
          </UFormField>
          <UFormField :label="t('commissionRules.bonusRules.form.campaignEnd')" name="campaignEnd" required>
            <UInput v-model="state.campaignEnd" type="date" class="w-full" />
          </UFormField>
        </div>

        <div>
          <UButton
            color="neutral"
            variant="ghost"
            size="sm"
            :icon="showAdvanced ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
            :label="showAdvanced ? t('commissionRules.bonusRules.form.hideAdvanced') : t('commissionRules.bonusRules.form.showAdvanced')"
            @click="showAdvanced = !showAdvanced"
          />
        </div>

        <div v-if="showAdvanced" class="space-y-4 rounded-lg border border-prohealth-200 p-4">
          <p class="text-sm font-medium text-prohealth-700">{{ t('commissionRules.bonusRules.form.advancedSection') }}</p>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField :label="t('commissionRules.bonusRules.form.partialSettlementPeriodStrategy')" name="partialSettlementPeriodStrategy" required>
              <USelectMenu clear v-model="state.partialSettlementPeriodStrategy" :items="settlementPeriodOptions" label-key="label" value-key="value" class="w-full" />
            </UFormField>
            <UFormField v-if="anchorKindFor(state.partialSettlementPeriodStrategy) === 'weekday'" :label="t('commissionRules.bonusRules.form.anchorWeekday')" name="partialSettlementPeriodAnchor">
              <USelectMenu clear v-model="state.partialSettlementPeriodAnchor" :items="weekdayOptions" label-key="label" value-key="value" class="w-full" />
            </UFormField>
            <UFormField v-else-if="anchorKindFor(state.partialSettlementPeriodStrategy) === 'monthday'" :label="t('commissionRules.bonusRules.form.anchorMonthday')" name="partialSettlementPeriodAnchor" :help="t('commissionRules.bonusRules.form.anchorMonthdayHelp')">
              <UInput v-model="state.partialSettlementPeriodAnchor" inputmode="numeric" min="1" max="31" class="w-full" />
            </UFormField>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField :label="t('commissionRules.bonusRules.form.finalSettlementPeriodStrategy')" name="finalSettlementPeriodStrategy" required>
              <USelectMenu clear v-model="state.finalSettlementPeriodStrategy" :items="settlementPeriodOptions" label-key="label" value-key="value" class="w-full" />
            </UFormField>
            <UFormField v-if="anchorKindFor(state.finalSettlementPeriodStrategy) === 'weekday'" :label="t('commissionRules.bonusRules.form.anchorWeekday')" name="finalSettlementPeriodAnchor">
              <USelectMenu clear v-model="state.finalSettlementPeriodAnchor" :items="weekdayOptions" label-key="label" value-key="value" class="w-full" />
            </UFormField>
            <UFormField v-else-if="anchorKindFor(state.finalSettlementPeriodStrategy) === 'monthday'" :label="t('commissionRules.bonusRules.form.anchorMonthday')" name="finalSettlementPeriodAnchor" :help="t('commissionRules.bonusRules.form.anchorMonthdayHelp')">
              <UInput v-model="state.finalSettlementPeriodAnchor" inputmode="numeric" min="1" max="31" class="w-full" />
            </UFormField>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField :label="t('commissionRules.bonusRules.form.retroactiveSettlementPeriodStrategy')" name="retroactiveSettlementPeriodStrategy" required>
              <USelectMenu clear v-model="state.retroactiveSettlementPeriodStrategy" :items="settlementPeriodOptions" label-key="label" value-key="value" class="w-full" />
            </UFormField>
            <UFormField v-if="anchorKindFor(state.retroactiveSettlementPeriodStrategy) === 'weekday'" :label="t('commissionRules.bonusRules.form.anchorWeekday')" name="retroactiveSettlementPeriodAnchor">
              <USelectMenu clear v-model="state.retroactiveSettlementPeriodAnchor" :items="weekdayOptions" label-key="label" value-key="value" class="w-full" />
            </UFormField>
            <UFormField v-else-if="anchorKindFor(state.retroactiveSettlementPeriodStrategy) === 'monthday'" :label="t('commissionRules.bonusRules.form.anchorMonthday')" name="retroactiveSettlementPeriodAnchor" :help="t('commissionRules.bonusRules.form.anchorMonthdayHelp')">
              <UInput v-model="state.retroactiveSettlementPeriodAnchor" inputmode="numeric" min="1" max="31" class="w-full" />
            </UFormField>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('commissionRules.bonusRules.form.rewardType')" name="rewardType" required>
            <USelectMenu clear v-model="state.rewardType" :items="rewardTypeOptions" label-key="label" value-key="value" class="w-full" />
          </UFormField>
          <UFormField v-if="state.rewardType === 'FLAT'" :label="t('commissionRules.bonusRules.form.flatAmount')" name="flatAmount" required>
            <CurrencyConverterDisplay :amount="state.flatAmount" :currency="rewardCurrencyCode" :date="flatAmountConversionDate" v-slot="{ result }">
              <UInput v-model="state.flatAmount" placeholder="100.00" class="w-full">
                <template #leading><span class="text-prohealth-400 text-sm">$</span></template>
                <template #trailing>
                  <CurrencyConverterTrigger :result="result" />
                </template>
              </UInput>
            </CurrencyConverterDisplay>
          </UFormField>
          <UFormField v-else :label="t('commissionRules.bonusRules.form.rewardPct')" name="rewardPct" required>
            <UInput v-model="state.rewardPct" placeholder="10.00" class="w-full">
              <template #trailing><span class="text-prohealth-400 text-sm">%</span></template>
            </UInput>
          </UFormField>
        </div>

        <UFormField v-if="state.rewardType === 'FLAT'" :label="t('commissionRules.bonusRules.form.rewardCurrency')" name="rewardCurrencyUuid" required :help="t('commissionRules.bonusRules.form.rewardCurrencyHelp')">
          <CommonEntityReferenceSelect
            v-model="state.rewardCurrencyUuid"
            :items="currencyItems"
            entity="currency"
            :loading="loadingCurrencies"
            :placeholder="t('common.select')"
            icon="i-lucide-coins"
            @navigate="goToCurrency"
          />
        </UFormField>

        <UFormField :label="t('commissionRules.bonusRules.form.includeSystemPromoters')" name="includeSystemPromoters">
          <USwitch v-model="state.includeSystemPromoters" />
        </UFormField>

        <UFormField :label="t('commissionRules.form.promoterTypes')" name="promoterTypeUuids" :help="t('commissionRules.form.promoterTypesHelp')">
          <USelectMenu
            clear
            v-model="state.promoterTypeUuids"
            :items="promoterTypeItems"
            label-key="label"
            value-key="value"
            multiple
            :loading="loadingPromoterTypes"
            icon="i-lucide-tags"
            :placeholder="t('commissionRules.form.promoterTypesPlaceholder')"
            class="w-full"
          />
        </UFormField>

        <UFormField :label="t('campaigns.form.campaign')" name="campaignUuid" :help="t('campaigns.form.campaignHelp')">
          <UInput v-if="campaignLocked" :model-value="props.campaignDisplay || state.campaignUuid" disabled readonly icon="i-lucide-rocket" :ui="READONLY_FIELD_UI" class="w-full">
            <template #trailing><UIcon name="i-lucide-lock-keyhole" class="text-prohealth-400" /></template>
          </UInput>
          <CommonEntityReferenceSelect
            v-else
            v-model="state.campaignUuid"
            :search="searchCampaigns"
            entity="campaign"
            :placeholder="t('common.select')"
            :search-placeholder="t('campaigns.searchPlaceholder')"
            icon="i-lucide-rocket"
            @navigate="goToCampaign"
          />
        </UFormField>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('commissionRules.bonusRules.form.startsAt')" name="startsAt">
            <AppDateTimePicker v-model="state.startsAt" />
          </UFormField>
          <UFormField :label="t('commissionRules.bonusRules.form.endsAt')" name="endsAt">
            <AppDateTimePicker v-model="state.endsAt" />
          </UFormField>
        </div>

        <!-- Discard unsaved changes before refreshing -->
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
            <RefreshButton
              v-if="mode === 'edit'"
              :icon-only="false"
              :label="t('common.refresh')"
              :title="t('common.refresh')"
              :loading="reloading"
              :disabled="isSubmitting"
              @refresh="onRefresh"
            />
            <UButton color="neutral" variant="ghost" :disabled="isSubmitting" @click="isOpen = false">{{ t('common.cancel') }}</UButton>
            <UButton :color="mode === 'create' ? 'primary' : 'info'" variant="outline" :loading="isSubmitting" icon="i-lucide-save" @click="formRef?.submit()">
              {{ mode === 'create' ? t('common.saveNew') : t('common.saveChanges') }}
            </UButton>
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>
