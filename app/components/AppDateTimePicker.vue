<script setup lang="ts">
import { CalendarDate, startOfMonth, endOfMonth } from '@internationalized/date'
import { todayInCaracas, withCaracasOffset } from '~/utils/date'

type LooseDateValue = { toString(): string } | undefined

/**
 * Single datetime control with quick shortcuts (Hoy/Ayer/Mañana, 1er/último día
 * del mes, quincena) — used for standalone date+time fields (e.g. a rule's own
 * startsAt/endsAt) where `AuditDateRangePicker` (range-only) doesn't fit.
 * `modelValue`/emit use the same `yyyy-MM-ddTHH:mm` "datetime-local" format the
 * rest of the form already converts to/from ISO.
 */
const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const { t } = useI18n()
const { formatDate } = useFormatters()

function parseDatePart(local: string | undefined): CalendarDate | undefined {
  if (!local) return undefined
  const [y, m, d] = (local.split('T')[0] ?? '').split('-').map(Number)
  if (!y || !m || !d) return undefined
  return new CalendarDate(y, m, d)
}

function parseTimePart(local: string | undefined): string {
  return local?.split('T')[1]?.slice(0, 5) || '00:00'
}

const date = ref<LooseDateValue>(parseDatePart(props.modelValue))
const time = ref(parseTimePart(props.modelValue))
const open = ref(false)

function todayCalendarDate(): CalendarDate {
  return parseDatePart(todayInCaracas())!
}

interface Shortcut { key: string, date: () => CalendarDate }

/**
 * Monday-first week, Venezuela business convention (lunes a viernes) — NOT
 * derived from `startOfWeek(date, 'es-VE')`, whose CLDR week data starts on
 * Sunday for `es-VE` and silently gave the wrong "first day of week".
 * `toDate().getDay()` is plain Gregorian (0=Sun…6=Sat), locale-independent.
 */
function mondayOfWeek(d: CalendarDate): CalendarDate {
  const jsDay = d.toDate('America/Caracas').getDay()
  const offsetFromMonday = (jsDay + 6) % 7
  return d.subtract({ days: offsetFromMonday })
}

const shortcuts: Shortcut[][] = [
  [
    { key: 'today', date: () => todayCalendarDate() },
    { key: 'yesterday', date: () => todayCalendarDate().subtract({ days: 1 }) },
    { key: 'tomorrow', date: () => todayCalendarDate().add({ days: 1 }) },
  ],
  [
    { key: 'firstDayOfWeek', date: () => mondayOfWeek(todayCalendarDate()) },
    { key: 'lastBusinessDayOfWeek', date: () => mondayOfWeek(todayCalendarDate()).add({ days: 4 }) },
    { key: 'lastDayOfWeek', date: () => mondayOfWeek(todayCalendarDate()).add({ days: 6 }) },
  ],
  [
    { key: 'firstDayOfMonth', date: () => startOfMonth(todayCalendarDate()) },
    { key: 'fortnight', date: () => startOfMonth(todayCalendarDate()).set({ day: 15 }) },
    { key: 'lastDayOfMonth', date: () => endOfMonth(todayCalendarDate()) },
  ],
]

function applyShortcut(shortcut: Shortcut) {
  date.value = shortcut.date()
}

function clear() {
  date.value = undefined
  time.value = '00:00'
  emit('update:modelValue', '')
}

function toLocal(d: LooseDateValue, t: string): string | undefined {
  if (!d) return undefined
  const safeTime = /^\d{2}:\d{2}$/.test(t) ? t : '00:00'
  return `${d.toString()}T${safeTime}`
}

function emitChange() {
  const local = toLocal(date.value, time.value)
  emit('update:modelValue', local ?? '')
}

watch([date, time], emitChange, { deep: true })

watch(() => props.modelValue, (v) => {
  const next = toLocal(date.value, time.value)
  if ((v || '') === (next || '')) return
  date.value = parseDatePart(v)
  time.value = parseTimePart(v)
})

const label = computed(() => {
  const local = toLocal(date.value, time.value)
  if (!local) return t('common.dateTimePicker.placeholder')
  return formatDate(withCaracasOffset(local), 'datetime')
})
</script>

<template>
  <UPopover v-model:open="open">
    <UButton color="neutral" variant="outline" icon="i-lucide-calendar-clock" truncate class="w-full justify-start">
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
              {{ t(`common.dateTimePicker.shortcuts.${shortcut.key}`) }}
            </UButton>
            <USeparator v-if="i < shortcuts.length - 1" class="my-1" />
          </template>
        </div>

        <div class="p-4 space-y-3">
          <UCalendar
            :model-value="(date as any)"
            @update:model-value="(v: any) => { date = v }"
          />
          <div class="flex items-center justify-between gap-3">
            <UFormField :label="t('common.dateTimePicker.time')">
              <UInput v-model="time" type="time" />
            </UFormField>
            <div class="flex items-center gap-2">
              <UButton color="neutral" variant="ghost" icon="i-lucide-x" @click="clear">
                {{ t('common.dateTimePicker.clear') }}
              </UButton>
              <UButton color="primary" icon="i-lucide-check" @click="open = false">
                {{ t('common.dateTimePicker.confirm') }}
              </UButton>
            </div>
          </div>
        </div>
      </div>
    </template>
  </UPopover>
</template>
