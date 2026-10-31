<script setup lang="ts">
import { RATABLE_USAGE_STATUS, type BenefitUsageDto, type MyUsageScope, type UsageServiceSummaryDto } from '~/types/benefits'
import type { BeneficiaryDto } from '~/types/members'

// The member's own benefit usage at allies (GET /v1/me/usage-history,
// MEMBER_VIEW_OWN). Scope comes from the JWT; newest first. Covers the whole
// family group: a "who" selector narrows it to the holder or one beneficiary
// (`holder=true` / `beneficiaryUuid`), and a "by service" summary
// (GET /v1/me/usage-history/summary) doubles as a service filter (`productUuid`).
// Each REGISTERED usage can be rated (ally + product stars, optional comment)
// through PUT /v1/me/usage-history/{uuid}/rating (MEMBER_RATE_USAGE).
definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'MEMBER_VIEW_OWN',
})

const { t } = useI18n()
const { formatCurrency, formatDate } = useFormatters()
const { can } = usePermissions()
const { myHistory, mySummary } = useBenefitUsage()
const members = useMembers()

useSeoMeta({ title: () => t('common.seoTitle', { page: t('members.usage.title') }) })

const data = ref<BenefitUsageDto[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1) // UPagination is 1-based; the API is 0-based
const size = ref(20)

// ---- Who consumed: Todos / Titular / each beneficiary ----
// 'all' | 'holder' | beneficiary uuid — `?who=` preselects it (family cards link here).
const route = useRoute()
const who = ref<string>(typeof route.query.who === 'string' ? route.query.who : 'all')
const holderName = ref<string | null>(null)
const family = ref<BeneficiaryDto[]>([])

function relationshipLabel(r?: string | null): string | null {
  return r ? t(`members.relationships.${r}`, r) : null
}

function personName(p: { fullName?: string, firstName: string, middleName?: string, lastName: string, secondLastName?: string }): string {
  return p.fullName || [p.firstName, p.middleName, p.lastName, p.secondLastName].filter(Boolean).join(' ')
}

const whoOptions = computed(() => [
  { value: 'all', label: t('members.usage.who.all'), hint: null as string | null },
  { value: 'holder', label: holderName.value || t('members.usage.who.holder'), hint: holderName.value ? t('members.usage.who.holder') : null },
  ...family.value.map(b => ({ value: b.uuid, label: personName(b), hint: relationshipLabel(b.relationship) })),
])

const scope = computed<MyUsageScope>(() => {
  if (who.value === 'holder') return { holder: true }
  if (who.value !== 'all') return { beneficiaryUuid: who.value }
  return {}
})

/** Family is a nicety for the selector: a failure just hides it. */
async function loadFamily() {
  const [me, fam] = await Promise.all([
    members.me().catch(() => null),
    members.myFamily().catch(() => [] as BeneficiaryDto[]),
  ])
  holderName.value = me ? personName(me) : null
  family.value = fam ?? []
}

// ---- Summary by service (also the service filter) ----
const summary = ref<UsageServiceSummaryDto[]>([])
const summaryLoading = ref(false)
const productFilter = ref<{ uuid: string, name: string } | null>(null)

async function loadSummary() {
  summaryLoading.value = true
  try {
    summary.value = (await mySummary(scope.value)) ?? []
  }
  catch {
    summary.value = []
  }
  finally {
    summaryLoading.value = false
  }
}

function summaryLabel(s: UsageServiceSummaryDto): string {
  return s.productName || t('members.usage.summary.uncatalogued', { category: s.productCategoryName })
}

function toggleProduct(s: UsageServiceSummaryDto) {
  if (!s.productUuid) return
  productFilter.value = productFilter.value?.uuid === s.productUuid
    ? null
    : { uuid: s.productUuid, name: s.productName || s.productCategoryName }
}

async function load() {
  loading.value = true
  try {
    const res = await myHistory({
      page: page.value - 1,
      size: size.value,
      sort: 'usageDate,desc',
      ...scope.value,
      productUuid: productFilter.value?.uuid,
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

/** Any filter change restarts on page 1 (the page watcher reloads if it moves). */
function reloadFromFirstPage() {
  if (page.value !== 1) page.value = 1
  else load()
}

// Declared first on purpose: it clears the service filter (which belongs to
// the previous person's summary) before the combined watcher below runs, so a
// "who" change triggers a single list reload.
watch(who, () => {
  productFilter.value = null
  loadSummary()
})
watch([who, () => productFilter.value?.uuid], reloadFromFirstPage)

const hasFilters = computed(() => who.value !== 'all' || !!productFilter.value)

onMounted(() => {
  load()
  loadSummary()
  loadFamily()
})

// ---- Rating ----
const canRate = computed(() => can('MEMBER_RATE_USAGE'))
const ratingOpen = ref(false)
const ratingUsage = ref<BenefitUsageDto | null>(null)

function isRatable(u: BenefitUsageDto): boolean {
  return canRate.value && u.status === RATABLE_USAGE_STATUS
}

function openRating(u: BenefitUsageDto) {
  ratingUsage.value = u
  ratingOpen.value = true
}

/** Swap the row in place with the PUT response — no reload, keeps the page. */
function onRated(updated: BenefitUsageDto) {
  const i = data.value.findIndex(u => u.uuid === updated.uuid)
  if (i >= 0) data.value[i] = { ...data.value[i], ...updated }
}

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

    <!-- Who consumed -->
    <div v-if="family.length > 0" class="flex flex-wrap items-center gap-2">
      <span class="text-xs font-semibold uppercase tracking-wide text-prohealth-400 mr-1">{{ t('members.usage.who.label') }}</span>
      <UButton
        v-for="o in whoOptions"
        :key="o.value"
        size="xs"
        variant="soft"
        :color="who === o.value ? 'primary' : 'neutral'"
        :aria-pressed="who === o.value"
        @click="who = o.value"
      >
        {{ o.label }}
        <span v-if="o.hint" class="font-normal opacity-70">· {{ o.hint }}</span>
      </UButton>
    </div>

    <!-- Summary by service -->
    <section v-if="summaryLoading || summary.length > 0" class="space-y-2">
      <div>
        <h2 class="text-sm font-bold text-prohealth-900">{{ t('members.usage.summary.title') }}</h2>
        <p class="text-xs text-prohealth-500">{{ t('members.usage.summary.subtitle') }}</p>
      </div>
      <div v-if="summaryLoading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <USkeleton v-for="i in 3" :key="i" class="h-20 rounded-2xl" />
      </div>
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <component
          :is="s.productUuid ? 'button' : 'div'"
          v-for="s in summary"
          :key="s.productUuid ?? `cat-${s.productCategoryName}`"
          :type="s.productUuid ? 'button' : undefined"
          :title="s.productUuid ? t('members.usage.summary.filterTooltip') : undefined"
          :aria-pressed="s.productUuid ? productFilter?.uuid === s.productUuid : undefined"
          class="text-left bg-white rounded-2xl border p-4 transition-colors"
          :class="[
            s.productUuid ? 'cursor-pointer hover:border-primary-300 hover:bg-primary-50/40' : '',
            s.productUuid && productFilter?.uuid === s.productUuid ? 'border-primary-400 ring-1 ring-primary-300' : 'border-prohealth-100',
          ]"
          @click="toggleProduct(s)"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="font-semibold text-prohealth-900 truncate">{{ summaryLabel(s) }}</p>
              <p class="text-xs text-prohealth-500 truncate">{{ s.productCategoryName }}</p>
            </div>
            <span class="shrink-0 text-lg font-extrabold text-prohealth-900">{{ s.usageCount }}</span>
          </div>
          <p class="text-xs text-prohealth-500 mt-1.5 flex items-center justify-between gap-2">
            <span>{{ t('members.usage.summary.lastUsage', { date: s.lastUsageDate_Display ?? formatDate(s.lastUsageDate) }) }}</span>
            <span class="text-prohealth-400">{{ t('members.usage.summary.times', { count: s.usageCount }, s.usageCount) }}</span>
          </p>
        </component>
      </div>
    </section>

    <!-- Active service filter -->
    <div v-if="productFilter" class="flex flex-wrap items-center gap-2">
      <UBadge color="primary" variant="soft" size="lg" class="gap-1.5">
        <UIcon name="i-lucide-filter" class="w-3.5 h-3.5" />
        {{ t('members.usage.filters.service', { name: productFilter.name }) }}
        <UButton
          size="xs"
          color="primary"
          variant="link"
          icon="i-lucide-x"
          class="-mr-1 p-0"
          :aria-label="t('members.usage.filters.clear')"
          @click="productFilter = null"
        />
      </UBadge>
    </div>

    <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden">
      <div v-if="loading" class="px-6 py-8 space-y-3">
        <USkeleton class="h-5 w-full rounded" />
        <USkeleton class="h-5 w-3/4 rounded" />
      </div>

      <div v-else-if="data.length === 0" class="px-6 py-10 text-center text-prohealth-500">
        <UIcon name="i-lucide-clipboard-list" class="w-7 h-7 mx-auto mb-2 text-prohealth-300" />
        <p class="text-sm">{{ hasFilters ? t('members.usage.emptyFiltered') : t('members.usage.empty') }}</p>
      </div>

      <ul v-else class="divide-y divide-prohealth-100">
        <li v-for="u in data" :key="u.uuid" class="px-6 py-3.5 flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="font-semibold text-prohealth-900 truncate">
              {{ u.allyName || t('common.empty') }}
              <UBadge v-if="u.status && u.status !== RATABLE_USAGE_STATUS" color="neutral" variant="soft" size="sm" class="ml-1 align-middle">
                {{ u.status_Display || u.status }}
              </UBadge>
            </p>
            <p class="text-xs text-prohealth-500 truncate">
              {{ u.usageDate_Display ?? formatDate(u.usageDate) }}
              · {{ [u.allyProductName, u.productCategoryName, u.planCode].filter(Boolean).join(' · ') || t('common.empty') }}
            </p>
            <p v-if="u.consumedByName" class="text-xs text-prohealth-600 mt-0.5 flex items-center gap-1 min-w-0">
              <UIcon name="i-lucide-user" class="w-3.5 h-3.5 shrink-0 text-prohealth-400" />
              <span class="sr-only">{{ t('members.usage.consumedBy') }}:</span>
              <span class="truncate">{{ u.consumedByName }}</span>
              <span class="text-prohealth-400 shrink-0">· {{ u.beneficiaryUuid ? (relationshipLabel(u.beneficiaryRelationship) ?? t('common.empty')) : t('members.usage.holderTag') }}</span>
            </p>
            <p v-if="u.notes" class="text-xs text-prohealth-400 truncate mt-0.5">{{ u.notes }}</p>

            <!-- My rating -->
            <div v-if="u.allyRating != null" class="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-prohealth-500">
              <span class="inline-flex items-center gap-1.5">
                {{ t('members.usage.rating.allyShort') }}
                <RatingStars :model-value="u.allyRating" size="xs" :label="t('members.usage.rating.allyShort')" />
              </span>
              <span v-if="u.productRating != null" class="inline-flex items-center gap-1.5 min-w-0">
                <span class="truncate">{{ u.allyProductName || t('members.usage.rating.productFallback') }}</span>
                <RatingStars :model-value="u.productRating" size="xs" :label="u.allyProductName || t('members.usage.rating.productFallback')" />
              </span>
            </div>
            <p v-if="u.allyRating != null && u.ratingComment" class="text-xs italic text-prohealth-500 mt-0.5 line-clamp-2">
              “{{ u.ratingComment }}”
            </p>
            <UButton
              v-if="isRatable(u)"
              size="xs"
              :variant="u.allyRating != null ? 'ghost' : 'soft'"
              color="primary"
              :icon="u.allyRating != null ? 'i-lucide-pencil' : 'i-lucide-star'"
              class="mt-1.5 -ml-1"
              @click="openRating(u)"
            >
              {{ u.allyRating != null ? t('members.usage.rating.editButton') : t('members.usage.rating.rateButton') }}
            </UButton>
          </div>
          <div class="text-right shrink-0 space-y-0.5">
            <p v-if="money(u.consumptionAmount, u.consumptionCurrency)" class="text-sm font-semibold text-prohealth-800">
              <CurrencyConverterDisplay :amount="u.consumptionAmount" :currency="u.consumptionCurrency" :date="u.usageDate" v-slot="{ result }">
                <span class="inline-flex items-center justify-end gap-1">
                  {{ money(u.consumptionAmount, u.consumptionCurrency) }}
                  <CurrencyConverterTrigger :result="result" />
                </span>
              </CurrencyConverterDisplay>
              <span class="text-xs font-normal text-prohealth-400">{{ t('members.usage.consumption') }}</span>
            </p>
            <p v-if="money(u.copayAmount, u.copayCurrency)" class="text-xs text-prohealth-500">
              <CurrencyConverterDisplay :amount="u.copayAmount" :currency="u.copayCurrency" :date="u.usageDate" v-slot="{ result }">
                <span class="inline-flex items-center justify-end gap-1">
                  {{ t('members.usage.copay') }}: {{ money(u.copayAmount, u.copayCurrency) }}
                  <CurrencyConverterTrigger :result="result" />
                </span>
              </CurrencyConverterDisplay>
            </p>
          </div>
        </li>
      </ul>

      <div v-if="!loading && total > size" class="flex items-center justify-end px-6 py-3 border-t border-prohealth-100">
        <UPagination v-model:page="page" :total="total" :items-per-page="size" />
      </div>
    </div>

    <UsageRatingModal v-model:open="ratingOpen" :usage="ratingUsage" @saved="onRated" />
  </div>
</template>
