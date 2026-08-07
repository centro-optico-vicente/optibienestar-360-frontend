<script setup lang="ts">
import type { CollectionCommissionTierDto } from '~/types/promoters'

definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'COLLECTION_COMMISSION_TIER_MANAGE',
})

const { t } = useI18n()
const { formatDate } = useFormatters()

useSeoMeta({ title: () => t('common.seoTitle', { page: t('nav.items.collectionCommissionTiers.label') }) })

const tiers = useCollectionCommissionTiers()
const { can } = usePermissions()
const toast = useToast()

const canManage = computed(() => can('COLLECTION_COMMISSION_TIER_MANAGE'))

// ---- List + pagination + search ----
const data = ref<CollectionCommissionTierDto[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1) // UPagination is 1-based; the API is 0-based
const size = ref(20)
const search = ref('')
const includeInactive = ref(false)

async function load() {
  loading.value = true
  try {
    const res = await tiers.list({
      page: page.value - 1,
      size: size.value,
      sort: 'maxDays,asc',
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

watch([page, size, includeInactive], load)
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    load()
  }, 400)
})

onMounted(load)

function pct(v: number): string {
  return `${Number(v).toFixed(2)}%`
}

// ---- Create/edit (shared modal) ----
const formOpen = ref(false)
const editingTier = ref<CollectionCommissionTierDto | null>(null)

function openCreate() {
  editingTier.value = null
  formOpen.value = true
}

function openEdit(item: CollectionCommissionTierDto) {
  editingTier.value = item
  formOpen.value = true
}

async function onSaved() {
  await load()
}

// ---- Delete ----
const deleteOpen = ref(false)
const deleting = ref(false)
const target = ref<CollectionCommissionTierDto | null>(null)

function openDelete(item: CollectionCommissionTierDto) {
  target.value = item
  deleteOpen.value = true
}

async function confirmDelete() {
  if (!target.value) return
  deleting.value = true
  try {
    await tiers.remove(target.value.uuid)
    toast.add({ title: t('collectionCommissionTiers.deletedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    deleteOpen.value = false
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
        <h1 class="text-2xl font-extrabold text-prohealth-900">{{ t('collectionCommissionTiers.title') }}</h1>
        <p class="text-sm text-prohealth-700/70 mt-1">
          {{ t('collectionCommissionTiers.subtitle') }}
        </p>
      </div>
      <UButton
        color="primary"
        icon="i-lucide-plus"
        :disabled="!canManage"
        @click="openCreate"
      >
        {{ t('collectionCommissionTiers.new') }}
      </UButton>
    </div>

    <!-- Search + filters -->
    <div class="bg-white rounded-2xl border border-prohealth-100 p-4 flex flex-wrap items-center gap-4">
      <UInput
        v-model="search"
        :placeholder="t('collectionCommissionTiers.searchPlaceholder')"
        icon="i-lucide-search"
        size="lg"
        class="w-full max-w-md"
      />
      <label class="flex items-center gap-2 text-sm text-prohealth-700">
        <USwitch v-model="includeInactive" />
        {{ t('collectionCommissionTiers.includeInactive') }}
      </label>
    </div>

    <!-- Table -->
    <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
              <th class="px-5 py-3 font-semibold">{{ t('collectionCommissionTiers.columns.name') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('collectionCommissionTiers.columns.maxDays') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('collectionCommissionTiers.columns.commissionPct') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('collectionCommissionTiers.columns.active') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('collectionCommissionTiers.columns.updatedAt') }}</th>
              <th class="px-5 py-3 font-semibold text-right">{{ t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-prohealth-100">
            <TableSkeleton v-if="loading" :rows="6" :cols="6" />
            <tr v-else-if="data.length === 0">
              <td colspan="6" class="px-5 py-12 text-center text-prohealth-500">
                <UIcon name="i-lucide-hand-coins" class="w-8 h-8 mx-auto mb-2 text-prohealth-300" />
                {{ t('collectionCommissionTiers.empty') }}
              </td>
            </tr>
            <tr v-for="item in data" v-else :key="item.uuid" class="hover:bg-prohealth-50/50">
              <td class="px-5 py-3 font-semibold text-prohealth-900">{{ item.name }}</td>
              <td class="px-5 py-3 text-prohealth-700">
                {{ t('collectionCommissionTiers.upToDays', { days: item.maxDays }) }}
              </td>
              <td class="px-5 py-3 text-prohealth-900 font-semibold">{{ pct(item.commissionPct) }}</td>
              <td class="px-5 py-3">
                <UBadge :color="item.active ? 'success' : 'neutral'" variant="subtle" size="sm">
                  {{ item.active ? t('common.yes') : t('common.no') }}
                </UBadge>
              </td>
              <td class="px-5 py-3 text-prohealth-600">{{ formatDate(item.updatedAt, 'short') }}</td>
              <td class="px-5 py-3" @click.stop>
                <div class="flex items-center justify-end gap-1">
                  <UTooltip :text="canManage ? t('common.edit') : t('collectionCommissionTiers.noPermission')">
                    <UButton
                      color="neutral"
                      variant="ghost"
                      icon="i-lucide-pencil"
                      size="sm"
                      :disabled="!canManage"
                      @click="openEdit(item)"
                    />
                  </UTooltip>
                  <UTooltip :text="canManage ? t('common.delete') : t('collectionCommissionTiers.noPermission')">
                    <UButton
                      color="error"
                      variant="ghost"
                      icon="i-lucide-trash-2"
                      size="sm"
                      :disabled="!canManage"
                      @click="openDelete(item)"
                    />
                  </UTooltip>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="flex items-center justify-between px-5 py-3 border-t border-prohealth-100">
        <p class="text-xs text-prohealth-500">
          {{ t('collectionCommissionTiers.paginationSummary', { shown: data.length, total }) }}
        </p>
        <UPagination
          v-model:page="page"
          :total="total"
          :items-per-page="size"
        />
      </div>
    </div>

    <!-- Create/edit modal -->
    <CollectionCommissionTierFormModal v-model:open="formOpen" :tier="editingTier" @saved="onSaved" />

    <!-- Delete confirmation modal -->
    <UModal v-model:open="deleteOpen" :title="t('collectionCommissionTiers.deleteTitle')">
      <template #body>
        <i18n-t keypath="collectionCommissionTiers.deleteConfirm" tag="p" class="text-sm text-prohealth-700" scope="global">
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
