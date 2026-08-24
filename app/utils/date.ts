/**
 * Shared "today" helpers, ADR 0010 (Venezuela localization). `en-CA` renders as
 * yyyy-MM-dd, which is what the backend's LocalDate/Instant params expect — building
 * it off the browser's raw local timezone would send tomorrow's date to anyone east
 * of Caracas. Same convention as `BenefitUsageModal.todayInCaracas()`.
 */
export function todayInCaracas(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Caracas',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

/** Current time (HH:mm, 24h) in the VE timezone. */
export function nowTimeInCaracas(): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Caracas',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date())
}

/**
 * Fixed UTC-4 offset for `America/Caracas` (no DST, per ADR 0010). The backend's audit
 * endpoints bind `from`/`to` with `@DateTimeFormat(iso = ISO.DATE_TIME)` onto
 * `java.time.Instant`, which REQUIRES an explicit offset/zone — a bare
 * `2026-08-17T00:00:00` 400s with "Failed to convert 'from'". We can't use
 * `Date.toISOString()` either: it renders in UTC ('Z'), which would silently shift the
 * displayed local time if the browser isn't already in Caracas time. So every audit
 * date-range value is built/serialized here with `-04:00` appended explicitly.
 */
export const CARACAS_OFFSET = '-04:00'

export interface DateTimeRange {
  /** `yyyy-MM-ddTHH:mm:ss-04:00` — a proper ISO-8601 instant with explicit offset. */
  from: string
  /** `yyyy-MM-ddTHH:mm:ss-04:00` — a proper ISO-8601 instant with explicit offset. */
  to: string
}

/** Appends the fixed Caracas UTC offset to a `yyyy-MM-ddTHH:mm[:ss]` local date-time string. */
export function withCaracasOffset(localDateTime: string): string {
  const withSeconds = /T\d{2}:\d{2}$/.test(localDateTime) ? `${localDateTime}:00` : localDateTime
  return `${withSeconds}${CARACAS_OFFSET}`
}

/** Default audit date-range filter: today 00:00 through the current time (VE). */
export function defaultTodayRange(): DateTimeRange {
  const d = todayInCaracas()
  return {
    from: withCaracasOffset(`${d}T00:00:00`),
    to: withCaracasOffset(`${d}T${nowTimeInCaracas()}:00`),
  }
}
