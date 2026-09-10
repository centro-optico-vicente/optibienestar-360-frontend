<script setup lang="ts">
import { CalendarDate, startOfMonth, startOfWeek, endOfMonth, endOfWeek } from '@internationalized/date'
import { todayInCaracas, withCaracasOffset } from '~/utils/date'
import type { DateTimeRange } from '~/utils/date'

// `UCalendar`'s range model is typed against reka-ui's `DateValue` union (CalendarDate |
// CalendarDateTime | ZonedDateTime), which carries private class fields that don't survive
// structural re-typing across this component's own props/refs — so we keep the calendar
// value loosely typed here and only rely on its public `.toString()` (`yyyy-MM-dd`).
type LooseDateValue = { toString(): string } | undefined

/**
 * Single range-with-time control for the audit history filters (sessions,
 * data-changes, reports) — replaces two separate day-only `<input type="date">`
 * fields with one popover: a range calendar (day granularity) plus two time
 * inputs (minute granularity), so the emitted `from`/`to` are full timestamps.
 */
const props = defineProps<{
  modelValue: DateTimeRange
}>()

const emit = defineEmits<{
  'update:modelValue': [value: DateTimeRange]
}>()

const { t } = useI18n()
const { formatDate } = useFormatters()

function parseDatePart(iso: string): CalendarDate {
  const [y, m, d] = (iso.split('T')[0] ?? '').split('-').map(Number)
  if (!y || !m || !d) {
    const today = new Date()
    return new CalendarDate(today.getFullYear(), today.getMonth() + 1, today.getDate())
  }
  return new CalendarDate(y, m, d)
}

function parseTimePart(iso: string): string {
  return iso.split('T')[1]?.slice(0, 5) || '00:00'
}

const range = ref<{ start: LooseDateValue, end: LooseDateValue }>({
  start: parseDatePart(props.modelValue.from),
  end: parseDatePart(props.modelValue.to),
})
const startTime = ref(parseTimePart(props.modelValue.from))
const endTime = ref(parseTimePart(props.modelValue.to))
const open = ref(false)

function todayCalendarDate(): CalendarDate {
  return parseDatePart(todayInCaracas())
}

/** `startOfWeek`/`endOfWeek` need a locale to know the first day of week — Monday for `es-VE`. */
const WEEK_LOCALE = 'es-VE'

interface Shortcut { key: string, range: () => { start: CalendarDate, end: CalendarDate } }

const shortcuts: Shortcut[][] = [
  [
    { key: 'today', range: () => { const d = todayCalendarDate(); return { start: d, end: d } } },
    { key: 'yesterday', range: () => { const d = todayCalendarDate().subtract({ days: 1 }); return { start: d, end: d } } },
    { key: 'tomorrow', range: () => { const d = todayCalendarDate().add({ days: 1 }); return { start: d, end: d } } },
  ],
  [
    { key: 'lastWeek', range: () => { const w = startOfWeek(todayCalendarDate(), WEEK_LOCALE).subtract({ weeks: 1 }); return { start: w, end: endOfWeek(w, WEEK_LOCALE) } } },
    { key: 'thisWeek', range: () => { const w = startOfWeek(todayCalendarDate(), WEEK_LOCALE); return { start: w, end: endOfWeek(w, WEEK_LOCALE) } } },
    { key: 'nextWeek', range: () => { const w = startOfWeek(todayCalendarDate(), WEEK_LOCALE).add({ weeks: 1 }); return { start: w, end: endOfWeek(w, WEEK_LOCALE) } } },
  ],
  [
    { key: 'lastMonth', range: () => { const m = startOfMonth(todayCalendarDate()).subtract({ months: 1 }); return { start: m, end: endOfMonth(m) } } },
    { key: 'thisMonth', range: () => { const m = startOfMonth(todayCalendarDate()); return { start: m, end: endOfMonth(m) } } },
    { key: 'nextMonth', range: () => { const m = startOfMonth(todayCalendarDate()).add({ months: 1 }); return { start: m, end: endOfMonth(m) } } },
  ],
]

function applyShortcut(shortcut: Shortcut) {
  const { start, end } = shortcut.range()
  range.value = { start, end }
  startTime.value = '00:00'
  endTime.value = '23:59'
}

function clearRange() {
  applyShortcut(shortcuts[0]![0]!)
}

function toIso(date: LooseDateValue, time: string): string | undefined {
  if (!date) return undefined
  const safeTime = /^\d{2}:\d{2}$/.test(time) ? time : '00:00'
  return withCaracasOffset(`${date.toString()}T${safeTime}`)
}

function emitChange() {
  const from = toIso(range.value.start, startTime.value)
  const to = toIso(range.value.end, endTime.value)
  if (!from || !to) return
  emit('update:modelValue', { from, to })
}

watch([range, startTime, endTime], emitChange, { deep: true })

// Keeps the internal state in sync if a parent resets the model (e.g. "clear filters").
watch(() => props.modelValue, (v) => {
  const nextFrom = toIso(range.value.start, startTime.value)
  const nextTo = toIso(range.value.end, endTime.value)
  if (v.from === nextFrom && v.to === nextTo) return
  range.value = { start: parseDatePart(v.from), end: parseDatePart(v.to) }
  startTime.value = parseTimePart(v.from)
  endTime.value = parseTimePart(v.to)
})

const label = computed(() => {
  const from = toIso(range.value.start, startTime.value)
  const to = toIso(range.value.end, endTime.value)
  if (!from || !to) return t('audit.dateRange.placeholder')
  return `${formatDate(from, 'datetime')} — ${formatDate(to, 'datetime')}`
})
</script>

<template>
  <UPopover v-model:open="open">
    <UButton
      color="neutral"
      variant="outline"
      icon="i-lucide-calendar-range"
      size="lg"
      truncate
    >
      {{ label }}
    </UButton>

    <template #content>
      <div class="flex">
        <div class="w-40 shrink-0 border-r border-default p-2 flex flex-col">
          <template v-for="(group, i) in shortcuts" :key="i">
            <UButton
              v-for="shortcut in group"
              :key="shortcut.key"
              color="neutral"
              variant="ghost"
              size="sm"
              class="justify-start"
              @click="applyShortcut(shortcut)"
            >
              {{ t(`audit.dateRange.shortcuts.${shortcut.key}`) }}
            </UButton>
            <USeparator v-if="i < shortcuts.length - 1" class="my-1" />
          </template>
        </div>

        <div class="p-4 space-y-3">
          <UCalendar
            :model-value="(range as any)"
            range
            :number-of-months="2"
            @update:model-value="(v: any) => { range = v }"
          />
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <UFormField :label="t('audit.dateRange.fromTime')">
                <UInput v-model="startTime" type="time" />
              </UFormField>
              <UFormField :label="t('audit.dateRange.toTime')">
                <UInput v-model="endTime" type="time" />
              </UFormField>
            </div>
            <div class="flex items-center gap-2">
              <UButton color="neutral" variant="ghost" icon="i-lucide-x" @click="clearRange">
                {{ t('audit.dateRange.clear') }}
              </UButton>
              <UButton color="primary" icon="i-lucide-check" @click="open = false">
                {{ t('audit.dateRange.confirm') }}
              </UButton>
            </div>
          </div>
        </div>
      </div>
    </template>
  </UPopover>
</template>
