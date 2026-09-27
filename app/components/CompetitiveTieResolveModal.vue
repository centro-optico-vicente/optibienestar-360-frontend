<script setup lang="ts">
import type { CompetitiveEvaluationOutcome, CompetitiveTieDto } from '~/types/competitiveCommissions'

// D16 — resolve an open tie: pick exactly `tie.slots` winners among its
// candidates. Same dryRun preview→confirm shape as CommissionReRatingModal.
const props = defineProps<{
  open: boolean
  tie: CompetitiveTieDto | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'done': []
}>()

const { t } = useI18n()
const { formatDate } = useFormatters()
const winnersApi = useCompetitiveCommissionWinners()
const toast = useToast()

const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})

const selected = ref<string[]>([])
const reason = ref('')
const preview = ref<CompetitiveEvaluationOutcome | null>(null)
const previewing = ref(false)
const confirming = ref(false)

watch(() => props.open, (open) => {
  if (!open) return
  selected.value = []
  reason.value = ''
  preview.value = null
  previewing.value = false
  confirming.value = false
})

const slots = computed(() => props.tie?.slots ?? 0)
const selectionValid = computed(() => selected.value.length === slots.value)
const reasonValid = computed(() => reason.value.trim().length >= 10)

function toggle(promoterUuid: string | null | undefined) {
  if (!promoterUuid) return
  const idx = selected.value.indexOf(promoterUuid)
  if (idx >= 0) {
    selected.value.splice(idx, 1)
    return
  }
  if (selected.value.length >= slots.value) return
  selected.value.push(promoterUuid)
}

function backToForm() {
  preview.value = null
}

async function onPreview() {
  if (!props.tie || !selectionValid.value || !reasonValid.value) return
  previewing.value = true
  try {
    preview.value = await winnersApi.resolveTie(props.tie.uuid, { winnerPromoterUuids: selected.value, reason: reason.value.trim() }, true)
  }
  catch { /* useApi already notified */ }
  finally { previewing.value = false }
}

async function onConfirm() {
  if (!props.tie) return
  confirming.value = true
  try {
    await winnersApi.resolveTie(props.tie.uuid, { winnerPromoterUuids: selected.value, reason: reason.value.trim() }, false)
    toast.add({ title: t('competitiveWinners.resolveModal.successToast'), color: 'success', icon: 'i-lucide-check-circle' })
    emit('done')
    isOpen.value = false
  }
  catch { /* useApi already notified */ }
  finally { confirming.value = false }
}
</script>

<template>
  <UModal v-model:open="isOpen" :title="t('competitiveWinners.resolveModal.title')" :ui="{ content: 'max-w-2xl' }">
    <template #body>
      <div v-if="tie" class="space-y-4">
        <p class="text-sm text-prohealth-600">
          {{ t('competitiveWinners.resolveModal.description', { from: tie.positionFrom, slots: tie.slots }) }}
        </p>

        <div v-if="!preview" class="space-y-4">
          <div class="bg-white rounded-xl border border-prohealth-100 overflow-hidden">
            <table class="w-full text-sm">
              <thead class="bg-prohealth-50/60">
                <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400">
                  <th class="px-4 py-2 font-semibold w-10" />
                  <th class="px-4 py-2 font-semibold">{{ t('competitiveWinners.candidateColumns.promoter') }}</th>
                  <th class="px-4 py-2 font-semibold text-right">{{ t('competitiveWinners.candidateColumns.metricValue') }}</th>
                  <th class="px-4 py-2 font-semibold">{{ t('competitiveWinners.candidateColumns.achievedAt') }}</th>
                  <th class="px-4 py-2 font-semibold text-right">{{ t('competitiveWinners.candidateColumns.transactions') }}</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-prohealth-100">
                <tr v-for="candidate in tie.candidates" :key="candidate.promoter_Uuid ?? undefined"
                    class="cursor-pointer hover:bg-prohealth-50/50" @click="toggle(candidate.promoter_Uuid)">
                  <td class="px-4 py-2">
                    <UCheckbox :model-value="selected.includes(candidate.promoter_Uuid ?? '')"
                               :disabled="!selected.includes(candidate.promoter_Uuid ?? '') && selected.length >= slots"
                               @click.stop @update:model-value="toggle(candidate.promoter_Uuid)" />
                  </td>
                  <td class="px-4 py-2 font-medium text-prohealth-900">{{ candidate.promoter_Display }}</td>
                  <td class="px-4 py-2 text-right text-prohealth-700">{{ candidate.metricValue }}</td>
                  <td class="px-4 py-2 text-prohealth-600">{{ candidate.achievedAt ? formatDate(candidate.achievedAt, 'datetime') : '—' }}</td>
                  <td class="px-4 py-2 text-right text-prohealth-700">{{ candidate.metricTransactionCount }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="text-xs" :class="selectionValid ? 'text-prohealth-500' : 'text-amber-600'">
            {{ t('competitiveWinners.resolveModal.selectedCount', { selected: selected.length, slots }) }}
          </p>

          <UFormField :label="t('competitiveWinners.reason')" required :help="t('competitiveWinners.reasonHelp')">
            <UTextarea v-model="reason" :rows="3" class="w-full" />
          </UFormField>
        </div>

        <div v-else class="space-y-4">
          <h3 class="font-bold text-prohealth-900">{{ t('competitiveWinners.resolveModal.previewTitle') }}</h3>
          <dl class="grid grid-cols-3 gap-3">
            <div class="rounded-xl border border-prohealth-100 bg-prohealth-50/40 p-3">
              <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('commissionRules.competitiveRules.leaderboard.totals.created') }}</dt>
              <dd class="text-prohealth-900 text-lg font-semibold mt-0.5">{{ preview.created }}</dd>
            </div>
            <div class="rounded-xl border border-prohealth-100 bg-prohealth-50/40 p-3">
              <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('commissionRules.competitiveRules.leaderboard.totals.updated') }}</dt>
              <dd class="text-prohealth-900 text-lg font-semibold mt-0.5">{{ preview.updated }}</dd>
            </div>
            <div class="rounded-xl border border-prohealth-100 bg-prohealth-50/40 p-3">
              <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('commissionRules.competitiveRules.leaderboard.totals.displaced') }}</dt>
              <dd class="text-prohealth-900 text-lg font-semibold mt-0.5">{{ preview.displaced }}</dd>
            </div>
          </dl>
          <div v-if="preview.openTie" class="rounded-xl border border-amber-200 bg-amber-50 p-3 flex gap-2 text-sm text-amber-800">
            <UIcon name="i-lucide-users" class="w-5 h-5 shrink-0 mt-0.5" />
            <span>{{ t('commissionRules.competitiveRules.leaderboard.openTieNote', { slots: preview.openTie.slots, candidates: preview.openTie.candidates.length }) }}</span>
          </div>
          <div class="rounded-xl border border-red-200 bg-red-50 p-3 flex gap-2 text-sm text-red-800">
            <UIcon name="i-lucide-alert-triangle" class="w-5 h-5 shrink-0 mt-0.5" />
            <span>{{ t('competitiveWinners.resolveModal.confirmDescription') }}</span>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div v-if="!preview" class="w-full flex items-center justify-end gap-3">
        <UButton color="neutral" variant="ghost" :disabled="previewing" @click="isOpen = false">{{ t('common.cancel') }}</UButton>
        <UButton color="primary" :loading="previewing" :disabled="!selectionValid || !reasonValid" icon="i-lucide-eye" @click="onPreview">
          {{ t('commissionRules.competitiveRules.leaderboard.preview') }}
        </UButton>
      </div>
      <div v-else class="w-full flex items-center justify-end gap-3">
        <UButton color="neutral" variant="ghost" :disabled="confirming" icon="i-lucide-arrow-left" @click="backToForm">
          {{ t('commissionRules.competitiveRules.leaderboard.back') }}
        </UButton>
        <UButton color="primary" :loading="confirming" icon="i-lucide-check" @click="onConfirm">
          {{ t('commissionRules.competitiveRules.leaderboard.confirm') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
