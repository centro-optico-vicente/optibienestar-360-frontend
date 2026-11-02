<script setup lang="ts">
import type { CreditBalanceDto, PaymentDto } from '~/types/payments'
import { paymentStatusColor } from '~/types/payments'

// "Mis pagos" (hub plan payments-unification, "Mis portales") — the
// caller's own collections, with or without a membership (V201: without one the
// approved payment is credit, shown below). List is COLLECTION_VIEW_OWN;
// register/delete-while-pending are COLLECTION_CREATE_OWN/COLLECTION_DELETE_OWN.
// Approve/reject stay exclusively an admin action — there is no self-approval path.
definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'COLLECTION_VIEW_OWN',
})

const { t } = useI18n()
const { formatDate, formatMonthYear } = useFormatters()

useSeoMeta({ title: () => t('common.seoTitle', { page: t('payments.mine.title') }) })

const payments = usePayments()
const { can } = usePermissions()
const toast = useToast()

const canRegister = computed(() => can('COLLECTION_CREATE_OWN'))
const canDelete = computed(() => can('COLLECTION_DELETE_OWN'))
const canClaim = computed(() => can('COLLECTION_CLAIM_CREATE_OWN'))

// Credit ("saldo a favor") per currency — empty list = nothing to show, never an error (ADR 0012 empty state).
const credit = ref<CreditBalanceDto['balances']>([])
async function loadCredit() {
  try {
    credit.value = ((await payments.creditBalance())?.balances ?? []).filter(b => Number(b.amount) > 0)
  }
  catch {
    credit.value = []
  }
}

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
onMounted(() => {
  load()
  loadCredit()
})

function statusLabel(s?: string | null): string {
  return s ? t(`payments.status.${s}`, s) : t('common.empty')
}
function methodLabel(m?: string | null): string {
  return m ? t(`payments.methods.${m}`, m) : t('common.empty')
}

// Period the payment covers: inscription, one month, or a multi-month
// advance (V154) — same labels as the admin collection detail.
function periodLabel(p: PaymentDto): string {
  if (p.inscription) return t('payments.allocation.inscriptionFull')
  if (!p.appliedPeriod) return t('common.empty')
  if (p.coverageThroughPeriod && p.coverageThroughPeriod !== p.appliedPeriod) {
    return t('payments.allocation.monthlyRange', {
      from: formatMonthYear(p.appliedPeriod),
      to: formatMonthYear(p.coverageThroughPeriod),
    })
  }
  return t('payments.allocation.monthlyPeriod', { period: formatMonthYear(p.appliedPeriod) })
}

function isPending(p: PaymentDto): boolean {
  return p.status === 'PENDING'
}

// The payer may still point a not-yet-approved payment at another membership (e.g. a relative's plan).
function canAssign(p: PaymentDto): boolean {
  return canRegister.value && (p.status === 'DRAFT' || p.status === 'PENDING')
}

// ---- Register (modal) ----
const formOpen = ref(false)

async function onSaved() {
  page.value = 1
  await Promise.all([load(), loadCredit()])
}

// ---- Claim on the remaining credit of an approved payment (hub ADR 0029) ----
// Only an approved collection with credit left and no open claim can be claimed.
function canClaimPayment(p: PaymentDto): boolean {
  return canClaim.value && p.direction !== 'OUT' && p.status === 'APPROVED'
    && Number(p.creditRemaining ?? 0) > 0 && !p.openClaim
}

const claimOpen = ref(false)
const claimTarget = ref<PaymentDto | null>(null)

function openClaim(p: PaymentDto) {
  claimTarget.value = p
  claimOpen.value = true
}

const withdrawing = ref<string | null>(null)

async function withdrawClaim(p: PaymentDto) {
  withdrawing.value = p.uuid
  try {
    await payments.withdrawClaimOwn(p.uuid)
    toast.add({ title: t('payments.claim.withdrawnToast'), color: 'success', icon: 'i-lucide-check-circle' })
    await Promise.all([load(), loadCredit()])
  }
  catch {
    // useApi already notified the error
  }
  finally {
    withdrawing.value = null
  }
}

// ---- Assign to a membership (DRAFT / PENDING) ----
const assignOpen = ref(false)
const assignTarget = ref<PaymentDto | null>(null)

function openAssign(p: PaymentDto) {
  assignTarget.value = p
  assignOpen.value = true
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
    await payments.removeOwn(target.value.uuid)
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
        <h1 class="text-2xl font-extrabold text-prohealth-900">{{ t('payments.mine.title') }}</h1>
        <p class="text-sm text-prohealth-700/70 mt-1">{{ t('payments.mine.subtitle') }}</p>
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

    <div v-if="credit.length > 0" class="rounded-2xl border border-green-200 bg-green-50 px-5 py-3 flex flex-wrap items-center gap-x-6 gap-y-1">
      <p class="text-sm font-semibold text-green-800">{{ t('payments.credit.title') }}</p>
      <p v-for="b in credit" :key="b.currency_Code" class="text-sm text-green-900">
        <span class="font-semibold">{{ b.amount_Display ?? b.amount }}</span> {{ b.currency_Code }}
      </p>
      <p class="text-xs text-green-700">{{ t('payments.credit.help') }}</p>
      <p class="text-xs text-green-700">{{ t('payments.credit.autoApply') }}</p>
    </div>

    <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden flex flex-col h-[calc(100vh-16rem)] min-h-[24rem]">
      <div class="overflow-auto flex-1">
        <table class="w-full text-sm">
          <thead class="sticky top-0 bg-white z-10">
            <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
              <th class="px-5 py-3 font-semibold">{{ t('payments.columns.planReference') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('payments.columns.amount') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('payments.columns.period') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('payments.columns.method') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('payments.columns.date') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('payments.columns.status') }}</th>
              <th class="px-5 py-3 font-semibold text-right">{{ t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-prohealth-100">
            <TableSkeleton v-if="loading" :rows="8" :cols="7" />
            <tr v-else-if="data.length === 0">
              <td colspan="7" class="px-5 py-12 text-center text-prohealth-500">
                <UIcon name="i-lucide-receipt" class="w-8 h-8 mx-auto mb-2 text-prohealth-300" />
                {{ t('payments.empty') }}
              </td>
            </tr>
            <tr v-for="p in data" v-else :key="p.uuid" class="hover:bg-prohealth-50/50">
              <td class="px-5 py-3 text-prohealth-800">
                {{ p.plan_Display ?? t('common.empty') }}
                <span v-if="p.beneficiary_Display" class="block text-xs text-prohealth-500">
                  {{ t('payments.beneficiary.forLabel', { name: p.beneficiary_Display }) }}
                </span>
              </td>
              <td class="px-5 py-3 font-medium text-prohealth-900">
                <CurrencyConverterDisplay :amount="p.amount" :currency="p.currency_Code" :date="p.paymentDate" v-slot="{ result }">
                  <span class="inline-flex items-center gap-1">
                    {{ p.amount_Display ?? p.amount }}
                    <CurrencyConverterTrigger :result="result" />
                  </span>
                </CurrencyConverterDisplay>
                <p v-if="p.discountAmount" class="text-xs text-green-700 font-normal">
                  {{ t('promotions.portal.paymentSaving', { amount: p.discountAmount_Display ?? p.discountAmount, reason: p.discountReason ?? '' }) }}
                </p>
              </td>
              <td class="px-5 py-3 text-prohealth-700 whitespace-nowrap">{{ periodLabel(p) }}</td>
              <td class="px-5 py-3 text-prohealth-600">{{ methodLabel(p.paymentMethod) }}</td>
              <td class="px-5 py-3 text-prohealth-600">{{ p.paymentDate_Display ?? formatDate(p.paymentDate, 'datetime') }}</td>
              <td class="px-5 py-3">
                <UBadge :color="paymentStatusColor(p.status)" variant="subtle" size="sm">
                  {{ p.status_Display ?? statusLabel(p.status) }}
                </UBadge>
                <UBadge v-if="p.openClaim" color="warning" variant="subtle" size="sm" class="ml-1">
                  {{ t('payments.claim.badge', { amount: p.openClaim.claimedAmount_Display ?? p.openClaim.claimedAmount }) }}
                </UBadge>
              </td>
              <td class="px-5 py-3 text-right">
                <UTooltip v-if="canClaimPayment(p)" :text="t('payments.claim.action')">
                  <UButton color="warning" variant="ghost" icon="i-lucide-message-square-warning" size="sm" @click="openClaim(p)" />
                </UTooltip>
                <UTooltip v-if="p.openClaim && canClaim" :text="t('payments.claim.withdraw')">
                  <UButton
                    color="neutral"
                    variant="ghost"
                    icon="i-lucide-undo-2"
                    size="sm"
                    :loading="withdrawing === p.uuid"
                    @click="withdrawClaim(p)"
                  />
                </UTooltip>
                <UTooltip v-if="canAssign(p)" :text="t('payments.assignOwn.title')">
                  <UButton color="neutral" variant="ghost" icon="i-lucide-link" size="sm" @click="openAssign(p)" />
                </UTooltip>
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
    <MyPaymentFormModal v-model:open="formOpen" @saved="onSaved" />

    <PaymentClaimModal v-model:open="claimOpen" :payment="claimTarget" @claimed="onSaved" />

    <PaymentAssignOwnMembershipModal v-model:open="assignOpen" :payment="assignTarget" @assigned="load" />

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
