<script setup lang="ts">
import { z } from 'zod'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { buildPageSizeItems, DEFAULT_PAGE_SIZE, UNPAGED_PAGE_SIZE } from '~/utils/pagination'
import type { ListFilterField } from '~/utils/listFilters'
import { countActiveFilters, emptyListFilters, listFilterQuery } from '~/utils/listFilters'
import type {
  DistributeRequest,
  DistributionCandidateDto,
  DistributionFilter,
  DistributionMode,
  DistributionResultDto,
  DistributionSource,
} from '~/types/portfolioDistribution'
import { DISTRIBUTION_MAX_MEMBERS, DISTRIBUTION_MAX_TARGETS } from '~/types/portfolioDistribution'

// Portfolio distribution (MEMBER_ASSIGN_PROMOTER): takes the members with no advisor (null or the
// INSTITUCION system advisor) or the portfolio of one advisor (even an inactive one) and spreads
// them among one or several active advisors, in equal parts (round-robin) or by count. The backend
// does the split; this page only picks the selection, shows the preview and confirms it.
//
// Query params (deep links from the members list and the advisor detail):
//   ?source=UNASSIGNED · ?source=ADVISOR&advisor=<uuid> · ?members=<uuid,uuid> (preselected rows)
definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'MEMBER_ASSIGN_PROMOTER',
})

const { t } = useI18n()
const { formatDate } = useFormatters()
const { can } = usePermissions()
const toast = useToast()
const route = useRoute()
const members = useMembers()
const promotersApi = usePromoters()

useSeoMeta({ title: () => t('common.seoTitle', { page: t('portfolioDistribution.title') }) })

const canViewMember = computed(() => can('MEMBER_VIEW_ALL'))
const canViewPromoter = computed(() => can('PROMOTER_VIEW_ALL'))

// ---- 1. Origin ----
const source = ref<DistributionSource>('UNASSIGNED')
const sourceAdvisor = ref<string | undefined>(undefined)
const sourceItems = computed(() => [
  { value: 'UNASSIGNED', label: t('portfolioDistribution.origin.unassigned'), description: t('portfolioDistribution.origin.unassignedHelp') },
  { value: 'ADVISOR', label: t('portfolioDistribution.origin.advisor'), description: t('portfolioDistribution.origin.advisorHelp') },
])

function advisorLabel(o: { label: string, active: boolean }): string {
  return o.active ? o.label : `${o.label} (${t('portfolioDistribution.inactive')})`
}

// Origin advisor: inactive advisors and INSTITUCION included (an advisor who left still has members).
const sourceAdvisorOptions = useLazyOptions(async q =>
  (await promotersApi.options({
    q,
    includeSystem: true,
    includeInactive: true,
    currentValues: sourceAdvisor.value ? [sourceAdvisor.value] : undefined,
  })).map(o => ({ label: advisorLabel(o), value: o.uuid })))

const needsAdvisor = computed(() => source.value === 'ADVISOR' && !sourceAdvisor.value)

// ---- 2. Members (candidates) ----
const rows = ref<DistributionCandidateDto[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1) // UPagination is 1-based; the API is 0-based
const size = ref(DEFAULT_PAGE_SIZE)
// No "all" option: the candidates can be thousands; "select all N results" covers that case.
const pageSizeItems = buildPageSizeItems(t).filter(i => i.value !== UNPAGED_PAGE_SIZE)
const search = ref('')

const plans = useLazyOptions(async q =>
  (await usePlans().options({ q })).map(o => ({ label: o.label, value: o.uuid })))

const filterFields = computed<ListFilterField[]>(() => [
  { key: 'planUuid', label: t('portfolioDistribution.members.filters.plan'), icon: 'i-lucide-package', lazy: plans },
  {
    key: 'status',
    label: t('portfolioDistribution.members.filters.status'),
    icon: 'i-lucide-activity',
    items: ['ACTIVE', 'SUSPENDED', 'INACTIVE'].map(s => ({ label: t(`members.status.${s}`), value: s })),
    class: 'w-44',
  },
])
const filters = ref(emptyListFilters(filterFields.value))
const activeFilterCount = computed(() => countActiveFilters(filters.value, search.value.trim()))

/** The candidates filter as the backend reads it — also the `filter` of "select all N results". */
function currentFilter(): DistributionFilter {
  const f = listFilterQuery(filters.value)
  const q = search.value.trim()
  return {
    source: source.value,
    ...(source.value === 'ADVISOR' && sourceAdvisor.value ? { sourcePromoterUuid: sourceAdvisor.value } : {}),
    ...(q ? { q } : {}),
    ...(f.planUuid ? { planUuid: f.planUuid } : {}),
    ...(f.status ? { status: f.status } : {}),
  }
}

async function load() {
  if (needsAdvisor.value) {
    rows.value = []
    total.value = 0
    return
  }
  loading.value = true
  try {
    const res = await members.distributionCandidates({ page: page.value - 1, size: size.value, ...currentFilter() })
    rows.value = res.content ?? []
    total.value = res.totalElements ?? 0
  }
  catch {
    // useApi already shows the error toast
    rows.value = []
    total.value = 0
  }
  finally {
    loading.value = false
  }
}

// ---- Selection ----
// Two modes: the ticked uuids (`memberUuids`), or every result of the current filter
// (`filter`) where `picked` holds the rows the user unticked (`excludeMemberUuids`).
const allMatching = ref(false)
const picked = ref<Set<string>>(new Set())

const selectedCount = computed(() => (allMatching.value ? Math.max(total.value - picked.value.size, 0) : picked.value.size))
const overLimit = computed(() => selectedCount.value > DISTRIBUTION_MAX_MEMBERS)

function isChecked(uuid: string): boolean {
  return allMatching.value ? !picked.value.has(uuid) : picked.value.has(uuid)
}

function setChecked(next: Set<string>, uuid: string, checked: boolean) {
  // In "all results" mode `picked` lists the exclusions, so ticking removes from it.
  const add = allMatching.value ? !checked : checked
  if (add) next.add(uuid)
  else next.delete(uuid)
}

function toggleRow(uuid: string, checked: boolean) {
  const next = new Set(picked.value)
  setChecked(next, uuid, checked)
  picked.value = next
}

const pageChecked = computed(() => rows.value.length > 0 && rows.value.every(r => isChecked(r.uuid)))
const pageCheckState = computed<boolean | 'indeterminate'>(() =>
  pageChecked.value ? true : (rows.value.some(r => isChecked(r.uuid)) ? 'indeterminate' : false))

function togglePage(checked: boolean) {
  const next = new Set(picked.value)
  for (const r of rows.value) setChecked(next, r.uuid, checked)
  picked.value = next
}

function selectAllMatching() {
  allMatching.value = true
  picked.value = new Set()
}

function clearSelection() {
  allMatching.value = false
  picked.value = new Set()
}

// ---- Reloads ----
// Set while the query params are applied, so the watchers don't fire a load each.
const initializing = ref(true)

/** A new origin/filter is a new set of results: the selection no longer applies. */
function reloadFromFirstPage() {
  clearSelection()
  if (page.value !== 1) page.value = 1 // the page watcher loads
  else load()
}

watch(size, () => { if (!initializing.value) page.value = 1 })
watch([page, size], () => { if (!initializing.value) load() })
watch([source, sourceAdvisor, filters], () => { if (!initializing.value) reloadFromFirstPage() })
const debouncedSearch = useTableFilterDebounce(() => reloadFromFirstPage())
watch(search, () => { if (!initializing.value) debouncedSearch() })

function clearFilters() {
  initializing.value = true
  search.value = ''
  filters.value = emptyListFilters(filterFields.value)
  nextTick(() => {
    initializing.value = false
    reloadFromFirstPage()
  })
}

// ---- 3. Targets (vee-validate + zod, spec 07-forms) ----
interface TargetRow {
  promoterUuid: string
  label: string
  count?: number | null
}

const validationSchema = computed(() => toTypedSchema(
  z.object({
    targets: z.array(z.object({
      promoterUuid: z.string(),
      label: z.string(),
      count: z.number().nullable().optional(),
    }))
      .min(1, t('portfolioDistribution.errors.targetsRequired'))
      .max(DISTRIBUTION_MAX_TARGETS, t('portfolioDistribution.errors.targetsMax', { n: DISTRIBUTION_MAX_TARGETS })),
    mode: z.enum(['EQUAL', 'COUNT']),
    reason: z.string().trim()
      .min(3, t('validation.minChars', { n: 3 }))
      .max(500, t('validation.maxChars', { n: 500 })),
  }).superRefine((v, ctx) => {
    if (v.mode !== 'COUNT') return
    let sum = 0
    v.targets.forEach((row, i) => {
      if (row.count == null || !Number.isInteger(row.count) || row.count < 1) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['targets', i, 'count'], message: t('portfolioDistribution.errors.countMin') })
      }
      else {
        sum += row.count
      }
    })
    // Format check only (the backend validates again): the counts cannot exceed the selection.
    if (sum > selectedCount.value) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['targets'],
        message: t('portfolioDistribution.errors.countSum', { sum, selected: selectedCount.value }),
      })
    }
  }),
))

const { handleSubmit, errors, defineField, resetForm } = useForm({
  validationSchema,
  initialValues: { targets: [] as TargetRow[], mode: 'EQUAL' as DistributionMode, reason: '' },
})

const [targets] = defineField('targets')
const [mode] = defineField('mode')
const [reason, reasonAttrs] = defineField('reason')

const fieldErrors = computed(() => errors.value as Record<string, string | undefined>)

const modeItems = computed(() => [
  { value: 'EQUAL', label: t('portfolioDistribution.targets.modes.EQUAL'), description: t('portfolioDistribution.targets.modeHelp.EQUAL') },
  { value: 'COUNT', label: t('portfolioDistribution.targets.modes.COUNT'), description: t('portfolioDistribution.targets.modeHelp.COUNT') },
])

// Targets: active, non-system advisors (the `/options` default) other than the origin one.
const targetOptions = useLazyOptions(async q =>
  (await promotersApi.options({ q }))
    .filter(o => o.active && !(source.value === 'ADVISOR' && o.uuid === sourceAdvisor.value))
    .map(o => ({ label: o.label, value: o.uuid })))

const targetUuids = computed<string[]>({
  get: () => (targets.value ?? []).map(r => r.promoterUuid),
  set: (uuids) => {
    const list = uuids ?? []
    const previous = new Map((targets.value ?? []).map(r => [r.promoterUuid, r]))
    targets.value = list.map(uuid => previous.get(uuid)
      ?? { promoterUuid: uuid, label: targetOptions.items.value.find(i => i.value === uuid)?.label ?? uuid, count: null })
    targetOptions.remember(list)
  },
})

function setCount(index: number, value: number | null | undefined) {
  targets.value = (targets.value ?? []).map((r, i) => (i === index ? { ...r, count: value ?? null } : r))
}

function removeTarget(uuid: string) {
  targetUuids.value = targetUuids.value.filter(u => u !== uuid)
}

const countsSum = computed(() => (targets.value ?? []).reduce((n, r) => n + (r.count ?? 0), 0))

// ---- 4. Preview → confirm ----
const preview = ref<DistributionResultDto | null>(null)
const previewOpen = ref(false)
const pendingBody = ref<DistributeRequest | null>(null)
const previewing = ref(false)
const distributing = ref(false)

function buildBody(v: { targets: TargetRow[], mode: DistributionMode, reason: string }): DistributeRequest {
  const selection: Pick<DistributeRequest, 'memberUuids' | 'filter' | 'excludeMemberUuids'> = allMatching.value
    ? { filter: currentFilter(), ...(picked.value.size ? { excludeMemberUuids: [...picked.value] } : {}) }
    : { memberUuids: [...picked.value] }
  return {
    ...selection,
    mode: v.mode,
    reason: v.reason.trim(),
    targets: v.targets.map(r => (v.mode === 'COUNT'
      ? { promoterUuid: r.promoterUuid, count: r.count ?? undefined }
      : { promoterUuid: r.promoterUuid })),
  }
}

const onPreview = handleSubmit(async (values) => {
  if (selectedCount.value === 0) {
    toast.add({ title: t('portfolioDistribution.errors.noSelection'), color: 'warning', icon: 'i-lucide-info' })
    return
  }
  if (overLimit.value) {
    toast.add({ title: t('portfolioDistribution.members.maxWarning', { max: DISTRIBUTION_MAX_MEMBERS }), color: 'warning', icon: 'i-lucide-info' })
    return
  }
  const body = buildBody(values as { targets: TargetRow[], mode: DistributionMode, reason: string })
  previewing.value = true
  try {
    preview.value = await members.distributePreview(body)
    pendingBody.value = body
    previewOpen.value = true
  }
  catch {
    // useApi already toasted the backend's reason (limits, inactive target…)
  }
  finally {
    previewing.value = false
  }
})

async function confirmDistribute() {
  if (!pendingBody.value) return
  distributing.value = true
  try {
    const res = await members.distribute(pendingBody.value)
    toast.add({
      title: t('portfolioDistribution.doneToast', { total: res.total, targets: res.targets.length }),
      description: res.skipped ? t('portfolioDistribution.doneSkipped', { skipped: res.skipped }) : undefined,
      color: 'success',
      icon: 'i-lucide-check-circle',
    })
    previewOpen.value = false
    pendingBody.value = null
    clearSelection()
    resetForm()
    await load()
  }
  catch {
    // useApi already toasted the backend's reason
  }
  finally {
    distributing.value = false
  }
}

// ---- Presentation helpers ----
function statusLabel(s?: string | null): string {
  return s ? t(`members.status.${s}`, s) : t('common.empty')
}

function statusColor(s?: string | null): 'success' | 'warning' | 'neutral' {
  if (s === 'ACTIVE') return 'success'
  if (s === 'SUSPENDED') return 'warning'
  return 'neutral'
}

// ---- Deep links ----
onMounted(async () => {
  const q = route.query
  const advisor = typeof q.advisor === 'string' && q.advisor ? q.advisor : undefined
  if (q.source === 'ADVISOR' || advisor) {
    source.value = 'ADVISOR'
    sourceAdvisor.value = advisor
  }
  if (typeof q.members === 'string' && q.members) {
    picked.value = new Set(q.members.split(',').map(s => s.trim()).filter(Boolean))
  }
  // Resolve the label of a preselected origin advisor.
  if (sourceAdvisor.value) void sourceAdvisorOptions.ensureLoaded()
  await nextTick()
  initializing.value = false
  await load()
})
</script>

<template>
  <div class="space-y-5">
    <!-- Header -->
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-extrabold text-prohealth-900">{{ t('portfolioDistribution.title') }}</h1>
        <p class="text-sm text-prohealth-700/70 mt-1">{{ t('portfolioDistribution.subtitle') }}</p>
      </div>
      <UButton color="neutral" variant="ghost" icon="i-lucide-arrow-left" to="/dashboard/advisors">
        {{ t('promoters.title') }}
      </UButton>
    </div>

    <!-- 1. Origin -->
    <section class="bg-white rounded-2xl border border-prohealth-100 p-6 space-y-4">
      <h2 class="text-lg font-bold text-prohealth-900">{{ t('portfolioDistribution.origin.title') }}</h2>
      <URadioGroup v-model="source" :items="sourceItems" orientation="horizontal" />
      <UFormField v-if="source === 'ADVISOR'" :label="t('portfolioDistribution.origin.advisorLabel')" required class="max-w-md">
        <USelectMenu
          v-model="sourceAdvisor"
          v-model:search-term="sourceAdvisorOptions.searchTerm.value"
          clear
          :items="sourceAdvisorOptions.items.value"
          :loading="sourceAdvisorOptions.loading.value"
          ignore-filter
          label-key="label"
          value-key="value"
          icon="i-lucide-user-round"
          :placeholder="t('portfolioDistribution.origin.advisorPlaceholder')"
          class="w-full"
          @update:open="sourceAdvisorOptions.onOpen"
          @update:model-value="sourceAdvisorOptions.remember($event)"
        />
      </UFormField>
    </section>

    <!-- 2. Members -->
    <section class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden">
      <div class="px-6 pt-6 pb-4 space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h2 class="text-lg font-bold text-prohealth-900">{{ t('portfolioDistribution.members.title') }}</h2>
          <RefreshButton :loading="loading" :title="t('common.refreshSection')" @refresh="load" />
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <UInput
            v-model="search"
            :placeholder="t('portfolioDistribution.members.searchPlaceholder')"
            icon="i-lucide-search"
            class="w-full max-w-sm"
            :disabled="needsAdvisor"
          />
          <ListFilterBar v-model="filters" :fields="filterFields" />
          <UButton v-if="activeFilterCount > 0" variant="link" color="neutral" size="sm" icon="i-lucide-x" @click="clearFilters">
            {{ t('common.clearFilters') }}
          </UButton>
        </div>

        <!-- Selection summary -->
        <div
          v-if="selectedCount > 0 || (pageChecked && total > rows.length)"
          class="flex flex-wrap items-center gap-3 rounded-lg bg-prohealth-50 px-4 py-2 text-sm text-prohealth-800"
        >
          <span v-if="allMatching">{{ t('portfolioDistribution.members.allSelected', { count: selectedCount }) }}</span>
          <span v-else>{{ t('portfolioDistribution.members.selectedCount', { count: selectedCount }) }}</span>
          <UButton
            v-if="!allMatching && pageChecked && total > rows.length"
            variant="link"
            size="sm"
            @click="selectAllMatching"
          >
            {{ t('portfolioDistribution.members.selectAll', { total }) }}
          </UButton>
          <UButton v-if="selectedCount > 0" variant="link" color="neutral" size="sm" @click="clearSelection">
            {{ t('portfolioDistribution.members.clearSelection') }}
          </UButton>
        </div>
        <UAlert
          v-if="overLimit"
          color="warning"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          :title="t('portfolioDistribution.members.maxWarning', { max: DISTRIBUTION_MAX_MEMBERS })"
        />
      </div>

      <div class="overflow-x-auto border-t border-prohealth-100">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
              <th class="pl-6 py-3 w-8">
                <UCheckbox
                  :model-value="pageCheckState"
                  :disabled="rows.length === 0"
                  :aria-label="t('portfolioDistribution.members.selectPage')"
                  :title="t('portfolioDistribution.members.selectPage')"
                  @update:model-value="togglePage($event === true)"
                />
              </th>
              <th class="px-5 py-3 font-semibold">{{ t('portfolioDistribution.members.columns.member') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('portfolioDistribution.members.columns.document') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('portfolioDistribution.members.columns.plan') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('portfolioDistribution.members.columns.status') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('portfolioDistribution.members.columns.advisor') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('portfolioDistribution.members.columns.createdAt') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-prohealth-100">
            <TableSkeleton v-if="loading" :rows="6" :cols="7" />
            <tr v-else-if="needsAdvisor">
              <td colspan="7" class="px-5 py-12 text-center text-prohealth-500">
                <UIcon name="i-lucide-user-round-search" class="w-8 h-8 mx-auto mb-2 text-prohealth-300" />
                {{ t('portfolioDistribution.origin.pickAdvisor') }}
              </td>
            </tr>
            <tr v-else-if="rows.length === 0">
              <td colspan="7" class="px-5 py-12 text-center text-prohealth-500">
                <UIcon name="i-lucide-users" class="w-8 h-8 mx-auto mb-2 text-prohealth-300" />
                {{ t('portfolioDistribution.members.empty') }}
              </td>
            </tr>
            <tr
              v-for="r in rows"
              v-else
              :key="r.uuid"
              class="hover:bg-prohealth-50/50 cursor-pointer"
              @click="toggleRow(r.uuid, !isChecked(r.uuid))"
            >
              <td class="pl-6 py-3 w-8" @click.stop>
                <UCheckbox
                  :model-value="isChecked(r.uuid)"
                  :aria-label="r.displayName"
                  @update:model-value="toggleRow(r.uuid, $event === true)"
                />
              </td>
              <td class="px-5 py-3 font-semibold" @click.stop>
                <CommonEntityLinkCell :to="`/dashboard/members/${r.uuid}`" :label="r.displayName" :can="canViewMember" />
              </td>
              <td class="px-5 py-3 text-prohealth-700">{{ r.document || t('common.empty') }}</td>
              <td class="px-5 py-3 text-prohealth-700">{{ r.plan_Display || t('common.empty') }}</td>
              <td class="px-5 py-3">
                <UBadge :color="statusColor(r.status)" variant="subtle" size="sm">{{ statusLabel(r.status) }}</UBadge>
              </td>
              <td class="px-5 py-3 text-prohealth-700" @click.stop>
                <CommonEntityLinkCell
                  v-if="r.promoter_Uuid"
                  :to="`/dashboard/advisors/${r.promoter_Uuid}`"
                  :label="r.promoter_Display"
                  :can="canViewPromoter"
                />
                <span v-else class="text-prohealth-400">{{ t('portfolioDistribution.unassigned') }}</span>
              </td>
              <td class="px-5 py-3 text-prohealth-600">{{ r.createdAt ? formatDate(r.createdAt) : t('common.empty') }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="flex items-center flex-wrap justify-between gap-3 px-6 py-3 border-t border-prohealth-100">
        <p class="text-xs text-prohealth-500">
          {{ t('portfolioDistribution.members.paginationSummary', { shown: rows.length, total }) }}
        </p>
        <div class="flex items-center gap-3">
          <UPagination v-model:page="page" :total="total" :items-per-page="size" />
          <UTooltip :text="$t('catalogs.pageSizeLabel')">
            <USelectMenu
              v-model="size"
              clear
              :items="pageSizeItems"
              label-key="label"
              value-key="value"
              icon="i-lucide-list"
              :aria-label="$t('catalogs.pageSizeLabel')"
              class="w-40"
              :reset-model-value-on-clear="false"
              @clear="size = DEFAULT_PAGE_SIZE"
            />
          </UTooltip>
        </div>
      </div>
    </section>

    <!-- 3. Targets + 4. Preview -->
    <form class="bg-white rounded-2xl border border-prohealth-100 p-6 space-y-5" @submit.prevent="onPreview">
      <h2 class="text-lg font-bold text-prohealth-900">{{ t('portfolioDistribution.targets.title') }}</h2>

      <UFormField :label="t('portfolioDistribution.targets.advisors')" required :error="fieldErrors.targets" class="max-w-2xl">
        <USelectMenu
          v-model="targetUuids"
          v-model:search-term="targetOptions.searchTerm.value"
          multiple
          clear
          :items="targetOptions.items.value"
          :loading="targetOptions.loading.value"
          ignore-filter
          label-key="label"
          value-key="value"
          icon="i-lucide-users"
          :placeholder="t('portfolioDistribution.targets.advisorsPlaceholder')"
          class="w-full"
          @update:open="targetOptions.onOpen"
        />
      </UFormField>

      <UFormField :label="t('portfolioDistribution.targets.mode')">
        <URadioGroup v-model="mode" :items="modeItems" orientation="horizontal" />
      </UFormField>

      <div v-if="(targets ?? []).length" class="rounded-xl border border-prohealth-100 divide-y divide-prohealth-100 max-w-2xl">
        <div v-for="(row, i) in targets" :key="row.promoterUuid" class="flex flex-wrap items-center justify-between gap-3 px-4 py-2">
          <span class="text-sm font-medium text-prohealth-900">{{ row.label }}</span>
          <div class="flex items-center gap-2">
            <UFormField v-if="mode === 'COUNT'" :error="fieldErrors[`targets[${i}].count`]" class="w-36">
              <UInputNumber
                :model-value="row.count ?? undefined"
                :min="1"
                :step="1"
                :aria-label="t('portfolioDistribution.targets.count')"
                :placeholder="t('portfolioDistribution.targets.count')"
                class="w-full"
                @update:model-value="setCount(i, $event)"
              />
            </UFormField>
            <UButton
              color="neutral"
              variant="ghost"
              size="sm"
              icon="i-lucide-x"
              :aria-label="t('common.delete')"
              @click="removeTarget(row.promoterUuid)"
            />
          </div>
        </div>
        <p v-if="mode === 'COUNT'" class="px-4 py-2 text-xs text-prohealth-500">
          {{ t('portfolioDistribution.targets.countsTotal', { sum: countsSum, selected: selectedCount }) }}
        </p>
      </div>

      <UFormField :label="t('portfolioDistribution.targets.reason')" required :error="fieldErrors.reason" class="max-w-2xl">
        <UTextarea
          v-model="reason"
          v-bind="reasonAttrs"
          :rows="3"
          :maxlength="500"
          :placeholder="t('portfolioDistribution.targets.reasonPlaceholder')"
          class="w-full"
        />
      </UFormField>

      <p class="text-xs text-prohealth-500 max-w-2xl">{{ t('promoters.portfolio.historyNotice') }}</p>

      <div class="flex flex-wrap items-center justify-end gap-3">
        <span class="text-sm text-prohealth-600">{{ t('portfolioDistribution.members.selectedCount', { count: selectedCount }) }}</span>
        <UButton
          type="submit"
          color="primary"
          icon="i-lucide-eye"
          :loading="previewing"
          :disabled="selectedCount === 0 || overLimit"
        >
          {{ t('portfolioDistribution.preview.button') }}
        </UButton>
      </div>
    </form>

    <!-- Preview → confirm -->
    <UModal v-model:open="previewOpen" :title="t('portfolioDistribution.preview.title')">
      <template #body>
        <div v-if="preview" class="space-y-4">
          <p class="text-sm text-prohealth-700">
            {{ t('portfolioDistribution.preview.notice', { total: preview.total }) }}
          </p>
          <p v-if="preview.skipped" class="text-sm text-amber-700">
            {{ t('portfolioDistribution.doneSkipped', { skipped: preview.skipped }) }}
          </p>
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
                <th class="py-2 font-semibold">{{ t('portfolioDistribution.preview.columns.advisor') }}</th>
                <th class="py-2 font-semibold text-right">{{ t('portfolioDistribution.preview.columns.count') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-prohealth-100">
              <tr v-for="tg in preview.targets" :key="tg.promoterUuid">
                <td class="py-2 text-prohealth-900">{{ tg.promoterDisplay }}</td>
                <td class="py-2 text-right font-semibold text-prohealth-900">{{ tg.count }}</td>
              </tr>
            </tbody>
          </table>
          <div class="flex items-center justify-end gap-3 pt-1">
            <UButton color="neutral" variant="ghost" :disabled="distributing" @click="previewOpen = false">
              {{ t('common.cancel') }}
            </UButton>
            <UButton
              color="primary"
              icon="i-lucide-check"
              :loading="distributing"
              :disabled="preview.total === 0"
              @click="confirmDistribute"
            >
              {{ t('portfolioDistribution.preview.confirm') }}
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
