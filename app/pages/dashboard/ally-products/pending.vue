<script setup lang="ts">
import type { AllyProductDto, AllyProductReviewLogDto } from '~/types/allies'
import type { SelectItem } from '~/types/options'

// Review queue of ally offers (hub ADR 0026): every offer waiting for a decision
// (PROPOSED / IN_REVIEW) across allies — GET /v1/admin/ally-products/pending,
// oldest first. Approve, reject (reason required, shown to the ally) or open the
// review log. Gated by ALLY_PRODUCT_APPROVE, like the backend.
definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'ALLY_PRODUCT_APPROVE',
})

const { t } = useI18n()
const { formatCurrency } = useFormatters()

useSeoMeta({ title: () => t('common.seoTitle', { page: t('allyProductReview.title') }) })

const allies = useAllies()
const { can } = usePermissions()
const toast = useToast()

const canViewAllies = computed(() => can('ALLY_VIEW_ALL'))
const canViewLog = computed(() => can('ALLY_PRODUCT_VIEW_ALL'))

// ---- Filters ----
const search = ref('')
const allyFilter = ref<string | undefined>(undefined)
const categoryFilter = ref<string | undefined>(undefined)
const categoryOptions = ref<SelectItem[]>([])

async function loadCategories() {
  try {
    const items = await usePublicCatalog('product-categories').list()
    categoryOptions.value = items.map(i => ({ label: i.name, value: i.uuid }))
  }
  catch {
    categoryOptions.value = []
  }
}

// Ally picker: server-side search (needs ALLY_VIEW_ALL; otherwise hidden).
const allySearchTerm = ref('')
const allyOptions = ref<SelectItem[]>([])
const allySearching = ref(false)
let allySearchTimer: ReturnType<typeof setTimeout> | undefined

async function searchAllies(q?: string) {
  if (!canViewAllies.value) return
  allySearching.value = true
  try {
    const res = await allies.list({ q, size: 20 })
    const found = (res.content ?? []).map(a => ({ label: a.name, value: a.uuid }))
    const current = allyOptions.value.find(o => o.value === allyFilter.value)
    allyOptions.value = current && !found.some(o => o.value === current.value) ? [current, ...found] : found
  }
  catch {
    // useApi already notified
  }
  finally {
    allySearching.value = false
  }
}

watch(allySearchTerm, (q) => {
  clearTimeout(allySearchTimer)
  const term = q.trim()
  if (term.length < 2) return
  allySearchTimer = setTimeout(() => searchAllies(term), 400)
})

// ---- List ----
const PAGE_SIZE = 20
const data = ref<AllyProductDto[]>([])
const total = ref(0)
const page = ref(1)
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    const res = await allies.listPendingProducts({
      page: page.value - 1,
      size: PAGE_SIZE,
      q: search.value.trim() || undefined,
      allyUuid: allyFilter.value,
      productCategoryUuid: categoryFilter.value,
    })
    data.value = res.content ?? []
    total.value = res.totalElements ?? 0
  }
  catch {
    data.value = []
    total.value = 0
  }
  finally {
    loading.value = false
  }
}

function reloadFromFirstPage() {
  if (page.value !== 1) page.value = 1
  else load()
}

watch(page, load)
watch([allyFilter, categoryFilter], reloadFromFirstPage)
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(reloadFromFirstPage, 400)
})

const hasFilters = computed(() => Boolean(search.value.trim() || allyFilter.value || categoryFilter.value))
function clearFilters() {
  search.value = ''
  allyFilter.value = undefined
  categoryFilter.value = undefined
}

function money(v?: number | string | null): string {
  if (v === null || v === undefined || v === '') return t('common.empty')
  return formatCurrency(Number(v), 'USD')
}

function typeLabel(o: AllyProductDto): string {
  return o.productType_Display ?? (o.productType ? t(`products.types.${o.productType}`, String(o.productType)) : t('common.empty'))
}

function statusLabel(s?: string | null): string {
  return s ? t(`allies.products.reviewStatus.${s}`, s) : t('common.empty')
}

// ---- Approve ----
const approvingUuid = ref<string | null>(null)

async function approve(o: AllyProductDto) {
  approvingUuid.value = o.uuid
  try {
    await allies.approveProduct(o.uuid)
    toast.add({ title: t('allies.products.approvedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    if (data.value.length === 1 && page.value > 1) page.value -= 1
    else await load()
  }
  catch {
    // toast handled by useApi
  }
  finally {
    approvingUuid.value = null
  }
}

// ---- Reject / withdraw (reason required) ----
const reasonOpen = ref(false)
const reasonAction = ref<'reject' | 'withdraw'>('reject')
const reasonTarget = ref<AllyProductDto | null>(null)
const reason = ref('')
const reasonSubmitting = ref(false)

function openReason(o: AllyProductDto, action: 'reject' | 'withdraw') {
  reasonTarget.value = o
  reasonAction.value = action
  reason.value = ''
  reasonOpen.value = true
}

async function confirmReason() {
  const target = reasonTarget.value
  const text = reason.value.trim()
  if (!target || !text) return
  reasonSubmitting.value = true
  try {
    if (reasonAction.value === 'reject') {
      await allies.rejectProduct(target.uuid, text)
      toast.add({ title: t('allies.products.rejectedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    }
    else {
      await allies.withdrawProduct(target.uuid, text)
      toast.add({ title: t('allies.products.withdrawnToast'), color: 'success', icon: 'i-lucide-check-circle' })
    }
    reasonOpen.value = false
    if (data.value.length === 1 && page.value > 1) page.value -= 1
    else await load()
  }
  catch {
    // toast handled by useApi
  }
  finally {
    reasonSubmitting.value = false
  }
}

// ---- Review log ----
const logOpen = ref(false)
const logTarget = ref<AllyProductDto | null>(null)
const logEntries = ref<AllyProductReviewLogDto[]>([])
const logLoading = ref(false)

async function openLog(o: AllyProductDto) {
  logTarget.value = o
  logEntries.value = []
  logOpen.value = true
  logLoading.value = true
  try {
    logEntries.value = await allies.productReviewLog(o.uuid)
  }
  catch {
    logEntries.value = []
  }
  finally {
    logLoading.value = false
  }
}

onMounted(() => {
  loadCategories()
  searchAllies()
  load()
})
</script>

<template>
  <div class="space-y-5">
    <!-- Header -->
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-extrabold text-prohealth-900">{{ t('allyProductReview.title') }}</h1>
        <p class="text-sm text-prohealth-700/70 mt-1">{{ t('allyProductReview.subtitle') }}</p>
      </div>
      <RefreshButton :loading="loading" :title="t('common.refresh')" @refresh="load" />
    </div>

    <!-- Filters -->
    <div class="bg-white rounded-2xl border border-prohealth-100 p-4 flex flex-wrap items-center gap-3">
      <UInput
        v-model="search"
        :placeholder="t('allyProductReview.searchPlaceholder')"
        icon="i-lucide-search"
        size="lg"
        class="w-full max-w-sm"
      />
      <USelectMenu
        v-if="canViewAllies"
        clear
        v-model="allyFilter"
        v-model:search-term="allySearchTerm"
        :items="allyOptions"
        label-key="label"
        value-key="value"
        ignore-filter
        icon="i-lucide-handshake"
        :loading="allySearching"
        :placeholder="t('allyProductReview.allAllies')"
        :search-input="{ placeholder: t('products.form.allySearchPlaceholder'), icon: 'i-lucide-search' }"
        class="w-60"
      />
      <USelectMenu
        clear
        v-model="categoryFilter"
        :items="categoryOptions"
        label-key="label"
        value-key="value"
        :placeholder="t('products.filters.allCategories')"
        class="w-56"
      />
      <UButton v-if="hasFilters" variant="link" color="neutral" size="sm" icon="i-lucide-x" @click="clearFilters">
        {{ t('common.clearFilters') }}
      </UButton>
    </div>

    <!-- Table -->
    <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
              <th class="px-5 py-3 font-semibold">{{ t('allies.products.columns.item') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('allyProductReview.columns.ally') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('allies.products.columns.category') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('allies.products.columns.price') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('allies.products.columns.discount') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('allies.products.columns.finalPrice') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('allyProductReview.columns.proposedAt') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('allies.products.columns.review') }}</th>
              <th class="px-5 py-3 font-semibold text-right">{{ t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-prohealth-100">
            <TableSkeleton v-if="loading" :rows="6" :cols="9" />
            <tr v-else-if="data.length === 0">
              <td colspan="9" class="px-5 py-12 text-center text-prohealth-500">
                <UIcon name="i-lucide-inbox" class="w-8 h-8 mx-auto mb-2 text-prohealth-300" />
                {{ t('allyProductReview.empty') }}
              </td>
            </tr>
            <tr v-for="o in data" v-else :key="o.uuid" class="hover:bg-prohealth-50/50">
              <td class="px-5 py-3">
                <div class="flex items-center gap-2">
                  <span class="font-semibold text-prohealth-900">{{ o.name }}</span>
                  <UBadge :color="o.exclusive ? 'info' : 'neutral'" variant="subtle" size="xs">
                    {{ o.exclusive ? t('allies.products.exclusive') : t('allies.products.general') }}
                  </UBadge>
                </div>
                <div class="text-xs text-prohealth-500">{{ typeLabel(o) }}</div>
                <div v-if="o.exclusions" class="text-xs text-amber-700 line-clamp-1">
                  {{ t('allies.public.detail.exclusions', { exclusions: o.exclusions }) }}
                </div>
              </td>
              <td class="px-5 py-3">
                <NuxtLink
                  v-if="o.ally_Uuid && canViewAllies"
                  :to="`/dashboard/allies/${o.ally_Uuid}`"
                  class="text-cyan-700 hover:underline"
                >
                  {{ o.ally_Display ?? t('products.offers.ally') }}
                </NuxtLink>
                <span v-else class="text-prohealth-700">{{ o.ally_Display ?? t('common.empty') }}</span>
              </td>
              <td class="px-5 py-3 text-prohealth-700">{{ o.productCategory?.name || t('common.empty') }}</td>
              <td class="px-5 py-3 text-prohealth-700">{{ money(o.priceAmount) }}</td>
              <td class="px-5 py-3 text-prohealth-700">{{ o.discountPct != null && o.discountPct !== '' ? `${o.discountPct}%` : t('common.empty') }}</td>
              <td class="px-5 py-3 font-semibold text-prohealth-900">{{ money(o.finalPrice) }}</td>
              <td class="px-5 py-3 text-prohealth-700">{{ o.createdAt_Display ?? t('common.empty') }}</td>
              <td class="px-5 py-3">
                <UBadge :color="o.reviewStatus === 'IN_REVIEW' ? 'info' : 'warning'" variant="subtle" size="sm">
                  {{ o.reviewStatus_Display ?? statusLabel(o.reviewStatus) }}
                </UBadge>
              </td>
              <td class="px-5 py-3">
                <div class="flex items-center justify-end gap-1">
                  <UTooltip v-if="canViewLog" :text="t('allyProductReview.log.open')">
                    <UButton color="neutral" variant="ghost" icon="i-lucide-history" size="sm" @click="openLog(o)" />
                  </UTooltip>
                  <template v-if="o.reviewStatus === 'APPROVED'">
                    <UTooltip :text="t('allies.products.review.withdraw')">
                      <UButton color="warning" variant="ghost" icon="i-lucide-circle-slash" size="sm" @click="openReason(o, 'withdraw')" />
                    </UTooltip>
                  </template>
                  <template v-else>
                    <UButton
                      color="success"
                      variant="soft"
                      icon="i-lucide-check"
                      size="sm"
                      :loading="approvingUuid === o.uuid"
                      @click="approve(o)"
                    >
                      {{ t('allies.products.review.approve') }}
                    </UButton>
                    <UButton color="warning" variant="ghost" icon="i-lucide-x" size="sm" @click="openReason(o, 'reject')">
                      {{ t('allies.products.review.reject') }}
                    </UButton>
                  </template>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="total > PAGE_SIZE" class="flex items-center flex-wrap justify-between gap-3 px-5 py-3 border-t border-prohealth-100">
        <p class="text-xs text-prohealth-500">
          {{ t('allies.products.paginationSummary', { shown: data.length, total }) }}
        </p>
        <UPagination v-model:page="page" :total="total" :items-per-page="PAGE_SIZE" />
      </div>
    </div>

    <!-- Reject / withdraw -->
    <UModal
      v-model:open="reasonOpen"
      :title="reasonAction === 'reject' ? t('allies.products.review.rejectTitle') : t('allies.products.review.withdrawTitle')"
      :description="reasonTarget?.name"
    >
      <template #body>
        <UFormField :label="t('allies.products.review.reasonLabel')" :help="t('allies.products.review.reasonHelp')" required>
          <UTextarea v-model="reason" :rows="3" class="w-full" />
        </UFormField>
        <div class="flex items-center justify-end gap-3 pt-5">
          <UButton color="neutral" variant="ghost" :disabled="reasonSubmitting" @click="reasonOpen = false">
            {{ t('common.cancel') }}
          </UButton>
          <UButton
            color="warning"
            :loading="reasonSubmitting"
            :disabled="!reason.trim()"
            icon="i-lucide-check"
            @click="confirmReason"
          >
            {{ t('allies.products.review.confirm') }}
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Review log -->
    <UModal v-model:open="logOpen" :title="t('allyProductReview.log.title')" :description="logTarget?.name">
      <template #body>
        <div v-if="logLoading" class="py-6 flex justify-center">
          <UIcon name="i-lucide-loader-circle" class="w-6 h-6 animate-spin text-prohealth-400" />
        </div>
        <p v-else-if="logEntries.length === 0" class="text-sm text-prohealth-500 text-center py-6">
          {{ t('allyProductReview.log.empty') }}
        </p>
        <ol v-else class="space-y-3">
          <li v-for="(e, i) in logEntries" :key="i" class="rounded-xl border border-prohealth-100 p-3 text-sm">
            <div class="flex items-center justify-between gap-3">
              <span class="font-semibold text-prohealth-900">
                <template v-if="e.fromStatus">{{ e.fromStatus_Display ?? statusLabel(e.fromStatus) }} → </template>
                {{ e.toStatus_Display ?? statusLabel(e.toStatus) }}
              </span>
              <span class="text-xs text-prohealth-500">{{ e.actionAt_Display ?? e.actionAt }}</span>
            </div>
            <p v-if="e.comment" class="text-prohealth-700 mt-1 whitespace-pre-line">{{ e.comment }}</p>
          </li>
        </ol>
      </template>
    </UModal>
  </div>
</template>
