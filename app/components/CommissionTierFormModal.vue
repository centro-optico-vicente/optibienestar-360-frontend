<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type {
  AppliesTo,
  CommissionTierDto,
  CreateCommissionTierRequest,
  PeriodStrategy,
  UpdateCommissionTierRequest,
} from '~/types/commissionTiers'
import { APPLIES_TO_OPTIONS, PERIOD_STRATEGY_OPTIONS } from '~/types/commissionTiers'
import { PLAN_TYPE_OPTIONS } from '~/types/plans'

// Create/edit form for a commission tier (bandas de inscripción, ADR 0013 §1).
// Exactly one of commissionPct / flatAmount is set — the "reward" select below
// picks which one the form captures.
const props = defineProps<{
  open: boolean
  tier?: CommissionTierDto | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'saved': [tier: CommissionTierDto]
  'delete': [tier: CommissionTierDto]
}>()

const { t } = useI18n()
const tiers = useCommissionTiers()
const toast = useToast()
const { can } = usePermissions()

const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})
const mode = computed<'create' | 'edit'>(() => (props.tier ? 'edit' : 'create'))
const canManage = computed(() => can(mode.value === 'edit' ? 'COMMISSION_TIER_UPDATE' : 'COMMISSION_TIER_CREATE'))
const isSubmitting = ref(false)

const planTypeOptions = computed(() => [
  { label: t('commissionRules.tiers.allPlans'), value: '' },
  ...PLAN_TYPE_OPTIONS.map(o => ({ label: t(o.labelKey), value: o.value })),
])
const periodOptions = computed(() => PERIOD_STRATEGY_OPTIONS.map(o => ({ label: t(o.labelKey), value: o.value })))
const appliesToOptions = computed(() => APPLIES_TO_OPTIONS.map(o => ({ label: t(o.labelKey), value: o.value })))
const rewardKindOptions = computed(() => [
  { label: t('commissionRules.tiers.rewardKindPct'), value: 'PCT' },
  { label: t('commissionRules.tiers.rewardKindFlat'), value: 'FLAT' },
])

interface FormState {
  name: string
  planType: string
  thresholdCount: string
  rewardKind: 'PCT' | 'FLAT'
  commissionPct: string
  flatAmount: string
  periodStrategy: PeriodStrategy | undefined
  appliesTo: AppliesTo | undefined
}

const state = reactive<FormState>({
  name: '',
  planType: '',
  thresholdCount: '0',
  rewardKind: 'PCT',
  commissionPct: '',
  flatAmount: '',
  periodStrategy: 'MONTHLY',
  appliesTo: 'BOTH',
})
// Kept outside `state` (a string-only form-state map) so the boolean isn't coerced.
const isActive = ref(true)

const schema = computed(() => {
  const money = z.string().regex(/^\d+(\.\d{1,2})?$/, t('commissionRules.form.invalidAmount'))
  const int = z.string().regex(/^\d+$/, t('commissionRules.form.integersOnly'))
  return z.object({
    name: z.string().min(3, t('validation.minChars', { n: 3 })).max(80, t('validation.maxChars', { n: 80 })),
    thresholdCount: int,
    commissionPct: state.rewardKind === 'PCT' ? money : z.string().optional(),
    flatAmount: state.rewardKind === 'FLAT' ? money : z.string().optional(),
    periodStrategy: z.string({ message: t('validation.required') }).min(1, t('validation.required')),
    appliesTo: z.string({ message: t('validation.required') }).min(1, t('validation.required')),
  })
})

// Snapshot of the last-loaded edit state, used to warn before a refresh
// discards unsaved changes.
const editSnapshot = ref('')
function snapEditState() { return JSON.stringify({ ...state, isActive: isActive.value }) }
const isEditDirty = computed(() => editSnapshot.value !== '' && snapEditState() !== editSnapshot.value)
const discardConfirmOpen = ref(false)
const reloading = ref(false)

function populateFrom(tier: CommissionTierDto | null) {
  if (!tier) {
    state.name = ''
    state.planType = ''
    state.thresholdCount = '0'
    state.rewardKind = 'PCT'
    state.commissionPct = ''
    state.flatAmount = ''
    state.periodStrategy = 'MONTHLY'
    state.appliesTo = 'BOTH'
    isActive.value = true
    editSnapshot.value = ''
    return
  }
  state.name = tier.name
  state.planType = tier.planType ?? ''
  state.thresholdCount = String(tier.thresholdCount ?? 0)
  state.rewardKind = tier.flatAmount != null ? 'FLAT' : 'PCT'
  state.commissionPct = tier.commissionPct != null ? String(tier.commissionPct) : ''
  state.flatAmount = tier.flatAmount != null ? String(tier.flatAmount) : ''
  state.periodStrategy = tier.periodStrategy
  state.appliesTo = tier.appliesTo
  isActive.value = tier.active ?? true
  editSnapshot.value = snapEditState()
}

watch(() => props.open, (open) => { if (open) populateFrom(props.tier ?? null) })

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
      planType: state.planType || null,
      thresholdCount: Number(state.thresholdCount),
      commissionPct: state.rewardKind === 'PCT' ? state.commissionPct.trim() : null,
      flatAmount: state.rewardKind === 'FLAT' ? state.flatAmount.trim() : null,
      periodStrategy: state.periodStrategy!,
      appliesTo: state.appliesTo!,
    }
    let result: CommissionTierDto
    if (mode.value === 'create') {
      result = await tiers.create(base as CreateCommissionTierRequest)
      toast.add({ title: t('commissionRules.tiers.createdToast'), color: 'success', icon: 'i-lucide-check-circle' })
    }
    else {
      result = await tiers.update(props.tier!.uuid, { ...base, active: isActive.value } as UpdateCommissionTierRequest)
      toast.add({ title: t('commissionRules.tiers.updatedToast'), color: 'success', icon: 'i-lucide-check-circle' })
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
    toast.add({ title: t('commissionRules.tiers.restoredToast'), color: 'success', icon: 'i-lucide-check-circle' })
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
    :title="mode === 'create' ? t('commissionRules.tiers.form.createTitle') : t('commissionRules.tiers.form.editTitle')"
    :ui="{ content: 'max-w-2xl' }"
  >
    <template #body>
      <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
        <UFormField :label="t('commissionRules.tiers.form.name')" name="name" required>
          <UInput v-model="state.name" class="w-full" />
        </UFormField>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('commissionRules.tiers.form.planType')" name="planType" :help="t('commissionRules.tiers.form.planTypeHelp')">
            <USelectMenu v-model="state.planType" :items="planTypeOptions" label-key="label" value-key="value" class="w-full" />
          </UFormField>
          <UFormField :label="t('commissionRules.tiers.form.thresholdCount')" name="thresholdCount" required :help="t('commissionRules.tiers.form.thresholdHelp')">
            <UInput v-model="state.thresholdCount" inputmode="numeric" class="w-full" />
          </UFormField>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('commissionRules.tiers.form.periodStrategy')" name="periodStrategy" required>
            <USelectMenu v-model="state.periodStrategy" :items="periodOptions" label-key="label" value-key="value" class="w-full" />
          </UFormField>
          <UFormField :label="t('commissionRules.tiers.form.appliesTo')" name="appliesTo" required>
            <USelectMenu v-model="state.appliesTo" :items="appliesToOptions" label-key="label" value-key="value" class="w-full" />
          </UFormField>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('commissionRules.tiers.form.rewardKind')" name="rewardKind" required>
            <USelectMenu v-model="state.rewardKind" :items="rewardKindOptions" label-key="label" value-key="value" class="w-full" />
          </UFormField>
          <UFormField v-if="state.rewardKind === 'PCT'" :label="t('commissionRules.tiers.form.commissionPct')" name="commissionPct" required>
            <UInput v-model="state.commissionPct" placeholder="25.00" class="w-full">
              <template #trailing><span class="text-prohealth-400 text-sm">%</span></template>
            </UInput>
          </UFormField>
          <UFormField v-else :label="t('commissionRules.tiers.form.flatAmount')" name="flatAmount" required>
            <UInput v-model="state.flatAmount" placeholder="5.00" class="w-full">
              <template #leading><span class="text-prohealth-400 text-sm">$</span></template>
            </UInput>
          </UFormField>
        </div>

        <UFormField v-if="mode === 'edit'" :label="t('commissionRules.tiers.form.active')">
          <USwitch v-model="isActive" />
        </UFormField>

        <p class="text-xs text-prohealth-500">{{ t('common.requiredFieldsHint') }}</p>

        <div class="flex items-center justify-between gap-3 pt-2">
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
            <UButton type="submit" color="info" variant="outline" :loading="isSubmitting" icon="i-lucide-save">
              {{ mode === 'create' ? t('commissionRules.tiers.form.submitCreate') : t('common.saveChanges') }}
            </UButton>
          </div>
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
  </UModal>
</template>
