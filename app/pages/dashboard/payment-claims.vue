<script setup lang="ts">
import type { PaymentClaimDto, ResolvePaymentClaimRequest } from '~/types/payments'
import { CLAIM_STATUSES } from '~/types/payments'

// Claims on the remaining credit of a payment (hub ADR 0029): a payer or staff flagged a payment as wrong,
// overpaid or a refund request. Finance resolves each one: keep the amount as credit ("monedero"), refund it
// (booked as a reversal; the transfer itself happens outside the system) or reject the claim.
definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'COLLECTION_CLAIM_VIEW_ALL',
})

const { t } = useI18n()
const { can } = usePermissions()
const toast = useToast()
const claimsApi = usePaymentClaims()

useSeoMeta({ title: () => t('common.seoTitle', { page: t('paymentClaims.title') }) })

const canResolve = computed(() => can('COLLECTION_CLAIM_RESOLVE'))

const data = ref<PaymentClaimDto[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1) // UPagination is 1-based; the API is 0-based
const size = ref(20)
const status = ref<string>('OPEN')

const statusOptions = computed(() => [
  { label: t('paymentClaims.allStatuses'), value: '' },
  ...CLAIM_STATUSES.map(s => ({ label: t(`paymentClaims.status.${s}`), value: s })),
])

async function load() {
  loading.value = true
  try {
    const res = await claimsApi.list({ page: page.value - 1, size: size.value, status: status.value || undefined })
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

watch(status, () => {
  if (page.value !== 1) page.value = 1
  else load()
})
watch(page, load)
onMounted(load)

function statusColor(s: string): 'warning' | 'success' | 'error' | 'neutral' {
  if (s === 'OPEN') return 'warning'
  if (s === 'REFUNDED' || s === 'KEPT_AS_CREDIT' || s === 'USED_BY_AGREEMENT') return 'success'
  if (s === 'REJECTED') return 'error'
  return 'neutral'
}

// ---- Resolve ----
const resolveOpen = ref(false)
const resolving = ref(false)
const target = ref<PaymentClaimDto | null>(null)
const action = ref<ResolvePaymentClaimRequest['action']>('KEEP_AS_CREDIT')
const refundedAmount = ref<number | null>(null)
const note = ref('')

const actionOptions = computed(() => (['KEEP_AS_CREDIT', 'REFUND', 'REJECT'] as const)
  .map(a => ({ label: t(`paymentClaims.actions.${a}`), value: a })))

function openResolve(c: PaymentClaimDto) {
  target.value = c
  action.value = c.reason === 'REFUND_REQUEST' ? 'REFUND' : 'KEEP_AS_CREDIT'
  refundedAmount.value = Number(c.claimedAmount)
  note.value = ''
  resolveOpen.value = true
}

const claimed = computed(() => Number(target.value?.claimedAmount ?? 0))
const refundValid = computed(() =>
  action.value !== 'REFUND' || (refundedAmount.value !== null && refundedAmount.value > 0 && refundedAmount.value <= claimed.value))

async function confirmResolve() {
  if (!target.value || !refundValid.value) return
  resolving.value = true
  try {
    await claimsApi.resolve(target.value.uuid, {
      action: action.value,
      ...(action.value === 'REFUND' && refundedAmount.value !== null ? { refundedAmount: refundedAmount.value } : {}),
      note: note.value.trim() || undefined,
    })
    toast.add({ title: t('paymentClaims.resolvedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    resolveOpen.value = false
    if (data.value.length === 1 && page.value > 1) page.value -= 1
    else await load()
  }
  catch {
    // useApi already notified the error
  }
  finally {
    resolving.value = false
  }
}
</script>

<template>
  <div class="space-y-5">
    <div>
      <h1 class="text-2xl font-extrabold text-prohealth-900">{{ t('paymentClaims.title') }}</h1>
      <p class="text-sm text-prohealth-700/70 mt-1">{{ t('paymentClaims.subtitle') }}</p>
    </div>

    <div class="flex flex-wrap items-center gap-4">
      <USelectMenu v-model="status" :items="statusOptions" label-key="label" value-key="value" class="w-full sm:w-64" />
    </div>

    <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden flex flex-col">
      <div class="overflow-auto">
        <table class="w-full text-sm">
          <thead class="sticky top-0 bg-white z-10">
            <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
              <th class="px-5 py-3 font-semibold">{{ t('paymentClaims.columns.payment') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('paymentClaims.columns.person') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('paymentClaims.columns.reason') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('paymentClaims.columns.amount') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('paymentClaims.columns.openedAt') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('paymentClaims.columns.status') }}</th>
              <th class="px-5 py-3 font-semibold text-right">{{ t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-prohealth-100">
            <TableSkeleton v-if="loading" :rows="6" :cols="7" />
            <tr v-else-if="data.length === 0">
              <td colspan="7" class="px-5 py-12 text-center text-prohealth-500">
                <UIcon name="i-lucide-message-square-warning" class="w-8 h-8 mx-auto mb-2 text-prohealth-300" />
                {{ t('paymentClaims.empty') }}
              </td>
            </tr>
            <tr v-for="c in data" v-else :key="c.uuid" class="hover:bg-prohealth-50/50 align-top">
              <td class="px-5 py-3">
                <NuxtLink :to="`/dashboard/collections/${c.paymentUuid}`" class="text-cyan-700 hover:underline">
                  {{ c.payment_Display ?? t('paymentClaims.viewPayment') }}
                </NuxtLink>
              </td>
              <td class="px-5 py-3 text-prohealth-800">
                {{ c.person_Display ?? t('common.empty') }}
                <span v-if="c.beneficiary_Display" class="block text-xs text-prohealth-500">
                  {{ t('payments.beneficiary.forLabel', { name: c.beneficiary_Display }) }}
                </span>
              </td>
              <td class="px-5 py-3 text-prohealth-700">
                {{ c.reason_Display ?? t(`payments.claim.reasons.${c.reason}`) }}
                <span v-if="c.comment" class="block text-xs text-prohealth-500 max-w-xs">{{ c.comment }}</span>
              </td>
              <td class="px-5 py-3 font-medium text-prohealth-900">
                {{ c.claimedAmount_Display ?? c.claimedAmount }} <span class="text-xs text-prohealth-500">{{ c.currency_Code }}</span>
              </td>
              <td class="px-5 py-3 text-prohealth-600">{{ c.openedAt_Display ?? c.openedAt }}</td>
              <td class="px-5 py-3">
                <UBadge :color="statusColor(c.status)" variant="subtle" size="sm">
                  {{ c.status_Display ?? t(`paymentClaims.status.${c.status}`) }}
                </UBadge>
                <span v-if="c.resolutionNote" class="block text-xs text-prohealth-500 mt-1 max-w-xs">{{ c.resolutionNote }}</span>
              </td>
              <td class="px-5 py-3 text-right">
                <UTooltip v-if="c.status === 'OPEN'" :text="canResolve ? t('paymentClaims.resolve') : t('paymentClaims.noPermissionResolve')">
                  <UButton
                    color="primary"
                    variant="soft"
                    size="sm"
                    icon="i-lucide-gavel"
                    :disabled="!canResolve"
                    @click="openResolve(c)"
                  >
                    {{ t('paymentClaims.resolve') }}
                  </UButton>
                </UTooltip>
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

    <UModal v-model:open="resolveOpen" :title="t('paymentClaims.resolveTitle')" :description="t('paymentClaims.resolveDescription')">
      <template #body>
        <div class="space-y-4">
          <p v-if="target" class="text-sm text-prohealth-700">
            {{ t('paymentClaims.claimedSummary', { amount: target.claimedAmount_Display ?? target.claimedAmount, currency: target.currency_Code ?? '' }) }}
          </p>

          <UFormField :label="t('paymentClaims.actionLabel')">
            <USelectMenu v-model="action" :items="actionOptions" label-key="label" value-key="value" class="w-full" />
          </UFormField>
          <p class="text-xs text-prohealth-500 -mt-2">{{ t(`paymentClaims.actionHelp.${action}`) }}</p>

          <UFormField
            v-if="action === 'REFUND'"
            :label="t('paymentClaims.refundedAmountLabel')"
            :error="!refundValid ? t('paymentClaims.refundedAmountInvalid') : undefined"
          >
            <UInput v-model.number="refundedAmount" type="number" step="0.01" min="0" class="w-full" />
          </UFormField>

          <UFormField :label="t('paymentClaims.noteLabel')">
            <UTextarea v-model="note" :rows="3" class="w-full" />
          </UFormField>

          <div class="flex items-center justify-end gap-3 pt-2">
            <UButton color="neutral" variant="ghost" :disabled="resolving" @click="resolveOpen = false">{{ t('common.cancel') }}</UButton>
            <UButton :loading="resolving" :disabled="!refundValid" icon="i-lucide-check" @click="confirmResolve">
              {{ t('paymentClaims.confirm') }}
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
