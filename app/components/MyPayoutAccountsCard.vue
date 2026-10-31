<script setup lang="ts">
import type { PromoterPayoutAccountDto } from '~/types/promoters'

// "Mis datos de cobro" — read-only card of the advisor portal (backend V184,
// GET /v1/advisors/me/payout-accounts, PROMOTER_PAYOUT_ACCOUNT_VIEW_OWN). The
// backend only ever returns the caller's own accounts; editing stays with the
// administration, so the card just tells the advisor whom to contact.
const { t } = useI18n()
const promoters = usePromoters()

const accounts = ref<PromoterPayoutAccountDto[]>([])
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    accounts.value = await promoters.myPayoutAccounts()
  }
  catch {
    accounts.value = []
  }
  finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden">
    <div class="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-prohealth-100">
      <div>
        <h2 class="font-bold text-prohealth-900">{{ t('promoterSelf.payoutAccounts.title') }}</h2>
        <p class="text-xs text-prohealth-500 mt-0.5">{{ t('promoterSelf.payoutAccounts.contactAdmin') }}</p>
      </div>
      <RefreshButton :loading="loading" :title="t('common.refreshSection')" @refresh="load" />
    </div>

    <div v-if="loading" class="p-5 space-y-3">
      <USkeleton class="h-4 w-64 rounded" />
      <USkeleton class="h-4 w-full max-w-lg rounded" />
    </div>

    <div v-else-if="accounts.length === 0" class="px-5 py-8 text-center text-sm text-prohealth-500">
      <UIcon name="i-lucide-wallet" class="w-7 h-7 mx-auto mb-2 text-prohealth-300" />
      {{ t('promoterSelf.payoutAccounts.empty') }}
    </div>

    <ul v-else class="divide-y divide-prohealth-100">
      <li v-for="a in accounts" :key="a.uuid" class="px-5 py-3 flex flex-wrap items-start justify-between gap-3 text-sm">
        <div>
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-semibold text-prohealth-900">{{ a.paymentMethod_Display || a.paymentMethodCode }}</span>
            <UBadge v-if="a.isDefault" color="primary" variant="soft" size="sm">{{ t('promoters.payoutAccounts.defaultBadge') }}</UBadge>
          </div>
          <p v-if="a.label || a.bank_Display" class="text-xs text-prohealth-500 mt-0.5">
            <span v-if="a.label">{{ a.label }}</span><span v-if="a.label && a.bank_Display"> · </span><BankName v-if="a.bank_Display" :uuid="a.bank_Uuid" :code="a.bank_Code" :name="a.bank_Display" />
          </p>
        </div>
        <div class="text-right">
          <p class="font-mono text-prohealth-800">{{ payoutDestination(a) || t('common.empty') }}</p>
          <p v-if="a.holderName || payoutHolderDocument(a)" class="text-xs text-prohealth-500 mt-0.5">
            {{ [a.holderName, payoutHolderDocument(a)].filter(Boolean).join(' · ') }}
          </p>
        </div>
      </li>
    </ul>
  </div>
</template>
