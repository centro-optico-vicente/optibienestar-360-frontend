<script setup lang="ts">
import { buildPageSizeItems, DEFAULT_PAGE_SIZE, UNPAGED_PAGE_SIZE } from '~/utils/pagination'
import type { PromoterDto, PromoterStatus } from '~/types/promoters'

definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'PROMOTER_VIEW_ALL',
})

const { t } = useI18n()
const { formatCurrency } = useFormatters()

useSeoMeta({ title: () => t('common.seoTitle', { page: t('nav.items.promoters.label') }) })

const promoters = usePromoters()
const { can } = usePermissions()
const toast = useToast()

const canCreate = computed(() => can('PROMOTER_CREATE'))
const canUpdate = computed(() => can('PROMOTER_UPDATE'))
const canDelete = computed(() => can('PROMOTER_DELETE'))

// ---- List + pagination + search ----
const data = ref<PromoterDto[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1) // UPagination is 1-based; the API is 0-based
const size = ref(DEFAULT_PAGE_SIZE)
const pageSizeItems = buildPageSizeItems(t)
const search = ref('')
const includeInactive = ref(false)

async function load() {
  loading.value = true
  try {
    const res = await promoters.list({
      page: page.value - 1,
      size: size.value,
      sort: 'displayName,asc',
      q: search.value.trim() || undefined,
      includeInactive: includeInactive.value,
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

watch(size, () => { page.value = 1 })
watch([page, size], load)
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    load()
  }, 400)
})
watch(includeInactive, () => { page.value = 1; load() })

onMounted(load)

// Amount in USD, formatted in the VE convention (useFormatters). Empty → '—'.
function money(v?: number | string | null): string {
  if (v === null || v === undefined || v === '') return t('common.empty')
  return formatCurrency(Number(v), 'USD')
}

// Status badge label; falls back to the raw value for unknown statuses.
function statusLabel(s?: string | null): string {
  return s ? t(`promoters.status.${s}`, s) : t('common.empty')
}

// Status → badge color: ACTIVE success, SUSPENDED warning, INACTIVE neutral.
function statusColor(s?: PromoterStatus | null): 'success' | 'warning' | 'neutral' {
  return s === 'ACTIVE' ? 'success' : s === 'SUSPENDED' ? 'warning' : 'neutral'
}

// ---- Create/edit (shared modal) ----
const formOpen = ref(false)
const editingPromoter = ref<PromoterDto | null>(null)

function openCreate() {
  editingPromoter.value = null
  formOpen.value = true
}

function openEdit(p: PromoterDto) {
  editingPromoter.value = p
  formOpen.value = true
}

async function onSaved() {
  await load()
}

// ---- Delete ----
const deleteOpen = ref(false)
const deleting = ref(false)
const target = ref<PromoterDto | null>(null)
const usageChecking = ref(false)
const usageInfo = ref<{ inUse: boolean, count: number } | null>(null)

async function openDelete(p: PromoterDto) {
  target.value = p
  deleteOpen.value = true
  usageChecking.value = true
  usageInfo.value = null
  try {
    usageInfo.value = await promoters.usage(p.uuid)
  }
  catch {
    // Fallback: treat as "in use" for safety (soft-deactivate instead of physical delete).
    usageInfo.value = null
  }
  finally {
    usageChecking.value = false
  }
}

async function confirmDelete() {
  if (!target.value) return
  deleting.value = true
  const wasPhysical = usageInfo.value?.inUse === false
  try {
    await promoters.remove(target.value.uuid, wasPhysical)
    toast.add({
      title: wasPhysical
        ? t('promoters.deletedPermanentToast')
        : t('promoters.deactivatedToast'),
      color: wasPhysical ? 'success' : 'info',
      icon: wasPhysical ? 'i-lucide-check-circle' : 'i-lucide-info',
    })
    deleteOpen.value = false
    // If the page is left empty after deleting, step back one.
    if (data.value.length === 1 && page.value > 1) page.value -= 1
    else await load()
  }
  catch {
    // toast handled by useApi
  }
  finally {
    deleting.value = false
  }
}
</script>

<template>
  <div class="space-y-5">
    <!-- Header -->
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-extrabold text-prohealth-900">{{ t('promoters.title') }}</h1>
        <p class="text-sm text-prohealth-700/70 mt-1">
          {{ t('promoters.subtitle') }}
        </p>
      </div>
      <UTooltip :text="canCreate ? t('promoters.createTooltip') : t('promoters.noPermissionCreate')">
        <UButton
          color="primary"
          icon="i-lucide-user-plus"
          :disabled="!canCreate"
          @click="openCreate"
        >
          {{ t('promoters.new') }}
        </UButton>
      </UTooltip>
    </div>

    <!-- Search -->
    <div class="bg-white rounded-2xl border border-prohealth-100 p-4 flex flex-wrap items-center gap-3">
      <UInput
        v-model="search"
        :placeholder="t('promoters.searchPlaceholder')"
        icon="i-lucide-search"
        size="lg"
        class="w-full max-w-md"
      />
      <UCheckbox v-model="includeInactive" :label="$t('catalogs.includeInactive')" class="self-center" />
    </div>

    <!-- Table -->
    <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden flex flex-col h-[calc(100vh-19rem)] min-h-[24rem]">
      <div class="overflow-auto flex-1">
        <table class="w-full text-sm">
          <thead class="sticky top-0 bg-white z-10">
            <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
              <th class="px-5 py-3 font-semibold">{{ t('promoters.columns.promoter') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('promoters.columns.status') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('promoters.columns.referrals') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('promoters.columns.commissionPaid') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('promoters.columns.active') }}</th>
              <th class="px-5 py-3 font-semibold text-right">{{ t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-prohealth-100">
            <TableSkeleton v-if="loading" :rows="8" :cols="6" />
            <tr v-else-if="data.length === 0">
              <td colspan="6" class="px-5 py-12 text-center text-prohealth-500">
                <UIcon name="i-lucide-megaphone" class="w-8 h-8 mx-auto mb-2 text-prohealth-300" />
                {{ t('promoters.empty') }}
              </td>
            </tr>
            <tr
              v-for="p in data"
              v-else
              :key="p.uuid"
              class="hover:bg-prohealth-50/50 cursor-pointer"
              :class="{ 'opacity-60': !p.active }"
              @click="navigateTo(`/dashboard/promoters/${p.uuid}`)"
            >
              <td class="px-5 py-3">
                <div class="flex items-center gap-2">
                  <span class="font-semibold text-prohealth-900">{{ p.displayName }}</span>
                  <UBadge v-if="p.system" color="neutral" variant="subtle" size="sm">
                    {{ t('promoters.systemBadge') }}
                  </UBadge>
                </div>
                <div class="text-xs text-prohealth-500 font-mono">{{ p.referralCode }}</div>
              </td>
              <td class="px-5 py-3">
                <UBadge :color="statusColor(p.status)" variant="subtle" size="sm">
                  {{ statusLabel(p.status) }}
                </UBadge>
              </td>
              <td class="px-5 py-3 text-prohealth-700">{{ p.totalReferrals }}</td>
              <td class="px-5 py-3 text-prohealth-700">{{ money(p.totalCommissionPaid) }}</td>
              <td class="px-5 py-3">
                <UBadge :color="p.active ? 'success' : 'neutral'" variant="subtle" size="sm">
                  {{ p.active ? t('common.yes') : t('common.no') }}
                </UBadge>
              </td>
              <td class="px-5 py-3" @click.stop>
                <div class="flex items-center justify-end gap-1">
                  <UTooltip :text="t('promoters.viewDetailTooltip')">
                    <UButton
                      color="neutral"
                      variant="ghost"
                      icon="i-lucide-eye"
                      size="sm"
                      :to="`/dashboard/promoters/${p.uuid}`"
                    />
                  </UTooltip>
                  <UTooltip :text="p.system ? t('promoters.systemLocked') : (canUpdate ? t('common.edit') : t('promoters.noPermissionEdit'))">
                    <UButton
                      color="neutral"
                      variant="ghost"
                      icon="i-lucide-pencil"
                      size="sm"
                      :disabled="!canUpdate || p.system"
                      @click="openEdit(p)"
                    />
                  </UTooltip>
                  <UTooltip :text="p.system ? t('promoters.systemLocked') : (canDelete ? t('common.delete') : t('promoters.noPermissionDelete'))">
                    <UButton
                      color="error"
                      variant="ghost"
                      icon="i-lucide-trash-2"
                      size="sm"
                      :disabled="!canDelete || p.system"
                      @click="openDelete(p)"
                    />
                  </UTooltip>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="flex items-center flex-wrap justify-between gap-3 px-5 py-3 border-t border-prohealth-100 shrink-0">
        <p class="text-xs text-prohealth-500">
          {{ t('promoters.paginationSummary', { shown: data.length, total }) }}
        </p>
        <div class="flex items-center gap-3">
          <UPagination
            v-if="size !== UNPAGED_PAGE_SIZE"
            v-model:page="page"
            :total="total"
            :items-per-page="size"
          />
          <UTooltip :text="$t('catalogs.pageSizeLabel')">
            <USelectMenu
              v-model="size"
              :items="pageSizeItems"
              label-key="label"
              value-key="value"
              icon="i-lucide-list"
              :search-input="false"
              :aria-label="$t('catalogs.pageSizeLabel')"
              class="w-40"
            />
          </UTooltip>
        </div>
      </div>
    </div>

    <!-- Create/edit modal (shared with the detail page) -->
    <PromoterFormModal v-model:open="formOpen" :promoter="editingPromoter" @saved="onSaved" @delete="openDelete" />

    <!-- Delete confirmation modal -->
    <UModal v-model:open="deleteOpen" :title="t('promoters.deleteTitle')">
      <template #body>
        <div v-if="usageChecking" class="flex items-center gap-2 text-sm text-prohealth-600">
          <UIcon name="i-lucide-loader-2" class="w-4 h-4 animate-spin" />
          {{ t('common.loading') }}
        </div>
        <p v-else class="text-sm text-prohealth-700">
          {{
            usageInfo?.inUse === false
              ? t('promoters.deleteConfirmPermanent')
              : t('promoters.deleteConfirmDeactivate', { count: usageInfo?.count ?? 0 })
          }}
        </p>
        <div class="flex items-center justify-end gap-3 pt-5">
          <UButton color="neutral" variant="ghost" :disabled="deleting" @click="deleteOpen = false">
            {{ t('common.cancel') }}
          </UButton>
          <UButton color="error" :loading="deleting" :disabled="usageChecking" icon="i-lucide-trash-2" @click="confirmDelete">
            {{ t('common.delete') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
