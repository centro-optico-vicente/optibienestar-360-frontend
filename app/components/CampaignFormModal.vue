<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type {
  CampaignDto,
  CampaignMode,
  CampaignScope,
  CreateCampaignRequest,
  UpdateCampaignRequest,
} from '~/types/campaign'
import { CAMPAIGN_MODE_OPTIONS, CAMPAIGN_SCOPE_OPTIONS } from '~/types/campaign'

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
}>()

const { t } = useI18n()
const campaigns = useCampaigns()
const toast = useToast()

const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})

const mode = computed<'create' | 'edit'>(() => (props.campaign && !props.forceCreate ? 'edit' : 'create'))
const isSubmitting = ref(false)
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
  targetCount: string
  exclusivityGroup: string
  priority: string
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
  targetCount: '',
  exclusivityGroup: '',
  priority: '',
})
const isActive = ref(true)

const schema = computed(() => z.object({
  name: z.string().min(3, t('validation.minChars', { n: 3 })).max(120, t('validation.maxChars', { n: 120 })),
  description: z.string().max(500, t('validation.maxChars', { n: 500 })).optional().or(z.literal('')),
  startsAt: z.string().min(1, t('validation.required')),
  endsAt: z.string().min(1, t('validation.required')),
  scope: z.string({ message: t('validation.required') }).min(1, t('validation.required')),
  mode: z.string({ message: t('validation.required') }).min(1, t('validation.required')),
  targetAmount: z.string().optional().or(z.literal('')),
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
  state.targetCount = ''
  state.exclusivityGroup = ''
  state.priority = ''
  isActive.value = true
}

function populateFrom(campaign: CampaignDto | null, blankDates: boolean) {
  if (!campaign) {
    resetForm()
    return
  }
  state.name = campaign.name
  state.description = campaign.description ?? ''
  state.startsAt = blankDates ? '' : isoToDatetimeLocal(campaign.startsAt)
  state.endsAt = blankDates ? '' : isoToDatetimeLocal(campaign.endsAt)
  state.scope = campaign.scope
  state.mode = campaign.mode
  state.evaluateOnlyAtEnd = campaign.evaluateOnlyAtEnd
  state.payOnlyAtEnd = campaign.payOnlyAtEnd
  state.targetAmount = campaign.targetAmount != null ? String(campaign.targetAmount) : ''
  state.targetCount = campaign.targetCount != null ? String(campaign.targetCount) : ''
  state.exclusivityGroup = campaign.exclusivityGroup ?? ''
  state.priority = campaign.priority != null ? String(campaign.priority) : ''
  isActive.value = campaign.active ?? true
}

watch(() => props.open, (open) => {
  if (!open) return
  populateFrom(props.campaign ?? null, props.forceCreate === true)
})

async function onSubmit(_e: FormSubmitEvent<Record<string, unknown>>) {
  isSubmitting.value = true
  try {
    const base = {
      name: state.name.trim(),
      description: state.description.trim() || null,
      startsAt: datetimeLocalToIso(state.startsAt)!,
      endsAt: datetimeLocalToIso(state.endsAt)!,
      scope: state.scope!,
      mode: state.mode!,
      evaluateOnlyAtEnd: state.evaluateOnlyAtEnd,
      payOnlyAtEnd: state.payOnlyAtEnd,
      targetAmount: state.targetAmount.trim() || null,
      targetCount: state.targetCount.trim() ? Number(state.targetCount) : null,
      exclusivityGroup: state.exclusivityGroup.trim() || null,
      priority: state.priority.trim() ? Number(state.priority) : null,
    }
    let result: CampaignDto
    if (props.relaunchOf) {
      result = await campaigns.relaunch(props.relaunchOf, {
        name: base.name,
        description: base.description,
        startsAt: base.startsAt,
        endsAt: base.endsAt,
      })
      toast.add({ title: t('campaigns.detail.relaunchToast'), color: 'success', icon: 'i-lucide-check-circle' })
    }
    else if (mode.value === 'create') {
      result = await campaigns.create(base as CreateCampaignRequest)
      toast.add({ title: t('campaigns.createdToast'), color: 'success', icon: 'i-lucide-check-circle' })
    }
    else {
      result = await campaigns.update(props.campaign!.uuid, { ...base, active: isActive.value } as UpdateCampaignRequest)
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
    :ui="{ content: 'max-w-2xl' }"
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
          <UFormField :label="t('campaigns.form.endsAt')" name="endsAt" required>
            <UInput v-model="state.endsAt" type="datetime-local" class="w-full" />
          </UFormField>
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
            <UInput v-model="state.targetAmount" placeholder="1000.00" class="w-full">
              <template #leading><span class="text-prohealth-400 text-sm">$</span></template>
            </UInput>
          </UFormField>
          <UFormField :label="t('campaigns.form.targetCount')" name="targetCount">
            <UInput v-model="state.targetCount" inputmode="numeric" class="w-full" />
          </UFormField>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('campaigns.form.exclusivityGroup')" name="exclusivityGroup" :help="t('campaigns.form.exclusivityGroupHelp')">
            <UInput v-model="state.exclusivityGroup" class="w-full" />
          </UFormField>
          <UFormField :label="t('campaigns.form.priority')" name="priority" :help="t('campaigns.form.priorityHelp')">
            <UInput v-model="state.priority" inputmode="numeric" class="w-full" />
          </UFormField>
        </div>

        <UFormField v-if="mode === 'edit'" :label="t('campaigns.form.active')">
          <USwitch v-model="isActive" />
        </UFormField>
      </UForm>
    </template>

    <template #footer>
      <div class="w-full space-y-2">
        <p class="text-xs text-prohealth-500">{{ t('common.requiredFieldsHint') }}</p>
        <div class="flex items-center justify-end gap-3">
          <UButton color="neutral" variant="ghost" :disabled="isSubmitting" @click="isOpen = false">{{ t('common.cancel') }}</UButton>
          <UButton :color="mode === 'create' ? 'primary' : 'info'" variant="outline" :loading="isSubmitting" icon="i-lucide-save" @click="formRef?.submit()">
            {{ mode === 'create' ? t('common.saveNew') : t('common.saveChanges') }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
