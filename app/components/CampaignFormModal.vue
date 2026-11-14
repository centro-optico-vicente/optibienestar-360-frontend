<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type {
  CampaignCloseCondition,
  CampaignDto,
  CampaignMode,
  CampaignScope,
  CreateCampaignRequest,
  UpdateCampaignRequest,
} from '~/types/campaign'
import { CAMPAIGN_MODE_OPTIONS, CAMPAIGN_SCOPE_OPTIONS } from '~/types/campaign'
import { todayInCaracas } from '~/utils/date'

// Create/edit form for a commission campaign. Used both as the standalone
// "quick edit" modal from the list and as the base for the "Relanzar campaña"
// flow (app/pages/dashboard/campaigns/[id].vue passes prefill via `campaign`
// with dates blanked out and no uuid, forcing create mode).
const props = defineProps<{
  open: boolean
  campaign?: CampaignDto | null
  /** Forces create mode even when `campaign` carries data (relaunch prefill). */
  forceCreate?: boolean
  /**
   * UUID of the campaign being relaunched. When set (together with `forceCreate`
   * and `campaign` prefilled with blank dates), submission calls
   * `useCampaigns().relaunch(relaunchOf, ...)` instead of `create`, so the
   * backend clones the source campaign's associated rules onto the new one.
   */
  relaunchOf?: string | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'saved': [campaign: CampaignDto]
  'delete': [campaign: CampaignDto]
}>()

const { t } = useI18n()
const campaigns = useCampaigns()
const currencies = useCurrencies()
const toast = useToast()

// ---- Currency options (goal amount) — same pattern as CommissionTierFormModal ----
const currencyCodeByUuid = ref<Record<string, string>>({})
// Searched on the server (`q`) when the dropdown opens and while typing; what was seen stays in the maps above.
const currencyLazy = useLazyOptions(async (q) => {
  const options = await currencies.options({ q })
  const withCode = options.filter(o => o.code)
  const found = withCode.map(o => ({ label: o.label, value: o.uuid }))
  currencyCodeByUuid.value = { ...currencyCodeByUuid.value, ...Object.fromEntries(withCode.map(o => [o.uuid, o.code as string])) }
  return found
})
const onCurrenciesOpen = currencyLazy.onOpen

/** Resolves `targetAmountCurrencyUuid` to its ISO code for `CurrencyConverterDisplay`. */
const targetAmountCurrencyCode = computed(() => currencyCodeByUuid.value[state.targetAmountCurrencyUuid] ?? null)

/**
 * The goal amount has no single "as of" date — it applies for the whole
 * campaign window. Clamp "today" into `[startsAt, endsAt]` (day granularity
 * is enough here) so the conversion preview always reflects a valid vigency
 * date: before the campaign starts it shows the rate as of the start date,
 * during it today's date, after it ends the rate as of the end date.
 */
const targetAmountConversionDate = computed(() => {
  const start = state.startsAt ? state.startsAt.slice(0, 10) : null
  const end = state.endsAt ? state.endsAt.slice(0, 10) : null
  if (!start && !end) return null
  const today = todayInCaracas()
  if (start && today < start) return start
  if (end && today > end) return end
  return today
})
function goToCurrency(to: string) {
  isOpen.value = false
  navigateTo(to)
}

const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})

const mode = computed<'create' | 'edit'>(() => (props.campaign && !props.forceCreate ? 'edit' : 'create'))
const isSubmitting = ref(false)
const reloading = ref(false)
const formRef = ref<{ submit: () => Promise<void> } | null>(null)

const scopeOptions = computed(() => CAMPAIGN_SCOPE_OPTIONS.map(o => ({ label: t(o.labelKey), value: o.value })))
const modeOptions = computed(() => CAMPAIGN_MODE_OPTIONS.map(o => ({ label: t(o.labelKey), value: o.value })))

interface FormState {
  name: string
  description: string
  /** `datetime-local` values — converted to/from an ISO instant at the edges. */
  startsAt: string
  endsAt: string
  scope: CampaignScope | undefined
  mode: CampaignMode | undefined
  evaluateOnlyAtEnd: boolean
  payOnlyAtEnd: boolean
  targetAmount: string
  targetAmountCurrencyUuid: string
  targetCount: string
  exclusivityGroup: string
  priority: string
  // ---- Closing rules and shared quota (hub ADR 0038) ----
  closeOnEndDate: boolean
  closeOnQuotaFilled: boolean
  /** Slots shared by every promotion; empty ⇒ no limit. */
  maxRedemptions: string
  /** Grace to confirm pending slots after closing: none, a fixed date, or N days. */
  graceMode: 'none' | 'date' | 'days'
  confirmGraceUntil: string
  confirmGraceDays: string
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

const state = reactive<FormState>({
  name: '',
  description: '',
  startsAt: '',
  endsAt: '',
  scope: 'ALL',
  mode: 'GENERAL',
  evaluateOnlyAtEnd: false,
  payOnlyAtEnd: false,
  targetAmount: '',
  targetAmountCurrencyUuid: '',
  targetCount: '',
  exclusivityGroup: '',
  priority: '',
  closeOnEndDate: true,
  closeOnQuotaFilled: false,
  maxRedemptions: '',
  graceMode: 'none',
  confirmGraceUntil: '',
  confirmGraceDays: '',
})
/** Create only: the "save as draft" button sends `draft: true` (the campaign starts as DRAFT). */
const saveAsDraft = ref(false)
const graceModeItems = computed(() => [
  { label: t('campaigns.form.grace.none'), value: 'none' },
  { label: t('campaigns.form.grace.date'), value: 'date' },
  { label: t('campaigns.form.grace.days'), value: 'days' },
])
/** The end date is needed by the END_DATE condition and by the "only at the end" commission switches. */
const endsAtRequired = computed(() => state.closeOnEndDate || state.evaluateOnlyAtEnd || state.payOnlyAtEnd)
/** Maps to CampaignRequest.enabled — the campaign's active/inactive editable flag on the entity.
 * NOT the same as CampaignDto.active (soft-delete status, only ever flipped by DELETE). */
const enabled = ref(true)

const schema = computed(() => z.object({
  name: z.string().min(3, t('validation.minChars', { n: 3 })).max(120, t('validation.maxChars', { n: 120 })),
  description: z.string().max(500, t('validation.maxChars', { n: 500 })).optional().or(z.literal('')),
  startsAt: z.string().min(1, t('validation.required')),
  endsAt: endsAtRequired.value
    ? z.string().min(1, t('campaigns.form.endsAtRequired')).refine(v => !state.startsAt || v > state.startsAt, t('campaigns.form.endsAfterStart'))
    : z.string().refine(v => !v || !state.startsAt || v > state.startsAt, t('campaigns.form.endsAfterStart')),
  maxRedemptions: state.closeOnQuotaFilled
    ? z.string().regex(/^[1-9]\d*$/, t('campaigns.form.maxRedemptionsRequired'))
    : z.string().regex(/^([1-9]\d*)?$/, t('commissionRules.form.integersOnly')),
  confirmGraceUntil: state.graceMode === 'date' ? z.string().min(1, t('validation.required')) : z.string().optional(),
  confirmGraceDays: state.graceMode === 'days'
    ? z.string().regex(/^[1-9]\d*$/, t('commissionRules.form.integersOnly'))
    : z.string().optional(),
  scope: z.string({ message: t('validation.required') }).min(1, t('validation.required')),
  mode: z.string({ message: t('validation.required') }).min(1, t('validation.required')),
  targetAmount: z.string().optional().or(z.literal('')),
  targetAmountCurrencyUuid: state.targetAmount.trim() ? z.string().min(1, t('validation.required')) : z.string().optional(),
  targetCount: z.string().regex(/^\d*$/, t('commissionRules.form.integersOnly')).optional().or(z.literal('')),
  exclusivityGroup: z.string().max(80, t('validation.maxChars', { n: 80 })).optional().or(z.literal('')),
  priority: z.string().regex(/^\d*$/, t('commissionRules.form.integersOnly')).optional().or(z.literal('')),
}))

function resetForm() {
  state.name = ''
  state.description = ''
  state.startsAt = ''
  state.endsAt = ''
  state.scope = 'ALL'
  state.mode = 'GENERAL'
  state.evaluateOnlyAtEnd = false
  state.payOnlyAtEnd = false
  state.targetAmount = ''
  state.targetAmountCurrencyUuid = ''
  state.targetCount = ''
  state.exclusivityGroup = ''
  state.priority = ''
  state.closeOnEndDate = true
  state.closeOnQuotaFilled = false
  state.maxRedemptions = ''
  state.graceMode = 'none'
  state.confirmGraceUntil = ''
  state.confirmGraceDays = ''
  enabled.value = true
}

function populateFrom(campaign: CampaignDto | null, blankDates: boolean) {
  if (!campaign) {
    resetForm()
    return
  }
  state.name = campaign.name
  state.description = campaign.description ?? ''
  state.startsAt = blankDates ? '' : isoToDatetimeLocal(campaign.startsAt)
  state.endsAt = blankDates ? '' : isoToDatetimeLocal(campaign.endsAt ?? '')
  state.scope = campaign.scope
  state.mode = campaign.mode
  state.evaluateOnlyAtEnd = campaign.evaluateOnlyAtEnd
  state.payOnlyAtEnd = campaign.payOnlyAtEnd
  state.targetAmount = campaign.targetAmount != null ? String(campaign.targetAmount) : ''
  state.targetAmountCurrencyUuid = campaign.targetAmountCurrency_Uuid ?? ''
  state.targetCount = campaign.targetCount != null ? String(campaign.targetCount) : ''
  state.exclusivityGroup = campaign.exclusivityGroup ?? ''
  state.priority = campaign.priority != null ? String(campaign.priority) : ''
  // Rows saved before the closing rules existed: they closed on their end date.
  const conditions: CampaignCloseCondition[] = campaign.closeConditions ?? (campaign.endsAt ? ['END_DATE'] : [])
  state.closeOnEndDate = conditions.includes('END_DATE')
  state.closeOnQuotaFilled = conditions.includes('QUOTA_FILLED')
  state.maxRedemptions = campaign.maxRedemptions != null ? String(campaign.maxRedemptions) : ''
  state.graceMode = campaign.confirmGraceUntil ? 'date' : (campaign.confirmGraceDays != null ? 'days' : 'none')
  state.confirmGraceUntil = campaign.confirmGraceUntil ? isoToDatetimeLocal(campaign.confirmGraceUntil) : ''
  state.confirmGraceDays = campaign.confirmGraceDays != null ? String(campaign.confirmGraceDays) : ''
  enabled.value = campaign.enabled ?? true
}

async function reloadForm() {
  if (!props.campaign) return
  reloading.value = true
  try {
    populateFrom(await campaigns.get(props.campaign.uuid), false)
  }
  catch {
    // useApi already notified
  }
  finally {
    reloading.value = false
  }
}

function requestDelete() {
  if (!props.campaign) return
  isOpen.value = false
  emit('delete', props.campaign)
}

watch(() => props.open, (open) => {
  if (!open) return
  populateFrom(props.campaign ?? null, props.forceCreate === true)
  if (state.targetAmountCurrencyUuid) onCurrenciesOpen(true)
})

function submitForm(draft: boolean) {
  saveAsDraft.value = draft
  formRef.value?.submit()
}

async function onSubmit(_e: FormSubmitEvent<Record<string, unknown>>) {
  isSubmitting.value = true
  try {
    const closeConditions: CampaignCloseCondition[] = [
      ...(state.closeOnEndDate ? ['END_DATE' as const] : []),
      ...(state.closeOnQuotaFilled ? ['QUOTA_FILLED' as const] : []),
    ]
    const base = {
      name: state.name.trim(),
      description: state.description.trim() || null,
      startsAt: datetimeLocalToIso(state.startsAt)!,
      endsAt: datetimeLocalToIso(state.endsAt) ?? null,
      scope: state.scope!,
      mode: state.mode!,
      evaluateOnlyAtEnd: state.evaluateOnlyAtEnd,
      payOnlyAtEnd: state.payOnlyAtEnd,
      targetAmount: state.targetAmount.trim() || null,
      targetAmountCurrencyUuid: state.targetAmount.trim() ? state.targetAmountCurrencyUuid : null,
      targetCount: state.targetCount.trim() ? Number(state.targetCount) : null,
      exclusivityGroup: state.exclusivityGroup.trim() || null,
      priority: state.priority.trim() ? Number(state.priority) : null,
      closeConditions,
      maxRedemptions: state.maxRedemptions.trim() ? Number(state.maxRedemptions) : null,
      confirmGraceUntil: state.graceMode === 'date' ? (datetimeLocalToIso(state.confirmGraceUntil) ?? null) : null,
      confirmGraceDays: state.graceMode === 'days' && state.confirmGraceDays.trim() ? Number(state.confirmGraceDays) : null,
    }
    let result: CampaignDto
    if (props.relaunchOf) {
      // CampaignRelaunchRequest only carries the new dates — name/description/config
      // are cloned server-side from the source campaign.
      result = await campaigns.relaunch(props.relaunchOf, {
        startsAt: base.startsAt,
        endsAt: base.endsAt,
      })
      toast.add({ title: t('campaigns.detail.relaunchToast'), color: 'success', icon: 'i-lucide-check-circle' })
    }
    else if (mode.value === 'create') {
      result = await campaigns.create({ ...base, enabled: enabled.value, draft: saveAsDraft.value } as CreateCampaignRequest)
      toast.add({ title: saveAsDraft.value ? t('campaigns.form.draftSavedToast') : t('campaigns.createdToast'), color: 'success', icon: 'i-lucide-check-circle' })
    }
    else {
      // CampaignRequest is a full replace (PUT) — `active` isn't a request field
      // (it's the soft-delete flag, only flipped via DELETE); `enabled` is.
      result = await campaigns.update(props.campaign!.uuid, { ...base, enabled: enabled.value } as UpdateCampaignRequest)
      toast.add({ title: t('campaigns.updatedToast'), color: 'success', icon: 'i-lucide-check-circle' })
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
</script>

<template>
  <UModal
    v-model:open="isOpen"
    :title="relaunchOf ? t('campaigns.detail.relaunch') : (mode === 'create' ? t('campaigns.form.createTitle') : t('campaigns.form.editTitle'))"
    :description="relaunchOf ? t('campaigns.form.relaunchDescription') : (mode === 'create' ? t('campaigns.form.createDescription') : t('campaigns.form.editDescription'))"
    :ui="MODAL_MEDIUM_UI"
  >
    <template #body>
      <UForm ref="formRef" :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
        <UFormField :label="t('campaigns.form.name')" name="name" required>
          <UInput v-model="state.name" class="w-full" />
        </UFormField>

        <UFormField :label="t('campaigns.form.description')" name="description">
          <UTextarea v-model="state.description" :rows="2" class="w-full" />
        </UFormField>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('campaigns.form.startsAt')" name="startsAt" required>
            <UInput v-model="state.startsAt" type="datetime-local" class="w-full" />
          </UFormField>
          <UFormField :label="t('campaigns.form.endsAt')" name="endsAt" :required="endsAtRequired" :help="endsAtRequired ? undefined : t('campaigns.form.endsAtOptionalHelp')">
            <UInput v-model="state.endsAt" type="datetime-local" class="w-full" />
          </UFormField>
        </div>

        <!-- Closing rules and shared quota (hub ADR 0038) -->
        <div class="rounded-xl border border-prohealth-100 p-4 space-y-3">
          <p class="text-sm font-semibold text-prohealth-900">{{ t('campaigns.form.closeConditions') }}</p>
          <div class="flex flex-wrap gap-4">
            <UCheckbox v-model="state.closeOnEndDate" :label="t('campaigns.closeCondition.END_DATE')" />
            <UCheckbox v-model="state.closeOnQuotaFilled" :label="t('campaigns.closeCondition.QUOTA_FILLED')" />
          </div>
          <p class="text-xs text-prohealth-500">{{ t('campaigns.form.manualCloseNote') }}</p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField
              :label="t('campaigns.form.maxRedemptions')"
              name="maxRedemptions"
              :required="state.closeOnQuotaFilled"
              :help="t('campaigns.form.maxRedemptionsHelp')"
            >
              <UInput v-model="state.maxRedemptions" inputmode="numeric" class="w-full" />
            </UFormField>
            <UFormField :label="t('campaigns.form.grace.label')" :help="t('campaigns.form.grace.help')">
              <USelectMenu v-model="state.graceMode" :items="graceModeItems" label-key="label" value-key="value" class="w-full" />
            </UFormField>
            <UFormField v-if="state.graceMode === 'date'" :label="t('campaigns.form.grace.untilLabel')" name="confirmGraceUntil" required>
              <UInput v-model="state.confirmGraceUntil" type="datetime-local" class="w-full" />
            </UFormField>
            <UFormField v-if="state.graceMode === 'days'" :label="t('campaigns.form.grace.daysLabel')" name="confirmGraceDays" required>
              <UInput v-model="state.confirmGraceDays" inputmode="numeric" class="w-full" />
            </UFormField>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('campaigns.form.scope')" name="scope" required>
            <USelectMenu clear v-model="state.scope" :items="scopeOptions" label-key="label" value-key="value" class="w-full" />
          </UFormField>
          <UFormField :label="t('campaigns.form.mode')" name="mode" required>
            <USelectMenu clear v-model="state.mode" :items="modeOptions" label-key="label" value-key="value" class="w-full" />
          </UFormField>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('campaigns.form.evaluateOnlyAtEnd')" :help="t('campaigns.form.evaluateOnlyAtEndHelp')">
            <USwitch v-model="state.evaluateOnlyAtEnd" />
          </UFormField>
          <UFormField :label="t('campaigns.form.payOnlyAtEnd')" :help="t('campaigns.form.payOnlyAtEndHelp')">
            <USwitch v-model="state.payOnlyAtEnd" />
          </UFormField>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('campaigns.form.targetAmount')" name="targetAmount" :help="t('campaigns.form.targetHelp')">
            <CurrencyConverterDisplay :amount="state.targetAmount" :currency="targetAmountCurrencyCode" :date="targetAmountConversionDate" v-slot="{ result }">
              <UInput v-model="state.targetAmount" placeholder="1000.00" class="w-full">
                <template #leading><span class="text-prohealth-400 text-sm">$</span></template>
                <template #trailing>
                  <CurrencyConverterTrigger :result="result" />
                </template>
              </UInput>
            </CurrencyConverterDisplay>
          </UFormField>
          <UFormField :label="t('campaigns.form.targetCount')" name="targetCount">
            <UInput v-model="state.targetCount" inputmode="numeric" class="w-full" />
          </UFormField>
        </div>

        <UFormField
          v-if="state.targetAmount.trim()"
          :label="t('campaigns.form.targetAmountCurrency')"
          name="targetAmountCurrencyUuid"
          required
        >
          <CommonEntityReferenceSelect
            v-model="state.targetAmountCurrencyUuid"
            entity="currency"
            :placeholder="t('common.select')"
            icon="i-lucide-coins"
            @navigate="goToCurrency"
            :lazy="currencyLazy"
          />
        </UFormField>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('campaigns.form.exclusivityGroup')" name="exclusivityGroup" :help="t('campaigns.form.exclusivityGroupHelp')">
            <UInput v-model="state.exclusivityGroup" class="w-full" />
          </UFormField>
          <UFormField :label="t('campaigns.form.priority')" name="priority" :help="t('campaigns.form.priorityHelp')">
            <UInput v-model="state.priority" inputmode="numeric" class="w-full" />
          </UFormField>
        </div>

        <UFormField v-if="mode === 'edit'" :label="t('campaigns.form.active')">
          <USwitch v-model="enabled" />
        </UFormField>
      </UForm>
    </template>

    <template #footer>
      <div class="w-full space-y-2">
        <p class="text-xs text-prohealth-500">{{ t('common.requiredFieldsHint') }}</p>
        <div class="flex items-center justify-between gap-3">
          <div>
            <UButton v-if="mode === 'edit' && campaign" color="error" variant="ghost" icon="i-lucide-trash-2" :disabled="isSubmitting" @click="requestDelete">
              {{ t('common.delete') }}
            </UButton>
          </div>
          <div class="flex items-center gap-3">
            <RefreshButton v-if="mode === 'edit'" :icon-only="false" :label="t('common.refresh')" :title="t('common.refresh')" :loading="reloading" :disabled="isSubmitting" @refresh="reloadForm" />
            <UButton color="neutral" variant="ghost" :disabled="isSubmitting" @click="isOpen = false">{{ t('common.cancel') }}</UButton>
            <UButton
              v-if="mode === 'create' && !relaunchOf"
              color="neutral"
              variant="outline"
              :loading="isSubmitting && saveAsDraft"
              :disabled="isSubmitting"
              icon="i-lucide-file-pen-line"
              @click="submitForm(true)"
            >
              {{ t('campaigns.form.saveDraft') }}
            </UButton>
            <UButton :color="mode === 'create' ? 'primary' : 'info'" variant="outline" :loading="isSubmitting && !saveAsDraft" :disabled="isSubmitting" icon="i-lucide-save" @click="submitForm(false)">
              {{ mode === 'create' ? t('common.saveNew') : t('common.saveChanges') }}
            </UButton>
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>
