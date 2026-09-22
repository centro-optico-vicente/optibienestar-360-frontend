<script setup lang="ts">
import type { CommissionApprovalGroupDto } from '~/types/promoters'
import { defaultThisMonthRange, type DateTimeRange } from '~/utils/date'

definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'COMMISSION_APPROVE',
})

const { t } = useI18n()
useSeoMeta({ title: () => t('common.seoTitle', { page: t('commissions.approval.title') }) })

const commissionApproval = useCommissionApproval()
const toast = useToast()

// ---- Period + load ----
const periodRange = ref<DateTimeRange>(defaultThisMonthRange())
const groups = ref<CommissionApprovalGroupDto[]>([])
const loading = ref(false)
const loaded = ref(false)

const periodValid = computed(() => !!periodRange.value.from && !!periodRange.value.to)

async function load() {
  if (!periodValid.value) return
  loading.value = true
  try {
    const periodStart = periodRange.value.from!.slice(0, 10)
    const periodEnd = periodRange.value.to!.slice(0, 10)
    groups.value = await commissionApproval.approvalQueue(periodStart, periodEnd)
    // Preselect every editable (PENDING) row per the backend's own `checked` flag —
    // locked rows never enter this set, only their own read-only state renders them.
    selected.value = new Set(
      groups.value.flatMap(g => g.rows.filter(r => !r.locked && r.checked).map(r => r.uuid)),
    )
    loaded.value = true
  }
  catch {
    groups.value = []
  }
  finally {
    loading.value = false
  }
}

onMounted(load)

// ---- Selection (uuids of editable rows currently checked, across all groups) ----
const selected = ref<Set<string>>(new Set())
const selectedCount = computed(() => selected.value.size)

function toggleRow(uuid: string, checked: boolean) {
  const next = new Set(selected.value)
  if (checked) next.add(uuid)
  else next.delete(uuid)
  selected.value = next
}

function toggleGroup(group: CommissionApprovalGroupDto, checked: boolean) {
  const editableIds = group.rows.filter(r => !r.locked).map(r => r.uuid)
  const next = new Set(selected.value)
  for (const id of editableIds) {
    if (checked) next.add(id)
    else next.delete(id)
  }
  selected.value = next
}

// ---- Approve ----
const approving = ref(false)
async function onApprove() {
  if (selected.value.size === 0) return
  approving.value = true
  try {
    const res = await commissionApproval.approve([...selected.value])
    toast.add({
      title: t('commissions.approval.approvedToast', { count: res.commissionUuids.length }),
      color: 'success',
      icon: 'i-lucide-check-circle',
    })
    await load()
  }
  catch {
    // useApi ya notificó el error
  }
  finally {
    approving.value = false
  }
}

// ---- Reject ----
const rejectOpen = ref(false)
const rejecting = ref(false)
async function onReject(reason: string) {
  if (selected.value.size === 0) return
  rejecting.value = true
  try {
    const res = await commissionApproval.reject([...selected.value], reason)
    toast.add({
      title: t('commissions.approval.rejectedToast', {
        count: res.commissionUuids.length,
        overrides: res.cascadedOverridesVoided,
      }),
      color: 'warning',
      icon: 'i-lucide-circle-x',
    })
    rejectOpen.value = false
    await load()
  }
  catch {
    // useApi ya notificó el error
  }
  finally {
    rejecting.value = false
  }
}
</script>

<template>
  <div class="space-y-5">
    <div>
      <h1 class="text-2xl font-extrabold text-prohealth-900 flex items-center gap-2">
        <UIcon name="i-lucide-badge-check" class="w-6 h-6 text-prohealth-600" />
        {{ t('commissions.approval.title') }}
      </h1>
      <p class="text-sm text-prohealth-700/70 mt-1">{{ t('commissions.approval.subtitle') }}</p>
    </div>

    <!-- Period picker -->
    <div class="bg-white rounded-2xl border border-prohealth-100 p-4 flex flex-wrap items-end gap-3">
      <UFormField :label="t('commissions.approval.fields.period')">
        <AuditDateRangePicker v-model="periodRange" />
      </UFormField>
      <UButton color="primary" variant="outline" icon="i-lucide-search" :disabled="!periodValid" :loading="loading" @click="load">
        {{ t('commissions.approval.loadButton') }}
      </UButton>
    </div>

    <template v-if="loaded">
      <!-- Empty state -->
      <div v-if="groups.length === 0" class="bg-white rounded-2xl border border-prohealth-100 p-10 text-center">
        <UIcon name="i-lucide-inbox" class="w-8 h-8 mx-auto mb-2 text-prohealth-300" />
        <p class="text-prohealth-700">{{ t('commissions.approval.empty') }}</p>
      </div>

      <template v-else>
        <!-- Bulk actions toolbar -->
        <div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-prohealth-100 bg-prohealth-50/40 px-4 py-3">
          <span class="text-sm text-prohealth-700">
            {{ t('commissions.approval.selectedCount', { count: selectedCount }) }}
          </span>
          <div class="flex items-center gap-2">
            <UButton
              color="error"
              variant="outline"
              icon="i-lucide-x"
              :disabled="selectedCount === 0"
              @click="rejectOpen = true"
            >
              {{ t('commissions.approval.rejectButton') }}
            </UButton>
            <UButton
              color="primary"
              icon="i-lucide-check"
              :loading="approving"
              :disabled="selectedCount === 0"
              @click="onApprove"
            >
              {{ t('commissions.approval.approveButton') }}
            </UButton>
          </div>
        </div>

        <!-- Groups -->
        <div class="space-y-3">
          <CommissionApprovalGroup
            v-for="group in groups"
            :key="group.promoterUuid"
            :group="group"
            :selected="selected"
            @toggle-row="toggleRow"
            @toggle-group="(checked) => toggleGroup(group, checked)"
          />
        </div>
      </template>
    </template>

    <CommissionRejectReasonModal
      v-model:open="rejectOpen"
      :count="selectedCount"
      :submitting="rejecting"
      @confirm="onReject"
    />
  </div>
</template>
