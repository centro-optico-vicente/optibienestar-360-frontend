<script setup lang="ts">
import type { AdvisorAllyListItemDto } from '~/types/allies'
import { allyRegistrationStatusColor } from '~/types/allyRequests'

// "Mis aliados" of the advisor portal: the allies the advisor brought into OptiBienestar 360 and where each one
// stands (GET /v1/me/advisor/allies, backend V235). Read-only — the review and the data live in the admin panel.
definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'PROMOTER_ALLY_VIEW_OWN',
})

const { t } = useI18n()
const { formatDate } = useFormatters()

useSeoMeta({ title: () => t('common.seoTitle', { page: t('advisorAllies.title') }) })

const api = useAdvisorAllies()

const data = ref<AdvisorAllyListItemDto[]>([])
const total = ref(0)
const loading = ref(false)
const search = ref('')
const page = ref(1) // UPagination is 1-based; the API is 0-based
const size = ref(20)

async function load() {
  loading.value = true
  try {
    const res = await api.list({ page: page.value - 1, size: size.value, q: search.value.trim() || undefined })
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

const debouncedSearch = useTableFilterDebounce(() => {
  page.value = 1
  load()
})
watch(page, load)
watch(search, debouncedSearch)
onMounted(load)

function statusLabel(a: AdvisorAllyListItemDto): string {
  return a.registrationStatus_Display ?? t(`allyRequests.status.${a.registrationStatus}`, a.registrationStatus)
}
function segmentLabel(a: AdvisorAllyListItemDto): string {
  return a.segment_Display ?? (a.segment ? t(`allies.segments.${a.segment}`, a.segment) : '')
}
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-extrabold text-prohealth-900">{{ t('advisorAllies.title') }}</h1>
        <p class="text-sm text-prohealth-700/70 mt-1">{{ t('advisorAllies.subtitle') }}</p>
      </div>
      <UInput v-model="search" :placeholder="t('advisorAllies.searchPlaceholder')" icon="i-lucide-search" class="w-full max-w-xs" />
    </div>

    <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden flex flex-col h-[calc(100vh-16rem)] min-h-[24rem]">
      <div class="overflow-auto flex-1">
        <table class="w-full text-sm">
          <thead class="sticky top-0 bg-white z-10">
            <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
              <th class="px-5 py-3 font-semibold">{{ t('advisorAllies.columns.ally') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('advisorAllies.columns.city') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('advisorAllies.columns.createdAt') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('advisorAllies.columns.registration') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('advisorAllies.columns.published') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-prohealth-100">
            <TableSkeleton v-if="loading" :rows="6" :cols="5" />
            <tr v-else-if="data.length === 0">
              <td colspan="5" class="px-5 py-12 text-center text-prohealth-500">
                <UIcon name="i-lucide-handshake" class="w-8 h-8 mx-auto mb-2 text-prohealth-300" />
                {{ t('advisorAllies.empty') }}
              </td>
            </tr>
            <tr v-for="a in data" v-else :key="a.uuid" class="hover:bg-prohealth-50/50">
              <td class="px-5 py-3">
                <p class="font-medium text-prohealth-900">{{ a.name }}</p>
                <p class="text-xs text-prohealth-500">
                  {{ segmentLabel(a) }}<template v-if="a.allyTypeNames?.length"> · {{ a.allyTypeNames.join(', ') }}</template>
                </p>
              </td>
              <td class="px-5 py-3 text-prohealth-600">{{ a.city_Display ?? t('common.empty') }}</td>
              <td class="px-5 py-3 text-prohealth-600 whitespace-nowrap">{{ a.createdAt_Display ?? formatDate(a.createdAt, 'datetime') }}</td>
              <td class="px-5 py-3">
                <UBadge :color="allyRegistrationStatusColor(a.registrationStatus)" variant="subtle" size="sm">{{ statusLabel(a) }}</UBadge>
              </td>
              <td class="px-5 py-3">
                <UBadge :color="a.published && a.active ? 'success' : 'neutral'" variant="subtle" size="sm">
                  {{ a.published && a.active ? t('allies.published') : t('allies.draft') }}
                </UBadge>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="flex items-center justify-between gap-3 px-5 py-3 border-t border-prohealth-100 shrink-0">
        <p class="text-xs text-prohealth-500">{{ t('catalogs.recordCount', { count: total }) }}</p>
        <UPagination v-model:page="page" :total="total" :items-per-page="size" />
      </div>
    </div>
  </div>
</template>
