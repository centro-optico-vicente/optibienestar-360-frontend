<script setup lang="ts">
import type { AffiliationRequestListItemDto, AffiliationRequestStatus } from '~/types/affiliationRequests'
import { AFFILIATION_REQUEST_STATUSES, affiliationRequestStatusColor } from '~/types/affiliationRequests'

// "Solicitudes" of the advisor portal: the public affiliation requests that
// came through the advisor's own QR (GET /v1/advisors/me/affiliation-requests,
// backend V188) and where each one stands. Read-only — the review happens in
// the admin panel.
definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'AFFILIATION_REQUEST_VIEW_OWN',
})

const { t } = useI18n()
const { formatDate } = useFormatters()

useSeoMeta({ title: () => t('common.seoTitle', { page: t('affiliationRequests.mine.title') }) })

const api = useAffiliationRequests()

const data = ref<AffiliationRequestListItemDto[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1) // UPagination is 1-based; the API is 0-based
const size = ref(20)
// 'ALL' = no status filter.
const status = ref<string>('ALL')

const statusItems = computed(() => [
  { value: 'ALL', label: t('affiliationRequests.statusAll') },
  ...AFFILIATION_REQUEST_STATUSES.map(s => ({ value: s, label: t(`affiliationRequests.status.${s}`) })),
])

async function load() {
  loading.value = true
  try {
    const res = await api.mine({
      page: page.value - 1,
      size: size.value,
      status: status.value === 'ALL' ? undefined : status.value as AffiliationRequestStatus,
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
watch(status, () => {
  if (page.value !== 1) page.value = 1
  else load()
})
onMounted(load)

function statusLabel(r: AffiliationRequestListItemDto): string {
  return r.status_Display ?? t(`affiliationRequests.status.${r.status}`, r.status)
}
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-extrabold text-prohealth-900">{{ t('affiliationRequests.mine.title') }}</h1>
        <p class="text-sm text-prohealth-700/70 mt-1">{{ t('affiliationRequests.mine.subtitle') }}</p>
      </div>
      <USelect v-model="status" :items="statusItems" :aria-label="t('affiliationRequests.columns.status')" class="w-48" />
    </div>

    <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden flex flex-col h-[calc(100vh-16rem)] min-h-[24rem]">
      <div class="overflow-auto flex-1">
        <table class="w-full text-sm">
          <thead class="sticky top-0 bg-white z-10">
            <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
              <th class="px-5 py-3 font-semibold">{{ t('affiliationRequests.columns.applicant') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('affiliationRequests.columns.plan') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('affiliationRequests.columns.createdAt') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('affiliationRequests.columns.status') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-prohealth-100">
            <TableSkeleton v-if="loading" :rows="6" :cols="4" />
            <tr v-else-if="data.length === 0">
              <td colspan="4" class="px-5 py-12 text-center text-prohealth-500">
                <UIcon name="i-lucide-user-plus" class="w-8 h-8 mx-auto mb-2 text-prohealth-300" />
                {{ t('affiliationRequests.mine.empty') }}
              </td>
            </tr>
            <tr v-for="r in data" v-else :key="r.uuid" class="hover:bg-prohealth-50/50">
              <td class="px-5 py-3">
                <p class="font-medium text-prohealth-900">{{ r.fullName }}</p>
                <p class="text-xs text-prohealth-500">{{ r.documentType }}-{{ r.documentNumber }} · {{ r.phone || r.email }}</p>
              </td>
              <td class="px-5 py-3 text-prohealth-600">{{ r.plan_Display ?? t('common.empty') }}</td>
              <td class="px-5 py-3 text-prohealth-600">{{ r.createdAt_Display ?? formatDate(r.createdAt, 'datetime') }}</td>
              <td class="px-5 py-3">
                <UBadge :color="affiliationRequestStatusColor(r.status)" variant="subtle" size="sm">{{ statusLabel(r) }}</UBadge>
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
