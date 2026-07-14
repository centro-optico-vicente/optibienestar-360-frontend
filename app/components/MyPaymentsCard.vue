<script setup lang="ts">
import type { PaymentDto } from '~/types/payments'
import { paymentStatusColor } from '~/types/payments'

// Authenticated member's payment history (GET /v1/me/payments, PAYMENT_VIEW_OWN).
// Self-gated: if the user lacks the permission, it renders nothing. Meant to be
// embedded in the member portal (/afiliado) next to the card.
const { t } = useI18n()
const { formatCurrency, formatDate, formatMonthYear } = useFormatters()
const payments = usePayments()
const { can } = usePermissions()

const canView = computed(() => can('PAYMENT_VIEW_OWN'))

const data = ref<PaymentDto[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1) // UPagination is 1-based; the API is 0-based
const size = ref(10)

async function load() {
  loading.value = true
  try {
    const res = await payments.mine({ page: page.value - 1, size: size.value })
    data.value = res.content ?? []
    total.value = res.totalElements ?? 0
  }
  catch {
    // useApi already shows the error toast
    data.value = []
    total.value = 0
  }
  finally {
    loading.value = false
  }
}

watch(page, load)

onMounted(() => {
  if (canView.value) load()
})

// Amount in the payment's currency, formatted in the VE convention. Empty → '—'.
function money(v?: number | string | null, currency?: string | null): string {
  if (v === null || v === undefined || v === '') return t('common.empty')
  return formatCurrency(Number(v), currency || 'USD')
}

// Payment method label; falls back to the raw value.
function methodLabel(m?: string | null): string {
  return m ? t(`payments.methods.${m}`, m) : t('common.empty')
}
function statusLabel(s?: string | null): string {
  return s ? t(`payments.status.${s}`, s) : t('common.empty')
}

function allocationLabel(p: PaymentDto): string {
  if (p.inscription) return t('payments.allocation.inscription')
  return p.appliedPeriod
    ? t('payments.allocation.monthlyPeriod', { period: formatMonthYear(p.appliedPeriod) })
    : t('payments.allocation.monthly')
}
</script>

<template>
  <div v-if="canView" class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden">
    <div class="px-6 py-4 border-b border-prohealth-100">
      <h2 class="font-bold text-prohealth-900">{{ t('payments.mine.title') }}</h2>
      <p class="text-xs text-prohealth-500 mt-0.5">{{ t('payments.mine.subtitle') }}</p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="px-6 py-8 space-y-3">
      <USkeleton class="h-5 w-full rounded" />
      <USkeleton class="h-5 w-3/4 rounded" />
    </div>

    <!-- Empty -->
    <div v-else-if="data.length === 0" class="px-6 py-10 text-center text-prohealth-500">
      <UIcon name="i-lucide-receipt" class="w-7 h-7 mx-auto mb-2 text-prohealth-300" />
      <p class="text-sm">{{ t('payments.mine.empty') }}</p>
    </div>

    <!-- List -->
    <ul v-else class="divide-y divide-prohealth-100">
      <li
        v-for="p in data"
        :key="p.uuid"
        class="px-6 py-3.5 flex items-center justify-between gap-3"
      >
        <div class="min-w-0">
          <p class="font-semibold text-prohealth-900">{{ money(p.amount, p.currency) }}</p>
          <p class="text-xs text-prohealth-500">
            {{ methodLabel(p.paymentMethod) }} · {{ formatDate(p.paymentDate, 'short') }} · {{ allocationLabel(p) }}
          </p>
        </div>
        <UBadge :color="paymentStatusColor(p.status)" variant="subtle" size="sm">
          {{ statusLabel(p.status) }}
        </UBadge>
      </li>
    </ul>

    <!-- Pagination (only when there is more than one page) -->
    <div v-if="!loading && total > size" class="flex items-center justify-end px-6 py-3 border-t border-prohealth-100">
      <UPagination
        v-model:page="page"
        :total="total"
        :items-per-page="size"
      />
    </div>
  </div>
</template>
