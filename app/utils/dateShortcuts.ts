import { CalendarDate, startOfMonth, endOfMonth } from '@internationalized/date'
import { todayInCaracas } from '~/utils/date'
import { appTimeZone } from '~/utils/timezone'

/**
 * Shared date shortcuts for every picker with a shortcut panel (07-forms.md, "Atajos de
 * fecha/hora"): fix or extend a shortcut here and every picker picks it up.
 * Groups are rendered in order with a separator between them: day / week / month.
 * Labels: `common.dateTimePicker.shortcuts.<key>` (single date) and
 * `audit.dateRange.shortcuts.<key>` (range).
 */

export interface DateShortcut { key: string, date: () => CalendarDate }
export interface DateRangeShortcut { key: string, range: () => { start: CalendarDate, end: CalendarDate } }

/** Today in the app time zone (America/Caracas) as a calendar date. */
export function todayCalendarDate(): CalendarDate {
  const [y, m, d] = (todayInCaracas().split('T')[0] ?? '').split('-').map(Number)
  return new CalendarDate(y!, m!, d!)
}

/**
 * Monday-first week, Venezuela business convention (lunes a domingo) — NOT
 * derived from `startOfWeek(date, 'es-VE')`, whose CLDR week data starts on
 * Sunday for `es-VE` and silently gave the wrong "first day of week".
 * `toDate().getDay()` is plain Gregorian (0=Sun…6=Sat), locale-independent.
 */
export function mondayOfWeek(d: CalendarDate): CalendarDate {
  const jsDay = d.toDate(appTimeZone()).getDay()
  const offsetFromMonday = (jsDay + 6) % 7
  return d.subtract({ days: offsetFromMonday })
}

const day = (d: CalendarDate) => ({ start: d, end: d })
const week = (monday: CalendarDate, days = 6) => ({ start: monday, end: monday.add({ days }) })
const month = (first: CalendarDate) => ({ start: first, end: endOfMonth(first) })
const thisMonday = () => mondayOfWeek(todayCalendarDate())
const thisFirst = () => startOfMonth(todayCalendarDate())

/** Single-date picker (`AppDateTimePicker`). */
export const DATE_SHORTCUTS: DateShortcut[][] = [
  [
    { key: 'today', date: () => todayCalendarDate() },
    { key: 'yesterday', date: () => todayCalendarDate().subtract({ days: 1 }) },
    { key: 'tomorrow', date: () => todayCalendarDate().add({ days: 1 }) },
  ],
  [
    { key: 'firstDayOfWeek', date: () => thisMonday() },
    { key: 'lastBusinessDayOfWeek', date: () => thisMonday().add({ days: 4 }) },
    { key: 'lastDayOfWeek', date: () => thisMonday().add({ days: 6 }) },
  ],
  [
    { key: 'firstDayOfMonth', date: () => thisFirst() },
    { key: 'fortnight', date: () => thisFirst().set({ day: 15 }) },
    { key: 'lastDayOfMonth', date: () => endOfMonth(todayCalendarDate()) },
  ],
]

/**
 * Range picker (`AuditDateRangePicker`): the same groups as ranges — the week splits into
 * business week (Mon–Fri) and full week (Mon–Sun), the month into fortnights (1–15,
 * 16–end) and the full month; previous/next sit at the ends of each group.
 */
export const DATE_RANGE_SHORTCUTS: DateRangeShortcut[][] = [
  [
    { key: 'today', range: () => day(todayCalendarDate()) },
    { key: 'yesterday', range: () => day(todayCalendarDate().subtract({ days: 1 })) },
    { key: 'tomorrow', range: () => day(todayCalendarDate().add({ days: 1 })) },
  ],
  [
    { key: 'lastWeek', range: () => week(thisMonday().subtract({ weeks: 1 })) },
    { key: 'thisBusinessWeek', range: () => week(thisMonday(), 4) },
    { key: 'thisWeek', range: () => week(thisMonday()) },
    { key: 'nextWeek', range: () => week(thisMonday().add({ weeks: 1 })) },
  ],
  [
    { key: 'lastMonth', range: () => month(thisFirst().subtract({ months: 1 })) },
    { key: 'firstFortnight', range: () => ({ start: thisFirst(), end: thisFirst().set({ day: 15 }) }) },
    { key: 'secondFortnight', range: () => ({ start: thisFirst().set({ day: 16 }), end: endOfMonth(thisFirst()) }) },
    { key: 'thisMonth', range: () => month(thisFirst()) },
    { key: 'nextMonth', range: () => month(thisFirst().add({ months: 1 })) },
  ],
]
