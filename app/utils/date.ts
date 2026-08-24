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

export interface DateTimeRange {
  /** `yyyy-MM-ddTHH:mm:ss` */
  from: string
  /** `yyyy-MM-ddTHH:mm:ss` */
  to: string
}

/** Default audit date-range filter: today 00:00 through the current time (VE). */
export function defaultTodayRange(): DateTimeRange {
  const d = todayInCaracas()
  return { from: `${d}T00:00:00`, to: `${d}T${nowTimeInCaracas()}:00` }
}
