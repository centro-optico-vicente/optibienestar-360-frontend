<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type {
  CreateHierarchyOverrideTierRequest,
  HierarchyOverrideTierDto,
  OverrideCategory,
  UpdateHierarchyOverrideTierRequest,
} from '~/types/hierarchyOverrideTiers'
import { OVERRIDE_CATEGORY_OPTIONS } from '~/types/hierarchyOverrideTiers'
import type { PeriodStrategy } from '~/types/commissionTiers'
import { PERIOD_STRATEGY_OPTIONS } from '~/types/commissionTiers'
import type { SelectItem } from '~/types/options'
import { clampTodayToRange } from '~/utils/date'

// Create/edit form for a hierarchy-override band (Supervisor/Coordinador
// override %, hub plan §2). Exactly one of overridePct / flatAmount is set —
// the "reward" select below picks which one the form captures, same pattern
// as CommissionTierFormModal. flatAmount additionally carries its own
// currency FK (ADR 0015 — a flat amount always carries its own currency).
const props = defineProps<{
  open: boolean
  tier?: HierarchyOverrideTierDto | null
  /** Preset campaign when created from the campaign ficha's "Add rule" flow. */
  campaignUuid?: string | null
  campaignDisplay?: string | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'saved': [tier: HierarchyOverrideTierDto]
  'delete': [tier: HierarchyOverrideTierDto]
}>()

const { t } = useI18n()
const tiers = useHierarchyOverrideTiers()
const hierarchy = usePromoterHierarchy()
const currencies = useCurrencies()
const campaignsApi = useCampaigns()
const toast = useToast()
const { can } = usePermissions()

// ---- Campaign selector (async search) + date autofill ----
async function searchCampaigns(q: string): Promise<SelectItem[]> {
  const res = await campaignsApi.list({ q, size: 20 })
  return (res.content ?? []).map(c => ({ label: c.name, value: c.uuid }))
}
function goToCampaign(to: string) {
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
// overwrite the tier's own snapshot dates when the modal opens.
const suppressCampaignAutofill = ref(false)

const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})

function goToRank(to: string) {
  isOpen.value = false
  navigateTo(to)
}
const mode = computed<'create' | 'edit'>(() => (props.tier ? 'edit' : 'create'))
const campaignLocked = computed(() => mode.value === 'create' && !!props.campaignUuid)
const canManage = computed(() => can(mode.value === 'edit' ? 'HIERARCHY_OVERRIDE_TIER_UPDATE' : 'HIERARCHY_OVERRIDE_TIER_CREATE'))
const isSubmitting = ref(false)
// Save button lives in the modal's #footer slot, outside the <UForm> element,
// so it can't use type="submit"; it triggers validation via this instead.
const formRef = ref<{ submit: () => Promise<void> } | null>(null)

const categoryOptions = computed(() => OVERRIDE_CATEGORY_OPTIONS.map(o => ({ label: t(o.labelKey), value: o.value })))
const periodOptions = computed(() => PERIOD_STRATEGY_OPTIONS.map(o => ({ label: t(o.labelKey), value: o.value })))
const rewardKindOptions = computed(() => [
  { label: t('commissionRules.tiers.rewardKindPct'), value: 'PCT' },
  { label: t('commissionRules.tiers.rewardKindFlat'), value: 'FLAT' },
])
const basisOptions = computed(() => [
  { label: t('hierarchyOverrideTiers.form.basisCount'), value: 'COUNT' },
  { label: t('hierarchyOverrideTiers.form.basisAmount'), value: 'AMOUNT' },
])
// ---- Settlement-frequency anchors (unified 4-axis model) ----
// Contextual "anchor day" per axis: weekday select (1-7) when the axis's own
// strategy is WEEKLY/BIWEEKLY, day-of-month number input (1-31) when it's
// MONTHLY or coarser, hidden entirely when DAILY.
type AnchorKind = 'weekday' | 'monthday' | 'none'
function anchorKindFor(strategy: PeriodStrategy | undefined): AnchorKind {
  if (!strategy || strategy === 'DAILY') return 'none'
  if (strategy === 'WEEKLY' || strategy === 'BIWEEKLY') return 'weekday'
  return 'monthday'
}
// Values are kept as strings ('1'..'7') so they share the same string-typed
// anchor field as the day-of-month input, avoiding a type split per axis.
const weekdayOptions = computed(() => [
  { label: t('hierarchyOverrideTiers.form.weekday.1'), value: '1' },
  { label: t('hierarchyOverrideTiers.form.weekday.2'), value: '2' },
  { label: t('hierarchyOverrideTiers.form.weekday.3'), value: '3' },
  { label: t('hierarchyOverrideTiers.form.weekday.4'), value: '4' },
  { label: t('hierarchyOverrideTiers.form.weekday.5'), value: '5' },
  { label: t('hierarchyOverrideTiers.form.weekday.6'), value: '6' },
  { label: t('hierarchyOverrideTiers.form.weekday.7'), value: '7' },
])
const showAdvanced = ref(false)

// ---- Rank options (Supervisor/Coordinador catalog, promoter-ranks) ----
const rankItems = ref<SelectItem[]>([])
const loadingRanks = ref(false)
async function loadRankOptions() {
  loadingRanks.value = true
  try {
    const options = await hierarchy.rankOptions({ limit: 100 })
    rankItems.value = options.map(o => ({ label: o.label, value: o.uuid }))
  }
  catch {
    rankItems.value = []
  }
  finally {
    loadingRanks.value = false
  }
}

// ---- Currency options (flatAmount's own currency FK, ADR 0015) ----
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
  catch {
    currencyItems.value = []
  }
  finally {
    loadingCurrencies.value = false
  }
}
/** Resolves `flatAmountCurrencyUuid` to its ISO code for `CurrencyConverterDisplay`. */
const flatAmountCurrencyCode = computed(() => currencyCodeByUuid.value[state.flatAmountCurrencyUuid] ?? null)
/** Resolves `thresholdAmountCurrencyUuid` (basis=AMOUNT threshold) to its ISO code. */
const thresholdAmountCurrencyCode = computed(() => currencyCodeByUuid.value[state.thresholdAmountCurrencyUuid] ?? null)
/** Same reasoning as `CommissionTierFormModal` — clamp "today" into the tier's own window. */
const flatAmountConversionDate = computed(() => clampTodayToRange(state.startsAt, state.endsAt))
function goToCurrency(to: string) {
  isOpen.value = false
  navigateTo(to)
}

interface FormState {
  name: string
  description: string
  rankUuid: string
  category: OverrideCategory | undefined
  basis: 'COUNT' | 'AMOUNT'
  thresholdCount: string
  thresholdAmount: string
  thresholdAmountCurrencyUuid: string
  rewardKind: 'PCT' | 'FLAT'
  overridePct: string
  flatAmount: string
  flatAmountCurrencyUuid: string
  accrualPeriodStrategy: PeriodStrategy | undefined
  accrualPeriodAnchor: string
  partialSettlementPeriodStrategy: PeriodStrategy | undefined
  partialSettlementPeriodAnchor: string
  finalSettlementPeriodStrategy: PeriodStrategy | undefined
  finalSettlementPeriodAnchor: string
  retroactiveSettlementPeriodStrategy: PeriodStrategy | undefined
  retroactiveSettlementPeriodAnchor: string
  campaignUuid: string
  startsAt: string
  endsAt: string
}

const state = reactive<FormState>({
  name: '',
  description: '',
  rankUuid: '',
  category: undefined,
  basis: 'COUNT',
  thresholdCount: '0',
  thresholdAmount: '',
  thresholdAmountCurrencyUuid: '',
  rewardKind: 'PCT',
  overridePct: '',
  flatAmount: '',
  flatAmountCurrencyUuid: '',
  // New settlement axes default to the same value as accrualPeriodStrategy so
  // a rule created without touching "advanced settings" behaves exactly like
  // before (no-op).
  accrualPeriodStrategy: 'MONTHLY',
  accrualPeriodAnchor: '',
  partialSettlementPeriodStrategy: 'MONTHLY',
  partialSettlementPeriodAnchor: '',
  finalSettlementPeriodStrategy: 'MONTHLY',
  finalSettlementPeriodAnchor: '',
  retroactiveSettlementPeriodStrategy: 'MONTHLY',
  retroactiveSettlementPeriodAnchor: '',
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
// Kept outside `state` (a string-only form-state map) so the boolean isn't coerced.
const isActive = ref(true)

const schema = computed(() => {
  const money = z.string().regex(/^\d+(\.\d{1,2})?$/, t('commissionRules.form.invalidAmount'))
  const int = z.string().regex(/^\d+$/, t('commissionRules.form.integersOnly'))
  const anchor = z.string().optional().refine(v => !v || /^\d{1,2}$/.test(v), t('commissionRules.form.integersOnly'))
  return z.object({
    name: z.string().min(3, t('validation.minChars', { n: 3 })).max(80, t('validation.maxChars', { n: 80 })),
    description: z.string().optional(),
    rankUuid: z.string({ message: t('validation.required') }).min(1, t('validation.required')),
    category: z.string({ message: t('validation.required') }).min(1, t('validation.required')),
    thresholdCount: state.basis === 'COUNT' ? int : z.string().optional(),
    thresholdAmount: state.basis === 'AMOUNT' ? money : z.string().optional(),
    thresholdAmountCurrencyUuid: state.basis === 'AMOUNT' ? z.string().min(1, t('validation.required')) : z.string().optional(),
    overridePct: state.rewardKind === 'PCT' ? money : z.string().optional(),
    flatAmount: state.rewardKind === 'FLAT' ? money : z.string().optional(),
    flatAmountCurrencyUuid: state.rewardKind === 'FLAT'
      ? z.string({ message: t('validation.required') }).min(1, t('validation.required'))
      : z.string().optional(),
    accrualPeriodStrategy: z.string({ message: t('validation.required') }).min(1, t('validation.required')),
    accrualPeriodAnchor: anchor,
    partialSettlementPeriodStrategy: z.string({ message: t('validation.required') }).min(1, t('validation.required')),
    partialSettlementPeriodAnchor: anchor,
    finalSettlementPeriodStrategy: z.string({ message: t('validation.required') }).min(1, t('validation.required')),
    finalSettlementPeriodAnchor: anchor,
    retroactiveSettlementPeriodStrategy: z.string({ message: t('validation.required') }).min(1, t('validation.required')),
    retroactiveSettlementPeriodAnchor: anchor,
  })
})

// Snapshot of the last-loaded edit state, used to warn before a refresh
// discards unsaved changes.
const editSnapshot = ref('')
function snapEditState() { return JSON.stringify({ ...state, isActive: isActive.value }) }
const isEditDirty = computed(() => editSnapshot.value !== '' && snapEditState() !== editSnapshot.value)
const discardConfirmOpen = ref(false)
const reloading = ref(false)

function populateFrom(tier: HierarchyOverrideTierDto | null) {
  suppressCampaignAutofill.value = true
  if (!tier) {
    state.name = ''
    state.description = ''
    state.rankUuid = ''
    state.category = undefined
    state.basis = 'COUNT'
    state.thresholdCount = '0'
    state.thresholdAmount = ''
    state.thresholdAmountCurrencyUuid = ''
    state.rewardKind = 'PCT'
    state.overridePct = ''
    state.flatAmount = ''
    state.flatAmountCurrencyUuid = ''
    state.accrualPeriodStrategy = 'MONTHLY'
    state.accrualPeriodAnchor = ''
    state.partialSettlementPeriodStrategy = 'MONTHLY'
    state.partialSettlementPeriodAnchor = ''
    state.finalSettlementPeriodStrategy = 'MONTHLY'
    state.finalSettlementPeriodAnchor = ''
    state.retroactiveSettlementPeriodStrategy = 'MONTHLY'
    state.retroactiveSettlementPeriodAnchor = ''
    state.campaignUuid = props.campaignUuid ?? ''
    state.startsAt = ''
    state.endsAt = ''
    isActive.value = true
    editSnapshot.value = ''
    showAdvanced.value = false
    nextTick(() => { suppressCampaignAutofill.value = false })
    return
  }
  state.name = tier.name
  state.description = tier.description ?? ''
  state.rankUuid = tier.rank_Uuid ?? ''
  state.category = tier.category
  state.basis = tier.basis ?? 'COUNT'
  state.thresholdCount = String(tier.thresholdCount ?? 0)
  state.thresholdAmount = tier.thresholdAmount != null ? String(tier.thresholdAmount) : ''
  state.thresholdAmountCurrencyUuid = tier.thresholdAmountCurrency_Uuid ?? ''
  state.rewardKind = tier.flatAmount != null ? 'FLAT' : 'PCT'
  state.overridePct = tier.overridePct != null ? String(tier.overridePct) : ''
  state.flatAmount = tier.flatAmount != null ? String(tier.flatAmount) : ''
  state.flatAmountCurrencyUuid = tier.flatAmountCurrency_Uuid ?? ''
  state.accrualPeriodStrategy = tier.accrualPeriodStrategy
  state.accrualPeriodAnchor = tier.accrualPeriodAnchor != null ? String(tier.accrualPeriodAnchor) : ''
  state.partialSettlementPeriodStrategy = tier.partialSettlementPeriodStrategy ?? tier.accrualPeriodStrategy
  state.partialSettlementPeriodAnchor = tier.partialSettlementPeriodAnchor != null ? String(tier.partialSettlementPeriodAnchor) : ''
  state.finalSettlementPeriodStrategy = tier.finalSettlementPeriodStrategy ?? tier.accrualPeriodStrategy
  state.finalSettlementPeriodAnchor = tier.finalSettlementPeriodAnchor != null ? String(tier.finalSettlementPeriodAnchor) : ''
  state.retroactiveSettlementPeriodStrategy = tier.retroactiveSettlementPeriodStrategy ?? tier.accrualPeriodStrategy
  state.retroactiveSettlementPeriodAnchor = tier.retroactiveSettlementPeriodAnchor != null ? String(tier.retroactiveSettlementPeriodAnchor) : ''
  state.campaignUuid = tier.campaign_Uuid ?? ''
  state.startsAt = tier.startsAt ? isoToDatetimeLocal(tier.startsAt) : ''
  state.endsAt = tier.endsAt ? isoToDatetimeLocal(tier.endsAt) : ''
  isActive.value = tier.active ?? true
  editSnapshot.value = snapEditState()
  nextTick(() => { suppressCampaignAutofill.value = false })
}

watch(() => props.open, async (open) => {
  if (!open) return
  if (rankItems.value.length === 0) await loadRankOptions()
  if (currencyItems.value.length === 0) await loadCurrencyOptions()
  populateFrom(props.tier ?? null)
})

async function reloadForm() {
  if (!props.tier) return
  reloading.value = true
  try { populateFrom(await tiers.get(props.tier.uuid)) }
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
    const base = {
      name: state.name.trim(),
      description: state.description.trim() || null,
      rankUuid: state.rankUuid,
      category: state.category!,
      basis: state.basis,
      thresholdCount: state.basis === 'COUNT' ? Number(state.thresholdCount) : null,
      thresholdAmount: state.basis === 'AMOUNT' ? state.thresholdAmount.trim() : null,
      thresholdAmountCurrencyUuid: state.basis === 'AMOUNT' ? state.thresholdAmountCurrencyUuid : null,
      overridePct: state.rewardKind === 'PCT' ? state.overridePct.trim() : null,
      flatAmount: state.rewardKind === 'FLAT' ? state.flatAmount.trim() : null,
      flatAmountCurrencyUuid: state.rewardKind === 'FLAT' ? state.flatAmountCurrencyUuid : null,
      accrualPeriodStrategy: state.accrualPeriodStrategy!,
      accrualPeriodAnchor: state.accrualPeriodAnchor ? Number(state.accrualPeriodAnchor) : null,
      partialSettlementPeriodStrategy: state.partialSettlementPeriodStrategy!,
      partialSettlementPeriodAnchor: state.partialSettlementPeriodAnchor ? Number(state.partialSettlementPeriodAnchor) : null,
      finalSettlementPeriodStrategy: state.finalSettlementPeriodStrategy!,
      finalSettlementPeriodAnchor: state.finalSettlementPeriodAnchor ? Number(state.finalSettlementPeriodAnchor) : null,
      retroactiveSettlementPeriodStrategy: state.retroactiveSettlementPeriodStrategy!,
      retroactiveSettlementPeriodAnchor: state.retroactiveSettlementPeriodAnchor ? Number(state.retroactiveSettlementPeriodAnchor) : null,
      campaignUuid: state.campaignUuid || null,
      startsAt: datetimeLocalToIso(state.startsAt) ?? null,
      endsAt: datetimeLocalToIso(state.endsAt) ?? null,
    }
    let result: HierarchyOverrideTierDto
    if (mode.value === 'create') {
      result = await tiers.create(base as CreateHierarchyOverrideTierRequest)
      toast.add({ title: t('hierarchyOverrideTiers.createdToast'), color: 'success', icon: 'i-lucide-check-circle' })
    }
    else {
      result = await tiers.update(props.tier!.uuid, { ...base, active: isActive.value } as UpdateHierarchyOverrideTierRequest)
      toast.add({ title: t('hierarchyOverrideTiers.updatedToast'), color: 'success', icon: 'i-lucide-check-circle' })
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
  if (!props.tier) return
  isOpen.value = false
  emit('delete', props.tier)
}

// One-click reactivation bypassing full-form validation, so a tier with stale
// data in other fields isn't blocked from being restored.
const restoring = ref(false)
async function restoreTier() {
  if (!props.tier) return
  restoring.value = true
  try {
    const result = await tiers.update(props.tier.uuid, { active: true })
    toast.add({ title: t('hierarchyOverrideTiers.restoredToast'), color: 'success', icon: 'i-lucide-check-circle' })
    emit('saved', result)
    isOpen.value = false
  }
  catch {
    // useApi already notified the error
  }
  finally {
    restoring.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="isOpen"
    :title="mode === 'create' ? t('hierarchyOverrideTiers.form.createTitle') : t('hierarchyOverrideTiers.form.editTitle')"
    :ui="{ content: 'max-w-2xl' }"
  >
    <template #body>
      <UForm ref="formRef" :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
        <UFormField :label="t('hierarchyOverrideTiers.form.name')" name="name" required>
          <UInput v-model="state.name" class="w-full" />
        </UFormField>

        <UFormField :label="t('hierarchyOverrideTiers.form.description')" name="description">
          <UTextarea v-model="state.description" :rows="2" class="w-full" />
        </UFormField>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('hierarchyOverrideTiers.form.rank')" name="rankUuid" required>
            <CommonEntityReferenceSelect
              v-model="state.rankUuid"
              :items="rankItems"
              :loading="loadingRanks"
              entity="promoter_rank"
              :placeholder="t('common.select')"
              @navigate="goToRank"
            />
          </UFormField>
          <UFormField :label="t('hierarchyOverrideTiers.form.category')" name="category" required>
            <USelectMenu clear v-model="state.category" :items="categoryOptions" label-key="label" value-key="value" class="w-full" />
          </UFormField>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('hierarchyOverrideTiers.form.basis')" name="basis" required>
            <USelectMenu v-model="state.basis" :items="basisOptions" label-key="label" value-key="value" class="w-full" />
          </UFormField>
          <UFormField v-if="state.basis === 'COUNT'" :label="t('hierarchyOverrideTiers.form.thresholdCount')" name="thresholdCount" required :help="t('hierarchyOverrideTiers.form.thresholdHelp')">
            <UInput v-model="state.thresholdCount" inputmode="numeric" class="w-full" />
          </UFormField>
          <UFormField v-else :label="t('hierarchyOverrideTiers.form.thresholdAmount')" name="thresholdAmount" required :help="t('hierarchyOverrideTiers.form.thresholdAmountHelp')">
            <CurrencyConverterDisplay :amount="state.thresholdAmount" :currency="thresholdAmountCurrencyCode" :date="flatAmountConversionDate" v-slot="{ result }">
              <UInput v-model="state.thresholdAmount" inputmode="decimal" placeholder="100.00" class="w-full">
                <template #trailing>
                  <CurrencyConverterTrigger :result="result" />
                </template>
              </UInput>
            </CurrencyConverterDisplay>
          </UFormField>
        </div>
        <UFormField v-if="state.basis === 'AMOUNT'" :label="t('hierarchyOverrideTiers.form.thresholdAmountCurrency')" name="thresholdAmountCurrencyUuid" required :help="t('hierarchyOverrideTiers.form.thresholdAmountCurrencyHelp')">
          <CommonEntityReferenceSelect
            v-model="state.thresholdAmountCurrencyUuid"
            :items="currencyItems"
            entity="currency"
            :loading="loadingCurrencies"
            :placeholder="t('common.select')"
            class="w-full"
            @navigate="goToCurrency"
          />
        </UFormField>

        <UFormField :label="t('hierarchyOverrideTiers.form.accrualPeriodStrategy')" name="accrualPeriodStrategy" required>
          <USelectMenu clear v-model="state.accrualPeriodStrategy" :items="periodOptions" label-key="label" value-key="value" class="w-full" />
        </UFormField>
        <UFormField v-if="anchorKindFor(state.accrualPeriodStrategy) === 'weekday'" :label="t('hierarchyOverrideTiers.form.anchorWeekday')" name="accrualPeriodAnchor">
          <USelectMenu clear v-model="state.accrualPeriodAnchor" :items="weekdayOptions" label-key="label" value-key="value" class="w-full" />
        </UFormField>
        <UFormField v-else-if="anchorKindFor(state.accrualPeriodStrategy) === 'monthday'" :label="t('hierarchyOverrideTiers.form.anchorMonthday')" name="accrualPeriodAnchor" :help="t('hierarchyOverrideTiers.form.anchorMonthdayHelp')">
          <UInput v-model="state.accrualPeriodAnchor" inputmode="numeric" min="1" max="31" class="w-full" />
        </UFormField>

        <div>
          <UButton
            color="neutral"
            variant="ghost"
            size="sm"
            :icon="showAdvanced ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
            :label="showAdvanced ? t('hierarchyOverrideTiers.form.hideAdvanced') : t('hierarchyOverrideTiers.form.showAdvanced')"
            @click="showAdvanced = !showAdvanced"
          />
        </div>

        <div v-if="showAdvanced" class="space-y-4 rounded-lg border border-prohealth-200 p-4">
          <p class="text-sm font-medium text-prohealth-700">{{ t('hierarchyOverrideTiers.form.advancedSection') }}</p>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField :label="t('hierarchyOverrideTiers.form.partialSettlementPeriodStrategy')" name="partialSettlementPeriodStrategy" required>
              <USelectMenu clear v-model="state.partialSettlementPeriodStrategy" :items="periodOptions" label-key="label" value-key="value" class="w-full" />
            </UFormField>
            <UFormField v-if="anchorKindFor(state.partialSettlementPeriodStrategy) === 'weekday'" :label="t('hierarchyOverrideTiers.form.anchorWeekday')" name="partialSettlementPeriodAnchor">
              <USelectMenu clear v-model="state.partialSettlementPeriodAnchor" :items="weekdayOptions" label-key="label" value-key="value" class="w-full" />
            </UFormField>
            <UFormField v-else-if="anchorKindFor(state.partialSettlementPeriodStrategy) === 'monthday'" :label="t('hierarchyOverrideTiers.form.anchorMonthday')" name="partialSettlementPeriodAnchor" :help="t('hierarchyOverrideTiers.form.anchorMonthdayHelp')">
              <UInput v-model="state.partialSettlementPeriodAnchor" inputmode="numeric" min="1" max="31" class="w-full" />
            </UFormField>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField :label="t('hierarchyOverrideTiers.form.finalSettlementPeriodStrategy')" name="finalSettlementPeriodStrategy" required>
              <USelectMenu clear v-model="state.finalSettlementPeriodStrategy" :items="periodOptions" label-key="label" value-key="value" class="w-full" />
            </UFormField>
            <UFormField v-if="anchorKindFor(state.finalSettlementPeriodStrategy) === 'weekday'" :label="t('hierarchyOverrideTiers.form.anchorWeekday')" name="finalSettlementPeriodAnchor">
              <USelectMenu clear v-model="state.finalSettlementPeriodAnchor" :items="weekdayOptions" label-key="label" value-key="value" class="w-full" />
            </UFormField>
            <UFormField v-else-if="anchorKindFor(state.finalSettlementPeriodStrategy) === 'monthday'" :label="t('hierarchyOverrideTiers.form.anchorMonthday')" name="finalSettlementPeriodAnchor" :help="t('hierarchyOverrideTiers.form.anchorMonthdayHelp')">
              <UInput v-model="state.finalSettlementPeriodAnchor" inputmode="numeric" min="1" max="31" class="w-full" />
            </UFormField>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField :label="t('hierarchyOverrideTiers.form.retroactiveSettlementPeriodStrategy')" name="retroactiveSettlementPeriodStrategy" required>
              <USelectMenu clear v-model="state.retroactiveSettlementPeriodStrategy" :items="periodOptions" label-key="label" value-key="value" class="w-full" />
            </UFormField>
            <UFormField v-if="anchorKindFor(state.retroactiveSettlementPeriodStrategy) === 'weekday'" :label="t('hierarchyOverrideTiers.form.anchorWeekday')" name="retroactiveSettlementPeriodAnchor">
              <USelectMenu clear v-model="state.retroactiveSettlementPeriodAnchor" :items="weekdayOptions" label-key="label" value-key="value" class="w-full" />
            </UFormField>
            <UFormField v-else-if="anchorKindFor(state.retroactiveSettlementPeriodStrategy) === 'monthday'" :label="t('hierarchyOverrideTiers.form.anchorMonthday')" name="retroactiveSettlementPeriodAnchor" :help="t('hierarchyOverrideTiers.form.anchorMonthdayHelp')">
              <UInput v-model="state.retroactiveSettlementPeriodAnchor" inputmode="numeric" min="1" max="31" class="w-full" />
            </UFormField>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('hierarchyOverrideTiers.form.rewardKind')" name="rewardKind" required>
            <USelectMenu clear v-model="state.rewardKind" :items="rewardKindOptions" label-key="label" value-key="value" class="w-full" />
          </UFormField>
          <UFormField v-if="state.rewardKind === 'PCT'" :label="t('hierarchyOverrideTiers.form.overridePct')" name="overridePct" required>
            <UInput v-model="state.overridePct" placeholder="10.00" class="w-full">
              <template #trailing><span class="text-prohealth-400 text-sm">%</span></template>
            </UInput>
          </UFormField>
          <UFormField v-else :label="t('hierarchyOverrideTiers.form.flatAmount')" name="flatAmount" required>
            <CurrencyConverterDisplay :amount="state.flatAmount" :currency="flatAmountCurrencyCode" :date="flatAmountConversionDate" v-slot="{ result }">
              <UInput v-model="state.flatAmount" placeholder="5.00" class="w-full">
                <template #leading><span class="text-prohealth-400 text-sm">$</span></template>
                <template #trailing>
                  <CurrencyConverterTrigger :result="result" />
                </template>
              </UInput>
            </CurrencyConverterDisplay>
          </UFormField>
        </div>

        <UFormField v-if="state.rewardKind === 'FLAT'" :label="t('hierarchyOverrideTiers.form.flatAmountCurrency')" name="flatAmountCurrencyUuid" required :help="t('hierarchyOverrideTiers.form.flatAmountCurrencyHelp')">
          <CommonEntityReferenceSelect
            v-model="state.flatAmountCurrencyUuid"
            :items="currencyItems"
            entity="currency"
            :loading="loadingCurrencies"
            :placeholder="t('common.select')"
            icon="i-lucide-coins"
            @navigate="goToCurrency"
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
          <UFormField :label="t('hierarchyOverrideTiers.form.startsAt')" name="startsAt">
            <AppDateTimePicker v-model="state.startsAt" />
          </UFormField>
          <UFormField :label="t('hierarchyOverrideTiers.form.endsAt')" name="endsAt">
            <AppDateTimePicker v-model="state.endsAt" />
          </UFormField>
        </div>

        <UFormField v-if="mode === 'edit'" :label="t('hierarchyOverrideTiers.form.active')">
          <USwitch v-model="isActive" />
        </UFormField>

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
          <div v-if="mode === 'edit' && tier">
            <RestoreButton
              v-if="tier.active === false"
              :active="tier.active"
              :allowed="canManage"
              :loading="restoring"
              :disabled="isSubmitting"
              @restore="restoreTier"
            />
            <UButton v-else color="error" variant="ghost" icon="i-lucide-trash-2" size="sm" :label="t('common.delete')" :disabled="isSubmitting" @click="openDeleteFromEdit" />
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
