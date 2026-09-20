<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type {
  CollectionCommissionTierDto,
  CreateCollectionCommissionTierRequest,
  UpdateCollectionCommissionTierRequest,
} from '~/types/collectionCommissionTiers'
import type { SelectItem } from '~/types/options'

// Create/edit form for a collection commission tier (comisión de cobranza por
// días, ADR 0013 §3, V44) — a decreasing-% bucket by days-to-collect.
const props = defineProps<{
  open: boolean
  tier?: CollectionCommissionTierDto | null
  /** Preset campaign_id when created from the campaign ficha's "Add rule" flow. Not yet a real backend field on this entity (see report); harmless no-op until the backend adds it. */
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
const loadingCurrencies = ref(false)
async function loadCurrencyOptions() {
  loadingCurrencies.value = true
  try {
    const options = await currencies.options()
    currencyItems.value = options.filter(o => o.code).map(o => ({ label: `${o.code} — ${o.label}`, value: o.uuid }))
  }
  catch { currencyItems.value = [] }
  finally { loadingCurrencies.value = false }
}
async function searchCampaigns(q: string): Promise<SelectItem[]> {
  const res = await campaignsApi.list({ q, size: 20 })
  return (res.content ?? []).map(c => ({ label: c.name, value: c.uuid }))
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

interface FormState {
  name: string
  description: string
  basis: 'DAYS' | 'AMOUNT'
  maxDays: string
  maxAmount: string
  rewardKind: 'PCT' | 'FLAT'
  commissionPct: string
  flatAmount: string
  flatAmountCurrencyUuid: string
  campaignUuid: string
  startsAt: string
  endsAt: string
}

const state = reactive<FormState>({
  name: '', description: '', basis: 'DAYS', maxDays: '', maxAmount: '',
  rewardKind: 'PCT', commissionPct: '', flatAmount: '', flatAmountCurrencyUuid: '',
  campaignUuid: '', startsAt: '', endsAt: '',
})
// Kept outside `state` (a string-only form-state map) so the boolean isn't coerced.
const isActive = ref(true)

const schema = computed(() => z.object({
  name: z.string().min(3, t('validation.minChars', { n: 3 })).max(80, t('validation.maxChars', { n: 80 })),
  description: z.string().optional(),
  maxDays: state.basis === 'DAYS' ? z.string().regex(/^[1-9]\d*$/, t('commissionRules.form.integersOnly')) : z.string().optional(),
  maxAmount: state.basis === 'AMOUNT' ? z.string().regex(/^\d+(\.\d{1,2})?$/, t('commissionRules.form.invalidAmount')) : z.string().optional(),
  commissionPct: state.rewardKind === 'PCT' ? z.string().regex(/^\d+(\.\d{1,2})?$/, t('commissionRules.form.invalidAmount')) : z.string().optional(),
  flatAmount: state.rewardKind === 'FLAT' ? z.string().regex(/^\d+(\.\d{1,2})?$/, t('commissionRules.form.invalidAmount')) : z.string().optional(),
  flatAmountCurrencyUuid: state.rewardKind === 'FLAT' ? z.string().min(1, t('validation.required')) : z.string().optional(),
}))

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
    state.maxAmount = ''
    state.rewardKind = 'PCT'
    state.commissionPct = ''
    state.flatAmount = ''
    state.flatAmountCurrencyUuid = ''
    state.campaignUuid = props.campaignUuid ?? ''
    state.startsAt = ''
    state.endsAt = ''
    isActive.value = true
    editSnapshot.value = ''
    return
  }
  state.name = tier.name
  state.description = tier.description ?? ''
  state.basis = tier.basis ?? 'DAYS'
  state.maxDays = String(tier.maxDays)
  state.maxAmount = tier.maxAmount != null ? String(tier.maxAmount) : ''
  state.rewardKind = tier.flatAmount != null ? 'FLAT' : 'PCT'
  state.commissionPct = tier.commissionPct != null ? String(tier.commissionPct) : ''
  state.flatAmount = tier.flatAmount != null ? String(tier.flatAmount) : ''
  state.flatAmountCurrencyUuid = tier.flatAmountCurrency_Uuid ?? ''
  state.campaignUuid = tier.campaign_Uuid ?? ''
  state.startsAt = tier.startsAt ? isoToDatetimeLocal(tier.startsAt) : ''
  state.endsAt = tier.endsAt ? isoToDatetimeLocal(tier.endsAt) : ''
  isActive.value = tier.active ?? true
  editSnapshot.value = snapEditState()
}

watch(() => props.open, async (open) => {
  if (!open) return
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
    let result: CollectionCommissionTierDto
    if (mode.value === 'create') {
      const body: CreateCollectionCommissionTierRequest = {
        name: state.name.trim(),
        description: state.description.trim() || null,
        basis: state.basis,
        maxDays: state.basis === 'DAYS' ? Number(state.maxDays) : null,
        maxAmount: state.basis === 'AMOUNT' ? state.maxAmount.trim() : null,
        commissionPct: state.rewardKind === 'PCT' ? state.commissionPct.trim() : null,
        flatAmount: state.rewardKind === 'FLAT' ? state.flatAmount.trim() : null,
        flatAmountCurrencyUuid: state.rewardKind === 'FLAT' ? state.flatAmountCurrencyUuid : null,
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
        maxAmount: state.basis === 'AMOUNT' ? state.maxAmount.trim() : null,
        commissionPct: state.rewardKind === 'PCT' ? state.commissionPct.trim() : null,
        flatAmount: state.rewardKind === 'FLAT' ? state.flatAmount.trim() : null,
        flatAmountCurrencyUuid: state.rewardKind === 'FLAT' ? state.flatAmountCurrencyUuid : null,
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
    :ui="{ content: 'max-w-lg' }"
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
          <UFormField v-else :label="t('commissionRules.collectionTiers.form.maxAmount')" name="maxAmount" required>
            <UInput v-model="state.maxAmount" inputmode="decimal" placeholder="100.00" class="w-full" />
          </UFormField>
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
            <UInput v-model="state.flatAmount" placeholder="5.00" class="w-full" />
          </UFormField>
        </div>

        <UFormField v-if="state.rewardKind === 'FLAT'" :label="t('commissionRules.collectionTiers.form.flatAmountCurrency')" name="flatAmountCurrencyUuid" required>
          <USelectMenu v-model="state.flatAmountCurrencyUuid" :items="currencyItems" label-key="label" value-key="value" :loading="loadingCurrencies" class="w-full" />
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
            <UInput v-model="state.startsAt" type="datetime-local" class="w-full" />
          </UFormField>
          <UFormField :label="t('commissionRules.tiers.form.endsAt')" name="endsAt">
            <UInput v-model="state.endsAt" type="datetime-local" class="w-full" />
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
