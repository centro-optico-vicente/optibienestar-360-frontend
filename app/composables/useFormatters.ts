/**
 * Date, number and currency formatting anchored to the Venezuelan convention
 * (`es-VE` / `America/Caracas`, UTC-4 with no DST — ADR 0010). Formatting is NOT
 * tied to the UI locale: figures and dates keep the VE convention even when the
 * user has the interface in English. UI strings are translated via `$t`; numeric
 * and temporal data is formatted here.
 */

const LOCALE = 'es-VE'
const TIME_ZONE = 'America/Caracas'
const EMPTY = '—'

type DateInput = string | number | Date | null | undefined
type DateFormat = 'short' | 'long' | 'datetime'

const BARE_DATE = /^\d{4}-\d{2}-\d{2}$/

function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === '') return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  // A bare `yyyy-MM-dd` (a backend LocalDate with no time — rateDate,
  // operationDate, etc.) is parsed by `new Date()` as midnight UTC. Formatted
  // in `America/Caracas` (UTC-4, ADR 0010) that lands at 20:00 the PREVIOUS
  // day, so the displayed date is always one day off. Anchor it at noon UTC
  // instead — any real-world zone offset still lands on the same calendar day.
  const d = typeof value === 'string' && BARE_DATE.test(value) ? new Date(`${value}T12:00:00Z`) : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

export const useFormatters = () => {
  // Cached by useOrganization() — populated once per session (dashboard.vue
  // triggers the fetch on mount for whoever has ORGANIZATION_VIEW). Read
  // directly off the shared state rather than calling ensureLoaded() here:
  // formatCurrency must stay synchronous (it's called inline in templates),
  // and by the time anything renders money the layout has already had a
  // chance to kick off the load.
  const organizationState = useState<{ referenceCurrency_Code?: string | null } | null>('organization', () => null)

  /**
   * Currency in the VE convention. Falls back to the organization's own
   * `referenceCurrency_Code` (ADR 0015 §4 — USD per ADR 0008) when the
   * caller passes no explicit currency, and only to the hardcoded `'USD'`
   * when the organization hasn't loaded (or the session can't read it).
   */
  const formatCurrency = (amount: number | null | undefined, currency?: string): string => {
    if (amount === null || amount === undefined || Number.isNaN(amount)) return EMPTY
    const resolvedCurrency = currency ?? organizationState.value?.referenceCurrency_Code ?? 'USD'
    // narrowSymbol: es-VE's default 'symbol' renders USD as "US$" — the
    // narrow form gives the plain "$" the business actually wants.
    return new Intl.NumberFormat(LOCALE, { style: 'currency', currency: resolvedCurrency, currencyDisplay: 'narrowSymbol' }).format(amount)
  }

  /** Number with thousands separators in the VE convention. */
  const formatNumber = (value: number | null | undefined): string => {
    if (value === null || value === undefined || Number.isNaN(value)) return EMPTY
    return new Intl.NumberFormat(LOCALE).format(value)
  }

  /**
   * Date in the VE convention. `short` (dd/mm/yyyy), `long` (1 de enero de 2026)
   * or `datetime` (medium date + time). Returns '—' when the input is empty.
   */
  const formatDate = (date: DateInput, format: DateFormat = 'short'): string => {
    const d = toDate(date)
    if (!d) return EMPTY
    const options: Intl.DateTimeFormatOptions
      = format === 'long'
        ? { day: 'numeric', month: 'long', year: 'numeric', timeZone: TIME_ZONE }
        : format === 'datetime'
          ? { dateStyle: 'medium', timeStyle: 'short', timeZone: TIME_ZONE }
          : { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: TIME_ZONE }
    return new Intl.DateTimeFormat(LOCALE, options).format(d)
  }

  /** Month + year in the VE convention ("julio de 2026"). Returns '—' when empty. */
  const formatMonthYear = (date: DateInput): string => {
    const d = toDate(date)
    if (!d) return EMPTY
    return new Intl.DateTimeFormat(LOCALE, { month: 'long', year: 'numeric', timeZone: TIME_ZONE }).format(d)
  }

  /** Time of day (HH:mm) in the VE convention. Returns '—' when empty. */
  const formatTime = (date: DateInput): string => {
    const d = toDate(date)
    if (!d) return EMPTY
    return new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit', timeZone: TIME_ZONE }).format(d)
  }

  /** Relative distance ("hace 3 días", "en 2 semanas"). Returns '—' when empty. */
  const formatRelative = (date: DateInput): string => {
    const d = toDate(date)
    if (!d) return EMPTY
    const rtf = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' })
    const diffMs = d.getTime() - Date.now()
    const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
      ['year', 1000 * 60 * 60 * 24 * 365],
      ['month', 1000 * 60 * 60 * 24 * 30],
      ['week', 1000 * 60 * 60 * 24 * 7],
      ['day', 1000 * 60 * 60 * 24],
      ['hour', 1000 * 60 * 60],
      ['minute', 1000 * 60],
    ]
    for (const [unit, ms] of units) {
      if (Math.abs(diffMs) >= ms) return rtf.format(Math.round(diffMs / ms), unit)
    }
    return rtf.format(Math.round(diffMs / 1000), 'second')
  }

  return { formatCurrency, formatNumber, formatDate, formatMonthYear, formatTime, formatRelative }
}
