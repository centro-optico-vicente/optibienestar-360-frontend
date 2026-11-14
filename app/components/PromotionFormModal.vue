<script setup lang="ts">
import type {
  AllyBenefitType,
  PromotionAppliesTo,
  PromotionBenefitKind,
  PromotionDiscountType,
  PromotionDto,
  PromotionKind,
  PromotionRequest,
} from '~/types/promotions'
import { toSelectItems } from '~/types/options'

/**
 * Create/edit a campaign promotion (hub ADR 0018). Mirrors the backend rules:
 * RECOVERY only discounts monthly fees, a required code needs at least one
 * accepted owner, and the referrer reward needs member codes plus both values.
 * The discount is a percentage or a fixed amount in a currency (hub ADR 0038).
 * An ALLY_BENEFIT line instead grants a voucher on an ally's product (free,
 * % or fixed amount off, N units); in an ally-exclusive campaign its ally is
 * the campaign's and cannot be changed.
 */
const props = defineProps<{
  open: boolean
  campaignUuid: string
  promotion: PromotionDto | null
  /** Ally of an ally-exclusive campaign: forced on every ALLY_BENEFIT line. */
  campaignAllyUuid?: string | null
  campaignAllyDisplay?: string | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'saved': [promotion: PromotionDto]
}>()

const { t } = useI18n()
const promotionsApi = usePromotions()
const plansApi = usePlans()
const currenciesApi = useCurrencies()
const alliesApi = useAllies()
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
// Plans searched on the server (`q`) when the dropdown opens and while typing (the promotion's own plans stay listed).
const planLazy = useLazyOptions(async q => (await plansApi.options({ q })).map(o => ({ label: o.label, value: o.uuid })))
const planItems = computed(() => planLazy.items.value)
const discountTypeItems = computed(() => [
  { label: t('promotions.discountType.PERCENTAGE'), value: 'PERCENTAGE' },
  { label: t('promotions.discountType.FLAT'), value: 'FLAT' },
])
// Currency of a fixed-amount discount or benefit, searched on the server; the saved ones are always listed.
const currencyLazy = useLazyOptions(async q => (await currenciesApi.options({
  q,
  currentValues: [state.discountCurrencyUuid, state.benefitCurrencyUuid].filter((v): v is string => !!v),
})).map(o => ({ label: o.label, value: o.uuid })))

// ---- Ally benefit (hub ADR 0038, phase 3) ----
const benefitKindItems = computed(() => [
  { label: t('promotions.benefitKind.DISCOUNT'), value: 'DISCOUNT' },
  { label: t('promotions.benefitKind.ALLY_BENEFIT'), value: 'ALLY_BENEFIT' },
])
const benefitTypeItems = computed(() => [
  { label: t('promotions.benefitType.FREE'), value: 'FREE' },
  { label: t('promotions.benefitType.PERCENTAGE'), value: 'PERCENTAGE' },
  { label: t('promotions.benefitType.FLAT'), value: 'FLAT' },
])
const isDiscount = computed(() => state.benefitKind === 'DISCOUNT')
/** The campaign belongs to one ally: its benefits are always that ally's. */
const allyLocked = computed(() => !!props.campaignAllyUuid)
const allyLazy = useLazyOptions(async q => toSelectItems(await alliesApi.options({
  q,
  currentValues: state.allyUuid ? [state.allyUuid] : undefined,
})))
// Offers of the chosen ally, searched on the server; reloaded when the ally changes.
const productLazy = useLazyOptions(async (q) => {
  if (!state.allyUuid) return []
  const page = await alliesApi.listProducts(state.allyUuid, { q: q || undefined, size: DROPDOWN_PAGE_SIZE })
  return (page.content ?? []).map(o => ({ label: o.name, value: o.uuid }))
})
/** The saved offer stays listed (with its server label) even before the dropdown loads. */
const productItems = computed(() => {
  const items = productLazy.items.value
  const p = props.promotion
  if (p?.allyProduct_Uuid && p.ally_Uuid === state.allyUuid && !items.some(i => i.value === p.allyProduct_Uuid)) {
    return [{ label: p.allyProduct_Display ?? p.allyProduct_Uuid, value: p.allyProduct_Uuid }, ...items]
  }
  return items
})

const state = reactive({
  name: '',
  description: '',
  kind: 'ACQUISITION' as PromotionKind,
  discountType: 'PERCENTAGE' as PromotionDiscountType,
  discountPct: undefined as number | undefined,
  discountAmount: undefined as number | undefined,
  discountCurrencyUuid: undefined as string | undefined,
  appliesTo: 'BOTH' as PromotionAppliesTo,
  cycles: undefined as number | undefined,
  coversExtraBeneficiaries: false,
  ownQuota: false,
  maxRedemptions: undefined as number | undefined,
  requiresCode: false,
  acceptsPromoterCode: false,
  acceptsMemberCode: false,
  acceptsAllyCode: false,
  referrerRewardPct: undefined as number | undefined,
  referrerRewardCycles: undefined as number | undefined,
  planUuids: [] as string[],
  benefitKind: 'DISCOUNT' as PromotionBenefitKind,
  allyUuid: undefined as string | undefined,
  allyProductUuid: undefined as string | undefined,
  benefitType: 'FREE' as AllyBenefitType,
  benefitPct: undefined as number | undefined,
  benefitAmount: undefined as number | undefined,
  benefitCurrencyUuid: undefined as string | undefined,
  benefitQuantity: 1 as number | undefined,
})
const touched = ref(false)
const submitting = ref(false)

// Recovery promotions only ever discount the delayed monthly fees.
watch(() => state.kind, (kind) => {
  if (kind === 'RECOVERY') state.appliesTo = 'MONTHLY'
})
// Ally benefits are always acquisition promotions.
watch(() => state.benefitKind, (kind) => {
  if (kind === 'ALLY_BENEFIT') state.kind = 'ACQUISITION'
})
// Another ally ⇒ another catalog of offers.
const loadingForm = ref(false)
watch(() => state.allyUuid, () => {
  productLazy.reset()
  if (!loadingForm.value) state.allyProductUuid = undefined
})

watch(() => props.open, async (open) => {
  if (!open) return
  touched.value = false
  loadingForm.value = true
  const p = props.promotion
  Object.assign(state, {
    name: p?.name ?? '',
    description: p?.description ?? '',
    kind: p?.kind ?? 'ACQUISITION',
    discountType: p?.discountType ?? 'PERCENTAGE',
    discountPct: p?.discountPct != null && p.discountPct !== '' ? Number(p.discountPct) : undefined,
    discountAmount: p?.discountAmount != null && p.discountAmount !== '' ? Number(p.discountAmount) : undefined,
    discountCurrencyUuid: p?.discountCurrency_Uuid ?? undefined,
    appliesTo: p?.appliesTo ?? 'BOTH',
    cycles: p?.cycles ?? undefined,
    coversExtraBeneficiaries: p?.coversExtraBeneficiaries ?? false,
    // Rows from before ADR 0038 had their own cap whenever maxRedemptions was set.
    ownQuota: p?.ownQuota ?? (p?.maxRedemptions != null),
    maxRedemptions: p?.maxRedemptions ?? undefined,
    requiresCode: p?.requiresCode ?? false,
    acceptsPromoterCode: p?.acceptsPromoterCode ?? false,
    acceptsMemberCode: p?.acceptsMemberCode ?? false,
    acceptsAllyCode: p?.acceptsAllyCode ?? false,
    referrerRewardPct: p?.referrerRewardPct != null ? Number(p.referrerRewardPct) : undefined,
    referrerRewardCycles: p?.referrerRewardCycles ?? undefined,
    planUuids: (p?.plans ?? []).map(pl => pl.uuid),
    benefitKind: p?.benefitKind ?? 'DISCOUNT',
    allyUuid: props.campaignAllyUuid ?? p?.ally_Uuid ?? undefined,
    allyProductUuid: p?.allyProduct_Uuid ?? undefined,
    benefitType: p?.benefitType ?? 'FREE',
    benefitPct: p?.benefitPct != null && p.benefitPct !== '' ? Number(p.benefitPct) : undefined,
    benefitAmount: p?.benefitAmount != null && p.benefitAmount !== '' ? Number(p.benefitAmount) : undefined,
    benefitCurrencyUuid: p?.benefitCurrency_Uuid ?? undefined,
    benefitQuantity: p?.benefitQuantity ?? 1,
  })
  await nextTick()
  loadingForm.value = false
  await planLazy.ensureLoaded()
  if (state.discountCurrencyUuid || state.benefitCurrencyUuid) await currencyLazy.ensureLoaded()
  if (state.allyUuid && !allyLocked.value) await allyLazy.ensureLoaded()
})

const errors = computed(() => {
  if (!touched.value) return {} as Record<string, string | undefined>
  const e: Record<string, string | undefined> = {}
  if (!state.name.trim()) e.name = t('validation.required')
  if (!isDiscount.value) {
    if (!state.allyUuid) e.ally = t('validation.required')
    if (!state.allyProductUuid) e.allyProduct = t('validation.required')
    if (state.benefitType === 'PERCENTAGE' && (state.benefitPct === undefined || state.benefitPct <= 0 || state.benefitPct > 100)) {
      e.benefitPct = t('promotions.form.pctRange')
    }
    if (state.benefitType === 'FLAT') {
      if (state.benefitAmount === undefined || state.benefitAmount < 0.01) e.benefitAmount = t('promotions.form.amountMin')
      if (!state.benefitCurrencyUuid) e.benefitCurrency = t('validation.required')
    }
    if (state.benefitQuantity === undefined || state.benefitQuantity < 1 || !Number.isInteger(state.benefitQuantity)) {
      e.benefitQuantity = t('promotions.form.quantityMin')
    }
  }
  else if (state.discountType === 'FLAT') {
    if (state.discountAmount === undefined || state.discountAmount < 0.01) e.discountAmount = t('promotions.form.amountMin')
    if (!state.discountCurrencyUuid) e.discountCurrency = t('validation.required')
  }
  else if (state.discountPct === undefined || state.discountPct <= 0 || state.discountPct > 100) {
    e.discountPct = t('promotions.form.pctRange')
  }
  if (state.ownQuota && (state.maxRedemptions === undefined || state.maxRedemptions < 1 || !Number.isInteger(state.maxRedemptions))) {
    e.maxRedemptions = t('promotions.form.ownQuotaRequired')
  }
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
  const discount = isDiscount.value
  const rewardEnabled = discount && state.acceptsMemberCode && state.referrerRewardPct !== undefined
  const body: PromotionRequest = {
    name: state.name.trim(),
    description: state.description.trim() || null,
    kind: discount ? state.kind : 'ACQUISITION',
    // Discount fields travel only for a DISCOUNT line; benefit fields only for an ALLY_BENEFIT one.
    discountType: discount ? state.discountType : null,
    discountPct: discount && state.discountType === 'PERCENTAGE' ? state.discountPct! : null,
    discountAmount: discount && state.discountType === 'FLAT' ? state.discountAmount! : null,
    discountCurrencyUuid: discount && state.discountType === 'FLAT' ? state.discountCurrencyUuid! : null,
    appliesTo: discount ? state.appliesTo : null,
    cycles: discount ? state.cycles ?? null : null,
    coversExtraBeneficiaries: discount && state.coversExtraBeneficiaries,
    benefitKind: state.benefitKind,
    allyUuid: discount ? null : state.allyUuid ?? null,
    allyProductUuid: discount ? null : state.allyProductUuid ?? null,
    benefitType: discount ? null : state.benefitType,
    benefitPct: !discount && state.benefitType === 'PERCENTAGE' ? state.benefitPct ?? null : null,
    benefitAmount: !discount && state.benefitType === 'FLAT' ? state.benefitAmount ?? null : null,
    benefitCurrencyUuid: !discount && state.benefitType === 'FLAT' ? state.benefitCurrencyUuid ?? null : null,
    benefitQuantity: discount ? null : state.benefitQuantity ?? 1,
    ownQuota: state.ownQuota,
    maxRedemptions: state.ownQuota ? state.maxRedemptions ?? null : null,
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

        <UFormField :label="t('promotions.fields.benefitKind')" :help="t(`promotions.benefitKindHelp.${state.benefitKind}`)">
          <URadioGroup v-model="state.benefitKind" :items="benefitKindItems" orientation="horizontal" />
        </UFormField>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <template v-if="isDiscount">
          <UFormField :label="t('promotions.fields.kind')" :help="t(`promotions.kindHelp.${state.kind}`)">
            <USelectMenu clear v-model="state.kind" :items="kindItems" label-key="label" value-key="value" class="w-full" />
          </UFormField>
          <UFormField :label="t('promotions.fields.appliesTo')">
            <USelectMenu
              clear
              v-model="state.appliesTo"
              :items="appliesToItems"
              label-key="label"
              value-key="value"
              :disabled="state.kind === 'RECOVERY'"
              class="w-full"
            />
          </UFormField>
          <UFormField :label="t('promotions.fields.discountType')" class="sm:col-span-2">
            <URadioGroup v-model="state.discountType" :items="discountTypeItems" orientation="horizontal" />
          </UFormField>
          <UFormField v-if="state.discountType === 'PERCENTAGE'" :label="t('promotions.fields.discountPct')" required :error="errors.discountPct">
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
          <template v-else>
            <UFormField :label="t('promotions.fields.discountAmount')" required :error="errors.discountAmount" :help="t('promotions.form.amountHelp')">
              <UInput
                :model-value="state.discountAmount"
                type="number"
                min="0.01"
                step="0.01"
                class="w-full"
                @update:model-value="state.discountAmount = numberOrUndefined($event)"
              />
            </UFormField>
            <UFormField :label="t('promotions.fields.discountCurrency')" required :error="errors.discountCurrency">
              <CommonEntityReferenceSelect
                v-model="state.discountCurrencyUuid"
                entity="currency"
                :placeholder="t('common.select')"
                icon="i-lucide-coins"
                :lazy="currencyLazy"
              />
            </UFormField>
          </template>
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
          </template>
          <!-- Ally benefit: a voucher on one of the ally's offers -->
          <template v-else>
            <UFormField :label="t('promotions.fields.ally')" required :error="errors.ally" :help="allyLocked ? t('promotions.form.allyLockedHelp') : undefined">
              <UInput v-if="allyLocked" :model-value="campaignAllyDisplay ?? ''" disabled icon="i-lucide-handshake" class="w-full" />
              <CommonEntityReferenceSelect
                v-else
                v-model="state.allyUuid"
                entity="ally"
                icon="i-lucide-handshake"
                :placeholder="t('common.select')"
                :lazy="allyLazy"
              />
            </UFormField>
            <UFormField :label="t('promotions.fields.allyProduct')" required :error="errors.allyProduct">
              <USelectMenu
                v-model="state.allyProductUuid"
                :items="productItems"
                :loading="productLazy.loading.value"
                v-model:search-term="productLazy.searchTerm.value"
                ignore-filter
                label-key="label"
                value-key="value"
                :disabled="!state.allyUuid"
                :placeholder="state.allyUuid ? t('common.select') : t('promotions.form.pickAllyFirst')"
                class="w-full"
                @update:open="productLazy.onOpen"
                @update:model-value="productLazy.remember($event)"
              />
            </UFormField>
            <UFormField :label="t('promotions.fields.benefitType')" class="sm:col-span-2">
              <URadioGroup v-model="state.benefitType" :items="benefitTypeItems" orientation="horizontal" />
            </UFormField>
            <UFormField v-if="state.benefitType === 'PERCENTAGE'" :label="t('promotions.fields.benefitPct')" required :error="errors.benefitPct">
              <UInput
                :model-value="state.benefitPct"
                type="number"
                min="0.01"
                max="100"
                step="0.01"
                trailing-icon="i-lucide-percent"
                class="w-full"
                @update:model-value="state.benefitPct = numberOrUndefined($event)"
              />
            </UFormField>
            <template v-if="state.benefitType === 'FLAT'">
              <UFormField :label="t('promotions.fields.benefitAmount')" required :error="errors.benefitAmount">
                <UInput
                  :model-value="state.benefitAmount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  class="w-full"
                  @update:model-value="state.benefitAmount = numberOrUndefined($event)"
                />
              </UFormField>
              <UFormField :label="t('promotions.fields.benefitCurrency')" required :error="errors.benefitCurrency">
                <CommonEntityReferenceSelect
                  v-model="state.benefitCurrencyUuid"
                  entity="currency"
                  :placeholder="t('common.select')"
                  icon="i-lucide-coins"
                  :lazy="currencyLazy"
                />
              </UFormField>
            </template>
            <UFormField :label="t('promotions.fields.benefitQuantity')" required :error="errors.benefitQuantity" :help="t('promotions.form.quantityHelp')">
              <UInput
                :model-value="state.benefitQuantity"
                type="number"
                min="1"
                step="1"
                class="w-full"
                @update:model-value="state.benefitQuantity = numberOrUndefined($event)"
              />
            </UFormField>
          </template>
          <UFormField :label="t('promotions.fields.ownQuota')" :help="t('promotions.form.ownQuotaHelp')">
            <UCheckbox v-model="state.ownQuota" :label="t('promotions.form.ownQuotaCheck')" />
          </UFormField>
          <UFormField
            v-if="state.ownQuota"
            :label="t('promotions.fields.maxRedemptions')"
            required
            :error="errors.maxRedemptions"
            :help="t('promotions.form.maxRedemptionsHelp')"
          >
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
              clear
              v-model="state.planUuids"
              :items="planItems"
              v-model:search-term="planLazy.searchTerm.value"
              ignore-filter
              label-key="label"
              value-key="value"
              multiple
              class="w-full"
              @update:model-value="planLazy.remember($event)"
            />
          </UFormField>
        </div>

        <USwitch
          v-if="isDiscount && state.appliesTo !== 'MONTHLY'"
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

          <div v-if="isDiscount && state.acceptsMemberCode" class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
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
