<script setup lang="ts">
import type { CopyableAccount } from '~/utils/companyAccountCopy'
import {
  bankCodeAndName,
  buildGenericCopy,
  buildMobilePaymentCopy,
  isMobilePayment,
  normalizeDocument,
} from '~/utils/companyAccountCopy'

// Read-only card of a bank account (a company account or an advisor's payout account) with copy buttons:
// one per key value, "copy data" for everything, and for Pago Móvil the 4-line text the bank apps accept
// (phone, cédula / RIF, bank code + name, amount in bolívares when known).
const props = defineProps<{
  account: CopyableAccount
  /** Amount in bolívares for the Pago Móvil text; `null` leaves that line out. */
  amountVes?: number | null
}>()

const { t } = useI18n()
const toast = useToast()
const { copy } = useClipboardCopy()

const mobile = computed(() => isMobilePayment(props.account.methodCode))
const bank = computed(() => bankCodeAndName(props.account))

async function copyText(text: string, what: string) {
  await copy(text)
  toast.add({ title: t('payments.accountCopy.copied', { what }), color: 'success', icon: 'i-lucide-clipboard-check' })
}

function copyMobilePayment() {
  copyText(buildMobilePaymentCopy(props.account, props.amountVes), t('payments.accountCopy.mobilePayment'))
}

function copyAll() {
  copyText(buildGenericCopy(props.account, {
    bank: t('payments.accountCopy.fields.bank'),
    accountType: t('payments.accountCopy.fields.accountType'),
    accountNumber: t('payments.accountCopy.fields.accountNumber'),
    holderName: t('payments.accountCopy.fields.holderName'),
    document: t('payments.accountCopy.fields.document'),
    phone: t('payments.accountCopy.fields.phone'),
    email: t('payments.accountCopy.fields.email'),
  }), t('payments.accountCopy.data'))
}
</script>

<template>
  <div class="space-y-2 rounded-lg bg-prohealth-50/60 p-3 text-xs text-prohealth-700">
    <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
      <div v-if="account.methodName"><dt class="inline font-semibold">{{ t('payments.accountCopy.fields.method') }}: </dt><dd class="inline">{{ account.methodName }}</dd></div>
      <div v-if="bank"><dt class="inline font-semibold">{{ t('payments.accountCopy.fields.bank') }}: </dt><dd class="inline"><BankName :uuid="account.bankUuid" :code="account.bankCode" :name="account.bankName" /></dd></div>
      <div v-if="account.accountType"><dt class="inline font-semibold">{{ t('payments.accountCopy.fields.accountType') }}: </dt><dd class="inline">{{ account.accountType }}</dd></div>
      <div v-if="account.accountNumber" class="flex items-center gap-1">
        <dt class="font-semibold">{{ t('payments.accountCopy.fields.accountNumber') }}: </dt>
        <dd class="font-mono">{{ account.accountNumber }}</dd>
        <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-copy" :aria-label="t('payments.accountCopy.fields.accountNumber')" @click="copyText(account.accountNumber!, t('payments.accountCopy.fields.accountNumber'))" />
      </div>
      <div v-if="account.phone" class="flex items-center gap-1">
        <dt class="font-semibold">{{ t('payments.accountCopy.fields.phone') }}: </dt>
        <dd class="font-mono">{{ account.phone }}</dd>
        <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-copy" :aria-label="t('payments.accountCopy.fields.phone')" @click="copyText(account.phone!, t('payments.accountCopy.fields.phone'))" />
      </div>
      <div v-if="account.email" class="flex items-center gap-1">
        <dt class="font-semibold">{{ t('payments.accountCopy.fields.email') }}: </dt>
        <dd>{{ account.email }}</dd>
        <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-copy" :aria-label="t('payments.accountCopy.fields.email')" @click="copyText(account.email!, t('payments.accountCopy.fields.email'))" />
      </div>
      <div v-if="account.holderName"><dt class="inline font-semibold">{{ t('payments.accountCopy.fields.holderName') }}: </dt><dd class="inline">{{ account.holderName }}</dd></div>
      <div v-if="account.document" class="flex items-center gap-1">
        <dt class="font-semibold">{{ t('payments.accountCopy.fields.document') }}: </dt>
        <dd>{{ account.document }}</dd>
        <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-copy" :aria-label="t('payments.accountCopy.fields.document')" @click="copyText(normalizeDocument(account.document), t('payments.accountCopy.fields.document'))" />
      </div>
      <slot name="extra" />
    </dl>
    <div class="flex flex-wrap items-center gap-2">
      <UButton v-if="mobile" size="xs" color="primary" variant="soft" icon="i-lucide-smartphone" @click="copyMobilePayment">
        {{ t('payments.accountCopy.mobilePaymentButton') }}
      </UButton>
      <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-copy" @click="copyAll">
        {{ t('payments.accountCopy.allButton') }}
      </UButton>
    </div>
    <p v-if="mobile" class="text-[11px] text-prohealth-500">
      {{ amountVes ? t('payments.accountCopy.mobileHintWithAmount') : t('payments.accountCopy.mobileHint') }}
    </p>
  </div>
</template>
