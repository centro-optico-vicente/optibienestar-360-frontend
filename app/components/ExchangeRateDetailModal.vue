<script setup lang="ts">
import type { ExchangeRateDto, ExchangeRateSource } from '~/types/currencies'
import { EXCHANGE_RATE_SOURCE_OPTIONS } from '~/types/currencies'

// Read-only detail — every row can be "viewed" here regardless of source;
// only a MANUAL row also gets the edit/delete actions (see ExchangeRateFormModal).
const props = defineProps<{ open: boolean, rate: ExchangeRateDto | null }>()

const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const { t } = useI18n()
const { formatDate } = useFormatters()

const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})

function sourceLabel(sourceValue: ExchangeRateSource): string {
  const opt = EXCHANGE_RATE_SOURCE_OPTIONS.find(o => o.value === sourceValue)
  return t(`exchangeRates.source.${sourceValue}`, opt?.label ?? sourceValue)
}

const { can } = usePermissions()
const canViewCurrency = computed(() => can('CURRENCY_VIEW_ALL'))
function currencyLink(code: string | null | undefined): string | null {
  return code ? `/dashboard/catalogs/currencies?code=${code}` : null
}
</script>

<template>
  <UModal v-model:open="isOpen" :title="t('exchangeRates.detail.title')">
    <template #body>
      <dl v-if="rate" class="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <dt class="text-prohealth-500">{{ t('exchangeRates.columns.pair') }}</dt>
        <dd class="font-mono font-semibold text-prohealth-900">
          <CommonEntityLinkCell :to="currencyLink(rate.baseCurrency_Code)" :label="rate.baseCurrency_Code" :can="canViewCurrency" />
          →
          <CommonEntityLinkCell :to="currencyLink(rate.quoteCurrency_Code)" :label="rate.quoteCurrency_Code" :can="canViewCurrency" />
        </dd>

        <dt class="text-prohealth-500">{{ t('exchangeRates.columns.rate') }}</dt>
        <dd class="font-mono text-prohealth-800">{{ rate.rate_Display ?? rate.rate }}</dd>

        <dt class="text-prohealth-500">
          {{ t('exchangeRates.columns.operationDate') }}
          <UTooltip :text="t('exchangeRates.form.fields.operationDateHelp')">
            <UIcon name="i-lucide-info" class="w-3.5 h-3.5 inline align-text-top text-prohealth-300" />
          </UTooltip>
        </dt>
        <dd class="text-prohealth-800">{{ rate.operationDate_Display ?? formatDate(rate.operationDate, 'short') }}</dd>

        <dt class="text-prohealth-500">
          {{ t('exchangeRates.columns.validFrom') }}
          <UTooltip :text="t('exchangeRates.form.fields.validFromHelp')">
            <UIcon name="i-lucide-info" class="w-3.5 h-3.5 inline align-text-top text-prohealth-300" />
          </UTooltip>
        </dt>
        <dd class="text-prohealth-800">{{ rate.validFrom_Display ?? formatDate(rate.validFrom, 'datetime') }}</dd>

        <dt class="text-prohealth-500">{{ t('exchangeRates.columns.source') }}</dt>
        <dd>
          <UBadge :color="rate.source === 'MANUAL' ? 'info' : 'neutral'" variant="subtle" size="sm">
            {{ rate.source_Display ?? sourceLabel(rate.source) }}
          </UBadge>
        </dd>

        <dt class="text-prohealth-500">{{ t('exchangeRates.detail.fetchedAt') }}</dt>
        <dd class="text-prohealth-800">{{ rate.fetchedAt_Display ?? formatDate(rate.fetchedAt, 'datetime') }}</dd>

        <dt class="text-prohealth-500">{{ t('exchangeRates.detail.active') }}</dt>
        <dd class="text-prohealth-800">{{ rate.active_Display ?? (rate.active ? t('common.yes') : t('common.no')) }}</dd>
      </dl>
    </template>

    <template #footer>
      <div class="flex items-center justify-end w-full">
        <UButton color="neutral" variant="ghost" @click="isOpen = false">{{ t('common.close') }}</UButton>
      </div>
    </template>
  </UModal>
</template>
