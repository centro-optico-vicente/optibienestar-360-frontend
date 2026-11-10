<script setup lang="ts">
import type { CatalogItem } from '~/types/catalogs'
import type { SelectItem } from '~/types/options'
import { memberOptionLabel } from '~/types/members'
import { bankOptionLabel } from '~/utils/bankLabel'
import type { PaymentMasterFilterState } from '~/utils/paymentFilters'

// Master-table filters shared by every payments list (Movimientos, Cobros, Pagos):
// affiliate (server-side typeahead), method, bank, reason/category, advisor, currency
// and a payment-date range. Emits a plain state object; the page maps it onto the
// `/v1/admin/payments` query via `paymentFilterQuery()` (utils/paymentFilters.ts).
const model = defineModel<PaymentMasterFilterState>({ required: true })

const { t } = useI18n()
const membersApi = useMembers()
const promotersApi = usePromoters()
const methodsApi = useCatalog('/v1/admin/payment-methods')
const banksApi = useCatalog('/v1/admin/banks')
const categoriesApi = useCatalog('/v1/admin/payment-categories')
const currenciesApi = useCatalog('/v1/admin/currencies')

const methodOptions = ref<SelectItem[]>([])
const bankOptions = ref<SelectItem[]>([])
const categoryOptions = ref<SelectItem[]>([])
const promoterOptions = ref<SelectItem[]>([])
const currencyOptions = ref<SelectItem[]>([])

async function searchMembers(q: string): Promise<SelectItem[]> {
  const res = await membersApi.options({ ...(q ? { q } : {}), limit: 10 })
  return res.map(o => ({ label: memberOptionLabel(o), value: o.uuid }))
}

function patch(partial: Partial<PaymentMasterFilterState>) {
  model.value = { ...model.value, ...partial }
}

onMounted(async () => {
  try {
    const [methods, banks, categories, currencies, advisors] = await Promise.all([
      methodsApi.listAll(),
      banksApi.listAll(),
      categoriesApi.listAll(),
      currenciesApi.listAll(),
      promotersApi.list({ size: 100, sort: ['displayName,asc'] }),
    ])
    const active = (items: CatalogItem[]) => items.filter(i => i.active)
    methodOptions.value = active(methods).map(m => ({ label: m.name, value: m.uuid }))
    bankOptions.value = active(banks).map(b => ({ label: bankOptionLabel(b), value: b.uuid }))
    categoryOptions.value = active(categories).map(c => ({ label: c.name, value: c.uuid }))
    currencyOptions.value = active(currencies).map(c => ({ label: `${c.code} (${c.symbol})`, value: c.code! }))
    promoterOptions.value = (advisors.content ?? []).map(a => ({ label: a.displayName, value: a.uuid }))
  }
  catch {
    // useApi already notified; the dropdowns just stay empty
  }
})
</script>

<template>
  <div class="flex flex-wrap items-center gap-3">
    <CommonEntityReferenceSelect
      :model-value="model.memberUuid || undefined"
      :search="searchMembers"
      icon="i-lucide-user"
      :placeholder="t('payments.filters.member')"
      class="w-56"
      @update:model-value="patch({ memberUuid: $event ?? '' })"
    />
    <USelectMenu
      :model-value="model.paymentMethodUuid || undefined"
      clear
      :items="methodOptions"
      label-key="label"
      value-key="value"
      icon="i-lucide-credit-card"
      :placeholder="t('payments.filters.method')"
      class="w-44"
      @update:model-value="patch({ paymentMethodUuid: $event ?? '' })"
    />
    <USelectMenu
      :model-value="model.bankUuid || undefined"
      clear
      :items="bankOptions"
      label-key="label"
      value-key="value"
      icon="i-lucide-landmark"
      :placeholder="t('payments.filters.bank')"
      class="w-48"
      @update:model-value="patch({ bankUuid: $event ?? '' })"
    />
    <USelectMenu
      :model-value="model.categoryUuid || undefined"
      clear
      :items="categoryOptions"
      label-key="label"
      value-key="value"
      icon="i-lucide-tag"
      :placeholder="t('payments.filters.category')"
      class="w-48"
      @update:model-value="patch({ categoryUuid: $event ?? '' })"
    />
    <USelectMenu
      :model-value="model.promoterUuid || undefined"
      clear
      :items="promoterOptions"
      label-key="label"
      value-key="value"
      icon="i-lucide-users"
      :placeholder="t('payments.filters.advisor')"
      class="w-48"
      @update:model-value="patch({ promoterUuid: $event ?? '' })"
    />
    <USelectMenu
      :model-value="model.currency || undefined"
      clear
      :items="currencyOptions"
      label-key="label"
      value-key="value"
      icon="i-lucide-coins"
      :placeholder="t('payments.filters.currency')"
      class="w-36"
      @update:model-value="patch({ currency: $event ?? '' })"
    />
    <DateRangeFilter
      :from="model.dateFrom"
      :to="model.dateTo"
      :from-label="t('payments.filters.dateFrom')"
      :to-label="t('payments.filters.dateTo')"
      @change="patch({ dateFrom: $event.from, dateTo: $event.to })"
    />
  </div>
</template>
