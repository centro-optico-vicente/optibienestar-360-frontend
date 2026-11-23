<script setup lang="ts">
import type { SubsidyDto } from '~/types/subsidies'
import { subsidyPercentLabel } from '~/types/subsidies'

/**
 * Affiliate portal: the titular's active subsidies / exonerations (read only). Self-gated by
 * SUBSIDY_VIEW_OWN and hidden when there are none. The backend already applies them to solvency and charges.
 */
const { t } = useI18n()
const { can } = usePermissions()
const { formatDate } = useFormatters()
const api = useMySubsidies()

const subsidies = ref<SubsidyDto[]>([])

onMounted(async () => {
  if (!can('SUBSIDY_VIEW_OWN')) return
  try {
    subsidies.value = (await api.list()) ?? []
  }
  catch {
    subsidies.value = []
  }
})

/** Full exoneration when every covered fee is at 100 %. */
function isFull(s: SubsidyDto): boolean {
  const full = (v: number | string | null) => v === null || Number(v) >= 100
  return full(s.monthlyPercentage) && full(s.inscriptionPercentage)
}

function headline(s: SubsidyDto): string {
  const monthly = subsidyPercentLabel(s.monthlyPercentage, s.monthlyPercentage_Display)
  if (monthly) {
    return isFull(s) && Number(s.monthlyPercentage) >= 100
      ? t('members.mySubsidies.monthlyExonerated')
      : t('members.mySubsidies.monthlySubsidized', { value: monthly })
  }
  const inscription = subsidyPercentLabel(s.inscriptionPercentage, s.inscriptionPercentage_Display)
  return Number(s.inscriptionPercentage) >= 100
    ? t('members.mySubsidies.inscriptionExonerated')
    : t('members.mySubsidies.inscriptionSubsidized', { value: inscription ?? '' })
}

function validity(s: SubsidyDto): string {
  const from = s.validFrom_Display ?? formatDate(s.validFrom)
  if (!s.validUntil) return t('members.mySubsidies.validSince', { from })
  return t('members.mySubsidies.validRange', { from, until: s.validUntil_Display ?? formatDate(s.validUntil) })
}
</script>

<template>
  <div v-if="subsidies.length" class="bg-white rounded-2xl border border-prohealth-100 p-6 space-y-4">
    <div class="flex items-center gap-3">
      <UIcon name="i-lucide-hand-heart" class="w-7 h-7 text-primary-500 shrink-0" />
      <div>
        <h2 class="font-bold text-prohealth-900">{{ t('members.mySubsidies.title') }}</h2>
        <p class="text-xs text-prohealth-500">{{ t('members.mySubsidies.hint') }}</p>
      </div>
    </div>
    <ul class="divide-y divide-prohealth-100">
      <li v-for="s in subsidies" :key="s.uuid" class="py-3 flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0 space-y-0.5">
          <p class="font-medium text-prohealth-900">{{ headline(s) }}</p>
          <p
            v-if="subsidyPercentLabel(s.monthlyPercentage, s.monthlyPercentage_Display) && subsidyPercentLabel(s.inscriptionPercentage, s.inscriptionPercentage_Display)"
            class="text-sm text-prohealth-700"
          >
            {{ t('members.mySubsidies.inscriptionAlso', { value: subsidyPercentLabel(s.inscriptionPercentage, s.inscriptionPercentage_Display) }) }}
          </p>
          <p class="text-xs text-prohealth-500">{{ validity(s) }}</p>
          <p v-if="s.beneficiaries?.length" class="text-xs text-prohealth-500">
            {{ t('members.mySubsidies.beneficiaries', { names: s.beneficiaries.map(b => b.beneficiaryName).filter(Boolean).join(', ') }) }}
          </p>
        </div>
        <UBadge :color="isFull(s) ? 'success' : 'info'" variant="subtle" size="sm">
          {{ isFull(s) ? t('members.mySubsidies.kind.exoneration') : t('members.mySubsidies.kind.partial') }}
        </UBadge>
      </li>
    </ul>
  </div>
</template>
