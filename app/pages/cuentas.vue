<script setup lang="ts">
import type { CompanyBankAccountDto } from '~/types/payments'
import { fromCompanyAccount } from '~/utils/companyAccountCopy'

// PUBLIC list of the company's bank accounts flagged public (no login; backend V204,
// GET /v1/public/company-bank-accounts). Anyone can see where to pay; accounts that are not
// flagged public are only offered to people registering a payment.
// English pair (hub URL convention): /en/accounts, same page rendered in English by
// middleware/public-locale.global.ts.
definePageMeta({ layout: 'default', alias: ['/en/accounts'], key: 'public-accounts' })

const { t } = useI18n()

useSeoMeta({
  title: () => t('publicAccounts.seoTitle'),
  description: () => t('publicAccounts.seoDescription'),
  ogTitle: () => t('publicAccounts.seoTitle'),
  ogDescription: () => t('publicAccounts.seoDescription'),
})

const accounts = ref<CompanyBankAccountDto[]>([])
const loading = ref(true)
const failed = ref(false)

onMounted(async () => {
  try {
    accounts.value = (await useApi<CompanyBankAccountDto[]>('/v1/public/company-bank-accounts', { skipAuth: true, silent: true })) ?? []
  }
  catch {
    failed.value = true
  }
  finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="max-w-4xl mx-auto px-4 py-10 space-y-6">
    <header class="space-y-2">
      <h1 class="text-2xl font-extrabold text-prohealth-900">{{ t('publicAccounts.title') }}</h1>
      <p class="text-sm text-prohealth-700/80">{{ t('publicAccounts.subtitle') }}</p>
    </header>

    <p v-if="loading" class="text-sm text-prohealth-500">{{ t('common.loading') }}</p>
    <p v-else-if="failed" class="text-sm text-red-600">{{ t('publicAccounts.loadFailed') }}</p>
    <p v-else-if="accounts.length === 0" class="text-sm text-prohealth-600">{{ t('publicAccounts.empty') }}</p>

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <article v-for="a in accounts" :key="a.uuid" class="rounded-2xl border border-prohealth-100 bg-white p-5 space-y-2">
        <!-- Same card and copy buttons as the payment forms: method-driven fields (Pago Móvil shows the phone,
             a transfer the account number) and, for Pago Móvil, the 4-line text bank apps accept (no amount here). -->
        <div class="flex items-start justify-between gap-2">
          <h2 class="font-bold text-prohealth-900">{{ a.paymentMethod_Display ?? a.paymentMethodCode }}</h2>
          <UBadge color="neutral" variant="subtle" size="sm">{{ a.currency_Code }}</UBadge>
        </div>
        <AccountCopyCard :account="fromCompanyAccount(a)" :amount-ves="null" />
        <p v-if="a.notes" class="text-xs text-prohealth-700">{{ a.notes }}</p>
      </article>
    </div>
  </div>
</template>
