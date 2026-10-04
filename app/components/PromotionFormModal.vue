<script setup lang="ts">
import type { PromotionAppliesTo, PromotionDto, PromotionKind, PromotionRequest } from '~/types/promotions'

/**
 * Create/edit a campaign promotion (hub ADR 0018). Mirrors the backend rules:
 * RECOVERY only discounts monthly fees, a required code needs at least one
 * accepted owner, and the referrer reward needs member codes plus both values.
 */
const props = defineProps<{
  open: boolean
  campaignUuid: string
  promotion: PromotionDto | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'saved': [promotion: PromotionDto]
}>()

const { t } = useI18n()
const promotionsApi = usePromotions()
const plansApi = usePlans()
const toast = useToast()

const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})
const isEdit = computed(() => !!props.promotion)

const kindItems = computed(() => [
  { label: t('promotions.kind.ACQUISITION'), value: 'ACQUISITION' },
  { label: t('promotions.kind.RECOVERY'), value: 'RECOVERY' },
])
const appliesToItems = computed(() => [
  { label: t('promotions.appliesTo.INSCRIPTION'), value: 'INSCRIPTION' },
  { label: t('promotions.appliesTo.MONTHLY'), value: 'MONTHLY' },
  { label: t('promotions.appliesTo.BOTH'), value: 'BOTH' },
])
const planItems = ref<{ label: string, value: string }[]>([])

const state = reactive({
  name: '',
  description: '',
  kind: 'ACQUISITION' as PromotionKind,
  discountPct: undefined as number | undefined,
  appliesTo: 'BOTH' as PromotionAppliesTo,
  cycles: undefined as number | undefined,
  coversExtraBeneficiaries: false,
  maxRedemptions: undefined as number | undefined,
  requiresCode: false,
  acceptsPromoterCode: false,
  acceptsMemberCode: false,
  acceptsAllyCode: false,
  referrerRewardPct: undefined as number | undefined,
  referrerRewardCycles: undefined as number | undefined,
  planUuids: [] as string[],
})
const touched = ref(false)
const submitting = ref(false)

// Recovery promotions only ever discount the delayed monthly fees.
watch(() => state.kind, (kind) => {
  if (kind === 'RECOVERY') state.appliesTo = 'MONTHLY'
})

watch(() => props.open, async (open) => {
  if (!open) return
  touched.value = false
  const p = props.promotion
  Object.assign(state, {
    name: p?.name ?? '',
    description: p?.description ?? '',
    kind: p?.kind ?? 'ACQUISITION',
    discountPct: p ? Number(p.discountPct) : undefined,
    appliesTo: p?.appliesTo ?? 'BOTH',
    cycles: p?.cycles ?? undefined,
    coversExtraBeneficiaries: p?.coversExtraBeneficiaries ?? false,
    maxRedemptions: p?.maxRedemptions ?? undefined,
    requiresCode: p?.requiresCode ?? false,
    acceptsPromoterCode: p?.acceptsPromoterCode ?? false,
    acceptsMemberCode: p?.acceptsMemberCode ?? false,
    acceptsAllyCode: p?.acceptsAllyCode ?? false,
    referrerRewardPct: p?.referrerRewardPct != null ? Number(p.referrerRewardPct) : undefined,
    referrerRewardCycles: p?.referrerRewardCycles ?? undefined,
    planUuids: (p?.plans ?? []).map(pl => pl.uuid),
  })
  try {
    const options = await plansApi.options({ limit: 100 })
    planItems.value = options.map(o => ({ label: o.label, value: o.uuid }))
  }
  catch {
    planItems.value = []
  }
})

const errors = computed(() => {
  if (!touched.value) return {} as Record<string, string | undefined>
  const e: Record<string, string | undefined> = {}
  if (!state.name.trim()) e.name = t('validation.required')
  if (state.discountPct === undefined || state.discountPct <= 0 || state.discountPct > 100) e.discountPct = t('promotions.form.pctRange')
  if (state.requiresCode && !(state.acceptsPromoterCode || state.acceptsMemberCode || state.acceptsAllyCode)) {
    e.codeOwners = t('promotions.form.codeOwnerRequired')
  }
  const hasPct = state.referrerRewardPct !== undefined
  const hasCycles = state.referrerRewardCycles !== undefined
  if (hasPct !== hasCycles) e.reward = t('promotions.form.rewardIncomplete')
  if (hasPct && (state.referrerRewardPct! <= 0 || state.referrerRewardPct! > 100)) e.reward = t('promotions.form.pctRange')
  return e
})

async function submit() {
  touched.value = true
  if (Object.values(errors.value).some(Boolean)) return
  const rewardEnabled = state.acceptsMemberCode && state.referrerRewardPct !== undefined
  const body: PromotionRequest = {
    name: state.name.trim(),
    description: state.description.trim() || null,
    kind: state.kind,
    discountPct: state.discountPct!,
    appliesTo: state.appliesTo,
    cycles: state.cycles ?? null,
    coversExtraBeneficiaries: state.coversExtraBeneficiaries,
    maxRedemptions: state.maxRedemptions ?? null,
    requiresCode: state.requiresCode,
    acceptsPromoterCode: state.acceptsPromoterCode,
    acceptsMemberCode: state.acceptsMemberCode,
    acceptsAllyCode: state.acceptsAllyCode,
    referrerRewardPct: rewardEnabled ? state.referrerRewardPct! : null,
    referrerRewardCycles: rewardEnabled ? state.referrerRewardCycles ?? null : null,
    planUuids: state.planUuids,
  }
  submitting.value = true
  try {
    const saved = isEdit.value
      ? await promotionsApi.update(props.promotion!.uuid, body)
      : await promotionsApi.create(props.campaignUuid, body)
    toast.add({ title: t('promotions.form.savedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    emit('saved', saved)
    isOpen.value = false
  }
  catch {
    // useApi already notified
  }
  finally {
    submitting.value = false
  }
}

function numberOrUndefined(v: string | number | null | undefined): number | undefined {
  return v === '' || v === null || v === undefined ? undefined : Number(v)
}
</script>

<template>
  <UModal
    v-model:open="isOpen"
    :title="isEdit ? t('promotions.form.editTitle') : t('promotions.form.createTitle')"
    :ui="{ content: 'max-w-2xl' }"
  >
    <template #body>
      <div class="space-y-4">
        <UFormField :label="t('promotions.fields.name')" required :error="errors.name">
          <UInput v-model="state.name" :maxlength="150" class="w-full" />
        </UFormField>
        <UFormField :label="t('promotions.fields.description')">
          <UTextarea v-model="state.description" :rows="2" class="w-full" />
        </UFormField>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('promotions.fields.kind')" :help="t(`promotions.kindHelp.${state.kind}`)">
            <USelectMenu v-model="state.kind" :items="kindItems" label-key="label" value-key="value" :search-input="false" class="w-full" />
          </UFormField>
          <UFormField :label="t('promotions.fields.appliesTo')">
            <USelectMenu
              v-model="state.appliesTo"
              :items="appliesToItems"
              label-key="label"
              value-key="value"
              :search-input="false"
              :disabled="state.kind === 'RECOVERY'"
              class="w-full"
            />
          </UFormField>
          <UFormField :label="t('promotions.fields.discountPct')" required :error="errors.discountPct">
            <UInput
              :model-value="state.discountPct"
              type="number"
              min="0.01"
              max="100"
              step="0.01"
              trailing-icon="i-lucide-percent"
              class="w-full"
              @update:model-value="state.discountPct = numberOrUndefined($event)"
            />
          </UFormField>
          <UFormField :label="t('promotions.fields.cycles')" :help="t('promotions.form.cyclesHelp')">
            <UInput
              :model-value="state.cycles"
              type="number"
              min="1"
              :disabled="state.appliesTo === 'INSCRIPTION'"
              class="w-full"
              @update:model-value="state.cycles = numberOrUndefined($event)"
            />
          </UFormField>
          <UFormField :label="t('promotions.fields.maxRedemptions')" :help="t('promotions.form.maxRedemptionsHelp')">
            <UInput
              :model-value="state.maxRedemptions"
              type="number"
              min="1"
              class="w-full"
              @update:model-value="state.maxRedemptions = numberOrUndefined($event)"
            />
          </UFormField>
          <UFormField :label="t('promotions.fields.plans')" :help="t('promotions.form.plansHelp')">
            <USelectMenu
              v-model="state.planUuids"
              :items="planItems"
              label-key="label"
              value-key="value"
              multiple
              class="w-full"
            />
          </UFormField>
        </div>

        <USwitch
          v-if="state.appliesTo !== 'MONTHLY'"
          v-model="state.coversExtraBeneficiaries"
          :label="t('promotions.fields.coversExtraBeneficiaries')"
        />

        <div class="rounded-xl border border-prohealth-100 p-4 space-y-3">
          <USwitch v-model="state.requiresCode" :label="t('promotions.fields.requiresCode')" />
          <p class="text-xs text-prohealth-500">{{ t('promotions.form.codeOwnersHelp') }}</p>
          <div class="flex flex-wrap gap-4">
            <UCheckbox v-model="state.acceptsPromoterCode" :label="t('promotions.codeOwner.PROMOTER')" />
            <UCheckbox v-model="state.acceptsMemberCode" :label="t('promotions.codeOwner.MEMBER')" />
            <UCheckbox v-model="state.acceptsAllyCode" :label="t('promotions.codeOwner.ALLY')" />
          </div>
          <p v-if="errors.codeOwners" class="text-xs text-red-600">{{ errors.codeOwners }}</p>

          <div v-if="state.acceptsMemberCode" class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <p class="sm:col-span-2 text-xs text-prohealth-500">{{ t('promotions.form.rewardHelp') }}</p>
            <UFormField :label="t('promotions.fields.referrerRewardPct')" :error="errors.reward">
              <UInput
                :model-value="state.referrerRewardPct"
                type="number"
                min="0.01"
                max="100"
                step="0.01"
                trailing-icon="i-lucide-percent"
                class="w-full"
                @update:model-value="state.referrerRewardPct = numberOrUndefined($event)"
              />
            </UFormField>
            <UFormField :label="t('promotions.fields.referrerRewardCycles')">
              <UInput
                :model-value="state.referrerRewardCycles"
                type="number"
                min="1"
                class="w-full"
                @update:model-value="state.referrerRewardCycles = numberOrUndefined($event)"
              />
            </UFormField>
          </div>
        </div>

        <div class="flex items-center justify-end gap-3 pt-1">
          <UButton color="neutral" variant="ghost" :disabled="submitting" @click="isOpen = false">
            {{ t('common.cancel') }}
          </UButton>
          <UButton color="primary" icon="i-lucide-check" :loading="submitting" @click="submit">
            {{ t('common.save') }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
