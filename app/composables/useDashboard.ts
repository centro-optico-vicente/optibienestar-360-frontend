/**
 * Home dashboard (GET /v1/me/dashboard). The backend resolves which sections
 * apply to the caller (management, advisor portfolio, ally, member) from the
 * JWT and returns their KPIs, charts and recent activity. Null fields are
 * omitted from the JSON, hence the optional properties below.
 */

export type DashboardSection = 'MANAGEMENT' | 'ADVISOR' | 'ALLY' | 'MEMBER'

export const DASHBOARD_SECTIONS: readonly DashboardSection[] = ['MANAGEMENT', 'ADVISOR', 'ALLY', 'MEMBER']

export type DashboardKpiFormat = 'NUMBER' | 'MONEY' | 'TEXT' | 'DATE' | 'RATING'

export interface DashboardKpi {
  key: string
  section: DashboardSection
  format: DashboardKpiFormat
  /** NUMBER / MONEY / RATING (RATING = average 0..5). */
  value?: number
  /** Same indicator for the previous month — drives the variation badge. */
  previousValue?: number
  /** Only for MONEY. */
  currency?: string
  /** TEXT: enum code (translated client-side). DATE: ISO `yyyy-MM-dd`. */
  text?: string
  /** RATING: number of ratings behind the average. */
  count?: number
}

export type DashboardChartType = 'BAR' | 'LINE' | 'DONUT'
/** MONTH: point.key = `yyyy-MM`. ENUM: point.key is a code. TEXT: use point.label verbatim. */
export type DashboardLabelKind = 'MONTH' | 'ENUM' | 'TEXT'

export interface DashboardChartPoint {
  key: string
  label?: string
  value: number
}

export interface DashboardChart {
  key: string
  section: DashboardSection
  type: DashboardChartType
  labelKind: DashboardLabelKind
  format: 'NUMBER' | 'MONEY'
  currency?: string
  points: DashboardChartPoint[]
}

export type DashboardActivityType =
  | 'PAYMENT_REGISTERED'
  | 'PAYMENT_APPROVED'
  | 'PAYMENT_REJECTED'
  | 'USAGE_REGISTERED'
  | 'USAGE_REVERSED'
  | 'AFFILIATION_REQUEST_RECEIVED'
  | 'AFFILIATION_REQUEST_APPROVED'
  | 'AFFILIATION_REQUEST_REJECTED'
  | 'MEMBER_ENROLLED'

export type DashboardActivityStatus = 'SUCCESS' | 'PENDING' | 'ERROR'

export interface DashboardActivity {
  type: DashboardActivityType
  section: DashboardSection
  /** Person name (literal). */
  title: string
  /** Ally, service or plan name (literal). */
  subtitle?: string
  amount?: number
  currency?: string
  /** ISO instant. */
  occurredAt: string
  status: DashboardActivityStatus
}

export interface DashboardDto {
  /** First day of the current month (`yyyy-MM-dd`, America/Caracas). */
  periodStart: string
  sections: DashboardSection[]
  kpis: DashboardKpi[]
  charts: DashboardChart[]
  /** Newest first, at most 8 items. */
  activity: DashboardActivity[]
}

/** Point already resolved for rendering by the dashboard chart components. */
export interface DashboardChartDatum {
  key: string
  label: string
  value: number
  /** Any CSS color; the chart falls back to its own palette when absent. */
  color?: string
}

/**
 * Brand palette for charts. Values mirror the tokens in assets/css/main.css;
 * the hex fallback keeps them working even if Tailwind tree-shook the variable.
 */
export const DASHBOARD_COLORS = {
  prohealth: 'var(--color-prohealth-500, #067DBC)',
  prohealthDark: 'var(--color-prohealth-800, #003F84)',
  lime: 'var(--color-lime-500, #7BC621)',
  limeDark: 'var(--color-lime-700, #477904)',
  cyan: 'var(--color-cyan-400, #7BB2DB)',
  orange: 'var(--color-energia-500, #FF7605)',
  red: '#DC2626',
  gray: '#94A3B8',
} as const

/** Default categorical sequence (donut segments without a semantic color). */
export const DASHBOARD_PALETTE: readonly string[] = [
  DASHBOARD_COLORS.prohealth,
  DASHBOARD_COLORS.lime,
  DASHBOARD_COLORS.cyan,
  DASHBOARD_COLORS.orange,
  DASHBOARD_COLORS.prohealthDark,
  DASHBOARD_COLORS.limeDark,
  DASHBOARD_COLORS.gray,
]

/**
 * Axis scale for the dashboard charts: rounds `max` up to a "nice" multiple of
 * 1/2/5·10ⁿ split into `ticks` steps (integer steps, the series are counts or
 * whole amounts). Returns the tick values from 0 up to the scale top.
 */
export function dashboardAxisTicks(max: number, ticks = 4): number[] {
  const safeMax = max > 0 ? max : 1
  const raw = safeMax / ticks
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const normalized = raw / magnitude
  const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10
  const step = Math.max(1, nice * magnitude)
  const count = Math.ceil(safeMax / step)
  return Array.from({ length: count + 1 }, (_, i) => i * step)
}

export const useDashboard = () => {
  /** Dashboard of the signed-in user (sections resolved by the backend from the JWT). */
  const fetchMine = () => useApi<DashboardDto>('/v1/me/dashboard', { silent: true })

  return { fetchMine }
}
