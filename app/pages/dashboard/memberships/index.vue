<script setup lang="ts">
import type { SelectItem } from '~/types/options'
import { memberOptionLabel } from '~/types/members'
import type { MembershipListItemDto, MembershipStatusFilter } from '~/types/memberships'
import { membershipStatusColor } from '~/types/memberships'
import { PLAN_TYPE_OPTIONS, type PlanType } from '~/types/plans'

// Cross-member memberships list (GET /v1/admin/memberships) with filters by affiliate, advisor,
// plan, plan type, status (lifecycle plus derived overdue / due soon) and date ranges. Picking one
// affiliate switches to the per-member management view (<MemberMembershipsCard>: enroll / cancel /
// reactivate), which stays the place where memberships are changed.
definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'MEMBERSHIP_VIEW_ALL',
})

const { t } = useI18n()
const { formatDate } = useFormatters()

useSeoMeta({ title: () => `${t('memberships.page.title')} — OptiBienestar 360` })

const members = useMembers()
const memberships = useMemberships()
const promotersApi = usePromoters()
const plansApi = usePlans()

// ---- Affiliate picker (server-side, debounced) ----
// Search box lives inside the USelectMenu itself (search-term) so typing and
// picking a result happen in the same field instead of two separate widgets.
// Opening the menu with nothing typed lists the first affiliates; typing searches from 1 character.
const memberSearchTerm = ref('')
const memberOptions = ref<SelectItem[]>([])
const searching = ref(false)
const selectedMemberUuid = ref<string>('')

async function fetchMembers(q?: string) {
  searching.value = true
  try {
    const res = await members.options({ ...(q ? { q } : {}), limit: 10 })
    memberOptions.value = res.map(o => ({ label: memberOptionLabel(o), value: o.uuid }))
  }
  catch {
    memberOptions.value = []
  }
  finally {
    searching.value = false
  }
}

let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(memberSearchTerm, (q) => {
  clearTimeout(searchTimer)
  const term = q.trim()
  // Don't clear memberOptions here: USelectMenu resets search-term to '' right after a
  // pick (resetSearchTermOnSelect/Blur), and wiping the list at that point would drop
  // the just-selected item, making the trigger fall back to showing the raw uuid
  // instead of its label.
  if (term.length < 1) return
  searchTimer = setTimeout(() => fetchMembers(term), 400)
})

// First page on open when nothing is loaded yet (an empty query lists the first affiliates).
function onPickerOpen(open: boolean) {
  if (open && memberOptions.value.length === 0 && !memberSearchTerm.value.trim()) fetchMembers()
}

const selectedMemberLabel = computed(() =>
  memberOptions.value.find(o => o.value === selectedMemberUuid.value)?.label ?? '')

// ---- Filters ----
const filters = reactive({
  promoterUuid: '',
  planUuid: '',
  planType: null as PlanType | null,
  status: '' as MembershipStatusFilter | '',
  enrolledFrom: '',
  enrolledTo: '',
  nextDueFrom: '',
  nextDueTo: '',
})

const promoterOptions = ref<SelectItem[]>([])
const planOptions = ref<SelectItem[]>([])

const planTypeOptions = computed(() => PLAN_TYPE_OPTIONS.map(o => ({ label: t(o.labelKey), value: o.value })))
const statusOptions = computed<SelectItem[]>(() => [
  { label: t('memberships.page.statusFilter.ACTIVE'), value: 'ACTIVE' },
  { label: t('memberships.page.statusFilter.DUE_SOON'), value: 'DUE_SOON' },
  { label: t('memberships.page.statusFilter.OVERDUE'), value: 'OVERDUE' },
  { label: t('memberships.page.statusFilter.SUSPENDED'), value: 'SUSPENDED' },
  { label: t('memberships.page.statusFilter.EXPIRED'), value: 'EXPIRED' },
  { label: t('memberships.page.statusFilter.CANCELED'), value: 'CANCELED' },
])

async function loadFilterOptions() {
  try {
    const [advisors, plans] = await Promise.all([
      promotersApi.list({ size: 100, sort: ['displayName,asc'] }),
      plansApi.options({ limit: 100 }),
    ])
    promoterOptions.value = (advisors.content ?? []).map(a => ({ label: a.displayName, value: a.uuid }))
    planOptions.value = plans.map(p => ({ label: p.label, value: p.uuid }))
  }
  catch {
    // useApi already notified; the filters just stay empty
  }
}

const activeFilterCount = computed(() => Object.values(filters).filter(Boolean).length)

function clearFilters() {
  Object.assign(filters, { promoterUuid: '', planUuid: '', planType: null, status: '', enrolledFrom: '', enrolledTo: '', nextDueFrom: '', nextDueTo: '' })
}

// ---- List ----
const data = ref<MembershipListItemDto[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1) // UPagination is 1-based; the API is 0-based
const size = ref(20)

async function load() {
  loading.value = true
  try {
    const res = await memberships.search({
      page: page.value - 1,
      size: size.value,
      promoterUuid: filters.promoterUuid || undefined,
      planUuid: filters.planUuid || undefined,
      planType: filters.planType || undefined,
      status: filters.status || undefined,
      enrolledFrom: filters.enrolledFrom || undefined,
      enrolledTo: filters.enrolledTo || undefined,
      nextDueFrom: filters.nextDueFrom || undefined,
      nextDueTo: filters.nextDueTo || undefined,
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

watch(filters, () => {
  page.value = 1
  load()
})
watch(page, load)

onMounted(() => {
  load()
  loadFilterOptions()
})

function paymentStatusColor(s?: string | null): 'error' | 'warning' | 'success' | 'neutral' {
  if (s === 'OVERDUE') return 'error'
  if (s === 'DUE_SOON') return 'warning'
  if (s === 'UP_TO_DATE') return 'success'
  return 'neutral'
}
</script>

<template>
  <div class="space-y-5">
    <!-- Header -->
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-extrabold text-prohealth-900">{{ t('memberships.page.title') }}</h1>
        <p class="text-sm text-prohealth-700/70 mt-1">
          {{ t('memberships.page.description') }}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <ReportPrintButton table-name="memberships" />
      </div>
    </div>

    <!-- Affiliate picker + filters -->
    <div class="bg-white rounded-2xl border border-prohealth-100 p-4 space-y-4">
      <UFormField :label="t('memberships.page.searchLabel')" :help="t('memberships.page.searchHelp')">
        <USelectMenu
          clear
          v-model="selectedMemberUuid"
          v-model:search-term="memberSearchTerm"
          :items="memberOptions"
          label-key="label"
          value-key="value"
          ignore-filter
          icon="i-lucide-search"
          :loading="searching"
          :placeholder="t('memberships.page.searchPlaceholder')"
          :search-input="{ placeholder: t('memberships.page.searchPlaceholder'), icon: 'i-lucide-search' }"
          class="w-full sm:max-w-md"
          @update:open="onPickerOpen"
        />
      </UFormField>
      <p v-if="selectedMemberLabel" class="text-xs text-prohealth-500">
        {{ t('memberships.page.managingFor') }} <span class="font-semibold text-prohealth-700">{{ selectedMemberLabel }}</span>.
        <NuxtLink :to="`/dashboard/members/${selectedMemberUuid}`" class="text-cyan-700 hover:underline">{{ t('memberships.page.viewFullRecord') }}</NuxtLink>.
      </p>

      <div v-if="!selectedMemberUuid" class="space-y-3">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <UFormField :label="t('memberships.page.filters.status')">
            <USelectMenu v-model="filters.status" clear :items="statusOptions" label-key="label" value-key="value" :placeholder="t('memberships.page.filters.any')" class="w-full" />
          </UFormField>
          <UFormField :label="t('memberships.page.filters.advisor')">
            <USelectMenu v-model="filters.promoterUuid" clear :items="promoterOptions" label-key="label" value-key="value" :placeholder="t('memberships.page.filters.any')" class="w-full" />
          </UFormField>
          <UFormField :label="t('memberships.page.filters.plan')">
            <USelectMenu v-model="filters.planUuid" clear :items="planOptions" label-key="label" value-key="value" :placeholder="t('memberships.page.filters.any')" class="w-full" />
          </UFormField>
          <UFormField :label="t('memberships.page.filters.planType')">
            <USelectMenu v-model="filters.planType" clear :items="planTypeOptions" label-key="label" value-key="value" :placeholder="t('memberships.page.filters.any')" class="w-full" />
          </UFormField>
        </div>
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <UFormField :label="t('memberships.page.filters.enrolledFrom')"><UInput v-model="filters.enrolledFrom" type="date" class="w-full" /></UFormField>
          <UFormField :label="t('memberships.page.filters.enrolledTo')"><UInput v-model="filters.enrolledTo" type="date" class="w-full" /></UFormField>
          <UFormField :label="t('memberships.page.filters.nextDueFrom')"><UInput v-model="filters.nextDueFrom" type="date" class="w-full" /></UFormField>
          <UFormField :label="t('memberships.page.filters.nextDueTo')"><UInput v-model="filters.nextDueTo" type="date" class="w-full" /></UFormField>
        </div>
        <UButton v-if="activeFilterCount > 0" color="neutral" variant="ghost" size="sm" icon="i-lucide-filter-x" @click="clearFilters">
          {{ t('memberships.page.filters.clear') }} ({{ activeFilterCount }})
        </UButton>
      </div>
    </div>

    <!-- Memberships of the selected member -->
    <MemberMembershipsCard v-if="selectedMemberUuid" :key="selectedMemberUuid" :member-uuid="selectedMemberUuid" />

    <!-- Filtered cross-member list -->
    <div v-else class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden flex flex-col">
      <div class="overflow-auto">
        <table class="w-full text-sm">
          <thead class="sticky top-0 bg-white z-10">
            <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
              <th class="px-5 py-3 font-semibold">{{ t('memberships.page.columns.member') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('memberships.page.columns.advisor') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('memberships.page.columns.plan') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('memberships.page.columns.enrolledAt') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('memberships.page.columns.nextDueDate') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('memberships.page.columns.status') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('memberships.page.columns.collection') }}</th>
              <th class="px-5 py-3 font-semibold text-right">{{ t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-prohealth-100">
            <TableSkeleton v-if="loading" :rows="8" :cols="8" />
            <tr v-else-if="data.length === 0">
              <td colspan="8" class="px-5 py-12 text-center text-prohealth-500">
                <UIcon name="i-lucide-badge-check" class="w-8 h-8 mx-auto mb-2 text-prohealth-300" />
                {{ t('memberships.page.emptyList') }}
              </td>
            </tr>
            <tr v-for="m in data" v-else :key="m.uuid" class="hover:bg-prohealth-50/50">
              <td class="px-5 py-3 text-prohealth-900 font-medium">
                {{ m.member_Display ?? m.member_Code }}
                <span v-if="m.contractNumber" class="block text-xs font-mono font-normal text-prohealth-500">{{ m.contractNumber }}</span>
              </td>
              <td class="px-5 py-3 text-prohealth-600">{{ m.advisor_Display ?? t('common.empty') }}</td>
              <td class="px-5 py-3 text-prohealth-700">
                {{ m.planName }}
                <span class="block text-xs text-prohealth-400">{{ m.planType_Display ?? m.planType }}</span>
              </td>
              <td class="px-5 py-3 text-prohealth-600">{{ m.enrolledAt_Display ?? formatDate(m.enrolledAt, 'short') }}</td>
              <td class="px-5 py-3 text-prohealth-600">{{ m.nextDueDate_Display ?? formatDate(m.nextDueDate, 'short') }}</td>
              <td class="px-5 py-3">
                <UBadge :color="membershipStatusColor(m.status)" variant="subtle" size="sm">
                  {{ m.status_Display ?? t(`memberships.status.${m.status}`, m.status) }}
                </UBadge>
              </td>
              <td class="px-5 py-3">
                <UBadge v-if="m.paymentStatus" :color="paymentStatusColor(m.paymentStatus)" variant="subtle" size="sm">
                  {{ t(`memberships.page.paymentStatus.${m.paymentStatus}`, { days: m.daysOverdue }) }}
                </UBadge>
                <span v-else class="text-prohealth-400">{{ t('common.empty') }}</span>
              </td>
              <td class="px-5 py-3 text-right">
                <UButton color="neutral" variant="ghost" size="sm" icon="i-lucide-settings-2" :title="t('memberships.page.manage')" @click="selectedMemberUuid = m.memberUuid; memberOptions = [{ label: m.member_Display ?? m.member_Code ?? '', value: m.memberUuid }, ...memberOptions]" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="flex items-center justify-between gap-3 px-5 py-3 border-t border-prohealth-100">
        <p class="text-xs text-prohealth-500">{{ t('catalogs.recordCount', { count: total }) }}</p>
        <UPagination v-model:page="page" :total="total" :items-per-page="size" />
      </div>
    </div>
  </div>
</template>
