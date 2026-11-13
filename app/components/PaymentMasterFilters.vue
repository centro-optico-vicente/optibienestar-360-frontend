<script setup lang="ts">
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
// Filters only need code + label: each entity's `/options` (any session), not the full admin list.
const methodsApi = useCatalogOptions('payment-methods', '/v1/admin')
const banksApi = useCatalogOptions('banks', '/v1/admin')
const categoriesApi = useCatalogOptions('payment-categories', '/v1/admin')
const currenciesApi = useCatalogOptions('currencies', '/v1/admin')

// Each dropdown fetches its list the first time it is opened, not when the list mounts.
const methods = useLazyOptions(async () =>
  (await methodsApi.options({ limit: 200 })).map(m => ({ label: m.label, value: m.uuid })))
const banks = useLazyOptions(async () =>
  (await banksApi.options({ limit: 200 })).map(b => ({ label: b.label, value: b.uuid })))
const categories = useLazyOptions(async () =>
  (await categoriesApi.options({ limit: 200 })).map(c => ({ label: c.label, value: c.uuid })))
const currencies = useLazyOptions(async () =>
  (await currenciesApi.options({ limit: 200 })).map(c => ({ label: c.label, value: c.code! })))

async function searchMembers(q: string): Promise<SelectItem[]> {
  const res = await membersApi.options({ ...(q ? { q } : {}), limit: 10 })
  return res.map(o => ({ label: memberOptionLabel(o), value: o.uuid }))
}

function patch(partial: Partial<PaymentMasterFilterState>) {
  model.value = { ...model.value, ...partial }
}
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
      :items="methods.items.value"
      :loading="methods.loading.value"
      @update:open="methods.onOpen"
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
      :items="banks.items.value"
      :loading="banks.loading.value"
      @update:open="banks.onOpen"
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
      :items="categories.items.value"
      :loading="categories.loading.value"
      @update:open="categories.onOpen"
      label-key="label"
      value-key="value"
      icon="i-lucide-tag"
      :placeholder="t('payments.filters.category')"
      class="w-48"
      @update:model-value="patch({ categoryUuid: $event ?? '' })"
    />
    <CommonEntityReferenceSelect
      :model-value="model.promoterUuid || undefined"
      :search="promotersApi.searchOptions"
      icon="i-lucide-users"
      :placeholder="t('payments.filters.advisor')"
      class="w-48"
      @update:model-value="patch({ promoterUuid: $event ?? '' })"
    />
    <USelectMenu
      :model-value="model.currency || undefined"
      clear
      :items="currencies.items.value"
      :loading="currencies.loading.value"
      @update:open="currencies.onOpen"
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
