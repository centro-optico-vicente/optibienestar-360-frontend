<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { CatalogItem } from '~/types/catalogs'
import type { CommissionApprovalRowDto, CommissionPayoutResponse } from '~/types/promoters'

// Ad-hoc payout for a hand-picked set of APPROVED commission rows (E.2) —
// same two-phase flow as CommissionPayoutModal (period-based payout), but
// sourced from `commissionUuids` instead of a date range:
//  1) Form: payment method + currency + reference → "Previsualizar" runs a
//     dryRun (no writes, no emails) and stores the response.
//  2) Preview: totals + per-promoter breakdown → "Confirmar" runs the real
//     payout (marks the selected commissions as PAID and emails each promoter).
// The parent (approval.vue) gates COMMISSION_APPROVE on which rows are
// selectable and reloads the approval queue on `success`.
const props = defineProps<{
  open: boolean
  commissionUuids: string[]
  rows?: CommissionApprovalRowDto[]
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'success': []
}>()

const { t } = useI18n()
const { formatCurrency, formatDate } = useFormatters()
const commissions = useCommissions()
const methodsApi = useCatalog('/v1/admin/payment-methods')
const currenciesApi = useCatalog('/v1/admin/currencies')
const toast = useToast()
const { can } = usePermissions()
const canViewPromoter = computed(() => can('PROMOTER_VIEW_ALL'))

const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})

interface FormState {
  paymentMethodUuid: string
  currencyUuid: string
  payoutReference: string
}

const state = reactive<FormState>({
  paymentMethodUuid: '',
  currencyUuid: '',
  payoutReference: '',
})

const schema = computed(() =>
  z.object({
    paymentMethodUuid: z.string({ message: t('validation.required') }).min(1, t('validation.required')),
    currencyUuid: z.string({ message: t('validation.required') }).min(1, t('validation.required')),
    payoutReference: z.string().max(120, t('validation.maxChars', { n: 120 })).optional(),
  }),
)

// Method/currency catalogs, same pattern as PaymentFormModal — `listAll()`
// resolves every active record for the select, value keyed by `uuid` (ADR
// 0014 `_Uuid` FK convention, matching the backend's `paymentMethodUuid`/
// `currencyUuid` fields).
const methodOptions = ref<{ label: string, value: string }[]>([])
const currencyOptions = ref<{ label: string, value: string }[]>([])
const loadingCatalogs = ref(false)

async function loadCatalogs() {
  loadingCatalogs.value = true
  try {
    const [methods, currencies] = await Promise.all([methodsApi.listAll(), currenciesApi.listAll()])
    methodOptions.value = methods
      .filter((m: CatalogItem) => m.active)
      .map((m: CatalogItem) => ({ label: m.name, value: m.uuid }))
    currencyOptions.value = currencies
      .filter((c: CatalogItem) => c.active)
      .map((c: CatalogItem) => ({ label: c.symbol ? `${c.code} (${c.symbol})` : (c.code ?? c.name), value: c.uuid }))
  }
  catch {
    methodOptions.value = []
    currencyOptions.value = []
  }
  finally {
    loadingCatalogs.value = false
  }
}

const preview = ref<CommissionPayoutResponse | null>(null)
const previewing = ref(false)
const confirming = ref(false)
const formRef = ref<{ submit: () => Promise<void> } | null>(null)

function money(v?: number | null, currency?: string | null): string {
  if (v === null || v === undefined) return t('common.empty')
  return formatCurrency(Number(v), currency || 'USD')
}

// Local, FE-only summary of the raw selection — shown as a hint before/while
// the dry-run preview loads; the backend's per-promoter breakdown replaces
// it once available.
const selectionCount = computed(() => props.commissionUuids.length)

watch(() => props.open, (open) => {
  if (!open) return
  state.paymentMethodUuid = ''
  state.currencyUuid = ''
  state.payoutReference = ''
  preview.value = null
  previewing.value = false
  confirming.value = false
  void loadCatalogs()
})

async function onPreview(_event: FormSubmitEvent<Record<string, unknown>>) {
  previewing.value = true
  try {
    preview.value = await commissions.payoutBySelection({
      commissionUuids: props.commissionUuids,
      paymentMethodUuid: state.paymentMethodUuid,
      currencyUuid: state.currencyUuid,
      payoutReference: state.payoutReference.trim() || undefined,
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

function backToForm() {
  preview.value = null
}

async function onConfirm() {
  confirming.value = true
  try {
    const res = await commissions.payoutBySelection({
      commissionUuids: props.commissionUuids,
      paymentMethodUuid: state.paymentMethodUuid,
      currencyUuid: state.currencyUuid,
      payoutReference: state.payoutReference.trim() || undefined,
      dryRun: false,
    })
    toast.add({
      title: t('commissions.payoutBySelection.successToast', {
        promoters: res.totalPromoters,
        commissions: res.totalCommissions,
        amount: formatCurrency(Number(res.totalAmount), res.currency || 'USD'),
      }),
      color: 'success',
      icon: 'i-lucide-check-circle',
    })
    emit('success')
    isOpen.value = false
  }
  catch {
    // useApi already notified the error (400 if a row isn't APPROVED anymore, etc.)
  }
  finally {
    confirming.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="isOpen"
    :title="t('commissions.payoutBySelection.title')"
    :description="t('commissions.payoutBySelection.description')"
    :ui="{ content: 'max-w-3xl' }"
  >
    <template #body>
      <!-- Phase 1: method + currency + reference form -->
      <UForm
        v-if="!preview"
        ref="formRef"
        :schema="schema"
        :state="state"
        class="space-y-4"
        @submit="onPreview"
      >
        <div class="rounded-xl border border-amber-200 bg-amber-50 p-3 flex gap-2 text-sm text-amber-800">
          <UIcon name="i-lucide-info" class="w-5 h-5 shrink-0 mt-0.5" />
          <span>{{ t('commissions.payoutBySelection.dryRunNote') }}</span>
        </div>

        <p class="text-sm text-prohealth-700">
          {{ t('commissions.payoutBySelection.selectionSummary', { count: selectionCount }) }}
        </p>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('commissions.payoutBySelection.fields.method')" name="paymentMethodUuid" required>
            <USelectMenu
              clear
              v-model="state.paymentMethodUuid"
              :items="methodOptions"
              label-key="label"
              value-key="value"
              :loading="loadingCatalogs"
              :placeholder="t('common.select')"
              class="w-full"
            />
          </UFormField>
          <UFormField :label="t('commissions.payoutBySelection.fields.currency')" name="currencyUuid" required>
            <USelectMenu
              clear
              v-model="state.currencyUuid"
              :items="currencyOptions"
              label-key="label"
              value-key="value"
              :loading="loadingCatalogs"
              :placeholder="t('common.select')"
              class="w-full"
            />
          </UFormField>
        </div>

        <UFormField :label="t('commissions.payoutBySelection.fields.payoutReference')" name="payoutReference">
          <UInput
            v-model="state.payoutReference"
            :placeholder="t('commissions.payoutBySelection.referencePlaceholder')"
            :maxlength="120"
            class="w-full"
          />
        </UFormField>
      </UForm>

      <!-- Phase 2: dryRun preview -->
      <div v-else class="space-y-5">
        <h3 class="font-bold text-prohealth-900">{{ t('commissions.payoutBySelection.previewTitle') }}</h3>

        <dl class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div class="rounded-xl border border-prohealth-100 bg-prohealth-50/40 p-3">
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('commissions.payoutBySelection.totals.promoters') }}</dt>
            <dd class="text-prohealth-900 text-lg font-semibold mt-0.5">{{ preview.totalPromoters }}</dd>
          </div>
          <div class="rounded-xl border border-prohealth-100 bg-prohealth-50/40 p-3">
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('commissions.payoutBySelection.totals.commissions') }}</dt>
            <dd class="text-prohealth-900 text-lg font-semibold mt-0.5">{{ preview.totalCommissions }}</dd>
          </div>
          <div class="rounded-xl border border-prohealth-100 bg-prohealth-50/40 p-3">
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('commissions.payoutBySelection.totals.amount') }}</dt>
            <dd class="text-prohealth-900 text-lg font-semibold mt-0.5">{{ money(preview.totalAmount, preview.currency) }}</dd>
          </div>
          <div class="rounded-xl border border-prohealth-100 bg-prohealth-50/40 p-3">
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('commissions.payoutBySelection.totals.executedAt') }}</dt>
            <dd class="text-prohealth-800 text-sm font-medium mt-0.5">{{ formatDate(preview.executedAt, 'datetime') }}</dd>
          </div>
        </dl>

        <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
                  <th class="px-4 py-2.5 font-semibold">{{ t('commissions.payoutBySelection.perPromoter.name') }}</th>
                  <th class="px-4 py-2.5 font-semibold">{{ t('commissions.payoutBySelection.perPromoter.code') }}</th>
                  <th class="px-4 py-2.5 font-semibold text-right">{{ t('commissions.payoutBySelection.perPromoter.count') }}</th>
                  <th class="px-4 py-2.5 font-semibold text-right">{{ t('commissions.payoutBySelection.perPromoter.amount') }}</th>
                  <th class="px-4 py-2.5 font-semibold">{{ t('commissions.payoutBySelection.perPromoter.email') }}</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-prohealth-100">
                <tr v-if="preview.perPromoter.length === 0">
                  <td colspan="5" class="px-4 py-8 text-center text-prohealth-500">
                    {{ t('commissions.payoutBySelection.emptyPreview') }}
                  </td>
                </tr>
                <tr v-for="p in preview.perPromoter" v-else :key="p.promoterUuid">
                  <td class="px-4 py-2.5 font-medium">
                    <CommonEntityLinkCell
                      :to="`/dashboard/promoters/${p.promoterUuid}`"
                      :label="p.promoterDisplayName"
                      :can="canViewPromoter"
                    />
                  </td>
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

        <div class="rounded-xl border border-red-200 bg-red-50 p-3 flex gap-2 text-sm text-red-800">
          <UIcon name="i-lucide-alert-triangle" class="w-5 h-5 shrink-0 mt-0.5" />
          <span>{{ t('commissions.payoutBySelection.confirmDescription') }}</span>
        </div>
      </div>
    </template>

    <template #footer>
      <div v-if="!preview" class="w-full flex items-center justify-end gap-3">
        <UButton color="neutral" variant="ghost" :disabled="previewing" @click="isOpen = false">
          {{ t('common.cancel') }}
        </UButton>
        <UButton color="primary" :loading="previewing" icon="i-lucide-eye" @click="formRef?.submit()">
          {{ t('commissions.payoutBySelection.preview') }}
        </UButton>
      </div>
      <div v-else class="w-full flex items-center justify-end gap-3">
        <UButton color="neutral" variant="ghost" :disabled="confirming" icon="i-lucide-arrow-left" @click="backToForm">
          {{ t('commissions.payoutBySelection.back') }}
        </UButton>
        <UButton color="primary" :loading="confirming" icon="i-lucide-check" @click="onConfirm">
          {{ t('commissions.payoutBySelection.confirm') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
