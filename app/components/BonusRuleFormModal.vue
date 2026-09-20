<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type {
  AccrualMode,
  BonusMetric,
  BonusRuleDto,
  BonusRuleRequest,
  RewardType,
  WindowStrategy,
} from '~/types/bonusRules'
import {
  ACCRUAL_MODE_OPTIONS,
  BONUS_METRIC_OPTIONS,
  REWARD_TYPE_OPTIONS,
  WINDOW_STRATEGY_OPTIONS,
} from '~/types/bonusRules'
import type { SelectItem } from '~/types/options'

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
const toast = useToast()

const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})

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
const windowOptions = computed(() => WINDOW_STRATEGY_OPTIONS.map(o => ({ label: t(o.labelKey), value: o.value })))
const rewardTypeOptions = computed(() => REWARD_TYPE_OPTIONS.map(o => ({ label: t(o.labelKey), value: o.value })))

interface FormState {
  name: string
  description: string
  metric: BonusMetric | undefined
  accrual: AccrualMode | undefined
  thresholdCount: string
  windowStrategy: WindowStrategy | undefined
  campaignStart: string
  campaignEnd: string
  rewardType: RewardType | undefined
  flatAmount: string
  rewardPct: string
  rewardCurrency: string
  includeSystemPromoters: boolean
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
  windowStrategy: 'MONTHLY',
  campaignStart: '',
  campaignEnd: '',
  rewardType: 'FLAT',
  flatAmount: '',
  rewardPct: '',
  rewardCurrency: 'USD',
  includeSystemPromoters: false,
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

const isCampaign = computed(() => state.windowStrategy === 'CAMPAIGN')

const schema = computed(() => {
  const money = z.string().regex(/^\d+(\.\d{1,2})?$/, t('commissionRules.form.invalidAmount'))
  const int = z.string().regex(/^\d+$/, t('commissionRules.form.integersOnly'))
  return z.object({
    name: z.string().min(3, t('validation.minChars', { n: 3 })).max(150, t('validation.maxChars', { n: 150 })),
    description: z.string().optional(),
    metric: z.string({ message: t('validation.required') }).min(1, t('validation.required')),
    accrual: z.string({ message: t('validation.required') }).min(1, t('validation.required')),
    thresholdCount: int,
    windowStrategy: z.string({ message: t('validation.required') }).min(1, t('validation.required')),
    campaignStart: isCampaign.value ? z.string().min(1, t('validation.required')) : z.string().optional(),
    campaignEnd: isCampaign.value ? z.string().min(1, t('validation.required')) : z.string().optional(),
    rewardType: z.string({ message: t('validation.required') }).min(1, t('validation.required')),
    flatAmount: state.rewardType === 'FLAT' ? money : z.string().optional(),
    rewardPct: state.rewardType === 'PERCENTAGE' ? money : z.string().optional(),
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
    state.windowStrategy = 'MONTHLY'
    state.campaignStart = ''
    state.campaignEnd = ''
    state.rewardType = 'FLAT'
    state.flatAmount = ''
    state.rewardPct = ''
    state.rewardCurrency = 'USD'
    state.includeSystemPromoters = false
    state.campaignUuid = props.campaignUuid ?? ''
    state.startsAt = ''
    state.endsAt = ''
    nextTick(() => { suppressCampaignAutofill.value = false })
    return
  }
  state.name = rule.name
  state.description = rule.description ?? ''
  state.metric = rule.metric
  state.accrual = rule.accrual
  state.thresholdCount = String(rule.thresholdCount ?? '')
  state.windowStrategy = rule.windowStrategy
  state.campaignStart = rule.campaignStart ?? ''
  state.campaignEnd = rule.campaignEnd ?? ''
  state.rewardType = rule.rewardType
  state.flatAmount = rule.flatAmount != null ? String(rule.flatAmount) : ''
  state.rewardPct = rule.rewardPct != null ? String(rule.rewardPct) : ''
  state.rewardCurrency = rule.rewardCurrency ?? 'USD'
  state.includeSystemPromoters = rule.includeSystemPromoters ?? false
  state.campaignUuid = rule.campaign_Uuid ?? ''
  state.startsAt = rule.startsAt ? isoToDatetimeLocal(rule.startsAt) : ''
  state.endsAt = rule.endsAt ? isoToDatetimeLocal(rule.endsAt) : ''
  editSnapshot.value = snapEditState()
  nextTick(() => { suppressCampaignAutofill.value = false })
}

watch(() => props.open, (open) => { if (open) populateFrom(props.rule ?? null) })

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
      thresholdCount: Number(state.thresholdCount),
      windowStrategy: state.windowStrategy!,
      campaignStart: isCampaign.value ? state.campaignStart : null,
      campaignEnd: isCampaign.value ? state.campaignEnd : null,
      rewardType: state.rewardType!,
      flatAmount: state.rewardType === 'FLAT' ? state.flatAmount.trim() : null,
      rewardPct: state.rewardType === 'PERCENTAGE' ? state.rewardPct.trim() : null,
      rewardCurrency: state.rewardCurrency,
      includeSystemPromoters: state.includeSystemPromoters,
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
          <UFormField :label="t('commissionRules.bonusRules.form.thresholdCount')" name="thresholdCount" required>
            <UInput v-model="state.thresholdCount" inputmode="numeric" class="w-full" />
          </UFormField>
          <UFormField :label="t('commissionRules.bonusRules.form.windowStrategy')" name="windowStrategy" required>
            <USelectMenu clear v-model="state.windowStrategy" :items="windowOptions" label-key="label" value-key="value" class="w-full" />
          </UFormField>
        </div>

        <div v-if="isCampaign" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('commissionRules.bonusRules.form.campaignStart')" name="campaignStart" required>
            <UInput v-model="state.campaignStart" type="date" class="w-full" />
          </UFormField>
          <UFormField :label="t('commissionRules.bonusRules.form.campaignEnd')" name="campaignEnd" required>
            <UInput v-model="state.campaignEnd" type="date" class="w-full" />
          </UFormField>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('commissionRules.bonusRules.form.rewardType')" name="rewardType" required>
            <USelectMenu clear v-model="state.rewardType" :items="rewardTypeOptions" label-key="label" value-key="value" class="w-full" />
          </UFormField>
          <UFormField v-if="state.rewardType === 'FLAT'" :label="t('commissionRules.bonusRules.form.flatAmount')" name="flatAmount" required>
            <UInput v-model="state.flatAmount" placeholder="100.00" class="w-full">
              <template #leading><span class="text-prohealth-400 text-sm">$</span></template>
            </UInput>
          </UFormField>
          <UFormField v-else :label="t('commissionRules.bonusRules.form.rewardPct')" name="rewardPct" required>
            <UInput v-model="state.rewardPct" placeholder="10.00" class="w-full">
              <template #trailing><span class="text-prohealth-400 text-sm">%</span></template>
            </UInput>
          </UFormField>
        </div>

        <UFormField :label="t('commissionRules.bonusRules.form.includeSystemPromoters')" name="includeSystemPromoters">
          <USwitch v-model="state.includeSystemPromoters" />
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
            <UInput v-model="state.startsAt" type="datetime-local" class="w-full" />
          </UFormField>
          <UFormField :label="t('commissionRules.bonusRules.form.endsAt')" name="endsAt">
            <UInput v-model="state.endsAt" type="datetime-local" class="w-full" />
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
