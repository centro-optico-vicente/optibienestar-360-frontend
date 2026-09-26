<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type {
  CollectionCommissionTierDto,
  CreateCollectionCommissionTierRequest,
  UpdateCollectionCommissionTierRequest,
} from '~/types/collectionCommissionTiers'
import type { PeriodStrategy } from '~/types/commissionTiers'
import { PERIOD_STRATEGY_OPTIONS } from '~/types/commissionTiers'
import type { SelectItem } from '~/types/options'
import { clampTodayToRange } from '~/utils/date'

// Create/edit form for a collection commission tier (comisión de cobranza por
// días, ADR 0013 §3, V44) — a decreasing-% bucket by days-to-collect.
const props = defineProps<{
  open: boolean
  tier?: CollectionCommissionTierDto | null
  /** Preset campaign_id when created from the campaign ficha's "Add rule" flow, or from the "Reglas de Campaña" tab. */
  campaignUuid?: string | null
  campaignDisplay?: string | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'saved': [tier: CollectionCommissionTierDto]
  'delete': [tier: CollectionCommissionTierDto]
}>()

const { t } = useI18n()
const tiers = useCollectionCommissionTiers()
const currencies = useCurrencies()
const campaignsApi = useCampaigns()
const promoterTypeOptions = useCatalogOptions('promoter-types')
const toast = useToast()
const { can } = usePermissions()

const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})
const mode = computed<'create' | 'edit'>(() => (props.tier ? 'edit' : 'create'))
const campaignLocked = computed(() => mode.value === 'create' && !!props.campaignUuid)
const canManage = computed(() => can(mode.value === 'edit' ? 'COLLECTION_COMMISSION_TIER_UPDATE' : 'COLLECTION_COMMISSION_TIER_CREATE'))
const isSubmitting = ref(false)
// Save button lives in the modal's #footer slot, outside the <UForm> element,
// so it can't use type="submit"; it triggers validation via this instead.
const formRef = ref<{ submit: () => Promise<void> } | null>(null)
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
/** Resolves `flatAmountCurrencyUuid` to its ISO code for `CurrencyConverterDisplay`. */
const flatAmountCurrencyCode = computed(() => currencyCodeByUuid.value[state.flatAmountCurrencyUuid] ?? null)
/** Resolves `minAmountCurrencyUuid` (basis=AMOUNT threshold) to its ISO code. */
const minAmountCurrencyCode = computed(() => currencyCodeByUuid.value[state.minAmountCurrencyUuid] ?? null)
/** Same reasoning as `CommissionTierFormModal` — clamp "today" into the tier's own window. */
const flatAmountConversionDate = computed(() => clampTodayToRange(state.startsAt, state.endsAt))
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
async function searchCampaigns(q: string): Promise<SelectItem[]> {
  const res = await campaignsApi.list({ q, size: 20 })
  return (res.content ?? []).map(c => ({ label: c.name, value: c.uuid }))
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
const basisOptions = computed(() => [
  { label: t('commissionRules.collectionTiers.form.basisDays'), value: 'DAYS' },
  { label: t('commissionRules.collectionTiers.form.basisAmount'), value: 'AMOUNT' },
])
const rewardKindOptions = computed(() => [
  { label: t('commissionRules.tiers.rewardKindPct'), value: 'PCT' },
  { label: t('commissionRules.tiers.rewardKindFlat'), value: 'FLAT' },
])
const periodOptions = computed(() => PERIOD_STRATEGY_OPTIONS.map(o => ({ label: t(o.labelKey), value: o.value })))
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
  { label: t('commissionRules.collectionTiers.form.weekday.1'), value: '1' },
  { label: t('commissionRules.collectionTiers.form.weekday.2'), value: '2' },
  { label: t('commissionRules.collectionTiers.form.weekday.3'), value: '3' },
  { label: t('commissionRules.collectionTiers.form.weekday.4'), value: '4' },
  { label: t('commissionRules.collectionTiers.form.weekday.5'), value: '5' },
  { label: t('commissionRules.collectionTiers.form.weekday.6'), value: '6' },
  { label: t('commissionRules.collectionTiers.form.weekday.7'), value: '7' },
])
const showAdvanced = ref(false)

interface FormState {
  name: string
  description: string
  basis: 'DAYS' | 'AMOUNT'
  maxDays: string
  minAmount: string
  minAmountCurrencyUuid: string
  rewardKind: 'PCT' | 'FLAT'
  commissionPct: string
  flatAmount: string
  flatAmountCurrencyUuid: string
  promoterTypeUuids: string[]
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
  name: '', description: '', basis: 'DAYS', maxDays: '', minAmount: '', minAmountCurrencyUuid: '',
  rewardKind: 'PCT', commissionPct: '', flatAmount: '', flatAmountCurrencyUuid: '',
  promoterTypeUuids: [],
  // New settlement axes default to the same value as accrualPeriodStrategy so
  // a tier created without touching "advanced settings" behaves consistently.
  accrualPeriodStrategy: 'MONTHLY',
  accrualPeriodAnchor: '',
  partialSettlementPeriodStrategy: 'MONTHLY',
  partialSettlementPeriodAnchor: '',
  finalSettlementPeriodStrategy: 'MONTHLY',
  finalSettlementPeriodAnchor: '',
  retroactiveSettlementPeriodStrategy: 'MONTHLY',
  retroactiveSettlementPeriodAnchor: '',
  campaignUuid: '', startsAt: '', endsAt: '',
})
// Kept outside `state` (a string-only form-state map) so the boolean isn't coerced.
const isActive = ref(true)

// D15 (hub plan competitive-commission-rules, Fase A): the retroactive axis
// only makes sense — and is only enabled — when partial is strictly finer
// than accrual. Instant client-side feedback for the same rule the backend
// enforces (SettlementAxes), instead of a round-trip 422.
const { retroactiveEnabled, retroactiveOptions } = useSettlementAxes(
  toRef(state, 'accrualPeriodStrategy'),
  toRef(state, 'partialSettlementPeriodStrategy'),
  toRef(state, 'retroactiveSettlementPeriodStrategy'),
  periodOptions,
)

const schema = computed(() => {
  const anchor = z.string().optional().refine(v => !v || /^\d{1,2}$/.test(v), t('commissionRules.form.integersOnly'))
  return z.object({
    name: z.string().min(3, t('validation.minChars', { n: 3 })).max(80, t('validation.maxChars', { n: 80 })),
    description: z.string().optional(),
    maxDays: state.basis === 'DAYS' ? z.string().regex(/^[1-9]\d*$/, t('commissionRules.form.integersOnly')) : z.string().optional(),
    minAmount: state.basis === 'AMOUNT' ? z.string().regex(/^\d+(\.\d{1,2})?$/, t('commissionRules.form.invalidAmount')) : z.string().optional(),
    minAmountCurrencyUuid: state.basis === 'AMOUNT' ? z.string().min(1, t('validation.required')) : z.string().optional(),
    commissionPct: state.rewardKind === 'PCT' ? z.string().regex(/^\d+(\.\d{1,2})?$/, t('commissionRules.form.invalidAmount')) : z.string().optional(),
    flatAmount: state.rewardKind === 'FLAT' ? z.string().regex(/^\d+(\.\d{1,2})?$/, t('commissionRules.form.invalidAmount')) : z.string().optional(),
    flatAmountCurrencyUuid: state.rewardKind === 'FLAT' ? z.string().min(1, t('validation.required')) : z.string().optional(),
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

function populateFrom(tier: CollectionCommissionTierDto | null) {
  if (!tier) {
    state.name = ''
    state.description = ''
    state.basis = 'DAYS'
    state.maxDays = ''
    state.minAmount = ''
    state.minAmountCurrencyUuid = ''
    state.rewardKind = 'PCT'
    state.commissionPct = ''
    state.flatAmount = ''
    state.flatAmountCurrencyUuid = ''
    state.promoterTypeUuids = []
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
    return
  }
  state.name = tier.name
  state.description = tier.description ?? ''
  state.basis = tier.basis ?? 'DAYS'
  state.maxDays = String(tier.maxDays)
  state.minAmount = tier.minAmount != null ? String(tier.minAmount) : ''
  state.minAmountCurrencyUuid = tier.minAmountCurrency_Uuid ?? ''
  state.rewardKind = tier.flatAmount != null ? 'FLAT' : 'PCT'
  state.commissionPct = tier.commissionPct != null ? String(tier.commissionPct) : ''
  state.flatAmount = tier.flatAmount != null ? String(tier.flatAmount) : ''
  state.flatAmountCurrencyUuid = tier.flatAmountCurrency_Uuid ?? ''
  state.promoterTypeUuids = (tier.promoterTypes ?? []).map(p => p.uuid)
  state.accrualPeriodStrategy = tier.accrualPeriodStrategy ?? 'MONTHLY'
  state.accrualPeriodAnchor = tier.accrualPeriodAnchor != null ? String(tier.accrualPeriodAnchor) : ''
  state.partialSettlementPeriodStrategy = tier.partialSettlementPeriodStrategy ?? tier.accrualPeriodStrategy ?? 'MONTHLY'
  state.partialSettlementPeriodAnchor = tier.partialSettlementPeriodAnchor != null ? String(tier.partialSettlementPeriodAnchor) : ''
  state.finalSettlementPeriodStrategy = tier.finalSettlementPeriodStrategy ?? tier.accrualPeriodStrategy ?? 'MONTHLY'
  state.finalSettlementPeriodAnchor = tier.finalSettlementPeriodAnchor != null ? String(tier.finalSettlementPeriodAnchor) : ''
  state.retroactiveSettlementPeriodStrategy = tier.retroactiveSettlementPeriodStrategy ?? tier.accrualPeriodStrategy ?? 'MONTHLY'
  state.retroactiveSettlementPeriodAnchor = tier.retroactiveSettlementPeriodAnchor != null ? String(tier.retroactiveSettlementPeriodAnchor) : ''
  state.campaignUuid = tier.campaign_Uuid ?? ''
  state.startsAt = tier.startsAt ? isoToDatetimeLocal(tier.startsAt) : ''
  state.endsAt = tier.endsAt ? isoToDatetimeLocal(tier.endsAt) : ''
  isActive.value = tier.active ?? true
  editSnapshot.value = snapEditState()
}

watch(() => props.open, async (open) => {
  if (!open) return
  if (currencyItems.value.length === 0) await loadCurrencyOptions()
  if (promoterTypeItems.value.length === 0) await loadPromoterTypeOptions()
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
    let result: CollectionCommissionTierDto
    if (mode.value === 'create') {
      const body: CreateCollectionCommissionTierRequest = {
        name: state.name.trim(),
        description: state.description.trim() || null,
        basis: state.basis,
        maxDays: state.basis === 'DAYS' ? Number(state.maxDays) : null,
        minAmount: state.basis === 'AMOUNT' ? state.minAmount.trim() : null,
        minAmountCurrencyUuid: state.basis === 'AMOUNT' ? state.minAmountCurrencyUuid : null,
        commissionPct: state.rewardKind === 'PCT' ? state.commissionPct.trim() : null,
        flatAmount: state.rewardKind === 'FLAT' ? state.flatAmount.trim() : null,
        flatAmountCurrencyUuid: state.rewardKind === 'FLAT' ? state.flatAmountCurrencyUuid : null,
        promoterTypeUuids: state.promoterTypeUuids,
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
      result = await tiers.create(body)
      toast.add({ title: t('commissionRules.collectionTiers.createdToast'), color: 'success', icon: 'i-lucide-check-circle' })
    }
    else {
      const body: UpdateCollectionCommissionTierRequest = {
        name: state.name.trim(),
        description: state.description.trim() || null,
        basis: state.basis,
        maxDays: state.basis === 'DAYS' ? Number(state.maxDays) : null,
        minAmount: state.basis === 'AMOUNT' ? state.minAmount.trim() : null,
        minAmountCurrencyUuid: state.basis === 'AMOUNT' ? state.minAmountCurrencyUuid : null,
        commissionPct: state.rewardKind === 'PCT' ? state.commissionPct.trim() : null,
        flatAmount: state.rewardKind === 'FLAT' ? state.flatAmount.trim() : null,
        flatAmountCurrencyUuid: state.rewardKind === 'FLAT' ? state.flatAmountCurrencyUuid : null,
        promoterTypeUuids: state.promoterTypeUuids,
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
      body.active = isActive.value
      result = await tiers.update(props.tier!.uuid, body)
      toast.add({ title: t('commissionRules.collectionTiers.updatedToast'), color: 'success', icon: 'i-lucide-check-circle' })
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
    toast.add({ title: t('commissionRules.collectionTiers.restoredToast'), color: 'success', icon: 'i-lucide-check-circle' })
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
    :title="mode === 'create' ? t('commissionRules.collectionTiers.form.createTitle') : t('commissionRules.collectionTiers.form.editTitle')"
    :ui="{ content: 'max-w-2xl' }"
  >
    <template #body>
      <UForm ref="formRef" :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
        <UFormField :label="t('commissionRules.collectionTiers.form.name')" name="name" required>
          <UInput v-model="state.name" class="w-full" />
        </UFormField>

        <UFormField :label="t('commissionRules.collectionTiers.form.description')" name="description">
          <UTextarea v-model="state.description" :rows="2" class="w-full" />
        </UFormField>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('commissionRules.collectionTiers.form.basis')" name="basis" required>
            <USelectMenu v-model="state.basis" :items="basisOptions" label-key="label" value-key="value" class="w-full" />
          </UFormField>
          <UFormField v-if="state.basis === 'DAYS'" :label="t('commissionRules.collectionTiers.form.maxDays')" name="maxDays" required :help="t('commissionRules.collectionTiers.form.maxDaysHelp')">
            <UInput v-model="state.maxDays" inputmode="numeric" placeholder="5" class="w-full" />
          </UFormField>
          <UFormField v-else :label="t('commissionRules.collectionTiers.form.minAmount')" name="minAmount" required :help="t('commissionRules.collectionTiers.form.minAmountHelp')">
            <CurrencyConverterDisplay :amount="state.minAmount" :currency="minAmountCurrencyCode" :date="flatAmountConversionDate" v-slot="{ result }">
              <UInput v-model="state.minAmount" inputmode="decimal" placeholder="100.00" class="w-full">
                <template #trailing>
                  <CurrencyConverterTrigger :result="result" />
                </template>
              </UInput>
            </CurrencyConverterDisplay>
          </UFormField>
        </div>
        <UFormField v-if="state.basis === 'AMOUNT'" :label="t('commissionRules.collectionTiers.form.minAmountCurrency')" name="minAmountCurrencyUuid" required :help="t('commissionRules.collectionTiers.form.minAmountCurrencyHelp')">
          <CommonEntityReferenceSelect
            v-model="state.minAmountCurrencyUuid"
            :items="currencyItems"
            entity="currency"
            :loading="loadingCurrencies"
            :placeholder="t('common.select')"
            class="w-full"
            @navigate="goToCurrency"
          />
        </UFormField>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('commissionRules.collectionTiers.form.accrualPeriodStrategy')" name="accrualPeriodStrategy" required>
            <USelectMenu clear v-model="state.accrualPeriodStrategy" :items="periodOptions" label-key="label" value-key="value" class="w-full" />
          </UFormField>
        </div>
        <UFormField v-if="anchorKindFor(state.accrualPeriodStrategy) === 'weekday'" :label="t('commissionRules.collectionTiers.form.anchorWeekday')" name="accrualPeriodAnchor">
          <USelectMenu clear v-model="state.accrualPeriodAnchor" :items="weekdayOptions" label-key="label" value-key="value" class="w-full" />
        </UFormField>
        <UFormField v-else-if="anchorKindFor(state.accrualPeriodStrategy) === 'monthday'" :label="t('commissionRules.collectionTiers.form.anchorMonthday')" name="accrualPeriodAnchor" :help="t('commissionRules.collectionTiers.form.anchorMonthdayHelp')">
          <UInput v-model="state.accrualPeriodAnchor" inputmode="numeric" min="1" max="31" class="w-full" />
        </UFormField>

        <div>
          <UButton
            color="neutral"
            variant="ghost"
            size="sm"
            :icon="showAdvanced ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
            :label="showAdvanced ? t('commissionRules.collectionTiers.form.hideAdvanced') : t('commissionRules.collectionTiers.form.showAdvanced')"
            @click="showAdvanced = !showAdvanced"
          />
        </div>

        <div v-if="showAdvanced" class="space-y-4 rounded-lg border border-prohealth-200 p-4">
          <p class="text-sm font-medium text-prohealth-700">{{ t('commissionRules.collectionTiers.form.advancedSection') }}</p>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField :label="t('commissionRules.collectionTiers.form.partialSettlementPeriodStrategy')" name="partialSettlementPeriodStrategy" required>
              <USelectMenu clear v-model="state.partialSettlementPeriodStrategy" :items="periodOptions" label-key="label" value-key="value" class="w-full" />
            </UFormField>
            <UFormField v-if="anchorKindFor(state.partialSettlementPeriodStrategy) === 'weekday'" :label="t('commissionRules.collectionTiers.form.anchorWeekday')" name="partialSettlementPeriodAnchor">
              <USelectMenu clear v-model="state.partialSettlementPeriodAnchor" :items="weekdayOptions" label-key="label" value-key="value" class="w-full" />
            </UFormField>
            <UFormField v-else-if="anchorKindFor(state.partialSettlementPeriodStrategy) === 'monthday'" :label="t('commissionRules.collectionTiers.form.anchorMonthday')" name="partialSettlementPeriodAnchor" :help="t('commissionRules.collectionTiers.form.anchorMonthdayHelp')">
              <UInput v-model="state.partialSettlementPeriodAnchor" inputmode="numeric" min="1" max="31" class="w-full" />
            </UFormField>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField :label="t('commissionRules.collectionTiers.form.finalSettlementPeriodStrategy')" name="finalSettlementPeriodStrategy" required>
              <USelectMenu clear v-model="state.finalSettlementPeriodStrategy" :items="periodOptions" label-key="label" value-key="value" class="w-full" />
            </UFormField>
            <UFormField v-if="anchorKindFor(state.finalSettlementPeriodStrategy) === 'weekday'" :label="t('commissionRules.collectionTiers.form.anchorWeekday')" name="finalSettlementPeriodAnchor">
              <USelectMenu clear v-model="state.finalSettlementPeriodAnchor" :items="weekdayOptions" label-key="label" value-key="value" class="w-full" />
            </UFormField>
            <UFormField v-else-if="anchorKindFor(state.finalSettlementPeriodStrategy) === 'monthday'" :label="t('commissionRules.collectionTiers.form.anchorMonthday')" name="finalSettlementPeriodAnchor" :help="t('commissionRules.collectionTiers.form.anchorMonthdayHelp')">
              <UInput v-model="state.finalSettlementPeriodAnchor" inputmode="numeric" min="1" max="31" class="w-full" />
            </UFormField>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField :label="t('commissionRules.collectionTiers.form.retroactiveSettlementPeriodStrategy')" name="retroactiveSettlementPeriodStrategy"
                        :required="retroactiveEnabled" :help="!retroactiveEnabled ? t('commissionRules.collectionTiers.form.retroactiveDisabledHelp') : undefined">
              <USelectMenu clear v-model="state.retroactiveSettlementPeriodStrategy" :items="retroactiveOptions" :disabled="!retroactiveEnabled" label-key="label" value-key="value" class="w-full" />
            </UFormField>
            <UFormField v-if="anchorKindFor(state.retroactiveSettlementPeriodStrategy) === 'weekday'" :label="t('commissionRules.collectionTiers.form.anchorWeekday')" name="retroactiveSettlementPeriodAnchor">
              <USelectMenu clear v-model="state.retroactiveSettlementPeriodAnchor" :items="weekdayOptions" label-key="label" value-key="value" class="w-full" />
            </UFormField>
            <UFormField v-else-if="anchorKindFor(state.retroactiveSettlementPeriodStrategy) === 'monthday'" :label="t('commissionRules.collectionTiers.form.anchorMonthday')" name="retroactiveSettlementPeriodAnchor" :help="t('commissionRules.collectionTiers.form.anchorMonthdayHelp')">
              <UInput v-model="state.retroactiveSettlementPeriodAnchor" inputmode="numeric" min="1" max="31" class="w-full" />
            </UFormField>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('commissionRules.tiers.form.rewardKind')" name="rewardKind" required>
            <USelectMenu v-model="state.rewardKind" :items="rewardKindOptions" label-key="label" value-key="value" class="w-full" />
          </UFormField>
          <UFormField v-if="state.rewardKind === 'PCT'" :label="t('commissionRules.collectionTiers.form.commissionPct')" name="commissionPct" required>
            <UInput v-model="state.commissionPct" placeholder="35.00" class="w-full">
              <template #trailing><span class="text-prohealth-400 text-sm">%</span></template>
            </UInput>
          </UFormField>
          <UFormField v-else :label="t('commissionRules.collectionTiers.form.flatAmount')" name="flatAmount" required>
            <CurrencyConverterDisplay :amount="state.flatAmount" :currency="flatAmountCurrencyCode" :date="flatAmountConversionDate" v-slot="{ result }">
              <UInput v-model="state.flatAmount" placeholder="5.00" class="w-full">
                <template #trailing>
                  <CurrencyConverterTrigger :result="result" />
                </template>
              </UInput>
            </CurrencyConverterDisplay>
          </UFormField>
        </div>

        <UFormField v-if="state.rewardKind === 'FLAT'" :label="t('commissionRules.collectionTiers.form.flatAmountCurrency')" name="flatAmountCurrencyUuid" required :help="t('commissionRules.collectionTiers.form.flatAmountCurrencyHelp')">
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

        <UFormField :label="t('campaigns.form.campaign')" name="campaignUuid">
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
          />
        </UFormField>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('commissionRules.tiers.form.startsAt')" name="startsAt">
            <AppDateTimePicker v-model="state.startsAt" />
          </UFormField>
          <UFormField :label="t('commissionRules.tiers.form.endsAt')" name="endsAt">
            <AppDateTimePicker v-model="state.endsAt" />
          </UFormField>
        </div>

        <UFormField v-if="mode === 'edit'" :label="t('commissionRules.collectionTiers.form.active')">
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
