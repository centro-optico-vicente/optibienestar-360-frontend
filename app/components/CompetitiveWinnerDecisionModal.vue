<script setup lang="ts">
import type { SelectItem } from '~/types/options'
import type {
  CompetitiveEvaluationOutcome,
  DecisionKind,
  DecisionReasonCategory,
} from '~/types/competitiveCommissions'
import { DECISION_REASON_CATEGORY_OPTIONS } from '~/types/competitiveCommissions'

// D16 — manual redirect/disqualify, standalone (not tied to a specific tie):
// the coordinator picks rule + period + position directly, e.g. unsportsmanlike
// conduct discovered after the fact. Same dryRun preview→confirm shape.
const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'done': []
}>()

const { t } = useI18n()
const winnersApi = useCompetitiveCommissionWinners()
const rulesApi = useCompetitiveCommissionRules()
const promotersApi = usePromoters()
const toast = useToast()

const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})

const kindOptions = computed(() => [
  { label: t('competitiveWinners.decisionModal.kinds.REDIRECT'), value: 'REDIRECT' as DecisionKind },
  { label: t('competitiveWinners.decisionModal.kinds.DISQUALIFY'), value: 'DISQUALIFY' as DecisionKind },
])
const reasonCategoryOptions = computed(() =>
  DECISION_REASON_CATEGORY_OPTIONS
    .filter(o => o.value !== 'TIE_BREAK')
    .map(o => ({ label: t(o.labelKey), value: o.value })))

const ruleUuid = ref<string | undefined>(undefined)
const periodStart = ref<string>('')
const kind = ref<DecisionKind>('REDIRECT')
const awardPosition = ref<string>('')
const promoterUuid = ref<string | undefined>(undefined)
const replacementPromoterUuid = ref<string | undefined>(undefined)
const excludeFromGroup = ref(false)
const reasonCategory = ref<DecisionReasonCategory | undefined>(undefined)
const reason = ref('')

const preview = ref<CompetitiveEvaluationOutcome | null>(null)
const previewing = ref(false)
const confirming = ref(false)

watch(() => props.open, (open) => {
  if (!open) return
  ruleUuid.value = undefined
  periodStart.value = ''
  kind.value = 'REDIRECT'
  awardPosition.value = ''
  promoterUuid.value = undefined
  replacementPromoterUuid.value = undefined
  excludeFromGroup.value = false
  reasonCategory.value = undefined
  reason.value = ''
  preview.value = null
  previewing.value = false
  confirming.value = false
})

const formValid = computed(() => {
  if (!ruleUuid.value || !periodStart.value || !awardPosition.value || !promoterUuid.value) return false
  if (reason.value.trim().length < 10) return false
  if (kind.value === 'REDIRECT' && !replacementPromoterUuid.value) return false
  return true
})

async function searchRules(q: string): Promise<SelectItem[]> {
  const res = await rulesApi.list({ q, size: 20 })
  return (res.content ?? []).map(r => ({ label: r.name, value: r.uuid }))
}

async function searchPromoters(q: string): Promise<SelectItem[]> {
  const res = await promotersApi.list({ q, size: 20 })
  return (res.content ?? []).map(p => ({ label: p.displayName, value: p.uuid }))
}

function backToForm() {
  preview.value = null
}

function buildRequest() {
  return {
    kind: kind.value,
    awardPosition: Number(awardPosition.value),
    promoterUuid: promoterUuid.value!,
    replacementPromoterUuid: kind.value === 'REDIRECT' ? replacementPromoterUuid.value : undefined,
    excludeFromGroup: excludeFromGroup.value,
    reasonCategory: reasonCategory.value,
    reason: reason.value.trim(),
  }
}

async function onPreview() {
  if (!ruleUuid.value || !periodStart.value || !formValid.value) return
  previewing.value = true
  try {
    preview.value = await winnersApi.decide(ruleUuid.value, periodStart.value, buildRequest(), true)
  }
  catch { /* useApi already notified */ }
  finally { previewing.value = false }
}

async function onConfirm() {
  if (!ruleUuid.value || !periodStart.value) return
  confirming.value = true
  try {
    await winnersApi.decide(ruleUuid.value, periodStart.value, buildRequest(), false)
    toast.add({ title: t('competitiveWinners.decisionModal.successToast'), color: 'success', icon: 'i-lucide-check-circle' })
    emit('done')
    isOpen.value = false
  }
  catch { /* useApi already notified */ }
  finally { confirming.value = false }
}
</script>

<template>
  <UModal
    v-model:open="isOpen"
    :title="t('competitiveWinners.decisionModal.title')"
    :description="t('competitiveWinners.decisionModal.description')"
    :ui="{ content: 'max-w-2xl' }"
  >
    <template #body>
      <div class="space-y-4">
        <div v-if="!preview" class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <UFormField :label="t('competitiveWinners.decisionModal.fields.rule')" required class="col-span-2">
              <CommonEntityReferenceSelect v-model="ruleUuid" :search="searchRules" icon="i-lucide-trophy" :placeholder="t('common.select')" />
            </UFormField>

            <UFormField :label="t('competitiveWinners.decisionModal.fields.periodStart')" required>
              <UInput v-model="periodStart" type="date" class="w-full" />
            </UFormField>

            <UFormField :label="t('competitiveWinners.decisionModal.fields.position')" required>
              <UInput v-model="awardPosition" type="number" min="1" class="w-full" />
            </UFormField>

            <UFormField :label="t('competitiveWinners.decisionModal.fields.kind')" required class="col-span-2">
              <URadioGroup v-model="kind" :items="kindOptions" orientation="horizontal" />
            </UFormField>

            <UFormField :label="t('competitiveWinners.decisionModal.fields.promoter')" required class="col-span-2">
              <CommonEntityReferenceSelect v-model="promoterUuid" :search="searchPromoters" entity="promoter" icon="i-lucide-user" :placeholder="t('common.select')" />
            </UFormField>

            <UFormField
              v-if="kind === 'REDIRECT'"
              :label="t('competitiveWinners.decisionModal.fields.replacement')"
              required
              class="col-span-2"
            >
              <CommonEntityReferenceSelect v-model="replacementPromoterUuid" :search="searchPromoters" entity="promoter" icon="i-lucide-user-plus" :placeholder="t('common.select')" />
            </UFormField>

            <UFormField :label="t('competitiveWinners.decisionModal.fields.reasonCategory')" class="col-span-2">
              <USelectMenu
                clear
                v-model="reasonCategory"
                :items="reasonCategoryOptions"
                label-key="label"
                value-key="value"
                :placeholder="t('common.select')"
                class="w-full"
              />
            </UFormField>

            <UFormField v-if="kind === 'DISQUALIFY'" class="col-span-2">
              <UCheckbox v-model="excludeFromGroup" :label="t('competitiveWinners.decisionModal.fields.excludeFromGroup')" />
            </UFormField>

            <UFormField :label="t('competitiveWinners.reason')" required class="col-span-2" :help="t('competitiveWinners.reasonHelp')">
              <UTextarea v-model="reason" :rows="3" class="w-full" />
            </UFormField>
          </div>
        </div>

        <div v-else class="space-y-4">
          <h3 class="font-bold text-prohealth-900">{{ t('commissionRules.competitiveRules.leaderboard.previewTitle') }}</h3>
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
            <span>{{ t('commissionRules.competitiveRules.leaderboard.confirmDescription') }}</span>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div v-if="!preview" class="w-full flex items-center justify-end gap-3">
        <UButton color="neutral" variant="ghost" :disabled="previewing" @click="isOpen = false">{{ t('common.cancel') }}</UButton>
        <UButton color="primary" :loading="previewing" :disabled="!formValid" icon="i-lucide-eye" @click="onPreview">
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
