<script setup lang="ts">
import { buildPageSizeItems, DEFAULT_PAGE_SIZE, UNPAGED_PAGE_SIZE } from '~/utils/pagination'
import type { CampaignSlotDto, CampaignSlotStatus } from '~/types/campaign'
import { CAMPAIGN_SLOT_STATUSES } from '~/types/campaign'
import { REDEMPTION_STATUS_COLORS } from '~/types/promotions'

/**
 * "Cupos" tab of the campaign detail (hub ADR 0038 point 9): every slot of the
 * campaign with its status, deadline (or "frozen" while a payment is in review)
 * and the payment that confirmed it. Staff can confirm a PENDING slot or release
 * one by hand, always with a note that goes to the audit log. Emits `changed`
 * so the parent reloads the quota counters.
 */
const props = defineProps<{ campaignUuid: string }>()
const emit = defineEmits<{ changed: [] }>()

const { t } = useI18n()
const { formatDate } = useFormatters()
const { can } = usePermissions()
const toast = useToast()
const campaignsApi = useCampaigns()

const canConfirm = computed(() => can('PROMOTION_SLOT_CONFIRM'))
const canRelease = computed(() => can('PROMOTION_SLOT_RELEASE'))
const canViewMember = computed(() => can('MEMBER_VIEW_ALL'))
const canViewPayment = computed(() => can('PAYMENT_VIEW_ALL'))
const canViewAdvisor = computed(() => can('PROMOTER_VIEW_ALL'))

const pageSizeItems = buildPageSizeItems(t)
const statusItems = computed(() => CAMPAIGN_SLOT_STATUSES.map(s => ({ label: t(`promotions.redemptionStatus.${s}`), value: s })))

const rows = ref<CampaignSlotDto[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const size = ref(DEFAULT_PAGE_SIZE)
const status = ref<CampaignSlotStatus | null>(null)

async function load() {
  loading.value = true
  try {
    const res = await campaignsApi.slots(props.campaignUuid, { status: status.value, page: page.value - 1, size: size.value })
    rows.value = res.content ?? []
    total.value = res.totalElements ?? 0
  }
  catch {
    rows.value = []
    total.value = 0
  }
  finally {
    loading.value = false
  }
}
onMounted(load)
watch([page, size], load)
watch(status, () => {
  if (page.value !== 1) page.value = 1
  else load()
})
defineExpose({ load })

function statusLabel(s: CampaignSlotDto): string {
  return s.redemptionStatus_Display ?? t(`promotions.redemptionStatus.${s.redemptionStatus}`)
}
function dateLabel(value?: string | null, display?: string | null): string {
  return value ? (display ?? formatDate(value, 'datetime')) : t('common.empty')
}

// ---- Confirm / release with a required note ----
const actionOpen = ref(false)
const action = ref<'confirm' | 'release'>('confirm')
const target = ref<CampaignSlotDto | null>(null)
const note = ref('')
const touched = ref(false)
const submitting = ref(false)
const noteError = computed(() => touched.value && !note.value.trim() ? t('campaigns.slots.noteRequired') : undefined)

function openAction(kind: 'confirm' | 'release', slot: CampaignSlotDto) {
  action.value = kind
  target.value = slot
  note.value = ''
  touched.value = false
  actionOpen.value = true
}

async function submitAction() {
  touched.value = true
  const text = note.value.trim()
  if (!target.value || !text) return
  submitting.value = true
  try {
    if (action.value === 'confirm') await campaignsApi.confirmSlot(props.campaignUuid, target.value.uuid, text)
    else await campaignsApi.releaseSlot(props.campaignUuid, target.value.uuid, text)
    toast.add({
      title: action.value === 'confirm' ? t('campaigns.slots.confirmedToast') : t('campaigns.slots.releasedToast'),
      color: 'success',
      icon: 'i-lucide-check-circle',
    })
    actionOpen.value = false
    await load()
    emit('changed')
  }
  catch { /* toast handled by useApi (422 when the slot changed meanwhile) */ }
  finally { submitting.value = false }
}
</script>

<template>
  <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden">
    <div class="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-prohealth-100">
      <div>
        <h2 class="font-bold text-prohealth-900">{{ t('campaigns.slots.title') }}</h2>
        <p class="text-xs text-prohealth-500 mt-0.5">{{ t('campaigns.slots.hint') }}</p>
      </div>
      <div class="flex items-center gap-2">
        <USelectMenu
          v-model="status"
          :items="statusItems"
          value-key="value"
          label-key="label"
          clear
          :placeholder="t('campaigns.slots.allStatuses')"
          icon="i-lucide-filter"
          class="w-48"
        />
        <RefreshButton :loading="loading" :title="t('common.refreshSection')" @refresh="load" />
      </div>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-prohealth-50/60">
          <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
            <th class="px-6 py-3 font-semibold">{{ t('campaigns.slots.columns.member') }}</th>
            <th class="px-6 py-3 font-semibold">{{ t('campaigns.slots.columns.promotion') }}</th>
            <th class="px-6 py-3 font-semibold">{{ t('campaigns.slots.columns.status') }}</th>
            <th class="px-6 py-3 font-semibold">{{ t('campaigns.slots.columns.deadline') }}</th>
            <th class="px-6 py-3 font-semibold">{{ t('campaigns.slots.columns.payment') }}</th>
            <th class="px-6 py-3 font-semibold">{{ t('campaigns.slots.columns.note') }}</th>
            <th class="px-6 py-3 font-semibold text-right">{{ t('common.actions') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-prohealth-100">
          <TableSkeleton v-if="loading" :rows="3" :cols="7" />
          <tr v-else-if="rows.length === 0">
            <td colspan="7" class="px-6 py-10 text-center text-prohealth-500">{{ t('campaigns.slots.empty') }}</td>
          </tr>
          <tr v-for="s in rows" v-else :key="s.uuid" class="hover:bg-prohealth-50/50 align-top">
            <td class="px-6 py-3">
              <CommonEntityLinkCell :to="s.member_Uuid ? `/dashboard/members/${s.member_Uuid}` : null" :label="s.member_Display" :can="canViewMember" />
              <p v-if="s.membership_Display" class="text-xs text-prohealth-500">{{ s.membership_Display }}</p>
              <p v-if="s.advisor_Display" class="text-xs text-prohealth-500">
                {{ t('campaigns.slots.advisor') }}:
                <CommonEntityLinkCell :to="s.advisor_Uuid ? `/dashboard/advisors/${s.advisor_Uuid}` : null" :label="s.advisor_Display" :can="canViewAdvisor" />
              </p>
            </td>
            <td class="px-6 py-3 text-prohealth-700">
              {{ s.promotion_Display ?? t('common.empty') }}
              <p v-if="s.benefitKind" class="text-xs text-prohealth-500">{{ s.benefitKind_Display ?? t(`promotions.benefitKind.${s.benefitKind}`) }}</p>
            </td>
            <td class="px-6 py-3 space-y-1">
              <UBadge :color="REDEMPTION_STATUS_COLORS[s.redemptionStatus] ?? 'neutral'" variant="subtle" size="sm">{{ statusLabel(s) }}</UBadge>
              <UBadge v-if="s.deadlineFrozen" color="info" variant="outline" size="sm" icon="i-lucide-snowflake" class="block w-fit">
                {{ t('campaigns.slots.frozen') }}
              </UBadge>
              <p v-if="s.quotaTrigger" class="text-xs text-prohealth-500">
                {{ t('campaigns.slots.confirmsWhen', { trigger: s.quotaTrigger_Display ?? t(`campaigns.quotaTrigger.${s.quotaTrigger}`) }) }}
              </p>
            </td>
            <td class="px-6 py-3 text-prohealth-600 whitespace-nowrap">
              <template v-if="s.redemptionStatus === 'PENDING'">
                <span v-if="s.deadlineFrozen" class="text-sky-700">{{ t('campaigns.slots.frozenShort') }}</span>
                <span v-else>{{ s.effectiveDeadline ? dateLabel(s.effectiveDeadline, s.effectiveDeadline_Display) : t('campaigns.slots.noDeadline') }}</span>
              </template>
              <span v-else-if="s.confirmedAt">{{ t('campaigns.slots.confirmedOn', { date: dateLabel(s.confirmedAt, s.confirmedAt_Display) }) }}</span>
              <span v-else>{{ t('common.empty') }}</span>
              <p class="text-xs text-prohealth-400">{{ t('campaigns.slots.reservedOn', { date: dateLabel(s.reservedAt, s.reservedAt_Display) }) }}</p>
            </td>
            <td class="px-6 py-3">
              <CommonEntityLinkCell
                v-if="s.confirmedByPayment_Uuid"
                :to="`/dashboard/collections/${s.confirmedByPayment_Uuid}`"
                :label="s.confirmedByPayment_Display"
                :can="canViewPayment"
              />
              <span v-else class="text-prohealth-400">{{ t('common.empty') }}</span>
            </td>
            <td class="px-6 py-3 text-prohealth-600 max-w-64">
              <template v-if="s.manualNote">
                <p class="whitespace-pre-line">{{ s.manualNote }}</p>
                <p v-if="s.manualBy_Display" class="text-xs text-prohealth-400">{{ s.manualBy_Display }}</p>
              </template>
              <span v-else class="text-prohealth-400">{{ t('common.empty') }}</span>
            </td>
            <td class="px-6 py-3">
              <div class="flex items-center justify-end gap-1">
                <UTooltip v-if="canConfirm && s.redemptionStatus === 'PENDING'" :text="t('campaigns.slots.confirm')">
                  <UButton color="success" variant="ghost" icon="i-lucide-check" size="sm" @click="openAction('confirm', s)" />
                </UTooltip>
                <UTooltip v-if="canRelease && (s.redemptionStatus === 'PENDING' || s.redemptionStatus === 'CONFIRMED')" :text="t('campaigns.slots.release')">
                  <UButton color="error" variant="ghost" icon="i-lucide-unlock" size="sm" @click="openAction('release', s)" />
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

    <UModal v-model:open="actionOpen" :title="action === 'confirm' ? t('campaigns.slots.confirmTitle') : t('campaigns.slots.releaseTitle')">
      <template #body>
        <div class="space-y-4">
          <div v-if="target" class="rounded-xl border border-prohealth-100 bg-prohealth-50/40 p-4 text-sm space-y-1">
            <p class="font-medium text-prohealth-900">{{ target.member_Display }}</p>
            <p class="text-prohealth-600">{{ target.promotion_Display }} · {{ statusLabel(target) }}</p>
          </div>
          <p class="text-sm text-prohealth-700">
            {{ action === 'confirm' ? t('campaigns.slots.confirmNotice') : t('campaigns.slots.releaseNotice') }}
          </p>
          <UFormField :label="t('campaigns.slots.note')" required :error="noteError">
            <UTextarea v-model="note" :rows="3" :maxlength="500" :placeholder="t('campaigns.slots.notePlaceholder')" class="w-full" @blur="touched = true" />
          </UFormField>
          <div class="flex items-center justify-end gap-3 pt-1">
            <UButton color="neutral" variant="ghost" :disabled="submitting" @click="actionOpen = false">{{ t('common.cancel') }}</UButton>
            <UButton
              :color="action === 'confirm' ? 'success' : 'error'"
              :icon="action === 'confirm' ? 'i-lucide-check' : 'i-lucide-unlock'"
              :loading="submitting"
              @click="submitAction"
            >
              {{ action === 'confirm' ? t('campaigns.slots.confirm') : t('campaigns.slots.release') }}
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
