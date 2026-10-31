<script setup lang="ts">
import type { PromoterPayoutAccountDto } from '~/types/promoters'
import { fromPayoutAccount } from '~/utils/companyAccountCopy'
import { payoutDestination } from '~/utils/payout-accounts'

// Picks the advisor's payout account a commission payout goes to (V206), from the accounts the parent already
// loaded (GET /v1/admin/advisors/{uuid}/payout-accounts). Shows it with copy buttons (Pago Móvil 4-line text
// included). The quick link opens the advisor detail, where the "Cuentas de cobro" tab manages them.
const props = defineProps<{
  accounts: PromoterPayoutAccountDto[]
  promoterUuid?: string | null
  loading?: boolean
}>()

const model = defineModel<string>({ default: '' })

const { t } = useI18n()
const { can } = usePermissions()
const canViewAdvisor = computed(() => can('PROMOTER_VIEW_ALL'))

function optionLabel(a: PromoterPayoutAccountDto): string {
  const head = a.label || a.paymentMethod_Display || a.paymentMethodCode
  const parts = [head, a.bank_Display, payoutDestination(a)].filter(Boolean)
  return parts.join(' · ') + (a.isDefault ? ` (${t('promoters.payoutAccounts.defaultBadge')})` : '')
}

const options = computed(() => props.accounts.map(a => ({ label: optionLabel(a), value: a.uuid })))
const selected = computed(() => props.accounts.find(a => a.uuid === model.value) ?? null)

function openAdvisor(to: string) {
  window.open(to, '_blank', 'noopener')
}
</script>

<template>
  <div class="space-y-2">
    <UFormField :label="t('payments.payouts.fields.payoutAccount')" :help="t('payments.payouts.payoutAccountHelp')">
      <div class="flex items-center gap-1">
        <USelectMenu
          v-if="loading || accounts.length > 0"
          v-model="model"
          clear
          :items="options"
          label-key="label"
          value-key="value"
          :loading="loading"
          :placeholder="t('common.select')"
          class="w-full"
        />
        <p v-else class="w-full text-xs text-prohealth-500">
          {{ promoterUuid ? t('payments.payouts.noPayoutAccounts') : t('payments.payouts.pickPromoterFirst') }}
        </p>
        <CommonEntityQuickLinkButton :to="promoterUuid ? `/dashboard/advisors/${promoterUuid}` : null" :can="canViewAdvisor" @navigate="openAdvisor" />
      </div>
    </UFormField>
    <AccountCopyCard v-if="selected" :account="fromPayoutAccount(selected)" />
  </div>
</template>
