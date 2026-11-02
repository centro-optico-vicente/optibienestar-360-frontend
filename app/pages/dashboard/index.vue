<script setup lang="ts">
import imgEyeTest from '~/assets/img/260c06e4612a1bcca2ebc97cbe1ef392.jpg'
import img1 from '~/assets/img/104f493a124416e8cec5195e449b3d0f.jpg'
import img2 from '~/assets/img/2cebb4172b5f4801ec4037d48736b911.jpg'
import img3 from '~/assets/img/85e129d7a660b545b497d9e65b47b3a4.jpg'
import img4 from '~/assets/img/c08baae430a8d168d93847b175f3d6ec.jpg'
import {
  DASHBOARD_COLORS,
  DASHBOARD_SECTIONS,
  type DashboardActivity,
  type DashboardActivityStatus,
  type DashboardChart,
  type DashboardChartDatum,
  type DashboardDto,
  type DashboardKpi,
  type DashboardSection,
} from '~/composables/useDashboard'

definePageMeta({ layout: 'dashboard' })

const { t, te, locale } = useI18n()
const auth = useAuthStore()
const { can } = usePermissions()
// Figures keep the VE convention regardless of UI locale (ADR 0010).
const { formatNumber, formatCurrency, formatDate } = useFormatters()
const dashboardApi = useDashboard()

useSeoMeta({ title: () => t('common.seoTitle', { page: t('nav.items.panel.label') }) })

// ---- Data ----
const data = ref<DashboardDto | null>(null)
const loading = ref(true)
const failed = ref(false)

async function load() {
  loading.value = true
  failed.value = false
  try {
    data.value = await dashboardApi.fetchMine()
  }
  catch {
    failed.value = true
  }
  finally {
    loading.value = false
  }
}

onMounted(load)

// Staff open the new-member form on the members list; an advisor (no access to that list)
// registers people from their own portfolio instead.
const newMemberTarget = computed(() => {
  if (can('MEMBER_CREATE') && can('MEMBER_VIEW_ALL')) return { path: '/dashboard/members', query: { new: '1' } }
  if (can('PROMOTER_PORTFOLIO_CREATE')) return { path: '/advisors/portfolio' }
  return null
})
// ---- Sections ----
const SECTION_ICON: Record<DashboardSection, string> = {
  MANAGEMENT: 'i-lucide-layout-dashboard',
  ADVISOR: 'i-lucide-briefcase',
  ALLY: 'i-lucide-handshake',
  MEMBER: 'i-lucide-id-card',
}

interface SectionView {
  section: DashboardSection
  kpis: DashboardKpi[]
  charts: DashboardChart[]
}

const sections = computed<SectionView[]>(() => {
  const d = data.value
  if (!d) return []
  return DASHBOARD_SECTIONS
    .filter(s => d.sections.includes(s))
    .map(section => ({
      section,
      kpis: d.kpis.filter(k => k.section === section),
      charts: d.charts.filter(c => c.section === section),
    }))
})

const isEmpty = computed(() => !!data.value && sections.value.every(s => !s.kpis.length && !s.charts.length))

/** Falls back to the raw key when a translation is missing (unknown key from a newer backend). */
const tr = (key: string, fallback: string) => (te(key) ? t(key) : fallback)

// ---- KPIs ----
interface KpiStyle { icon: string, accent: string }

const KPI_STYLE: Record<string, KpiStyle> = {
  activeMembers: { icon: 'i-lucide-users', accent: 'bg-prohealth-50 text-prohealth-700' },
  monthlyRevenue: { icon: 'i-lucide-banknote', accent: 'bg-lime-50 text-lime-700' },
  allyUsages: { icon: 'i-lucide-handshake', accent: 'bg-cyan-50 text-cyan-700' },
  pendingPayments: { icon: 'i-lucide-clock', accent: 'bg-orange-50 text-orange-700' },
  pendingAffiliationRequests: { icon: 'i-lucide-inbox', accent: 'bg-orange-50 text-orange-700' },
  portfolioMembers: { icon: 'i-lucide-users', accent: 'bg-prohealth-50 text-prohealth-700' },
  portfolioUpToDate: { icon: 'i-lucide-circle-check', accent: 'bg-lime-50 text-lime-700' },
  portfolioDue: { icon: 'i-lucide-clock', accent: 'bg-orange-50 text-orange-700' },
  portfolioOverdue: { icon: 'i-lucide-circle-alert', accent: 'bg-red-50 text-red-600' },
  portfolioNewThisMonth: { icon: 'i-lucide-user-plus', accent: 'bg-cyan-50 text-cyan-700' },
  allyMonthUsages: { icon: 'i-lucide-receipt-text', accent: 'bg-prohealth-50 text-prohealth-700' },
  allyMembersServed: { icon: 'i-lucide-users', accent: 'bg-cyan-50 text-cyan-700' },
  allyRating: { icon: 'i-lucide-star', accent: 'bg-lime-50 text-lime-700' },
  membershipStatus: { icon: 'i-lucide-shield-check', accent: 'bg-prohealth-50 text-prohealth-700' },
  nextDueDate: { icon: 'i-lucide-calendar-clock', accent: 'bg-orange-50 text-orange-700' },
  beneficiaries: { icon: 'i-lucide-users-round', accent: 'bg-cyan-50 text-cyan-700' },
  memberMonthUsages: { icon: 'i-lucide-receipt-text', accent: 'bg-lime-50 text-lime-700' },
  memberTotalUsages: { icon: 'i-lucide-history', accent: 'bg-prohealth-50 text-prohealth-700' },
}
const DEFAULT_KPI_STYLE: KpiStyle = { icon: 'i-lucide-activity', accent: 'bg-prohealth-50 text-prohealth-700' }

// Indicators where a rise is bad news (variation shown in red when it goes up).
const LOWER_IS_BETTER = new Set(['pendingPayments', 'pendingAffiliationRequests', 'portfolioDue', 'portfolioOverdue'])

const MEMBERSHIP_TONE: Record<string, string> = {
  ACTIVE: 'text-lime-700',
  SUSPENDED: 'text-orange-600',
  EXPIRED: 'text-red-600',
  CANCELED: 'text-prohealth-500',
  NONE: 'text-prohealth-500',
}

const kpiStyle = (k: DashboardKpi) => KPI_STYLE[k.key] ?? DEFAULT_KPI_STYLE
const kpiLabel = (k: DashboardKpi) => tr(`dashboard.kpis.${k.key}`, k.key)

function kpiValue(k: DashboardKpi): string {
  switch (k.format) {
    case 'MONEY':
      return formatCurrency(k.value ?? 0, k.currency)
    case 'TEXT':
      return k.text ? tr(`dashboard.membershipStatus.${k.text}`, k.text) : t('common.empty')
    case 'DATE':
      return k.text ? formatDate(k.text, 'long') : t('dashboard.noDueDate')
    case 'RATING':
      return k.value === undefined
        ? t('dashboard.rating.none')
        : t('dashboard.rating.outOf', { value: k.value.toLocaleString(locale.value, { maximumFractionDigits: 1 }) })
    default:
      return formatNumber(k.value ?? 0)
  }
}

const kpiValueClass = (k: DashboardKpi) =>
  k.format === 'TEXT' ? (MEMBERSHIP_TONE[k.text ?? ''] ?? 'text-prohealth-900') : 'text-prohealth-900'

interface KpiDelta { label: string, icon: string, tone: string }

function kpiDelta(k: DashboardKpi): KpiDelta | null {
  if (k.previousValue === undefined || k.value === undefined) return null
  const current = k.value
  const previous = k.previousValue
  if (current === previous) {
    return { label: t('dashboard.delta.noChange'), icon: 'i-lucide-minus', tone: 'text-prohealth-500' }
  }
  const up = current > previous
  const good = LOWER_IS_BETTER.has(k.key) ? !up : up
  const tone = good ? 'text-lime-700' : 'text-red-600'
  const icon = up ? 'i-lucide-trending-up' : 'i-lucide-trending-down'
  if (previous === 0) return { label: t('dashboard.delta.new'), icon, tone }
  const pct = ((current - previous) / Math.abs(previous)) * 100
  const label = `${pct > 0 ? '+' : ''}${pct.toLocaleString(locale.value, { maximumFractionDigits: 1 })}%`
  return { label, icon, tone }
}

// ---- Charts ----
const ENUM_COLORS: Record<string, string> = {
  ACTIVE: DASHBOARD_COLORS.lime,
  UP_TO_DATE: DASHBOARD_COLORS.lime,
  SUSPENDED: DASHBOARD_COLORS.orange,
  DUE: DASHBOARD_COLORS.orange,
  EXPIRED: DASHBOARD_COLORS.red,
  OVERDUE: DASHBOARD_COLORS.red,
  CANCELED: DASHBOARD_COLORS.gray,
  NO_MEMBERSHIP: DASHBOARD_COLORS.gray,
}

const CHART_COLOR: Record<DashboardSection, string> = {
  MANAGEMENT: DASHBOARD_COLORS.prohealth,
  ADVISOR: DASHBOARD_COLORS.prohealth,
  ALLY: DASHBOARD_COLORS.cyan,
  MEMBER: DASHBOARD_COLORS.lime,
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number)
  if (!y || !m) return key
  // Mid-month at noon UTC: the label never drifts to a neighbouring month in any timezone.
  return new Intl.DateTimeFormat(locale.value, { month: 'short', year: '2-digit', timeZone: 'UTC' })
    .format(new Date(Date.UTC(y, m - 1, 15, 12)))
}

function chartData(c: DashboardChart): DashboardChartDatum[] {
  return c.points.map((p) => {
    const label = c.labelKind === 'MONTH'
      ? monthLabel(p.key)
      : c.labelKind === 'ENUM'
        ? tr(`dashboard.charts.enums.${c.key}.${p.key}`, p.key)
        : (p.label ?? p.key)
    return {
      key: p.key,
      label,
      value: p.value,
      color: c.labelKind === 'ENUM' ? ENUM_COLORS[p.key] : undefined,
    }
  })
}

const chartTitle = (c: DashboardChart) => tr(`dashboard.charts.titles.${c.key}`, c.key)
const chartSubtitle = (c: DashboardChart) => (c.labelKind === 'MONTH' || c.labelKind === 'TEXT') && c.type !== 'DONUT'
  ? t('dashboard.charts.lastMonths')
  : undefined

const compactMoney = (value: number) =>
  `$${new Intl.NumberFormat('es-VE', { notation: 'compact', maximumFractionDigits: 1 }).format(value)}`

const chartFormatter = (c: DashboardChart) =>
  c.format === 'MONEY'
    ? (v: number) => formatCurrency(v, c.currency)
    : (v: number) => formatNumber(v)

// ---- Activity ----
const ACTIVITY_ICON: Record<string, string> = {
  PAYMENT_REGISTERED: 'i-lucide-banknote',
  PAYMENT_APPROVED: 'i-lucide-badge-check',
  PAYMENT_REJECTED: 'i-lucide-ban',
  USAGE_REGISTERED: 'i-lucide-receipt-text',
  USAGE_REVERSED: 'i-lucide-undo-2',
  AFFILIATION_REQUEST_RECEIVED: 'i-lucide-inbox',
  AFFILIATION_REQUEST_APPROVED: 'i-lucide-user-check',
  AFFILIATION_REQUEST_REJECTED: 'i-lucide-user-x',
  MEMBER_ENROLLED: 'i-lucide-user-plus',
}

const ACTIVITY_ACCENT: Record<DashboardActivityStatus, string> = {
  SUCCESS: 'bg-lime-50 text-lime-700',
  PENDING: 'bg-orange-50 text-orange-700',
  ERROR: 'bg-red-50 text-red-600',
}

const statusColor: Record<DashboardActivityStatus, 'success' | 'warning' | 'error'> = {
  SUCCESS: 'success',
  PENDING: 'warning',
  ERROR: 'error',
}

const activity = computed<DashboardActivity[]>(() => data.value?.activity ?? [])

// Ticks every minute so "hace 2 min" stays current while the panel is open.
const now = ref(Date.now())
let ticker: ReturnType<typeof setInterval> | undefined
onMounted(() => { ticker = setInterval(() => { now.value = Date.now() }, 60_000) })
onBeforeUnmount(() => { if (ticker) clearInterval(ticker) })

function relativeTime(iso: string): string {
  const diffMs = new Date(iso).getTime() - now.value
  if (Number.isNaN(diffMs)) return ''
  const rtf = new Intl.RelativeTimeFormat(locale.value, { numeric: 'auto' })
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 31_536_000_000],
    ['month', 2_592_000_000],
    ['week', 604_800_000],
    ['day', 86_400_000],
    ['hour', 3_600_000],
    ['minute', 60_000],
  ]
  for (const [unit, ms] of units) {
    if (Math.abs(diffMs) >= ms) return rtf.format(Math.round(diffMs / ms), unit)
  }
  return rtf.format(0, 'minute')
}

const activityDescription = (a: DashboardActivity) => {
  const what = tr(`dashboard.activity.types.${a.type}`, a.type)
  const parts = [what, a.subtitle].filter(Boolean)
  const amount = a.amount !== undefined ? formatCurrency(a.amount, a.currency) : null
  return amount ? `${parts.join(' · ')} · ${amount}` : parts.join(' · ')
}

// ---- Gallery ----
interface GalleryItem {
  src: string
  alt: string
}

const gallery = computed<GalleryItem[]>(() => [
  { src: imgEyeTest, alt: t('dashboard.gallery.items.eyeTest') },
  { src: img1, alt: t('dashboard.gallery.items.care') },
  { src: img2, alt: t('dashboard.gallery.items.services') },
  { src: img3, alt: t('dashboard.gallery.items.frames') },
  { src: img4, alt: t('dashboard.gallery.items.center') },
])

// Time-of-day greeting key resolved against the `dashboard.greeting.*` bundle.
const greetingKey = computed<'morning' | 'afternoon' | 'evening'>(() => {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 19) return 'afternoon'
  return 'evening'
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl md:text-3xl font-extrabold text-prohealth-900">
          {{ t(`dashboard.greeting.${greetingKey}`) }}, {{ auth.user?.fullName || auth.user?.email }} 👋
        </h1>
        <p class="text-sm text-prohealth-700/70 mt-1">
          {{ t('dashboard.subtitle') }}
        </p>
      </div>
      <UButton
        v-if="newMemberTarget"
        :to="newMemberTarget"
        color="primary"
        variant="solid"
        icon="i-lucide-plus"
        size="sm"
      >
        {{ t('dashboard.newMember') }}
      </UButton>
    </div>

    <!-- Loading -->
    <div v-if="loading && !data" class="space-y-4" aria-busy="true">
      <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <USkeleton v-for="i in 4" :key="i" class="h-32 rounded-2xl" />
      </div>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <USkeleton v-for="i in 2" :key="i" class="h-72 rounded-2xl" />
      </div>
    </div>

    <!-- Error -->
    <UAlert
      v-else-if="failed"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      :title="t('dashboard.loadError')"
      :actions="[{ label: t('dashboard.retry'), icon: 'i-lucide-refresh-cw', color: 'error', variant: 'outline', onClick: load }]"
    />

    <!-- Empty -->
    <div
      v-else-if="isEmpty"
      class="bg-white rounded-2xl border border-prohealth-100 p-8 text-center text-prohealth-500"
    >
      <UIcon name="i-lucide-chart-pie" class="w-8 h-8 mx-auto" />
      <p class="mt-2 text-sm">{{ t('dashboard.empty') }}</p>
    </div>

    <!-- Sections -->
    <template v-else>
      <section
        v-for="s in sections"
        :key="s.section"
        class="space-y-4"
        :aria-labelledby="`dashboard-section-${s.section}`"
      >
        <h2
          :id="`dashboard-section-${s.section}`"
          class="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-prohealth-600"
        >
          <UIcon :name="SECTION_ICON[s.section]" class="w-4 h-4" />
          {{ t(`dashboard.sections.${s.section}`) }}
        </h2>

        <!-- KPIs -->
        <div
          v-if="s.kpis.length"
          class="grid grid-cols-1 sm:grid-cols-2 gap-4"
          :class="s.kpis.length >= 5 ? 'lg:grid-cols-3 2xl:grid-cols-5' : s.kpis.length === 3 ? 'xl:grid-cols-3' : 'xl:grid-cols-4'"
        >
          <div
            v-for="k in s.kpis"
            :key="k.key"
            class="bg-white rounded-2xl border border-prohealth-100 p-5 hover:shadow-md transition-shadow"
          >
            <div class="flex items-center justify-between gap-2">
              <span :class="['w-10 h-10 rounded-xl grid place-items-center shrink-0', kpiStyle(k).accent]">
                <UIcon :name="kpiStyle(k).icon" class="w-5 h-5" />
              </span>
              <span
                v-if="kpiDelta(k)"
                :class="['text-xs font-semibold inline-flex items-center gap-1', kpiDelta(k)!.tone]"
                :title="t('dashboard.delta.vsPrevious')"
              >
                <UIcon :name="kpiDelta(k)!.icon" class="w-3.5 h-3.5" />
                {{ kpiDelta(k)!.label }}
                <span class="sr-only">{{ t('dashboard.delta.vsPrevious') }}</span>
              </span>
            </div>
            <p :class="['mt-4 font-extrabold', k.format === 'DATE' || k.format === 'TEXT' ? 'text-xl' : 'text-2xl', kpiValueClass(k)]">
              {{ kpiValue(k) }}
            </p>
            <p class="text-xs text-prohealth-500 mt-0.5">
              {{ kpiLabel(k) }}
              <template v-if="k.format === 'RATING' && k.count">
                · {{ t('dashboard.rating.count', { count: k.count }, k.count) }}
              </template>
            </p>
          </div>
        </div>

        <!-- Charts -->
        <div v-if="s.charts.length" class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div
            v-for="c in s.charts"
            :key="c.key"
            class="bg-white rounded-2xl border border-prohealth-100 p-6"
          >
            <div class="mb-4">
              <h3 class="font-bold text-prohealth-900">{{ chartTitle(c) }}</h3>
              <p v-if="chartSubtitle(c)" class="text-xs text-prohealth-500">{{ chartSubtitle(c) }}</p>
            </div>
            <DashboardDonutChart
              v-if="c.type === 'DONUT'"
              :data="chartData(c)"
              :label="chartTitle(c)"
              :format-value="chartFormatter(c)"
            />
            <DashboardLineChart
              v-else-if="c.type === 'LINE'"
              :data="chartData(c)"
              :label="chartTitle(c)"
              :format-value="chartFormatter(c)"
              :format-tick="c.format === 'MONEY' ? compactMoney : undefined"
              :color="CHART_COLOR[s.section]"
            />
            <DashboardBarChart
              v-else
              :data="chartData(c)"
              :label="chartTitle(c)"
              :format-value="chartFormatter(c)"
              :orientation="c.labelKind === 'TEXT' ? 'horizontal' : 'vertical'"
              :color="CHART_COLOR[s.section]"
            />
          </div>
        </div>
      </section>
    </template>

    <!-- Galería de servicios -->
    <section class="bg-white rounded-2xl border border-prohealth-100 p-6">
      <div class="mb-4">
        <h3 class="font-bold text-prohealth-900">{{ t('dashboard.gallery.title') }}</h3>
        <p class="text-xs text-prohealth-500">{{ t('dashboard.gallery.subtitle') }}</p>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div
          v-for="g in gallery"
          :key="g.src"
          class="group relative aspect-square overflow-hidden rounded-xl border border-prohealth-100"
        >
          <img
            :src="g.src"
            :alt="g.alt"
            loading="lazy"
            class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          >
          <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
            <p class="text-[11px] font-medium text-white truncate">{{ g.alt }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Activity + session -->
    <section class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div class="lg:col-span-2 bg-white rounded-2xl border border-prohealth-100">
        <div class="p-6 pb-3">
          <h3 class="font-bold text-prohealth-900">{{ t('dashboard.activity.title') }}</h3>
          <p class="text-xs text-prohealth-500">{{ t('dashboard.activity.subtitle') }}</p>
        </div>
        <div v-if="loading && !data" class="px-6 pb-6 space-y-3">
          <USkeleton v-for="i in 4" :key="i" class="h-10 rounded-lg" />
        </div>
        <p
          v-else-if="!activity.length"
          class="px-6 pb-6 text-sm text-prohealth-500"
        >
          {{ failed ? t('dashboard.loadError') : t('dashboard.activity.empty') }}
        </p>
        <ul v-else class="divide-y divide-prohealth-100">
          <li
            v-for="(a, i) in activity"
            :key="`${a.type}-${a.occurredAt}-${i}`"
            class="px-6 py-3 flex items-center gap-4"
          >
            <span :class="['w-9 h-9 rounded-full grid place-items-center shrink-0', ACTIVITY_ACCENT[a.status]]">
              <UIcon :name="ACTIVITY_ICON[a.type] ?? 'i-lucide-activity'" class="w-4 h-4" />
            </span>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold text-prohealth-900 truncate">{{ a.title }}</p>
              <p class="text-xs text-prohealth-500 truncate">{{ activityDescription(a) }}</p>
            </div>
            <time
              :datetime="a.occurredAt"
              :title="formatDate(a.occurredAt, 'datetime')"
              class="text-xs text-prohealth-500 hidden sm:inline whitespace-nowrap"
            >{{ relativeTime(a.occurredAt) }}</time>
            <UBadge :color="statusColor[a.status]" variant="subtle" size="sm">
              {{ t(`dashboard.activity.status.${a.status}`) }}
            </UBadge>
          </li>
        </ul>
      </div>

      <div class="bg-white rounded-2xl border border-prohealth-100 p-6">
        <h3 class="font-bold text-prohealth-900">{{ t('dashboard.session.title') }}</h3>
        <p class="text-xs text-prohealth-500 mb-5">{{ t('dashboard.session.subtitle') }}</p>

        <dl class="space-y-3 text-sm">
          <div class="flex items-center justify-between">
            <dt class="text-prohealth-500">{{ t('dashboard.session.email') }}</dt>
            <dd class="font-semibold text-prohealth-900 truncate max-w-[60%]">{{ auth.user?.email }}</dd>
          </div>
          <div class="flex items-center justify-between">
            <dt class="text-prohealth-500">{{ t('dashboard.session.roles') }}</dt>
            <dd class="flex flex-wrap gap-1 justify-end">
              <UBadge
                v-for="r in auth.roleNames"
                :key="r"
                color="primary"
                variant="subtle"
              >
                {{ r }}
              </UBadge>
            </dd>
          </div>
        </dl>

        <UButton
          to="/dashboard/change-password"
          block
          color="primary"
          variant="soft"
          icon="i-lucide-key-round"
          class="mt-6"
        >
          {{ t('auth.changePassword.heading') }}
        </UButton>
      </div>
    </section>
  </div>
</template>
