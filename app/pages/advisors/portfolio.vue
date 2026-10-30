<script setup lang="ts">
import { z } from 'zod'
import type {
  CollectionScoreDto,
  PromoterContactType,
  PromoterDashboardDto,
  PromoterMemberContactDto,
  PromoterMemberRow,
} from '~/types/promoters'
import { todayInCaracas } from '~/utils/date'

// "Mi cartera" — portfolio management self-service of the logged-in advisor
// (v2 PDF 2.b). Rows come from the dashboard aggregate (GET /v1/advisors/me,
// `portfolio`), the summary from GET /v1/advisors/me/collection-score, and
// the per-row actions from PromoterContactsController: reminder /
// payment-promise (PROMOTER_CONTACT_OWN) and the contact history
// (PROMOTER_VIEW_OWN). The backend has no "last contact" per portfolio row,
// so the history is fetched on demand per affiliate.
definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'PROMOTER_VIEW_OWN',
})

const { t } = useI18n()
const { formatCurrency, formatDate } = useFormatters()
const promoters = usePromoters()
const { can } = usePermissions()
const toast = useToast()

useSeoMeta({ title: () => t('common.seoTitle', { page: t('promoterSelf.portfolio.title') }) })

const canContact = computed(() => can('PROMOTER_CONTACT_OWN'))

// V201: register a new person into the portfolio and collect from anyone in it, membership or not.
const canCreatePerson = computed(() => can('PROMOTER_PORTFOLIO_CREATE'))
const canRegisterPayment = computed(() => can('COLLECTION_CREATE_DOWNLINE'))
const newMemberOpen = ref(false)
const paymentOpen = ref(false)

const dashboard = ref<PromoterDashboardDto | null>(null)
const score = ref<CollectionScoreDto | null>(null)
const loading = ref(false)
const loadFailed = ref(false)

async function load() {
  loading.value = true
  loadFailed.value = false
  try {
    const [dash, sc] = await Promise.all([
      promoters.me(),
      // The summary is secondary — a failure there must not blank the table.
      promoters.myCollectionScore().catch(() => null),
    ])
    dashboard.value = dash
    score.value = sc
  }
  catch {
    // useApi already shows the error toast
    dashboard.value = null
    score.value = null
    loadFailed.value = true
  }
  finally {
    loading.value = false
  }
}

onMounted(load)

// ---- Client-side filter + search (the portfolio is an embedded array, not a paged endpoint) ----
type PortfolioBucket = 'upToDate' | 'overdue' | 'withoutMembership'
type PortfolioFilter = 'all' | PortfolioBucket

const filter = ref<PortfolioFilter>('all')
const search = ref('')

function bucketOf(row: PromoterMemberRow): PortfolioBucket {
  if (row.membershipStatus === 'ACTIVE') return 'upToDate'
  if (row.membershipStatus === 'SUSPENDED' || row.membershipStatus === 'EXPIRED') return 'overdue'
  return 'withoutMembership'
}

const rows = computed(() => dashboard.value?.portfolio ?? [])

const bucketCounts = computed(() => {
  const counts: Record<PortfolioBucket, number> = { upToDate: 0, overdue: 0, withoutMembership: 0 }
  for (const r of rows.value) counts[bucketOf(r)]++
  return counts
})

const filteredRows = computed(() => {
  const q = search.value.trim().toLocaleLowerCase()
  return rows.value.filter(r =>
    (filter.value === 'all' || bucketOf(r) === filter.value)
    && (!q || r.memberName.toLocaleLowerCase().includes(q)),
  )
})

const filterOptions = computed<{ value: PortfolioFilter, label: string, count: number, color: 'primary' | 'success' | 'warning' | 'neutral' }[]>(() => [
  { value: 'all', label: t('promoterSelf.portfolio.filters.all'), count: rows.value.length, color: 'primary' },
  { value: 'upToDate', label: t('promoterSelf.portfolio.filters.upToDate'), count: bucketCounts.value.upToDate, color: 'success' },
  { value: 'overdue', label: t('promoterSelf.portfolio.filters.overdue'), count: bucketCounts.value.overdue, color: 'warning' },
  { value: 'withoutMembership', label: t('promoterSelf.portfolio.filters.withoutMembership'), count: bucketCounts.value.withoutMembership, color: 'neutral' },
])

function statusLabel(row: PromoterMemberRow): string {
  return t(`promoterSelf.portfolio.status.${bucketOf(row)}`)
}

function statusColor(row: PromoterMemberRow): 'success' | 'warning' | 'neutral' {
  const b = bucketOf(row)
  if (b === 'upToDate') return 'success'
  if (b === 'overdue') return 'warning'
  return 'neutral'
}

// Monthly fees are priced in USD (same rationale as the admin portfolio tab
// in pages/dashboard/advisors/[uuid].vue — the backend MONEY _Display
// assumes VES).
function money(v?: number | null): string {
  if (v === null || v === undefined) return t('common.empty')
  return formatCurrency(Number(v), 'USD')
}

function noPermissionTooltip(label: string): string {
  return canContact.value ? label : t('promoterSelf.portfolio.noPermissionContact')
}

// ---- Reminder (note optional) ----
const NOTE_MAX = 2000
const reminderOpen = ref(false)
const reminderSaving = ref(false)
const reminderTarget = ref<PromoterMemberRow | null>(null)
const reminderNote = ref('')

function openReminder(row: PromoterMemberRow) {
  reminderTarget.value = row
  reminderNote.value = ''
  reminderOpen.value = true
}

async function confirmReminder() {
  if (!reminderTarget.value || reminderNote.value.length > NOTE_MAX) return
  reminderSaving.value = true
  try {
    const note = reminderNote.value.trim()
    await promoters.registerReminder(reminderTarget.value.memberUuid, note ? { note } : {})
    toast.add({ title: t('promoterSelf.portfolio.reminder.savedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    reminderOpen.value = false
    await load()
  }
  catch {
    // useApi already notified the error
  }
  finally {
    reminderSaving.value = false
  }
}

// ---- Payment promise ----
const promiseOpen = ref(false)
const promiseSaving = ref(false)
const promiseTarget = ref<PromoterMemberRow | null>(null)
const promiseState = reactive({ promisedAmount: '', promisedAtDate: '', note: '' })

const promiseSchema = computed(() => z.object({
  promisedAmount: z.string()
    .regex(/^\d{1,8}(\.\d{1,2})?$/, t('validation.invalidAmount'))
    .refine(v => Number(v) >= 0.01, t('promoterSelf.portfolio.promise.validation.amountMin')),
  promisedAtDate: z.string()
    .min(1, t('validation.required'))
    .refine(v => v >= todayInCaracas(), t('promoterSelf.portfolio.promise.validation.datePast')),
  note: z.string().max(NOTE_MAX, t('validation.maxChars', { n: NOTE_MAX })).optional(),
}))

function openPromise(row: PromoterMemberRow) {
  promiseTarget.value = row
  promiseState.promisedAmount = row.monthlyFee !== null && row.monthlyFee !== undefined ? Number(row.monthlyFee).toFixed(2) : ''
  promiseState.promisedAtDate = todayInCaracas()
  promiseState.note = ''
  promiseOpen.value = true
}

async function submitPromise() {
  if (!promiseTarget.value) return
  promiseSaving.value = true
  try {
    const note = promiseState.note.trim()
    await promoters.registerPaymentPromise(promiseTarget.value.memberUuid, {
      promisedAmount: Number(promiseState.promisedAmount),
      promisedAtDate: promiseState.promisedAtDate,
      ...(note ? { note } : {}),
    })
    toast.add({ title: t('promoterSelf.portfolio.promise.savedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    promiseOpen.value = false
    await load()
  }
  catch {
    // useApi already notified the error
  }
  finally {
    promiseSaving.value = false
  }
}

// ---- Contact history (on demand, per affiliate) ----
const historyOpen = ref(false)
const historyLoading = ref(false)
const historyTarget = ref<PromoterMemberRow | null>(null)
const history = ref<PromoterMemberContactDto[]>([])

async function openHistory(row: PromoterMemberRow) {
  historyTarget.value = row
  history.value = []
  historyOpen.value = true
  historyLoading.value = true
  try {
    history.value = await promoters.myMemberContacts(row.memberUuid)
  }
  catch {
    history.value = []
  }
  finally {
    historyLoading.value = false
  }
}

function contactTypeLabel(c: PromoterMemberContactDto): string {
  return c.type_Display ?? t(`promoterSelf.portfolio.history.types.${c.type}`, c.type)
}

function contactTypeIcon(type: PromoterContactType): string {
  if (type === 'REMINDER') return 'i-lucide-bell-ring'
  if (type === 'PAYMENT_PROMISE') return 'i-lucide-handshake'
  return 'i-lucide-sticky-note'
}
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-extrabold text-prohealth-900">{{ t('promoterSelf.portfolio.title') }}</h1>
        <p class="text-sm text-prohealth-700/70 mt-1">{{ t('promoterSelf.portfolio.subtitle') }}</p>
      </div>
      <div class="flex items-center gap-2">
        <UButton v-if="canCreatePerson" color="primary" variant="outline" icon="i-lucide-user-plus" @click="newMemberOpen = true">
          {{ t('promoterSelf.newMember.title') }}
        </UButton>
        <UButton v-if="canRegisterPayment" color="primary" variant="outline" icon="i-lucide-receipt" @click="paymentOpen = true">
          {{ t('promoterSelf.portfolio.registerPayment') }}
        </UButton>
        <RefreshButton :loading="loading" @refresh="load" />
      </div>
    </div>

    <!-- Collection score summary -->
    <div class="grid grid-cols-2 lg:grid-cols-5 gap-3">
      <template v-if="loading && !score">
        <USkeleton v-for="i in 5" :key="i" class="h-20 rounded-2xl" />
      </template>
      <template v-else-if="score">
        <div class="col-span-2 lg:col-span-1 bg-white rounded-2xl border border-prohealth-100 p-4">
          <p class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('promoterSelf.portfolio.score.scorePct') }}</p>
          <p class="text-2xl font-extrabold text-prohealth-900 mt-1">{{ score.scorePct_Display ?? score.scorePct }}%</p>
          <p class="text-xs text-prohealth-500 mt-0.5">{{ t('promoterSelf.portfolio.score.scoreHint') }}</p>
        </div>
        <div class="bg-white rounded-2xl border border-prohealth-100 p-4">
          <p class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('promoterSelf.portfolio.score.activeAffiliates') }}</p>
          <p class="text-2xl font-extrabold text-prohealth-900 mt-1">{{ score.activeAffiliates }}</p>
        </div>
        <div class="bg-white rounded-2xl border border-prohealth-100 p-4">
          <p class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('promoterSelf.portfolio.score.upToDate') }}</p>
          <p class="text-2xl font-extrabold text-success mt-1">{{ score.upToDate }}</p>
        </div>
        <div class="bg-white rounded-2xl border border-prohealth-100 p-4">
          <p class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('promoterSelf.portfolio.score.overdue') }}</p>
          <p class="text-2xl font-extrabold text-warning mt-1">{{ score.overdue }}</p>
        </div>
        <div class="bg-white rounded-2xl border border-prohealth-100 p-4">
          <p class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('promoterSelf.portfolio.score.withoutMembership') }}</p>
          <p class="text-2xl font-extrabold text-prohealth-700 mt-1">{{ score.withoutMembership }}</p>
        </div>
      </template>
    </div>

    <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden flex flex-col h-[calc(100vh-22rem)] min-h-[24rem]">
      <div class="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-prohealth-100 shrink-0">
        <div class="flex flex-wrap items-center gap-2">
          <UButton
            v-for="f in filterOptions"
            :key="f.value"
            size="xs"
            variant="soft"
            :color="filter === f.value ? f.color : 'neutral'"
            @click="filter = f.value"
          >
            {{ f.label }} ({{ f.count }})
          </UButton>
        </div>
        <UInput
          v-model="search"
          icon="i-lucide-search"
          size="sm"
          :placeholder="t('promoterSelf.portfolio.searchPlaceholder')"
          class="w-full sm:w-64"
        />
      </div>

      <div class="overflow-auto flex-1">
        <table class="w-full text-sm">
          <thead class="sticky top-0 bg-white z-10">
            <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
              <th class="px-5 py-3 font-semibold">{{ t('promoterSelf.portfolio.columns.member') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('promoterSelf.portfolio.columns.status') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('promoterSelf.portfolio.columns.nextDueDate') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('promoterSelf.portfolio.columns.monthlyFee') }}</th>
              <th class="px-5 py-3 font-semibold text-right">{{ t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-prohealth-100">
            <TableSkeleton v-if="loading" :rows="8" :cols="5" />
            <tr v-else-if="loadFailed">
              <td colspan="5" class="px-5 py-12 text-center text-prohealth-500">
                <UIcon name="i-lucide-circle-alert" class="w-8 h-8 mx-auto mb-2 text-prohealth-300" />
                <p>{{ t('promoterSelf.portfolio.loadError') }}</p>
                <UButton class="mt-3" size="sm" variant="soft" icon="i-lucide-refresh-cw" @click="load">
                  {{ t('common.refresh') }}
                </UButton>
              </td>
            </tr>
            <tr v-else-if="filteredRows.length === 0">
              <td colspan="5" class="px-5 py-12 text-center text-prohealth-500">
                <UIcon name="i-lucide-users" class="w-8 h-8 mx-auto mb-2 text-prohealth-300" />
                {{ rows.length === 0 ? t('promoterSelf.portfolio.empty') : t('promoterSelf.portfolio.noMatches') }}
              </td>
            </tr>
            <tr v-for="r in filteredRows" v-else :key="r.memberUuid" class="hover:bg-prohealth-50/50">
              <td class="px-5 py-3 font-semibold text-prohealth-800">{{ r.memberName }}</td>
              <td class="px-5 py-3">
                <UBadge :color="statusColor(r)" variant="subtle" size="sm">
                  {{ r.membershipStatus_Display ?? statusLabel(r) }}
                </UBadge>
              </td>
              <td class="px-5 py-3 text-prohealth-600">{{ r.nextDueDate_Display ?? formatDate(r.nextDueDate, 'short') }}</td>
              <td class="px-5 py-3 text-prohealth-700">
                <CurrencyConverterDisplay v-if="r.monthlyFee != null" :amount="r.monthlyFee" currency="USD" v-slot="{ result }">
                  <span class="inline-flex items-center gap-1">
                    {{ money(r.monthlyFee) }}
                    <CurrencyConverterTrigger :result="result" />
                  </span>
                </CurrencyConverterDisplay>
                <template v-else>{{ t('common.empty') }}</template>
              </td>
              <td class="px-5 py-3">
                <div class="flex items-center justify-end gap-1">
                  <UTooltip :text="t('promoterSelf.portfolio.history.action')">
                    <UButton
                      color="neutral"
                      variant="ghost"
                      icon="i-lucide-history"
                      size="sm"
                      :aria-label="t('promoterSelf.portfolio.history.action')"
                      @click="openHistory(r)"
                    />
                  </UTooltip>
                  <UTooltip :text="noPermissionTooltip(t('promoterSelf.portfolio.reminder.action'))">
                    <UButton
                      color="primary"
                      variant="ghost"
                      icon="i-lucide-bell-ring"
                      size="sm"
                      :aria-label="t('promoterSelf.portfolio.reminder.action')"
                      :disabled="!canContact"
                      @click="openReminder(r)"
                    />
                  </UTooltip>
                  <UTooltip :text="noPermissionTooltip(t('promoterSelf.portfolio.promise.action'))">
                    <UButton
                      color="primary"
                      variant="ghost"
                      icon="i-lucide-handshake"
                      size="sm"
                      :aria-label="t('promoterSelf.portfolio.promise.action')"
                      :disabled="!canContact"
                      @click="openPromise(r)"
                    />
                  </UTooltip>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="px-5 py-3 border-t border-prohealth-100 shrink-0">
        <p class="text-xs text-prohealth-500">{{ t('catalogs.recordCount', { count: filteredRows.length }) }}</p>
      </div>
    </div>

    <!-- Reminder modal -->
    <UModal
      v-model:open="reminderOpen"
      :title="t('promoterSelf.portfolio.reminder.title')"
      :description="t('promoterSelf.portfolio.reminder.description', { name: reminderTarget?.memberName ?? '' })"
    >
      <template #body>
        <UFormField
          :label="t('promoterSelf.portfolio.fields.note')"
          :help="t('promoterSelf.portfolio.reminder.noteHelp')"
          :error="reminderNote.length > NOTE_MAX ? t('validation.maxChars', { n: NOTE_MAX }) : undefined"
        >
          <UTextarea v-model="reminderNote" :rows="3" class="w-full" />
        </UFormField>
        <div class="flex items-center justify-end gap-3 pt-5">
          <UButton color="neutral" variant="ghost" :disabled="reminderSaving" @click="reminderOpen = false">
            {{ t('common.cancel') }}
          </UButton>
          <UButton color="primary" :loading="reminderSaving" :disabled="reminderNote.length > NOTE_MAX" icon="i-lucide-bell-ring" @click="confirmReminder">
            {{ t('promoterSelf.portfolio.reminder.submit') }}
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Payment promise modal -->
    <UModal
      v-model:open="promiseOpen"
      :title="t('promoterSelf.portfolio.promise.title')"
      :description="t('promoterSelf.portfolio.promise.description', { name: promiseTarget?.memberName ?? '' })"
    >
      <template #body>
        <UForm :schema="promiseSchema" :state="promiseState" class="space-y-4" @submit="submitPromise">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField :label="t('promoterSelf.portfolio.fields.promisedAmount')" name="promisedAmount" required>
              <UInput v-model="promiseState.promisedAmount" placeholder="10.00" class="w-full text-right">
                <template #leading>
                  <span class="text-prohealth-400 text-sm">$</span>
                </template>
              </UInput>
            </UFormField>
            <UFormField :label="t('promoterSelf.portfolio.fields.promisedAtDate')" name="promisedAtDate" required>
              <AppDatePicker v-model="promiseState.promisedAtDate" :clearable="false" />
            </UFormField>
          </div>
          <UFormField :label="t('promoterSelf.portfolio.fields.note')" name="note">
            <UTextarea v-model="promiseState.note" :rows="3" class="w-full" />
          </UFormField>
          <div class="flex items-center justify-end gap-3 pt-2">
            <UButton color="neutral" variant="ghost" :disabled="promiseSaving" @click="promiseOpen = false">
              {{ t('common.cancel') }}
            </UButton>
            <UButton type="submit" color="primary" :loading="promiseSaving" icon="i-lucide-handshake">
              {{ t('promoterSelf.portfolio.promise.submit') }}
            </UButton>
          </div>
        </UForm>
      </template>
    </UModal>

    <!-- Contact history modal -->
    <UModal
      v-model:open="historyOpen"
      :title="t('promoterSelf.portfolio.history.title')"
      :description="historyTarget?.memberName ?? ''"
    >
      <template #body>
        <div v-if="historyLoading" class="space-y-3">
          <USkeleton v-for="i in 3" :key="i" class="h-14 rounded-xl" />
        </div>
        <div v-else-if="history.length === 0" class="py-6 text-center text-prohealth-500">
          <UIcon name="i-lucide-history" class="w-8 h-8 mx-auto mb-2 text-prohealth-300" />
          <p class="text-sm">{{ t('promoterSelf.portfolio.history.empty') }}</p>
        </div>
        <ul v-else class="divide-y divide-prohealth-100">
          <li v-for="c in history" :key="c.uuid" class="py-3 flex gap-3">
            <UIcon :name="contactTypeIcon(c.type)" class="w-5 h-5 mt-0.5 shrink-0 text-prohealth-500" />
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-baseline justify-between gap-2">
                <p class="font-semibold text-prohealth-900">{{ contactTypeLabel(c) }}</p>
                <p class="text-xs text-prohealth-500">{{ c.createdAt_Display ?? formatDate(c.createdAt, 'datetime') }}</p>
              </div>
              <p v-if="c.type === 'PAYMENT_PROMISE'" class="text-sm text-prohealth-700 mt-0.5">
                <CurrencyConverterDisplay :amount="c.promisedAmount" currency="USD" :date="c.promisedAtDate" v-slot="{ result }">
                  <span class="inline-flex items-center gap-1">
                    {{ t('promoterSelf.portfolio.history.promiseLine', {
                      amount: money(c.promisedAmount),
                      date: c.promisedAtDate_Display ?? formatDate(c.promisedAtDate, 'short'),
                    }) }}
                    <CurrencyConverterTrigger :result="result" />
                  </span>
                </CurrencyConverterDisplay>
              </p>
              <p v-if="c.note" class="text-sm text-prohealth-600 mt-0.5 whitespace-pre-line break-words">{{ c.note }}</p>
            </div>
          </li>
        </ul>
      </template>
    </UModal>

    <PortfolioNewMemberModal v-model:open="newMemberOpen" @created="load" />
    <DownlinePaymentFormModal v-model:open="paymentOpen" @saved="load" />
  </div>
</template>
