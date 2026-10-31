<script setup lang="ts">
import type { OpeningHourDto, OpeningHoursRequest } from '~/types/allies'

/**
 * Weekly opening hours of an ally (backend V214, hub ADR 0031 §7): one row per
 * day with zero or more time ranges. The whole week is saved at once. Used by
 * the admin ally detail (`scope="admin"`) and the ally portal (`scope="portal"`,
 * editable only by the OWNER — the backend enforces it as well).
 *
 * Mirrors the backend rules so the user sees the problem before saving: each
 * range closes after it opens and ranges of the same day do not overlap
 * (08:00–12:00 and 12:00–14:00 only touch, which is allowed).
 */
const props = defineProps<{
  allyUuid: string
  scope: 'admin' | 'portal'
  readonly?: boolean
}>()

interface Range { opensAt: string, closesAt: string }

const DAYS = [1, 2, 3, 4, 5, 6, 7] as const

const { t } = useI18n()
const toast = useToast()
const allies = useAllies()
const myAllies = useMyAllies()

const week = ref<Record<number, Range[]>>(emptyWeek())
const loading = ref(false)
const saving = ref(false)
const dirty = ref(false)
// Not `readonly` / `isReadonly` in the template: both resolve to auto-imported Vue functions.
const viewOnly = computed(() => props.readonly === true)

function emptyWeek(): Record<number, Range[]> {
  return Object.fromEntries(DAYS.map(d => [d, [] as Range[]]))
}

function fromDtos(rows: OpeningHourDto[]): Record<number, Range[]> {
  const next = emptyWeek()
  for (const r of rows) {
    next[r.dayOfWeek]?.push({ opensAt: r.opensAt.slice(0, 5), closesAt: r.closesAt.slice(0, 5) })
  }
  return next
}

async function load() {
  if (!props.allyUuid) return
  loading.value = true
  try {
    const rows = props.scope === 'admin'
      ? await allies.getOpeningHours(props.allyUuid)
      : await myAllies.getOpeningHours(props.allyUuid)
    week.value = fromDtos(rows ?? [])
    dirty.value = false
  }
  catch {
    // useApi already shows the error toast
    week.value = emptyWeek()
  }
  finally {
    loading.value = false
  }
}

watch(() => props.allyUuid, load, { immediate: true })

function addRange(day: number) {
  const ranges = week.value[day]!
  const last = ranges[ranges.length - 1]
  ranges.push(last ? { opensAt: last.closesAt, closesAt: '18:00' } : { opensAt: '08:00', closesAt: '12:00' })
  dirty.value = true
}

function removeRange(day: number, index: number) {
  week.value[day]!.splice(index, 1)
  dirty.value = true
}

/** Copies Monday's ranges to Tuesday–Friday (the usual business week). */
function copyMondayToWeekdays() {
  const monday = week.value[1] ?? []
  for (const day of [2, 3, 4, 5]) {
    week.value[day] = monday.map(r => ({ ...r }))
  }
  dirty.value = true
}

/** Error key of a day, or null when its ranges are valid. */
function dayError(day: number): string | null {
  const ranges = [...(week.value[day] ?? [])]
  if (ranges.some(r => !r.opensAt || !r.closesAt || r.closesAt <= r.opensAt)) {
    return 'allies.openingHours.errors.invalidRange'
  }
  ranges.sort((a, b) => a.opensAt.localeCompare(b.opensAt))
  for (let i = 1; i < ranges.length; i++) {
    if (ranges[i]!.opensAt < ranges[i - 1]!.closesAt) return 'allies.openingHours.errors.overlap'
  }
  return null
}

const hasErrors = computed(() => DAYS.some(d => dayError(d) !== null))
const isEmpty = computed(() => DAYS.every(d => (week.value[d] ?? []).length === 0))

async function save() {
  if (hasErrors.value) return
  const body: OpeningHoursRequest = {
    ranges: DAYS.flatMap(day => (week.value[day] ?? []).map(r => ({
      dayOfWeek: day,
      opensAt: r.opensAt,
      closesAt: r.closesAt,
    }))),
  }
  saving.value = true
  try {
    const saved = props.scope === 'admin'
      ? await allies.replaceOpeningHours(props.allyUuid, body)
      : await myAllies.replaceOpeningHours(props.allyUuid, body)
    week.value = fromDtos(saved ?? [])
    dirty.value = false
    toast.add({ title: t('allies.openingHours.savedToast'), color: 'success', icon: 'i-lucide-check-circle' })
  }
  catch {
    // useApi already shows the error toast
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="space-y-3">
    <div v-if="loading" class="text-sm text-prohealth-500 py-4">{{ t('allies.openingHours.loading') }}</div>

    <template v-else>
      <p v-if="viewOnly && isEmpty" class="text-sm text-prohealth-500">{{ t('allies.openingHours.empty') }}</p>

      <div
        v-for="day in DAYS"
        v-show="!viewOnly || (week[day] ?? []).length > 0"
        :key="day"
        class="flex flex-col sm:flex-row sm:items-start gap-2 py-2 border-b border-prohealth-50 last:border-b-0"
      >
        <div class="sm:w-32 shrink-0 font-medium text-prohealth-900 text-sm pt-1.5">
          {{ t(`allies.openingHours.days.${day}`) }}
        </div>

        <div class="flex-1 space-y-2">
          <p v-if="(week[day] ?? []).length === 0" class="text-sm text-prohealth-400 pt-1.5">
            {{ t('allies.openingHours.closed') }}
          </p>

          <div v-for="(range, index) in week[day]" :key="index" class="flex items-center gap-2">
            <template v-if="viewOnly">
              <span class="text-sm text-prohealth-700">{{ range.opensAt }} – {{ range.closesAt }}</span>
            </template>
            <template v-else>
              <UInput
                v-model="range.opensAt"
                type="time"
                size="sm"
                :aria-label="t('allies.openingHours.opensAt')"
                @update:model-value="dirty = true"
              />
              <span class="text-prohealth-400">–</span>
              <UInput
                v-model="range.closesAt"
                type="time"
                size="sm"
                :aria-label="t('allies.openingHours.closesAt')"
                @update:model-value="dirty = true"
              />
              <UTooltip :text="t('allies.openingHours.removeRange')">
                <UButton
                  color="error"
                  variant="ghost"
                  icon="i-lucide-x"
                  size="xs"
                  square
                  @click="removeRange(day, index)"
                />
              </UTooltip>
            </template>
          </div>

          <p v-if="!viewOnly && dayError(day)" class="text-xs text-red-600">{{ t(dayError(day) ?? '') }}</p>
        </div>

        <UButton
          v-if="!viewOnly"
          color="primary"
          variant="ghost"
          icon="i-lucide-plus"
          size="xs"
          class="self-start"
          @click="addRange(day)"
        >
          {{ t('allies.openingHours.addRange') }}
        </UButton>
      </div>

      <div v-if="!viewOnly" class="flex flex-wrap items-center justify-between gap-2 pt-2">
        <UButton
          color="neutral"
          variant="soft"
          icon="i-lucide-copy"
          size="sm"
          :disabled="(week[1] ?? []).length === 0"
          @click="copyMondayToWeekdays"
        >
          {{ t('allies.openingHours.copyMonday') }}
        </UButton>
        <UButton
          color="primary"
          icon="i-lucide-save"
          size="sm"
          :loading="saving"
          :disabled="!dirty || hasErrors"
          @click="save"
        >
          {{ t('allies.openingHours.save') }}
        </UButton>
      </div>
    </template>
  </div>
</template>
