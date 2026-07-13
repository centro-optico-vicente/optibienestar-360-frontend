/**
 * Formateo de fechas, números y moneda anclado a la convención venezolana
 * (`es-VE` / `America/Caracas`, UTC-4 sin DST — ADR 0010). El formato NO se ata
 * al locale de la UI: las cifras y fechas siguen la convención VE aunque el
 * usuario tenga la interfaz en inglés. Los mensajes UI se traducen vía `$t`;
 * los datos numéricos/temporales se formatean aquí.
 */

const LOCALE = 'es-VE'
const TIME_ZONE = 'America/Caracas'
const EMPTY = '—'

type DateInput = string | number | Date | null | undefined
type DateFormat = 'short' | 'long' | 'datetime'

function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === '') return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

export const useFormatters = () => {
  /** Moneda en convención VE (por defecto USD; usar 'VES' para bolívares). */
  const formatCurrency = (amount: number | null | undefined, currency = 'USD'): string => {
    if (amount === null || amount === undefined || Number.isNaN(amount)) return EMPTY
    return new Intl.NumberFormat(LOCALE, { style: 'currency', currency }).format(amount)
  }

  /** Número con separadores de miles en convención VE. */
  const formatNumber = (value: number | null | undefined): string => {
    if (value === null || value === undefined || Number.isNaN(value)) return EMPTY
    return new Intl.NumberFormat(LOCALE).format(value)
  }

  /**
   * Fecha en convención VE. `short` (dd/mm/aaaa), `long` (1 de enero de 2026)
   * o `datetime` (fecha media + hora). Devuelve '—' si la entrada es vacía.
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

  /** Distancia relativa ("hace 3 días", "en 2 semanas"). Devuelve '—' si es vacía. */
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

  return { formatCurrency, formatNumber, formatDate, formatRelative }
}
