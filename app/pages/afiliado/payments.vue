<script setup lang="ts">
import type { PaymentDto } from '~/types/payments'
import { paymentStatusColor } from '~/types/payments'

// "Mis pagos" (hub plan payments-unification, "Mis portales") — the
// affiliate's own membership-fee collections (GET /v1/me/payments,
// PAYMENT_VIEW_OWN). Read-only history; registering a new payment stays on
// whatever flow already covers that (not this screen).
definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'PAYMENT_VIEW_OWN',
})

const { t } = useI18n()
const { formatDate } = useFormatters()

useSeoMeta({ title: () => t('common.seoTitle', { page: t('payments.mine.title') }) })

const payments = usePayments()

const data = ref<PaymentDto[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1) // UPagination is 1-based; the API is 0-based
const size = ref(20)

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
onMounted(load)

function statusLabel(s?: string | null): string {
  return s ? t(`payments.status.${s}`, s) : t('common.empty')
}
function methodLabel(m?: string | null): string {
  return m ? t(`payments.methods.${m}`, m) : t('common.empty')
}
</script>

<template>
  <div class="space-y-5">
    <div>
      <h1 class="text-2xl font-extrabold text-prohealth-900">{{ t('payments.mine.title') }}</h1>
      <p class="text-sm text-prohealth-700/70 mt-1">{{ t('payments.mine.subtitle') }}</p>
    </div>

    <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden flex flex-col h-[calc(100vh-16rem)] min-h-[24rem]">
      <div class="overflow-auto flex-1">
        <table class="w-full text-sm">
          <thead class="sticky top-0 bg-white z-10">
            <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
              <th class="px-5 py-3 font-semibold">{{ t('payments.columns.planReference') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('payments.columns.amount') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('payments.columns.method') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('payments.columns.date') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('payments.columns.status') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-prohealth-100">
            <TableSkeleton v-if="loading" :rows="8" :cols="5" />
            <tr v-else-if="data.length === 0">
              <td colspan="5" class="px-5 py-12 text-center text-prohealth-500">
                <UIcon name="i-lucide-receipt" class="w-8 h-8 mx-auto mb-2 text-prohealth-300" />
                {{ t('payments.empty') }}
              </td>
            </tr>
            <tr v-for="p in data" v-else :key="p.uuid" class="hover:bg-prohealth-50/50">
              <td class="px-5 py-3 text-prohealth-800">{{ p.plan_Display ?? t('common.empty') }}</td>
              <td class="px-5 py-3 font-medium text-prohealth-900">{{ p.amount_Display ?? p.amount }}</td>
              <td class="px-5 py-3 text-prohealth-600">{{ methodLabel(p.paymentMethod) }}</td>
              <td class="px-5 py-3 text-prohealth-600">{{ p.paymentDate_Display ?? formatDate(p.paymentDate, 'short') }}</td>
              <td class="px-5 py-3">
                <UBadge :color="paymentStatusColor(p.status)" variant="subtle" size="sm">
                  {{ p.status_Display ?? statusLabel(p.status) }}
                </UBadge>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="flex items-center justify-between gap-3 px-5 py-3 border-t border-prohealth-100 shrink-0">
        <p class="text-xs text-prohealth-500">{{ t('catalogs.recordCount', { count: total }) }}</p>
        <UPagination v-model:page="page" :total="total" :items-per-page="size" />
      </div>
    </div>
  </div>
</template>
