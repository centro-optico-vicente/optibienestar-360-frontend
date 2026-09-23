<script setup lang="ts">
import type { PaymentDto } from '~/types/payments'
import { paymentStatusColor } from '~/types/payments'

// "Cobros de mis afiliados" (hub plan payments-unification, "Mis portales") —
// direction=IN payments from the affiliates in the promoter's own downline
// (payments.promoter_id, V117). Register/delete (V121, PAYMENT_CREATE_DOWNLINE
// / PAYMENT_DELETE_DOWNLINE) let the promoter self-manage collections for
// their own portfolio; approve/reject stay admin-only by default (granular
// permissions exist — PAYMENT_APPROVE_DOWNLINE/PAYMENT_REJECT_DOWNLINE —
// but aren't granted to PROMOTOR, see V121 header comment).
definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'PROMOTER_VIEW_OWN',
})

const { t } = useI18n()
const { formatDate } = useFormatters()

useSeoMeta({ title: () => t('common.seoTitle', { page: t('promoterSelf.collections.title') }) })

const payments = usePayments()
const { can } = usePermissions()
const toast = useToast()

const canRegister = computed(() => can('PAYMENT_CREATE_DOWNLINE'))
const canDelete = computed(() => can('PAYMENT_DELETE_DOWNLINE'))

const data = ref<PaymentDto[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1) // UPagination is 1-based; the API is 0-based
const size = ref(20)

async function load() {
  loading.value = true
  try {
    const res = await payments.mineForPromoter('IN', { page: page.value - 1, size: size.value })
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

function isPending(p: PaymentDto): boolean {
  return p.status === 'PENDING'
}

// ---- Register (modal) ----
const formOpen = ref(false)

async function onSaved() {
  page.value = 1
  await load()
}

// ---- Delete (only while still PENDING) ----
const deleteOpen = ref(false)
const deleting = ref(false)
const target = ref<PaymentDto | null>(null)

function openDelete(p: PaymentDto) {
  target.value = p
  deleteOpen.value = true
}

async function confirmDelete() {
  if (!target.value) return
  deleting.value = true
  try {
    await payments.removeForDownline(target.value.uuid)
    toast.add({ title: t('payments.deletedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    deleteOpen.value = false
    if (data.value.length === 1 && page.value > 1) page.value -= 1
    else await load()
  }
  catch {
    // useApi already notified the error
  }
  finally {
    deleting.value = false
  }
}
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-extrabold text-prohealth-900">{{ t('promoterSelf.collections.title') }}</h1>
        <p class="text-sm text-prohealth-700/70 mt-1">{{ t('promoterSelf.collections.subtitle') }}</p>
      </div>
      <UTooltip :text="canRegister ? t('payments.createTooltip') : t('payments.noPermissionRegister')">
        <UButton
          color="primary"
          variant="outline"
          icon="i-lucide-plus"
          :disabled="!canRegister"
          @click="formOpen = true"
        >
          {{ t('common.new') }}
        </UButton>
      </UTooltip>
    </div>

    <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden flex flex-col h-[calc(100vh-16rem)] min-h-[24rem]">
      <div class="overflow-auto flex-1">
        <table class="w-full text-sm">
          <thead class="sticky top-0 bg-white z-10">
            <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
              <th class="px-5 py-3 font-semibold">{{ t('payments.columns.member') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('payments.columns.planReference') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('payments.columns.amount') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('payments.columns.date') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('payments.columns.status') }}</th>
              <th class="px-5 py-3 font-semibold text-right">{{ t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-prohealth-100">
            <TableSkeleton v-if="loading" :rows="8" :cols="6" />
            <tr v-else-if="data.length === 0">
              <td colspan="6" class="px-5 py-12 text-center text-prohealth-500">
                <UIcon name="i-lucide-receipt" class="w-8 h-8 mx-auto mb-2 text-prohealth-300" />
                {{ t('promoterSelf.collections.empty') }}
              </td>
            </tr>
            <tr v-for="p in data" v-else :key="p.uuid" class="hover:bg-prohealth-50/50">
              <td class="px-5 py-3 text-prohealth-800">{{ p.member_Display ?? t('common.empty') }}</td>
              <td class="px-5 py-3 text-prohealth-600">{{ p.plan_Display ?? t('common.empty') }}</td>
              <td class="px-5 py-3 font-medium text-prohealth-900">
                <CurrencyConverterDisplay :amount="p.amount" :currency="p.currency_Code" :date="p.paymentDate" v-slot="{ result }">
                  <span class="inline-flex items-center gap-1">
                    {{ p.amount_Display ?? p.amount }}
                    <CurrencyConverterTrigger :result="result" />
                  </span>
                </CurrencyConverterDisplay>
              </td>
              <td class="px-5 py-3 text-prohealth-600">{{ p.paymentDate_Display ?? formatDate(p.paymentDate, 'datetime') }}</td>
              <td class="px-5 py-3">
                <UBadge :color="paymentStatusColor(p.status)" variant="subtle" size="sm">
                  {{ p.status_Display ?? statusLabel(p.status) }}
                </UBadge>
              </td>
              <td class="px-5 py-3 text-right">
                <UTooltip v-if="isPending(p)" :text="canDelete ? t('common.delete') : t('payments.tooltips.noPermissionDelete')">
                  <UButton
                    color="error"
                    variant="ghost"
                    icon="i-lucide-trash-2"
                    size="sm"
                    :disabled="!canDelete"
                    @click="openDelete(p)"
                  />
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

    <!-- Register modal -->
    <DownlinePaymentFormModal v-model:open="formOpen" @saved="onSaved" />

    <!-- Delete confirmation modal (PENDING only) -->
    <UModal v-model:open="deleteOpen" :title="t('payments.delete.title')">
      <template #body>
        <p class="text-sm text-prohealth-700">{{ t('payments.delete.confirm') }}</p>
        <div class="flex items-center justify-end gap-3 pt-5">
          <UButton color="neutral" variant="ghost" :disabled="deleting" @click="deleteOpen = false">
            {{ t('common.cancel') }}
          </UButton>
          <UButton color="error" :loading="deleting" icon="i-lucide-trash-2" @click="confirmDelete">
            {{ t('common.delete') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
