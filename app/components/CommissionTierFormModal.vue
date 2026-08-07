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

const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})
const mode = computed<'create' | 'edit'>(() => (props.tier ? 'edit' : 'create'))
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
}

watch(() => props.open, (open) => { if (open) populateFrom(props.tier ?? null) })

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
      result = await tiers.update(props.tier!.uuid, base as UpdateCommissionTierRequest)
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

        <p class="text-xs text-prohealth-500">{{ t('common.requiredFieldsHint') }}</p>

        <div class="flex items-center justify-between gap-3 pt-2">
          <div v-if="mode === 'edit' && tier">
            <UButton color="error" variant="ghost" icon="i-lucide-trash-2" size="sm" :label="t('common.delete')" :disabled="isSubmitting" @click="openDeleteFromEdit" />
          </div>
          <div v-else />
          <div class="flex items-center gap-3">
            <UButton color="neutral" variant="ghost" :disabled="isSubmitting" @click="isOpen = false">{{ t('common.cancel') }}</UButton>
            <UButton type="submit" color="primary" :loading="isSubmitting" icon="i-lucide-save">
              {{ mode === 'create' ? t('commissionRules.tiers.form.submitCreate') : t('common.saveChanges') }}
            </UButton>
          </div>
        </div>
      </UForm>
    </template>
  </UModal>
</template>
