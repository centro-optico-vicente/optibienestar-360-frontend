<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { CommissionPayoutResponse } from '~/types/promoters'

// Period payout for the commission ledger. Two-phase flow:
//  1) Form: period range + reference → "Previsualizar" runs a dryRun (no writes,
//     no emails) and stores the response.
//  2) Preview: totals + per-promoter breakdown → "Confirmar" runs the real payout
//     (marks the PENDING commissions in range as PAID and emails each promoter).
// The parent gates COMMISSION_PAYOUT on the button that opens this modal and reloads
// the list on `done`.
const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'done': []
}>()

const { t } = useI18n()
const { formatCurrency, formatDate } = useFormatters()
const commissions = useCommissions()
const toast = useToast()

const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})

interface FormState {
  periodStart: string
  periodEnd: string
  payoutReference: string
}

const state = reactive<FormState>({
  periodStart: '',
  periodEnd: '',
  payoutReference: '',
})

// Locale-reactive schema; the range guard surfaces on periodEnd.
const schema = computed(() =>
  z.object({
    periodStart: z.string().min(1, t('validation.required')),
    periodEnd: z.string().min(1, t('validation.required')),
    payoutReference: z.string().min(1, t('validation.required')).max(120, t('validation.maxChars', { n: 120 })),
  }).refine(v => !v.periodStart || !v.periodEnd || v.periodEnd >= v.periodStart, {
    message: t('commissions.payout.invalidRange'),
    path: ['periodEnd'],
  }),
)

// dryRun preview (null → still on the form phase).
const preview = ref<CommissionPayoutResponse | null>(null)
const previewing = ref(false)
const confirming = ref(false)

function money(v?: number | null, currency?: string | null): string {
  if (v === null || v === undefined) return t('common.empty')
  return formatCurrency(Number(v), currency || 'USD')
}

// Reset both phases whenever the modal opens.
watch(() => props.open, (open) => {
  if (!open) return
  state.periodStart = ''
  state.periodEnd = ''
  state.payoutReference = ''
  preview.value = null
  previewing.value = false
  confirming.value = false
})

// Phase 1 → dryRun preview (no writes, no emails).
async function onPreview(_event: FormSubmitEvent<Record<string, unknown>>) {
  previewing.value = true
  try {
    preview.value = await commissions.payout({
      periodStart: state.periodStart,
      periodEnd: state.periodEnd,
      payoutReference: state.payoutReference.trim(),
      dryRun: true,
    })
  }
  catch {
    // useApi already notified the error
  }
  finally {
    previewing.value = false
  }
}

// Back to the form to adjust the range/reference.
function backToForm() {
  preview.value = null
}

// Phase 2 → real payout (marks PAID + emails each promoter).
async function onConfirm() {
  confirming.value = true
  try {
    const res = await commissions.payout({
      periodStart: state.periodStart,
      periodEnd: state.periodEnd,
      payoutReference: state.payoutReference.trim(),
      dryRun: false,
    })
    toast.add({
      title: t('commissions.payout.successToast', {
        promoters: res.totalPromoters,
        commissions: res.totalCommissions,
        amount: formatCurrency(Number(res.totalAmount), res.currency || 'USD'),
      }),
      color: 'success',
      icon: 'i-lucide-check-circle',
    })
    emit('done')
    isOpen.value = false
  }
  catch {
    // useApi already notified the error (422 if the range is already settled, etc.)
  }
  finally {
    confirming.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="isOpen"
    :title="t('commissions.payout.title')"
    :description="t('commissions.payout.description')"
    :ui="{ content: 'max-w-3xl' }"
  >
    <template #body>
      <!-- Phase 1: period form -->
      <UForm
        v-if="!preview"
        :schema="schema"
        :state="state"
        class="space-y-4"
        @submit="onPreview"
      >
        <div class="rounded-xl border border-amber-200 bg-amber-50 p-3 flex gap-2 text-sm text-amber-800">
          <UIcon name="i-lucide-info" class="w-5 h-5 shrink-0 mt-0.5" />
          <span>{{ t('commissions.payout.dryRunNote') }}</span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('commissions.payout.fields.periodStart')" name="periodStart" required>
            <UInput v-model="state.periodStart" type="date" class="w-full" />
          </UFormField>
          <UFormField :label="t('commissions.payout.fields.periodEnd')" name="periodEnd" required>
            <UInput v-model="state.periodEnd" type="date" class="w-full" />
          </UFormField>
        </div>

        <UFormField :label="t('commissions.payout.fields.payoutReference')" name="payoutReference" required>
          <UInput
            v-model="state.payoutReference"
            :placeholder="t('commissions.payout.referencePlaceholder')"
            :maxlength="120"
            class="w-full"
          />
        </UFormField>

        <div class="flex items-center justify-end gap-3 pt-2">
          <UButton color="neutral" variant="ghost" :disabled="previewing" @click="isOpen = false">
            {{ t('common.cancel') }}
          </UButton>
          <UButton type="submit" color="primary" :loading="previewing" icon="i-lucide-eye">
            {{ t('commissions.payout.preview') }}
          </UButton>
        </div>
      </UForm>

      <!-- Phase 2: dryRun preview -->
      <div v-else class="space-y-5">
        <h3 class="font-bold text-prohealth-900">{{ t('commissions.payout.previewTitle') }}</h3>

        <!-- Totals -->
        <dl class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div class="rounded-xl border border-prohealth-100 bg-prohealth-50/40 p-3">
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('commissions.payout.totals.promoters') }}</dt>
            <dd class="text-prohealth-900 text-lg font-semibold mt-0.5">{{ preview.totalPromoters }}</dd>
          </div>
          <div class="rounded-xl border border-prohealth-100 bg-prohealth-50/40 p-3">
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('commissions.payout.totals.commissions') }}</dt>
            <dd class="text-prohealth-900 text-lg font-semibold mt-0.5">{{ preview.totalCommissions }}</dd>
          </div>
          <div class="rounded-xl border border-prohealth-100 bg-prohealth-50/40 p-3">
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('commissions.payout.totals.amount') }}</dt>
            <dd class="text-prohealth-900 text-lg font-semibold mt-0.5">{{ money(preview.totalAmount, preview.currency) }}</dd>
          </div>
          <div class="rounded-xl border border-prohealth-100 bg-prohealth-50/40 p-3">
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('commissions.payout.totals.executedAt') }}</dt>
            <dd class="text-prohealth-800 text-sm font-medium mt-0.5">{{ formatDate(preview.executedAt, 'datetime') }}</dd>
          </div>
        </dl>

        <!-- Per-promoter breakdown -->
        <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
                  <th class="px-4 py-2.5 font-semibold">{{ t('commissions.payout.perPromoter.name') }}</th>
                  <th class="px-4 py-2.5 font-semibold">{{ t('commissions.payout.perPromoter.code') }}</th>
                  <th class="px-4 py-2.5 font-semibold text-right">{{ t('commissions.payout.perPromoter.count') }}</th>
                  <th class="px-4 py-2.5 font-semibold text-right">{{ t('commissions.payout.perPromoter.amount') }}</th>
                  <th class="px-4 py-2.5 font-semibold">{{ t('commissions.payout.perPromoter.email') }}</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-prohealth-100">
                <tr v-if="preview.perPromoter.length === 0">
                  <td colspan="5" class="px-4 py-8 text-center text-prohealth-500">
                    {{ t('commissions.payout.emptyPreview') }}
                  </td>
                </tr>
                <tr v-for="p in preview.perPromoter" v-else :key="p.promoterUuid">
                  <td class="px-4 py-2.5 font-medium text-prohealth-900">{{ p.promoterDisplayName }}</td>
                  <td class="px-4 py-2.5 text-prohealth-500 font-mono text-xs">{{ p.promoterCode }}</td>
                  <td class="px-4 py-2.5 text-prohealth-700 text-right">{{ p.commissionCount }}</td>
                  <td class="px-4 py-2.5 text-prohealth-900 font-semibold text-right">{{ money(p.totalAmount, p.currency) }}</td>
                  <td class="px-4 py-2.5">
                    <UBadge :color="p.emailDispatched ? 'success' : 'neutral'" variant="subtle" size="sm">
                      {{ p.emailDispatched ? t('common.yes') : t('common.no') }}
                    </UBadge>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Confirm notice -->
        <div class="rounded-xl border border-red-200 bg-red-50 p-3 flex gap-2 text-sm text-red-800">
          <UIcon name="i-lucide-alert-triangle" class="w-5 h-5 shrink-0 mt-0.5" />
          <span>{{ t('commissions.payout.confirmDescription') }}</span>
        </div>

        <div class="flex items-center justify-end gap-3 pt-1">
          <UButton color="neutral" variant="ghost" :disabled="confirming" icon="i-lucide-arrow-left" @click="backToForm">
            {{ t('commissions.payout.back') }}
          </UButton>
          <UButton color="primary" :loading="confirming" icon="i-lucide-check" @click="onConfirm">
            {{ t('commissions.payout.confirm') }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
