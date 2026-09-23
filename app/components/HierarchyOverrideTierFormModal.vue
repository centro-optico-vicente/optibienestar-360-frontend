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
  thresholdCount: string
  rewardKind: 'PCT' | 'FLAT'
  overridePct: string
  flatAmount: string
  flatAmountCurrencyUuid: string
  periodStrategy: PeriodStrategy | undefined
  campaignUuid: string
  startsAt: string
  endsAt: string
}

const state = reactive<FormState>({
  name: '',
  description: '',
  rankUuid: '',
  category: undefined,
  thresholdCount: '0',
  rewardKind: 'PCT',
  overridePct: '',
  flatAmount: '',
  flatAmountCurrencyUuid: '',
  periodStrategy: 'MONTHLY',
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
  return z.object({
    name: z.string().min(3, t('validation.minChars', { n: 3 })).max(80, t('validation.maxChars', { n: 80 })),
    description: z.string().optional(),
    rankUuid: z.string({ message: t('validation.required') }).min(1, t('validation.required')),
    category: z.string({ message: t('validation.required') }).min(1, t('validation.required')),
    thresholdCount: int,
    overridePct: state.rewardKind === 'PCT' ? money : z.string().optional(),
    flatAmount: state.rewardKind === 'FLAT' ? money : z.string().optional(),
    flatAmountCurrencyUuid: state.rewardKind === 'FLAT'
      ? z.string({ message: t('validation.required') }).min(1, t('validation.required'))
      : z.string().optional(),
    periodStrategy: z.string({ message: t('validation.required') }).min(1, t('validation.required')),
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
    state.thresholdCount = '0'
    state.rewardKind = 'PCT'
    state.overridePct = ''
    state.flatAmount = ''
    state.flatAmountCurrencyUuid = ''
    state.periodStrategy = 'MONTHLY'
    state.campaignUuid = props.campaignUuid ?? ''
    state.startsAt = ''
    state.endsAt = ''
    isActive.value = true
    editSnapshot.value = ''
    nextTick(() => { suppressCampaignAutofill.value = false })
    return
  }
  state.name = tier.name
  state.description = tier.description ?? ''
  state.rankUuid = tier.rank_Uuid ?? ''
  state.category = tier.category
  state.thresholdCount = String(tier.thresholdCount ?? 0)
  state.rewardKind = tier.flatAmount != null ? 'FLAT' : 'PCT'
  state.overridePct = tier.overridePct != null ? String(tier.overridePct) : ''
  state.flatAmount = tier.flatAmount != null ? String(tier.flatAmount) : ''
  state.flatAmountCurrencyUuid = tier.flatAmountCurrency_Uuid ?? ''
  state.periodStrategy = tier.periodStrategy
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
      thresholdCount: Number(state.thresholdCount),
      overridePct: state.rewardKind === 'PCT' ? state.overridePct.trim() : null,
      flatAmount: state.rewardKind === 'FLAT' ? state.flatAmount.trim() : null,
      flatAmountCurrencyUuid: state.rewardKind === 'FLAT' ? state.flatAmountCurrencyUuid : null,
      periodStrategy: state.periodStrategy!,
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
          <UFormField :label="t('hierarchyOverrideTiers.form.thresholdCount')" name="thresholdCount" required :help="t('hierarchyOverrideTiers.form.thresholdHelp')">
            <UInput v-model="state.thresholdCount" inputmode="numeric" class="w-full" />
          </UFormField>
          <UFormField :label="t('hierarchyOverrideTiers.form.periodStrategy')" name="periodStrategy" required>
            <USelectMenu clear v-model="state.periodStrategy" :items="periodOptions" label-key="label" value-key="value" class="w-full" />
          </UFormField>
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
