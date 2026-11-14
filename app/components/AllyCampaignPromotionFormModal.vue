<script setup lang="ts">
import type { AllyPartnershipCampaignDto } from '~/types/campaign'
import type { AllyBenefitType, AllyPromotionRequest, PromotionDto } from '~/types/promotions'

/**
 * Ally portal: propose (or edit) the ally's own benefit inside a campaign open
 * to partnership (hub ADR 0038, phase 3). The benefit is a voucher on one of
 * the ally's approved offers: free, a percentage or a fixed amount off, N
 * units per member. The ally itself comes from the session, never the body.
 */
const props = defineProps<{
  open: boolean
  campaign: AllyPartnershipCampaignDto | null
  /** Ally whose offers are listed (the one selected in the page). */
  allyUuid: string | null
  promotion: PromotionDto | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'saved': [promotion: PromotionDto]
}>()

const { t } = useI18n()
const allyCampaigns = useAllyCampaigns()
const myAllies = useMyAllies()
const plansApi = usePlans()
const currenciesApi = useCurrencies()
const toast = useToast()

const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})
const isEdit = computed(() => !!props.promotion)

const benefitTypeItems = computed(() => [
  { label: t('promotions.benefitType.FREE'), value: 'FREE' },
  { label: t('promotions.benefitType.PERCENTAGE'), value: 'PERCENTAGE' },
  { label: t('promotions.benefitType.FLAT'), value: 'FLAT' },
])

const state = reactive({
  name: '',
  description: '',
  allyProductUuid: undefined as string | undefined,
  benefitType: 'FREE' as AllyBenefitType,
  benefitPct: undefined as number | undefined,
  benefitAmount: undefined as number | undefined,
  benefitCurrencyUuid: undefined as string | undefined,
  benefitQuantity: 1 as number | undefined,
  ownQuota: false,
  maxRedemptions: undefined as number | undefined,
  planUuids: [] as string[],
})
const touched = ref(false)
const submitting = ref(false)

// Only approved offers of the ally can carry a campaign benefit.
const productItems = ref<{ label: string, value: string }[]>([])
const productsLoading = ref(false)
async function loadProducts() {
  productItems.value = []
  if (!props.allyUuid) return
  productsLoading.value = true
  try {
    const page = await myAllies.listProducts(props.allyUuid, { size: 200 })
    productItems.value = (page.content ?? [])
      .filter(o => !o.reviewStatus || o.reviewStatus === 'APPROVED')
      .map(o => ({ label: o.name, value: o.uuid }))
    const p = props.promotion
    if (p?.allyProduct_Uuid && !productItems.value.some(i => i.value === p.allyProduct_Uuid)) {
      productItems.value.unshift({ label: p.allyProduct_Display ?? p.allyProduct_Uuid, value: p.allyProduct_Uuid })
    }
  }
  catch {
    productItems.value = []
  }
  finally {
    productsLoading.value = false
  }
}

const planLazy = useLazyOptions(async q => (await plansApi.options({ q })).map(o => ({ label: o.label, value: o.uuid })))
const currencyLazy = useLazyOptions(async q => (await currenciesApi.options({
  q,
  currentValues: state.benefitCurrencyUuid ? [state.benefitCurrencyUuid] : undefined,
})).map(o => ({ label: o.label, value: o.uuid })))

watch(() => props.open, async (open) => {
  if (!open) return
  touched.value = false
  const p = props.promotion
  Object.assign(state, {
    name: p?.name ?? '',
    description: p?.description ?? '',
    allyProductUuid: p?.allyProduct_Uuid ?? undefined,
    benefitType: p?.benefitType ?? 'FREE',
    benefitPct: p?.benefitPct != null && p.benefitPct !== '' ? Number(p.benefitPct) : undefined,
    benefitAmount: p?.benefitAmount != null && p.benefitAmount !== '' ? Number(p.benefitAmount) : undefined,
    benefitCurrencyUuid: p?.benefitCurrency_Uuid ?? undefined,
    benefitQuantity: p?.benefitQuantity ?? 1,
    ownQuota: p?.ownQuota ?? false,
    maxRedemptions: p?.maxRedemptions ?? undefined,
    planUuids: (p?.plans ?? []).map(pl => pl.uuid),
  })
  await loadProducts()
  if (state.planUuids.length) await planLazy.ensureLoaded()
  if (state.benefitCurrencyUuid) await currencyLazy.ensureLoaded()
})

const errors = computed(() => {
  if (!touched.value) return {} as Record<string, string | undefined>
  const e: Record<string, string | undefined> = {}
  if (!state.name.trim()) e.name = t('validation.required')
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
  if (state.ownQuota && (state.maxRedemptions === undefined || state.maxRedemptions < 1 || !Number.isInteger(state.maxRedemptions))) {
    e.maxRedemptions = t('promotions.form.ownQuotaRequired')
  }
  return e
})

async function submit() {
  touched.value = true
  if (Object.values(errors.value).some(Boolean) || !props.campaign) return
  const body: AllyPromotionRequest = {
    name: state.name.trim(),
    description: state.description.trim() || null,
    allyProductUuid: state.allyProductUuid!,
    benefitType: state.benefitType,
    benefitPct: state.benefitType === 'PERCENTAGE' ? state.benefitPct ?? null : null,
    benefitAmount: state.benefitType === 'FLAT' ? state.benefitAmount ?? null : null,
    benefitCurrencyUuid: state.benefitType === 'FLAT' ? state.benefitCurrencyUuid ?? null : null,
    benefitQuantity: state.benefitQuantity ?? 1,
    ownQuota: state.ownQuota,
    maxRedemptions: state.ownQuota ? state.maxRedemptions ?? null : null,
    planUuids: state.planUuids,
  }
  submitting.value = true
  try {
    const saved = isEdit.value
      ? await allyCampaigns.updatePromotion(props.promotion!.uuid, body, props.allyUuid)
      : await allyCampaigns.createPromotion(props.campaign.uuid, body, props.allyUuid)
    toast.add({ title: t('allyCampaigns.savedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    emit('saved', saved)
    isOpen.value = false
  }
  catch {
    // useApi already notified (campaign no longer open, offer not ours, already redeemed…)
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
    :title="isEdit ? t('allyCampaigns.form.editTitle') : t('allyCampaigns.form.createTitle')"
    :description="campaign?.name"
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
          <UFormField :label="t('promotions.fields.allyProduct')" required :error="errors.allyProduct" class="sm:col-span-2">
            <USelectMenu
              v-model="state.allyProductUuid"
              :items="productItems"
              :loading="productsLoading"
              label-key="label"
              value-key="value"
              :placeholder="productItems.length ? t('common.select') : t('allyCampaigns.form.noProducts')"
              class="w-full"
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
              v-model="state.planUuids"
              :items="planLazy.items.value"
              :loading="planLazy.loading.value"
              v-model:search-term="planLazy.searchTerm.value"
              ignore-filter
              label-key="label"
              value-key="value"
              multiple
              class="w-full"
              @update:open="planLazy.onOpen"
              @update:model-value="planLazy.remember($event)"
            />
          </UFormField>
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
