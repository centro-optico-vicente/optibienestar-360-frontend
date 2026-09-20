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

// Create/edit form for a bonus rule (bono por escala, ADR 0013 §2). The backend
// replaces the whole row on PUT (no PATCH semantics), so both create and update
// send the same full BonusRuleRequest shape.
const props = defineProps<{
  open: boolean
  rule?: BonusRuleDto | null
  /** Preset campaign_id (ASSUMPTION, not yet confirmed) when created from the campaign ficha's "Add rule" flow. */
  campaignUuid?: string | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'saved': [rule: BonusRuleDto]
  'delete': [rule: BonusRuleDto]
}>()

const { t } = useI18n()
const bonusRules = useBonusRules()
const toast = useToast()

const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})
const mode = computed<'create' | 'edit'>(() => (props.rule ? 'edit' : 'create'))
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
  editSnapshot.value = snapEditState()
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
    }
    let result: BonusRuleDto
    if (mode.value === 'create') {
      result = await bonusRules.create({ ...body, campaignUuid: props.campaignUuid ?? null })
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
