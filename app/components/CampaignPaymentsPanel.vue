<script setup lang="ts">
import { buildPageSizeItems, DEFAULT_PAGE_SIZE, UNPAGED_PAGE_SIZE } from '~/utils/pagination'
import type { CampaignPaymentRowDto, CampaignPaymentTotalsDto, CampaignSlotStatus } from '~/types/campaign'
import { CAMPAIGN_SLOT_STATUSES } from '~/types/campaign'
import { REDEMPTION_STATUS_COLORS } from '~/types/promotions'
import { PAYMENT_STATUS_OPTIONS, paymentStatusColor } from '~/types/payments'

/**
 * "Pagos" tab of the campaign detail (hub ADR 0038 point 9, CAMPAIGN_PAYMENT_VIEW):
 * one row per slot with the payment that confirms it (or none yet), totals, and
 * internal reminders to the advisor and the payment approvers
 * (CAMPAIGN_PAYMENT_REMIND, at most one per payment per hour — the backend
 * answers 422 otherwise and useApi shows its message).
 */
const props = defineProps<{ campaignUuid: string }>()

const { t } = useI18n()
const { formatDate, formatCurrency } = useFormatters()
const { can } = usePermissions()
const toast = useToast()
const campaignsApi = useCampaigns()

const canRemind = computed(() => can('CAMPAIGN_PAYMENT_REMIND'))
const canViewMember = computed(() => can('MEMBER_VIEW_ALL'))
const canViewPayment = computed(() => can('PAYMENT_VIEW_ALL'))
const canViewAdvisor = computed(() => can('PROMOTER_VIEW_ALL'))

const pageSizeItems = buildPageSizeItems(t)
const slotStatusItems = computed(() => CAMPAIGN_SLOT_STATUSES.map(s => ({ label: t(`promotions.redemptionStatus.${s}`), value: s })))
const paymentStatusItems = computed(() => PAYMENT_STATUS_OPTIONS.map(o => ({ label: t(o.labelKey), value: o.value as string })))

const rows = ref<CampaignPaymentRowDto[]>([])
const totals = ref<CampaignPaymentTotalsDto | null>(null)
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const size = ref(DEFAULT_PAGE_SIZE)
const slotStatus = ref<CampaignSlotStatus | null>(null)
const paymentStatus = ref<string | null>(null)

async function load() {
  loading.value = true
  try {
    const res = await campaignsApi.payments(props.campaignUuid, {
      slotStatus: slotStatus.value,
      paymentStatus: paymentStatus.value,
      page: page.value - 1,
      size: size.value,
    })
    totals.value = res.totals ?? null
    rows.value = res.page?.content ?? []
    total.value = res.page?.totalElements ?? 0
  }
  catch {
    totals.value = null
    rows.value = []
    total.value = 0
  }
  finally {
    loading.value = false
  }
}
onMounted(load)
watch([page, size], load)
watch([slotStatus, paymentStatus], () => {
  if (page.value !== 1) page.value = 1
  else load()
})
defineExpose({ load })

const tiles = computed(() => {
  const s = totals.value
  if (!s) return []
  return [
    { key: 'confirmed', value: s.confirmed, class: 'text-green-700' },
    { key: 'pendingInReview', value: s.pendingInReview, class: 'text-amber-600' },
    { key: 'pendingWithoutPayment', value: s.pendingWithoutPayment, class: 'text-prohealth-700' },
    { key: 'expired', value: s.expired, class: 'text-red-600' },
  ]
})

function amountLabel(r: CampaignPaymentRowDto): string {
  if (r.amount === null || r.amount === undefined || r.amount === '') return t('common.empty')
  return r.amount_Display ?? formatCurrency(Number(r.amount), r.amountCurrency_Code || 'USD')
}
function dateLabel(value?: string | null, display?: string | null, format: 'short' | 'datetime' = 'datetime'): string {
  return value ? (display ?? formatDate(value, format)) : t('common.empty')
}
/** A reminder makes sense while the slot waits for a payment that is still in review. */
function canRemindRow(r: CampaignPaymentRowDto): boolean {
  return canRemind.value && !!r.payment_Uuid && r.redemptionStatus === 'PENDING' && r.paymentStatus === 'PENDING'
}

// ---- Reminders (optional note) ----
const remindOpen = ref(false)
const remindTarget = ref<CampaignPaymentRowDto | null>(null)
const remindNote = ref('')
const reminding = ref(false)

function openRemind(row: CampaignPaymentRowDto | null) {
  remindTarget.value = row
  remindNote.value = ''
  remindOpen.value = true
}

async function submitRemind() {
  reminding.value = true
  const note = remindNote.value.trim() || null
  try {
    if (remindTarget.value?.payment_Uuid) {
      await campaignsApi.remindPayment(props.campaignUuid, remindTarget.value.payment_Uuid, note)
      toast.add({ title: t('campaigns.payments.remindedToast'), color: 'success', icon: 'i-lucide-mail-check' })
    }
    else {
      const res = await campaignsApi.remindPending(props.campaignUuid, note)
      toast.add({
        title: t('campaigns.payments.remindedAllToast', { sent: res.sent, skipped: res.skipped }),
        color: res.sent > 0 ? 'success' : 'warning',
        icon: 'i-lucide-mail-check',
      })
    }
    remindOpen.value = false
    await load()
  }
  catch { /* useApi shows the backend message, e.g. 422 campaign_payment.remind.too_soon */ }
  finally { reminding.value = false }
}
</script>

<template>
  <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden">
    <div class="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-prohealth-100">
      <div>
        <h2 class="font-bold text-prohealth-900">{{ t('campaigns.payments.title') }}</h2>
        <p class="text-xs text-prohealth-500 mt-0.5">{{ t('campaigns.payments.hint') }}</p>
      </div>
      <div class="flex items-center gap-2">
        <UButton
          v-if="canRemind"
          color="primary"
          variant="outline"
          size="sm"
          icon="i-lucide-bell-ring"
          :disabled="!totals?.pendingInReview"
          @click="openRemind(null)"
        >
          {{ t('campaigns.payments.remindAll') }}
        </UButton>
        <RefreshButton :loading="loading" :title="t('common.refreshSection')" @refresh="load" />
      </div>
    </div>

    <dl v-if="totals" class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm px-6 py-4 border-b border-prohealth-100">
      <div v-for="tile in tiles" :key="tile.key">
        <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t(`campaigns.payments.totals.${tile.key}`) }}</dt>
        <dd class="mt-0.5 text-lg font-bold" :class="tile.class">{{ tile.value }}</dd>
      </div>
    </dl>

    <div class="flex flex-wrap items-center gap-2 px-6 py-3 border-b border-prohealth-100">
      <USelectMenu
        v-model="slotStatus"
        :items="slotStatusItems"
        value-key="value"
        label-key="label"
        clear
        :placeholder="t('campaigns.payments.filters.slotStatus')"
        icon="i-lucide-filter"
        class="w-52"
      />
      <USelectMenu
        v-model="paymentStatus"
        :items="paymentStatusItems"
        value-key="value"
        label-key="label"
        clear
        :placeholder="t('campaigns.payments.filters.paymentStatus')"
        icon="i-lucide-filter"
        class="w-52"
      />
    </div>

    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-prohealth-50/60">
          <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
            <th class="px-6 py-3 font-semibold">{{ t('campaigns.payments.columns.member') }}</th>
            <th class="px-6 py-3 font-semibold">{{ t('campaigns.payments.columns.payment') }}</th>
            <th class="px-6 py-3 font-semibold">{{ t('campaigns.payments.columns.amount') }}</th>
            <th class="px-6 py-3 font-semibold">{{ t('campaigns.payments.columns.paymentStatus') }}</th>
            <th class="px-6 py-3 font-semibold">{{ t('campaigns.payments.columns.slot') }}</th>
            <th class="px-6 py-3 font-semibold">{{ t('campaigns.payments.columns.deadline') }}</th>
            <th class="px-6 py-3 font-semibold">{{ t('campaigns.payments.columns.lastReminded') }}</th>
            <th class="px-6 py-3 font-semibold text-right">{{ t('common.actions') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-prohealth-100">
          <TableSkeleton v-if="loading" :rows="3" :cols="8" />
          <tr v-else-if="rows.length === 0">
            <td colspan="8" class="px-6 py-10 text-center text-prohealth-500">{{ t('campaigns.payments.empty') }}</td>
          </tr>
          <tr v-for="r in rows" v-else :key="r.slotUuid" class="hover:bg-prohealth-50/50 align-top">
            <td class="px-6 py-3">
              <CommonEntityLinkCell :to="r.member_Uuid ? `/dashboard/members/${r.member_Uuid}` : null" :label="r.member_Display" :can="canViewMember" />
              <p v-if="r.membership_Display" class="text-xs text-prohealth-500">{{ r.membership_Display }}</p>
              <p class="text-xs text-prohealth-500">{{ r.promotion_Display }}</p>
              <p v-if="r.advisor_Display" class="text-xs text-prohealth-500">
                {{ t('campaigns.slots.advisor') }}:
                <CommonEntityLinkCell :to="r.advisor_Uuid ? `/dashboard/advisors/${r.advisor_Uuid}` : null" :label="r.advisor_Display" :can="canViewAdvisor" />
              </p>
            </td>
            <td class="px-6 py-3">
              <template v-if="r.payment_Uuid">
                <CommonEntityLinkCell :to="`/dashboard/collections/${r.payment_Uuid}`" :label="r.payment_Display ?? r.paymentReference" :can="canViewPayment" />
                <p v-if="r.paymentReference" class="text-xs text-prohealth-500 font-mono">{{ r.paymentReference }}</p>
                <p class="text-xs text-prohealth-500">{{ dateLabel(r.paymentDate, r.paymentDate_Display, 'short') }}</p>
              </template>
              <span v-else class="text-prohealth-400">{{ t('campaigns.payments.noPayment') }}</span>
            </td>
            <td class="px-6 py-3 text-prohealth-700 whitespace-nowrap">
              <CurrencyConverterDisplay v-if="r.payment_Uuid" :amount="r.amount" :currency="r.amountCurrency_Code" :date="r.paymentDate" v-slot="{ result }">
                <span class="inline-flex items-center gap-1">
                  {{ amountLabel(r) }}
                  <CurrencyConverterTrigger :result="result" />
                </span>
              </CurrencyConverterDisplay>
              <span v-else class="text-prohealth-400">{{ t('common.empty') }}</span>
            </td>
            <td class="px-6 py-3">
              <UBadge v-if="r.paymentStatus" :color="paymentStatusColor(r.paymentStatus)" variant="subtle" size="sm">
                {{ r.paymentStatus_Display ?? t(`payments.status.${r.paymentStatus}`, r.paymentStatus) }}
              </UBadge>
              <span v-else class="text-prohealth-400">{{ t('common.empty') }}</span>
            </td>
            <td class="px-6 py-3 space-y-1">
              <UBadge :color="REDEMPTION_STATUS_COLORS[r.redemptionStatus] ?? 'neutral'" variant="subtle" size="sm">
                {{ r.redemptionStatus_Display ?? t(`promotions.redemptionStatus.${r.redemptionStatus}`) }}
              </UBadge>
              <UBadge v-if="r.deadlineFrozen" color="info" variant="outline" size="sm" icon="i-lucide-snowflake" class="block w-fit">
                {{ t('campaigns.slots.frozen') }}
              </UBadge>
              <UBadge v-if="r.confirmsOnApproval" color="primary" variant="outline" size="sm" icon="i-lucide-badge-check" class="block w-fit">
                {{ t('campaigns.payments.confirmsOnApproval') }}
              </UBadge>
            </td>
            <td class="px-6 py-3 text-prohealth-600 whitespace-nowrap">
              <template v-if="r.redemptionStatus === 'PENDING'">
                <span v-if="r.deadlineFrozen" class="text-sky-700">{{ t('campaigns.slots.frozenShort') }}</span>
                <span v-else>{{ r.effectiveDeadline ? dateLabel(r.effectiveDeadline, r.effectiveDeadline_Display) : t('campaigns.slots.noDeadline') }}</span>
              </template>
              <span v-else>{{ t('common.empty') }}</span>
            </td>
            <td class="px-6 py-3 text-prohealth-600 whitespace-nowrap">{{ dateLabel(r.lastRemindedAt, r.lastRemindedAt_Display) }}</td>
            <td class="px-6 py-3">
              <div class="flex items-center justify-end gap-1">
                <UTooltip v-if="canRemindRow(r)" :text="t('campaigns.payments.remind')">
                  <UButton color="primary" variant="ghost" icon="i-lucide-bell" size="sm" @click="openRemind(r)" />
                </UTooltip>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="flex items-center flex-wrap justify-between gap-3 px-6 py-3 border-t border-prohealth-100 shrink-0">
      <p class="text-xs text-prohealth-500">{{ t('campaigns.paginationSummary', { shown: rows.length, total }) }}</p>
      <div class="flex items-center gap-3">
        <UPagination v-if="size !== UNPAGED_PAGE_SIZE" v-model:page="page" :total="total" :items-per-page="size" />
        <USelectMenu clear v-model="size" :items="pageSizeItems" label-key="label" value-key="value" icon="i-lucide-list" class="w-40" :reset-model-value-on-clear="false" @clear="size = DEFAULT_PAGE_SIZE" />
      </div>
    </div>

    <UModal v-model:open="remindOpen" :title="remindTarget ? t('campaigns.payments.remindTitle') : t('campaigns.payments.remindAllTitle')">
      <template #body>
        <div class="space-y-4">
          <div v-if="remindTarget" class="rounded-xl border border-prohealth-100 bg-prohealth-50/40 p-4 text-sm space-y-1">
            <p class="font-medium text-prohealth-900">{{ remindTarget.member_Display }}</p>
            <p class="text-prohealth-600">{{ remindTarget.payment_Display ?? remindTarget.paymentReference }} · {{ amountLabel(remindTarget) }}</p>
          </div>
          <p class="text-sm text-prohealth-700">
            {{ remindTarget ? t('campaigns.payments.remindNotice') : t('campaigns.payments.remindAllNotice', { n: totals?.pendingInReview ?? 0 }) }}
          </p>
          <UFormField :label="t('campaigns.payments.remindNote')" :help="t('campaigns.payments.remindNoteHelp')">
            <UTextarea v-model="remindNote" :rows="3" :maxlength="500" class="w-full" />
          </UFormField>
          <div class="flex items-center justify-end gap-3 pt-1">
            <UButton color="neutral" variant="ghost" :disabled="reminding" @click="remindOpen = false">{{ t('common.cancel') }}</UButton>
            <UButton color="primary" icon="i-lucide-send" :loading="reminding" @click="submitRemind">
              {{ t('campaigns.payments.send') }}
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
