<script setup lang="ts">
import type { Page } from '~/types/admin'
import type { BenefitUsageDto } from '~/types/benefits'

// The member's own benefit usage at allies (GET /v1/me/usage-history,
// MEMBER_VIEW_OWN). Scope comes from the JWT; newest first.
definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'MEMBER_VIEW_OWN',
})

const { t } = useI18n()
const { formatCurrency, formatDate } = useFormatters()

useSeoMeta({ title: () => t('common.seoTitle', { page: t('members.usage.title') }) })

const data = ref<BenefitUsageDto[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1) // UPagination is 1-based; the API is 0-based
const size = ref(20)

async function load() {
  loading.value = true
  try {
    const res = await useApi<Page<BenefitUsageDto>>('/v1/me/usage-history', {
      query: { page: page.value - 1, size: size.value, sort: 'usageDate,desc' },
    })
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

function money(v?: number | string | null, currency?: string | null): string | null {
  if (v === null || v === undefined || v === '') return null
  return formatCurrency(Number(v), currency || 'USD')
}
</script>

<template>
  <div class="space-y-6 max-w-5xl">
    <div>
      <h1 class="text-2xl font-extrabold text-prohealth-900">{{ t('members.usage.title') }}</h1>
      <p class="text-sm text-prohealth-700/70 mt-1">{{ t('members.usage.subtitle') }}</p>
    </div>

    <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden">
      <div v-if="loading" class="px-6 py-8 space-y-3">
        <USkeleton class="h-5 w-full rounded" />
        <USkeleton class="h-5 w-3/4 rounded" />
      </div>

      <div v-else-if="data.length === 0" class="px-6 py-10 text-center text-prohealth-500">
        <UIcon name="i-lucide-clipboard-list" class="w-7 h-7 mx-auto mb-2 text-prohealth-300" />
        <p class="text-sm">{{ t('members.usage.empty') }}</p>
      </div>

      <ul v-else class="divide-y divide-prohealth-100">
        <li v-for="u in data" :key="u.uuid" class="px-6 py-3.5 flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="font-semibold text-prohealth-900 truncate">
              {{ u.allyName || t('common.empty') }}
            </p>
            <p class="text-xs text-prohealth-500 truncate">
              {{ u.usageDate_Display ?? formatDate(u.usageDate) }}
              · {{ [u.serviceCategoryName, u.planCode].filter(Boolean).join(' · ') || t('common.empty') }}
            </p>
            <p v-if="u.notes" class="text-xs text-prohealth-400 truncate mt-0.5">{{ u.notes }}</p>
          </div>
          <div class="text-right shrink-0 space-y-0.5">
            <p v-if="money(u.consumptionAmount, u.consumptionCurrency)" class="text-sm font-semibold text-prohealth-800">
              {{ money(u.consumptionAmount, u.consumptionCurrency) }}
              <span class="text-xs font-normal text-prohealth-400">{{ t('members.usage.consumption') }}</span>
            </p>
            <p v-if="money(u.copayAmount, u.copayCurrency)" class="text-xs text-prohealth-500">
              {{ t('members.usage.copay') }}: {{ money(u.copayAmount, u.copayCurrency) }}
            </p>
          </div>
        </li>
      </ul>

      <div v-if="!loading && total > size" class="flex items-center justify-end px-6 py-3 border-t border-prohealth-100">
        <UPagination v-model:page="page" :total="total" :items-per-page="size" />
      </div>
    </div>
  </div>
</template>
