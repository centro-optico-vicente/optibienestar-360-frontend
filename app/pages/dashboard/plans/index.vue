<script setup lang="ts">
import { buildPageSizeItems, DEFAULT_PAGE_SIZE, UNPAGED_PAGE_SIZE } from '~/utils/pagination'
import type { PlanDto } from '~/types/plans'

definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'PLAN_VIEW_ALL',
})

const { t } = useI18n()
const { formatCurrency } = useFormatters()

useSeoMeta({ title: () => t('common.seoTitle', { page: t('nav.items.plans.label') }) })

const plans = usePlans()
const { can } = usePermissions()
const toast = useToast()

const canCreate = computed(() => can('PLAN_CREATE'))
const canUpdate = computed(() => can('PLAN_UPDATE'))
const canDelete = computed(() => can('PLAN_DELETE'))

// ---- List + pagination + search ----
const data = ref<PlanDto[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1) // UPagination is 1-based; the API is 0-based
const size = ref(DEFAULT_PAGE_SIZE)
const pageSizeItems = buildPageSizeItems(t)
const search = ref('')

async function load() {
  loading.value = true
  try {
    const res = await plans.list({
      page: page.value - 1,
      size: size.value,
      sort: 'code,asc',
      q: search.value.trim() || undefined,
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

onMounted(load)

// Amount in USD, formatted in the VE convention (useFormatters). Empty → '—'.
function money(v?: number | string | null): string {
  if (v === null || v === undefined || v === '') return t('common.empty')
  return formatCurrency(Number(v), 'USD')
}

// Plan type badge label; falls back to the raw value for unknown types.
function typeLabel(type?: string | null): string {
  return type ? t(`plans.types.${type}`, type) : t('common.empty')
}

// ---- Create/edit (shared modal) ----
const formOpen = ref(false)
const editingPlan = ref<PlanDto | null>(null)

function openCreate() {
  editingPlan.value = null
  formOpen.value = true
}

function openEdit(p: PlanDto) {
  editingPlan.value = p
  formOpen.value = true
}

async function onSaved() {
  await load()
}

// ---- Delete ----
const deleteOpen = ref(false)
const deleting = ref(false)
const target = ref<PlanDto | null>(null)

function openDelete(p: PlanDto) {
  target.value = p
  deleteOpen.value = true
}

async function confirmDelete() {
  if (!target.value) return
  deleting.value = true
  try {
    await plans.remove(target.value.uuid)
    toast.add({ title: t('plans.deletedToast'), color: 'success', icon: 'i-lucide-check-circle' })
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
        <h1 class="text-2xl font-extrabold text-prohealth-900">{{ t('plans.title') }}</h1>
        <p class="text-sm text-prohealth-700/70 mt-1">
          {{ t('plans.subtitle') }}
        </p>
      </div>
      <UTooltip :text="canCreate ? t('plans.createTooltip') : t('plans.noPermissionCreate')">
        <UButton
          color="primary"
          icon="i-lucide-package-plus"
          :disabled="!canCreate"
          @click="openCreate"
        >
          {{ t('plans.new') }}
        </UButton>
      </UTooltip>
    </div>

    <!-- Search -->
    <div class="bg-white rounded-2xl border border-prohealth-100 p-4">
      <UInput
        v-model="search"
        :placeholder="t('plans.searchPlaceholder')"
        icon="i-lucide-search"
        size="lg"
        class="w-full max-w-md"
      />
    </div>

    <!-- Table -->
    <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden flex flex-col h-[calc(100vh-19rem)] min-h-[24rem]">
      <div class="overflow-auto flex-1">
        <table class="w-full text-sm">
          <thead class="sticky top-0 bg-white z-10">
            <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
              <th class="px-5 py-3 font-semibold">{{ t('plans.columns.plan') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('plans.columns.type') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('plans.columns.inscription') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('plans.columns.monthly') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('plans.columns.beneficiaries') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('plans.columns.published') }}</th>
              <th class="px-5 py-3 font-semibold text-right">{{ t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-prohealth-100">
            <TableSkeleton v-if="loading" :rows="8" :cols="7" />
            <tr v-else-if="data.length === 0">
              <td colspan="7" class="px-5 py-12 text-center text-prohealth-500">
                <UIcon name="i-lucide-package" class="w-8 h-8 mx-auto mb-2 text-prohealth-300" />
                {{ t('plans.empty') }}
              </td>
            </tr>
            <tr
              v-for="p in data"
              v-else
              :key="p.uuid"
              class="hover:bg-prohealth-50/50 cursor-pointer"
              @click="navigateTo(`/dashboard/plans/${p.uuid}`)"
            >
              <td class="px-5 py-3">
                <div class="font-semibold text-prohealth-900">{{ p.name }}</div>
                <div class="text-xs text-prohealth-500 font-mono">{{ p.code }}</div>
              </td>
              <td class="px-5 py-3">
                <UBadge color="primary" variant="subtle" size="sm">{{ typeLabel(p.type) }}</UBadge>
              </td>
              <td class="px-5 py-3 text-prohealth-700">{{ money(p.inscriptionFee) }}</td>
              <td class="px-5 py-3 text-prohealth-700">{{ money(p.monthlyFee) }}</td>
              <td class="px-5 py-3 text-prohealth-700">
                {{ t('plans.includedShort', { n: p.includedBeneficiaries }) }}
                <span class="text-prohealth-400">· {{ t('plans.maxShort', { n: p.maxBeneficiaries ?? '∞' }) }}</span>
              </td>
              <td class="px-5 py-3">
                <UBadge :color="p.published ? 'success' : 'neutral'" variant="subtle" size="sm">
                  {{ p.published ? t('plans.published') : t('plans.draft') }}
                </UBadge>
              </td>
              <td class="px-5 py-3" @click.stop>
                <div class="flex items-center justify-end gap-1">
                  <UTooltip :text="t('plans.viewDetailTooltip')">
                    <UButton
                      color="neutral"
                      variant="ghost"
                      icon="i-lucide-eye"
                      size="sm"
                      :to="`/dashboard/plans/${p.uuid}`"
                    />
                  </UTooltip>
                  <UTooltip :text="canUpdate ? t('common.edit') : t('plans.noPermissionEdit')">
                    <UButton
                      color="neutral"
                      variant="ghost"
                      icon="i-lucide-pencil"
                      size="sm"
                      :disabled="!canUpdate"
                      @click="openEdit(p)"
                    />
                  </UTooltip>
                  <UTooltip :text="canDelete ? t('common.delete') : t('plans.noPermissionDelete')">
                    <UButton
                      color="error"
                      variant="ghost"
                      icon="i-lucide-trash-2"
                      size="sm"
                      :disabled="!canDelete"
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
          {{ t('plans.paginationSummary', { shown: data.length, total }) }}
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
    <PlanFormModal v-model:open="formOpen" :plan="editingPlan" @saved="onSaved" />

    <!-- Delete confirmation modal -->
    <UModal v-model:open="deleteOpen" :title="t('plans.deleteTitle')">
      <template #body>
        <i18n-t keypath="plans.deleteConfirm" tag="p" class="text-sm text-prohealth-700" scope="global">
          <template #name>
            <span class="font-semibold">{{ target?.name }}</span>
          </template>
        </i18n-t>
        <div class="flex items-center justify-end gap-3 pt-5">
          <UButton color="neutral" variant="ghost" :disabled="deleting" @click="deleteOpen = false">
            {{ t('common.cancel') }}
          </UButton>
          <UButton color="error" :loading="deleting" icon="i-lucide-trash-2" @click="confirmDelete">
            {{ t('common.delete') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
