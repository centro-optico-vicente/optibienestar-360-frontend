<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { CommissionReRatingResponse } from '~/types/promoters'

// Month-close retroactive re-rating for the commission ledger. Two-phase flow,
// same shape as CommissionPayoutModal:
//  1) Form: period range → "Previsualizar" runs a dryRun (no writes) and stores the response.
//  2) Preview: per-promoter deltas → "Confirmar" runs the real re-rate (bumps PENDING
//     INSCRIPTION commissions in range to each promoter's highest reached band).
// The parent gates COMMISSION_RE_RATE on the button that opens this modal and reloads
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
}

const state = reactive<FormState>({
  periodStart: '',
  periodEnd: '',
})

const schema = computed(() =>
  z.object({
    periodStart: z.string().min(1, t('validation.required')),
    periodEnd: z.string().min(1, t('validation.required')),
  }).refine(v => !v.periodStart || !v.periodEnd || v.periodEnd >= v.periodStart, {
    message: t('commissions.reRating.invalidRange'),
    path: ['periodEnd'],
  }),
)

// dryRun preview (null → still on the form phase).
const preview = ref<CommissionReRatingResponse | null>(null)
const previewing = ref(false)
const confirming = ref(false)

function money(v?: number | null, currency?: string | null): string {
  if (v === null || v === undefined) return t('common.empty')
  return formatCurrency(Number(v), currency || 'USD')
}

// Signed delta — a promoter can move down a band too if past data was corrected.
function delta(v?: number | null, currency?: string | null): string {
  if (v === null || v === undefined) return t('common.empty')
  const n = Number(v)
  const sign = n > 0 ? '+' : ''
  return `${sign}${formatCurrency(n, currency || 'USD')}`
}

// Reset both phases whenever the modal opens.
watch(() => props.open, (open) => {
  if (!open) return
  state.periodStart = ''
  state.periodEnd = ''
  preview.value = null
  previewing.value = false
  confirming.value = false
})

// Phase 1 → dryRun preview (no writes).
async function onPreview(_event: FormSubmitEvent<Record<string, unknown>>) {
  previewing.value = true
  try {
    preview.value = await commissions.reRate({
      periodStart: state.periodStart,
      periodEnd: state.periodEnd,
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

// Back to the form to adjust the range.
function backToForm() {
  preview.value = null
}

// Phase 2 → real re-rate (writes the recomputed pct/amount/tier on each row).
async function onConfirm() {
  confirming.value = true
  try {
    const res = await commissions.reRate({
      periodStart: state.periodStart,
      periodEnd: state.periodEnd,
      dryRun: false,
    })
    toast.add({
      title: t('commissions.reRating.successToast', {
        promoters: res.totalPromoters,
        commissions: res.commissionsUpdated,
      }),
      color: 'success',
      icon: 'i-lucide-check-circle',
    })
    emit('done')
    isOpen.value = false
  }
  catch {
    // useApi already notified the error
  }
  finally {
    confirming.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="isOpen"
    :title="t('commissions.reRating.title')"
    :description="t('commissions.reRating.description')"
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
          <span>{{ t('commissions.reRating.dryRunNote') }}</span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('commissions.reRating.fields.periodStart')" name="periodStart" required>
            <UInput v-model="state.periodStart" type="date" class="w-full" />
          </UFormField>
          <UFormField :label="t('commissions.reRating.fields.periodEnd')" name="periodEnd" required>
            <UInput v-model="state.periodEnd" type="date" class="w-full" />
          </UFormField>
        </div>

        <div class="flex items-center justify-between gap-3 pt-2">
          <p class="text-xs text-prohealth-500">{{ t('common.requiredFieldsHint') }}</p>
          <div class="flex items-center gap-3">
            <UButton color="neutral" variant="ghost" :disabled="previewing" @click="isOpen = false">
              {{ t('common.cancel') }}
            </UButton>
            <UButton type="submit" color="primary" :loading="previewing" icon="i-lucide-eye">
              {{ t('commissions.reRating.preview') }}
            </UButton>
          </div>
        </div>
      </UForm>

      <!-- Phase 2: dryRun preview -->
      <div v-else class="space-y-5">
        <h3 class="font-bold text-prohealth-900">{{ t('commissions.reRating.previewTitle') }}</h3>

        <!-- Totals -->
        <dl class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div class="rounded-xl border border-prohealth-100 bg-prohealth-50/40 p-3">
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('commissions.reRating.totals.promoters') }}</dt>
            <dd class="text-prohealth-900 text-lg font-semibold mt-0.5">{{ preview.totalPromoters }}</dd>
          </div>
          <div class="rounded-xl border border-prohealth-100 bg-prohealth-50/40 p-3">
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('commissions.reRating.totals.commissionsUpdated') }}</dt>
            <dd class="text-prohealth-900 text-lg font-semibold mt-0.5">{{ preview.commissionsUpdated }}</dd>
          </div>
          <div class="rounded-xl border border-prohealth-100 bg-prohealth-50/40 p-3">
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('commissions.reRating.totals.delta') }}</dt>
            <dd class="text-prohealth-900 text-lg font-semibold mt-0.5">{{ delta(preview.totalDeltaAmount, preview.currency) }}</dd>
          </div>
          <div class="rounded-xl border border-prohealth-100 bg-prohealth-50/40 p-3">
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('commissions.reRating.totals.executedAt') }}</dt>
            <dd class="text-prohealth-800 text-sm font-medium mt-0.5">{{ formatDate(preview.executedAt, 'datetime') }}</dd>
          </div>
        </dl>

        <!-- Per-promoter breakdown -->
        <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
                  <th class="px-4 py-2.5 font-semibold">{{ t('commissions.reRating.perPromoter.name') }}</th>
                  <th class="px-4 py-2.5 font-semibold">{{ t('commissions.reRating.perPromoter.code') }}</th>
                  <th class="px-4 py-2.5 font-semibold text-right">{{ t('commissions.reRating.perPromoter.count') }}</th>
                  <th class="px-4 py-2.5 font-semibold">{{ t('commissions.reRating.perPromoter.tier') }}</th>
                  <th class="px-4 py-2.5 font-semibold text-right">{{ t('commissions.reRating.perPromoter.changed') }}</th>
                  <th class="px-4 py-2.5 font-semibold text-right">{{ t('commissions.reRating.perPromoter.delta') }}</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-prohealth-100">
                <tr v-if="preview.perPromoter.length === 0">
                  <td colspan="6" class="px-4 py-8 text-center text-prohealth-500">
                    {{ t('commissions.reRating.emptyPreview') }}
                  </td>
                </tr>
                <tr v-for="p in preview.perPromoter" v-else :key="p.promoterUuid">
                  <td class="px-4 py-2.5 font-medium text-prohealth-900">{{ p.promoterDisplayName }}</td>
                  <td class="px-4 py-2.5 text-prohealth-500 font-mono text-xs">{{ p.promoterCode }}</td>
                  <td class="px-4 py-2.5 text-prohealth-700 text-right">{{ p.inscriptionCount }}</td>
                  <td class="px-4 py-2.5 text-prohealth-700">{{ p.targetTierName }}</td>
                  <td class="px-4 py-2.5 text-prohealth-700 text-right">{{ p.commissionsChanged }}</td>
                  <td class="px-4 py-2.5 font-semibold text-right" :class="Number(p.deltaAmount) >= 0 ? 'text-emerald-600' : 'text-red-600'">
                    {{ delta(p.deltaAmount, preview.currency) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Confirm notice -->
        <div class="rounded-xl border border-red-200 bg-red-50 p-3 flex gap-2 text-sm text-red-800">
          <UIcon name="i-lucide-alert-triangle" class="w-5 h-5 shrink-0 mt-0.5" />
          <span>{{ t('commissions.reRating.confirmDescription') }}</span>
        </div>

        <div class="flex items-center justify-end gap-3 pt-1">
          <UButton color="neutral" variant="ghost" :disabled="confirming" icon="i-lucide-arrow-left" @click="backToForm">
            {{ t('commissions.reRating.back') }}
          </UButton>
          <UButton color="primary" :loading="confirming" icon="i-lucide-check" @click="onConfirm">
            {{ t('commissions.reRating.confirm') }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
