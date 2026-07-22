<script setup lang="ts">
import type { MyReferralDto } from '~/types/promoters'
import { referralStatusColor } from '~/types/promoters'

// Authenticated affiliate's own referral history (GET /v1/me/referrals,
// REFERRAL_CODE_VIEW_OWN). Self-gated: if the user lacks the permission it renders
// nothing. Meant to be embedded in the member portal (/afiliado).
const { t } = useI18n()
const { formatCurrency, formatDate } = useFormatters()
const referrals = useReferrals()
const { can } = usePermissions()

const canView = computed(() => can('REFERRAL_CODE_VIEW_OWN'))

const data = ref<MyReferralDto[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1) // UPagination is 1-based; the API is 0-based
const size = ref(10)

async function load() {
  loading.value = true
  try {
    const res = await referrals.mine({ page: page.value - 1, size: size.value })
    data.value = res.content ?? []
    total.value = res.totalElements ?? 0
  }
  catch {
    // useApi already shows the error toast
    data.value = []
    total.value = 0
  }
  finally {
    loading.value = false
  }
}

watch(page, load)

onMounted(() => {
  if (canView.value) load()
})

function statusLabel(s?: string | null): string {
  return s ? t(`referrals.status.${s}`, s) : t('common.empty')
}

// Reward text: pct XOR flat amount; only meaningful once REWARD_GRANTED.
function rewardLabel(r: MyReferralDto): string {
  if (r.rewardPct != null) return `${r.rewardPct}%`
  if (r.rewardFlatAmount != null) return formatCurrency(Number(r.rewardFlatAmount), r.rewardCurrency || 'USD')
  return t('common.empty')
}

function referredName(r: MyReferralDto): string {
  return r.referredMemberName || t('referrals.mine.pendingReferred')
}
</script>

<template>
  <div v-if="canView" class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden">
    <div class="px-6 py-4 border-b border-prohealth-100">
      <h2 class="font-bold text-prohealth-900">{{ t('referrals.mine.title') }}</h2>
      <p class="text-xs text-prohealth-500 mt-0.5">{{ t('referrals.mine.subtitle') }}</p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="px-6 py-8 space-y-3">
      <USkeleton class="h-5 w-full rounded" />
      <USkeleton class="h-5 w-3/4 rounded" />
    </div>

    <!-- Empty -->
    <div v-else-if="data.length === 0" class="px-6 py-10 text-center text-prohealth-500">
      <UIcon name="i-lucide-share-2" class="w-7 h-7 mx-auto mb-2 text-prohealth-300" />
      <p class="text-sm">{{ t('referrals.mine.empty') }}</p>
    </div>

    <!-- List -->
    <ul v-else class="divide-y divide-prohealth-100">
      <li
        v-for="r in data"
        :key="r.uuid"
        class="px-6 py-3.5 flex items-center justify-between gap-3"
      >
        <div class="min-w-0">
          <p class="font-semibold text-prohealth-900 truncate">{{ referredName(r) }}</p>
          <p class="text-xs text-prohealth-500">
            <span class="font-mono">{{ r.referralCode }}</span>
            <template v-if="r.enrolledAt"> · {{ t('referrals.mine.enrolledOn', { date: formatDate(r.enrolledAt, 'short') }) }}</template>
            <template v-if="r.status === 'REWARD_GRANTED'"> · {{ t('referrals.mine.reward', { reward: rewardLabel(r) }) }}</template>
          </p>
        </div>
        <UBadge :color="referralStatusColor(r.status)" variant="subtle" size="sm">
          {{ statusLabel(r.status) }}
        </UBadge>
      </li>
    </ul>

    <!-- Pagination (only when there is more than one page) -->
    <div v-if="!loading && total > size" class="flex items-center justify-end px-6 py-3 border-t border-prohealth-100">
      <UPagination
        v-model:page="page"
        :total="total"
        :items-per-page="size"
      />
    </div>
  </div>
</template>
