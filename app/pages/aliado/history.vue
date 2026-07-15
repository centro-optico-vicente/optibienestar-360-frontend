<script setup lang="ts">
import type { BenefitUsageDto } from '~/types/benefits'

// Usage history for every ally the operator works at (GET /v1/ally/usage-history,
// ALLY_VIEW_OWN). Scope is implicit in the JWT — the backend resolves "my allies"
// through the AllyUser pivot, so there is no ally filter to pass and no way to
// read another partner's feed. Newest first.
definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'ALLY_VIEW_OWN',
})

const { t } = useI18n()
const { formatCurrency, formatDate } = useFormatters()
const benefitUsage = useBenefitUsage()

useSeoMeta({ title: () => t('validator.history.seoTitle') })

const data = ref<BenefitUsageDto[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1) // UPagination is 1-based; the API is 0-based
const size = ref(20)

async function load() {
  loading.value = true
  try {
    const res = await benefitUsage.history({ page: page.value - 1, size: size.value })
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
onMounted(load)

// Co-pay in its own currency, formatted in the VE convention. Absent → '—'.
function money(v?: number | string | null, currency?: string | null): string {
  if (v === null || v === undefined || v === '') return t('common.empty')
  return formatCurrency(Number(v), currency || 'USD')
}
</script>

<template>
  <div class="space-y-6 max-w-3xl">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-extrabold text-prohealth-900">{{ t('validator.history.title') }}</h1>
        <p class="text-sm text-prohealth-700/70 mt-1">{{ t('validator.history.subtitle') }}</p>
      </div>
      <UButton to="/aliado/validator" color="primary" variant="soft" icon="i-lucide-scan-line">
        {{ t('validator.history.validateCta') }}
      </UButton>
    </div>

    <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden">
      <!-- Loading -->
      <div v-if="loading" class="px-6 py-8 space-y-3">
        <USkeleton class="h-5 w-full rounded" />
        <USkeleton class="h-5 w-3/4 rounded" />
      </div>

      <!-- Empty -->
      <div v-else-if="data.length === 0" class="px-6 py-10 text-center text-prohealth-500">
        <UIcon name="i-lucide-clipboard-list" class="w-7 h-7 mx-auto mb-2 text-prohealth-300" />
        <p class="text-sm">{{ t('validator.history.empty') }}</p>
      </div>

      <!-- List -->
      <ul v-else class="divide-y divide-prohealth-100">
        <li v-for="u in data" :key="u.uuid" class="px-6 py-3.5 flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="font-semibold text-prohealth-900">{{ formatDate(u.usageDate) }}</p>
            <p class="text-xs text-prohealth-500 truncate">
              <!-- allyName only matters when the operator spans several allies, but it's
                   cheap to always show and avoids a conditional that reads as a bug. -->
              {{ [u.allyName, u.planCode].filter(Boolean).join(' · ') || t('common.empty') }}
            </p>
            <p v-if="u.notes" class="text-xs text-prohealth-400 truncate mt-0.5">{{ u.notes }}</p>
          </div>
          <div class="text-right shrink-0">
            <p v-if="u.copayAmount" class="text-sm font-semibold text-prohealth-800">
              {{ money(u.copayAmount, u.copayCurrency) }}
            </p>
            <p class="text-xs text-prohealth-400">{{ t('validator.history.copayLabel') }}</p>
          </div>
        </li>
      </ul>

      <!-- Pagination (only when there is more than one page) -->
      <div v-if="!loading && total > size" class="flex items-center justify-end px-6 py-3 border-t border-prohealth-100">
        <UPagination v-model:page="page" :total="total" :items-per-page="size" />
      </div>
    </div>
  </div>
</template>
