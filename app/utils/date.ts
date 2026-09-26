import { appTimeZone, offsetFor } from '~/utils/timezone'

/**
 * Shared "today" helpers, ADR 0010 (Venezuela localization) — anchored to the
 * app's own timezone (`appTimeZone()`, hub plan competitive-commission-rules,
 * Fase A) rather than a hardcoded `America/Caracas` literal, so a different
 * deployed `TZ` is honored too. `en-CA` renders as yyyy-MM-dd, which is what
 * the backend's LocalDate/Instant params expect — building it off the
 * browser's raw local timezone would send tomorrow's date to anyone east of
 * the app's zone. Same convention as `BenefitUsageModal.todayInCaracas()`.
 */
export function todayInCaracas(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: appTimeZone(),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

/**
 * Clamps "today" (VE timezone) into `[startsAt, endsAt]` (accepts `yyyy-MM-dd`
 * or full ISO datetime, only the date part is used) — for a currency
 * conversion tied to a whole window (a campaign goal, a campaign-scoped
 * rule's reward) rather than a single transaction date. While the window is
 * running this is just "today"; once it ends the conversion freezes at
 * `endsAt` instead of drifting forward with "now" forever. `null`/`null` (no
 * window) returns `null` (caller falls back to its own default, e.g. "now").
 */
export function clampTodayToRange(startsAt?: string | null, endsAt?: string | null): string | null {
  const start = startsAt ? startsAt.slice(0, 10) : null
  const end = endsAt ? endsAt.slice(0, 10) : null
  if (!start && !end) return null
  const today = todayInCaracas()
  if (start && today < start) return start
  if (end && today > end) return end
  return today
}

/** Current time (HH:mm, 24h) in the app's timezone. */
export function nowTimeInCaracas(): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: appTimeZone(),
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date())
}

export interface DateTimeRange {
  /** `yyyy-MM-ddTHH:mm:ss-04:00` — a proper ISO-8601 instant with explicit offset. Omitted → no filter (shows the picker's placeholder). */
  from?: string
  /** `yyyy-MM-ddTHH:mm:ss-04:00` — a proper ISO-8601 instant with explicit offset. Omitted → no filter (shows the picker's placeholder). */
  to?: string
}

/** Empty range — no filter applied, `AuditDateRangePicker` renders its placeholder. */
export function emptyDateRange(): DateTimeRange {
  return {}
}

/**
 * Appends the app timezone's UTC offset to a `yyyy-MM-ddTHH:mm[:ss]` local
 * date-time string (hub plan competitive-commission-rules, Fase A —
 * previously a hardcoded `-04:00`). The backend's audit endpoints bind
 * `from`/`to` with `@DateTimeFormat(iso = ISO.DATE_TIME)` onto
 * `java.time.Instant`, which REQUIRES an explicit offset/zone — a bare
 * `2026-08-17T00:00:00` 400s with "Failed to convert 'from'". We can't use
 * `Date.toISOString()` either: it renders in UTC ('Z'), which would silently
 * shift the displayed local time if the browser isn't already in the app's
 * timezone. So every audit date-range value is built/serialized here with
 * the real offset appended explicitly.
 */
export function withCaracasOffset(localDateTime: string): string {
  const withSeconds = /T\d{2}:\d{2}$/.test(localDateTime) ? `${localDateTime}:00` : localDateTime
  return `${withSeconds}${offsetFor(withSeconds)}`
}

/** Default audit date-range filter: today 00:00 through the current time (VE). */
export function defaultTodayRange(): DateTimeRange {
  const d = todayInCaracas()
  return {
    from: withCaracasOffset(`${d}T00:00:00`),
    to: withCaracasOffset(`${d}T${nowTimeInCaracas()}:00`),
  }
}

/** Default "this month" range (VE) — same calendar-month math as `AuditDateRangePicker`'s "Este mes" shortcut. */
export function defaultThisMonthRange(): DateTimeRange {
  const [y, m] = todayInCaracas().split('-').map(Number) as [number, number]
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    from: withCaracasOffset(`${y}-${pad(m)}-01T00:00:00`),
    to: withCaracasOffset(`${y}-${pad(m)}-${pad(lastDay)}T23:59:00`),
  }
}
