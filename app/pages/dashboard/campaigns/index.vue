<script setup lang="ts">
import { buildPageSizeItems, DEFAULT_PAGE_SIZE, UNPAGED_PAGE_SIZE } from '~/utils/pagination'
import type { SortDirection } from '~/composables/useTableSort'
import type { CampaignDto } from '~/types/campaign'
import { CAMPAIGN_MODE_OPTIONS, CAMPAIGN_SCOPE_OPTIONS } from '~/types/campaign'

// List screen for commission campaigns (hub plan "commission campaigns").
// Follows the same table/pagination shape as catalogs/[resource].vue.
definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'CAMPAIGN_VIEW_ALL',
})

const { t } = useI18n()
const { formatDate } = useFormatters()
const { can } = usePermissions()
const toast = useToast()

useSeoMeta({ title: () => t('common.seoTitle', { page: t('nav.items.campaigns.label') }) })

const canCreate = computed(() => can('CAMPAIGN_CREATE'))
const canUpdate = computed(() => can('CAMPAIGN_UPDATE'))
const canDelete = computed(() => can('CAMPAIGN_DELETE'))

const campaignsApi = useCampaigns()

const items = ref<CampaignDto[]>([])
const total = ref(0)
const loading = ref(false)
const search = ref('')
const includeInactive = ref(false)
const page = ref(1)
const pageSize = ref(DEFAULT_PAGE_SIZE)
const pageSizeItems = buildPageSizeItems(t)

const sort = useTableSort([])
const hasActiveSort = computed(() => sort.hasActiveSort.value)
const isMultiSort = computed(() => sort.orders.value.length > 1)

const resetting = ref(false)

async function load() {
  loading.value = true
  try {
    const res = await campaignsApi.list({
      page: page.value - 1,
      size: pageSize.value,
      sort: sort.sortParam.value,
      q: search.value.trim() || undefined,
      includeInactive: includeInactive.value,
    })
    items.value = res.content ?? []
    total.value = res.totalElements ?? 0
    if (sort.orders.value.length === 0 && res.appliedSort?.length) {
      resetting.value = true
      sort.seedServerDefault(res.appliedSort.map(o => ({ field: o.field, direction: o.direction.toLowerCase() as SortDirection })))
      await nextTick()
      resetting.value = false
    }
  }
  catch {
    items.value = []
    total.value = 0
  }
  finally {
    loading.value = false
  }
}

watch(pageSize, () => { if (!resetting.value) page.value = 1 })
watch([page, pageSize], () => { if (!resetting.value) load() })
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, () => {
  if (resetting.value) return
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { page.value = 1; load() }, 400)
})
watch(includeInactive, () => { if (!resetting.value) { page.value = 1; load() } })
watch(sort.orders, () => { if (!resetting.value) load() }, { deep: true })

async function resetFilters() {
  resetting.value = true
  search.value = ''
  includeInactive.value = false
  sort.reset()
  pageSize.value = DEFAULT_PAGE_SIZE
  page.value = 1
  await nextTick()
  resetting.value = false
  load()
}

function scopeLabel(c: CampaignDto): string {
  const opt = CAMPAIGN_SCOPE_OPTIONS.find(o => o.value === c.scope)
  const base = opt ? t(opt.labelKey) : c.scope
  if (c.scope === 'ALL') return base
  return `${base} (${c.audienceCount ?? 0})`
}

function modeLabel(c: CampaignDto): string {
  const opt = CAMPAIGN_MODE_OPTIONS.find(o => o.value === c.mode)
  return opt ? t(opt.labelKey) : c.mode
}

function vigencyLabel(c: CampaignDto): string {
  return `${formatDate(c.startsAt)} — ${formatDate(c.endsAt)}`
}

// ---- Quick create/edit modal ----
const formOpen = ref(false)
const editingCampaign = ref<CampaignDto | null>(null)
function openCreate() { editingCampaign.value = null; formOpen.value = true }
function openQuickEdit(c: CampaignDto) { editingCampaign.value = c; formOpen.value = true }
async function onSaved() { formOpen.value = false; await load() }

// ---- Delete ----
const deleteOpen = ref(false)
const deleting = ref(false)
const target = ref<CampaignDto | null>(null)

function openDelete(c: CampaignDto) {
  target.value = c
  deleteOpen.value = true
}

async function confirmDelete() {
  if (!target.value) return
  deleting.value = true
  try {
    await campaignsApi.remove(target.value.uuid)
    toast.add({
      title: t('campaigns.deletedToast'),
      color: 'success',
      icon: 'i-lucide-check-circle',
    })
    deleteOpen.value = false
    await load()
  }
  catch { /* toast handled by useApi */ }
  finally { deleting.value = false }
}

onMounted(load)
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-extrabold text-prohealth-900">{{ t('campaigns.title') }}</h1>
        <p class="text-sm text-prohealth-700/70 mt-1">{{ t('campaigns.subtitle') }}</p>
      </div>
      <div class="flex items-center gap-2">
        <ListRefreshMenu :loading="loading" variant="ghost" @refresh="load" @reset="resetFilters" />
        <UButton v-if="canCreate" color="primary" variant="outline" icon="i-lucide-plus" @click="openCreate">
          {{ t('common.new') }}
        </UButton>
      </div>
    </div>

    <div class="bg-white rounded-2xl border border-prohealth-100 p-4 flex flex-wrap items-center gap-3">
      <UInput
        v-model="search"
        :placeholder="t('campaigns.searchPlaceholder')"
        icon="i-lucide-search"
        size="lg"
        class="w-full max-w-md"
      />
      <UCheckbox v-model="includeInactive" :label="t('catalogs.includeInactive')" class="self-center" />
      <UButton
        v-if="hasActiveSort"
        variant="link"
        color="neutral"
        size="sm"
        icon="i-lucide-list-restart"
        :title="t('common.clearSortHint')"
        @click="sort.reset()"
      >
        {{ t('common.clearSort') }}
      </UButton>
    </div>

    <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-prohealth-50/60">
          <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
            <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('name')">
              {{ t('campaigns.columns.name') }}
              <SortIndicator :state="sort.stateOf('name')" :multi-active="isMultiSort" @clear="sort.remove('name')" />
            </th>
            <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('startsAt')">
              {{ t('campaigns.columns.vigency') }}
              <SortIndicator :state="sort.stateOf('startsAt')" :multi-active="isMultiSort" @clear="sort.remove('startsAt')" />
            </th>
            <th class="px-5 py-3 font-semibold">{{ t('campaigns.columns.scope') }}</th>
            <th class="px-5 py-3 font-semibold">{{ t('campaigns.columns.mode') }}</th>
            <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('active')">
              {{ t('catalogs.columns.status') }}
              <SortIndicator :state="sort.stateOf('active')" :multi-active="isMultiSort" @clear="sort.remove('active')" />
            </th>
            <th class="px-5 py-3 font-semibold text-right">{{ t('common.actions') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-prohealth-100">
          <TableSkeleton v-if="loading" :rows="4" :cols="6" />
          <tr v-else-if="items.length === 0">
            <td colspan="6" class="px-5 py-10 text-center text-prohealth-500">{{ t('campaigns.empty') }}</td>
          </tr>
          <tr
            v-for="c in items"
            v-else
            :key="c.uuid"
            class="hover:bg-prohealth-50/50"
            :class="{ 'opacity-60': !c.active }"
          >
            <td class="px-5 py-3 font-medium text-prohealth-900">
              <NuxtLink :to="`/dashboard/campaigns/${c.uuid}`" class="hover:underline">{{ c.name }}</NuxtLink>
            </td>
            <td class="px-5 py-3 text-prohealth-600">{{ vigencyLabel(c) }}</td>
            <td class="px-5 py-3 text-prohealth-600">{{ scopeLabel(c) }}</td>
            <td class="px-5 py-3">
              <UBadge :color="c.mode === 'TARGETED' ? 'primary' : 'neutral'" variant="subtle" size="sm">{{ modeLabel(c) }}</UBadge>
            </td>
            <td class="px-5 py-3">
              <UBadge :color="c.active ? 'success' : 'neutral'" variant="subtle" size="sm">
                {{ c.active ? t('catalogs.status.active') : t('catalogs.status.inactive') }}
              </UBadge>
            </td>
            <td class="px-5 py-3">
              <div class="flex items-center justify-end gap-1">
                <UTooltip :text="t('campaigns.viewDetail')">
                  <UButton color="neutral" variant="ghost" icon="i-lucide-file-search" size="sm" :to="`/dashboard/campaigns/${c.uuid}`" />
                </UTooltip>
                <UButton v-if="canUpdate" color="info" variant="ghost" icon="i-lucide-pencil" size="sm" @click="openQuickEdit(c)" />
                <UButton v-if="canDelete" color="error" variant="ghost" icon="i-lucide-trash-2" size="sm" class="ms-2" @click="openDelete(c)" />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <div class="flex items-center flex-wrap justify-between gap-3 px-5 py-3 border-t border-prohealth-100 shrink-0">
        <p class="text-xs text-prohealth-500">
          {{ t('campaigns.paginationSummary', { shown: items.length, total }) }}
        </p>
        <div class="flex items-center gap-3">
          <UPagination
            v-if="pageSize !== UNPAGED_PAGE_SIZE"
            v-model:page="page"
            :total="total"
            :items-per-page="pageSize"
          />
          <UTooltip :text="t('catalogs.pageSizeLabel')">
            <USelectMenu
              v-model="pageSize"
              :items="pageSizeItems"
              label-key="label"
              value-key="value"
              icon="i-lucide-list"
              :search-input="false"
              :aria-label="t('catalogs.pageSizeLabel')"
              class="w-40"
            />
          </UTooltip>
        </div>
      </div>
    </div>

    <CampaignFormModal v-model:open="formOpen" :campaign="editingCampaign" @saved="onSaved" />

    <UModal v-model:open="deleteOpen" :title="t('campaigns.deleteTitle')">
      <template #body>
        <p class="text-sm text-prohealth-700">
          {{ t('campaigns.deleteConfirm') }}
        </p>
        <div class="flex items-center justify-end gap-3 pt-5">
          <UButton color="neutral" variant="ghost" :disabled="deleting" @click="deleteOpen = false">{{ t('common.cancel') }}</UButton>
          <UButton color="error" :loading="deleting" icon="i-lucide-trash-2" @click="confirmDelete">{{ t('common.delete') }}</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
