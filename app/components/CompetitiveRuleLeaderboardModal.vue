<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import type { CompetitiveEvaluationOutcome, CompetitiveRuleListItemDto } from '~/types/competitiveCommissions'

// Manual evaluation run for one competitive rule — same preview→confirm shape
// as CommissionReRatingModal: dryRun=true previews (no writes), dryRun=false
// applies. The scheduled job (every 15 min) already does this automatically;
// this is the "run it now" / "see what would happen" admin override.
const props = defineProps<{
  open: boolean
  rule: CompetitiveRuleListItemDto | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'done': []
}>()

const { t } = useI18n()
const { formatDate } = useFormatters()
const rulesApi = useCompetitiveCommissionRules()
const toast = useToast()

const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})

interface FormState {
  period: string
}
const state = reactive<FormState>({ period: '' })

const preview = ref<CompetitiveEvaluationOutcome | null>(null)
const previewing = ref(false)
const confirming = ref(false)
const formRef = ref<{ submit: () => Promise<void> } | null>(null)

watch(() => props.open, (open) => {
  if (!open) return
  state.period = ''
  preview.value = null
  previewing.value = false
  confirming.value = false
})

function backToForm() {
  preview.value = null
}

async function onPreview(_event: FormSubmitEvent<Record<string, unknown>>) {
  if (!props.rule) return
  previewing.value = true
  try {
    preview.value = await rulesApi.recalculate(props.rule.uuid, { period: state.period || undefined, dryRun: true })
  }
  catch { /* useApi already notified */ }
  finally { previewing.value = false }
}

async function onConfirm() {
  if (!props.rule) return
  confirming.value = true
  try {
    const res = await rulesApi.recalculate(props.rule.uuid, { period: state.period || undefined, dryRun: false })
    toast.add({
      title: t('commissionRules.competitiveRules.leaderboard.successToast', { created: res.created, updated: res.updated, displaced: res.displaced }),
      color: 'success',
      icon: 'i-lucide-check-circle',
    })
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
    :title="t('commissionRules.competitiveRules.leaderboard.title', { name: rule?.name ?? '' })"
    :description="t('commissionRules.competitiveRules.leaderboard.description')"
    :ui="{ content: 'max-w-2xl' }"
  >
    <template #body>
      <UForm v-if="!preview" ref="formRef" :state="state" class="space-y-4" @submit="onPreview">
        <div class="rounded-xl border border-amber-200 bg-amber-50 p-3 flex gap-2 text-sm text-amber-800">
          <UIcon name="i-lucide-info" class="w-5 h-5 shrink-0 mt-0.5" />
          <span>{{ t('commissionRules.competitiveRules.leaderboard.dryRunNote') }}</span>
        </div>
        <UFormField :label="t('commissionRules.competitiveRules.leaderboard.period')" name="period" :help="t('commissionRules.competitiveRules.leaderboard.periodHelp')">
          <UInput v-model="state.period" type="date" class="w-full" />
        </UFormField>
      </UForm>

      <div v-else class="space-y-5">
        <h3 class="font-bold text-prohealth-900">{{ t('commissionRules.competitiveRules.leaderboard.previewTitle') }}</h3>
        <dl class="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
          <div class="rounded-xl border border-prohealth-100 bg-prohealth-50/40 p-3">
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('commissionRules.competitiveRules.leaderboard.totals.period') }}</dt>
            <dd class="text-prohealth-800 text-sm font-medium mt-0.5">{{ formatDate(preview.periodStart) }} – {{ formatDate(preview.periodEnd) }}</dd>
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
    </template>

    <template #footer>
      <div v-if="!preview" class="w-full flex items-center justify-end gap-3">
        <UButton color="neutral" variant="ghost" :disabled="previewing" @click="isOpen = false">{{ t('common.cancel') }}</UButton>
        <UButton color="primary" :loading="previewing" icon="i-lucide-eye" @click="formRef?.submit()">
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
