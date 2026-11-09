<script setup lang="ts">
// Birth date as three selects (day / month / year) instead of a date input: easier on a phone and for
// older people (hub ADR 0037 §2). v-model is `yyyy-MM-dd`, or '' while it is incomplete or impossible.
const model = defineModel<string>({ default: '' })

const { t } = useI18n()

const parts = reactive({ day: '', month: '', year: '' })

function split(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  parts.year = match?.[1] ?? ''
  parts.month = match ? String(Number(match[2])) : ''
  parts.day = match ? String(Number(match[3])) : ''
}
split(model.value)

// An outside change (restoring a saved request) refreshes the selects.
watch(model, (value) => {
  const current = compose()
  if (value !== current) split(value)
})

function pad(n: string): string {
  return n.padStart(2, '0')
}

function compose(): string {
  if (!parts.day || !parts.month || !parts.year) return ''
  const date = new Date(Number(parts.year), Number(parts.month) - 1, Number(parts.day))
  const possible = date.getFullYear() === Number(parts.year)
    && date.getMonth() === Number(parts.month) - 1
    && date.getDate() === Number(parts.day)
  return possible ? `${parts.year}-${pad(parts.month)}-${pad(parts.day)}` : ''
}

watch(parts, () => { model.value = compose() })

const days = Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))
const months = computed(() => Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: new Intl.DateTimeFormat(undefined, { month: 'long' }).format(new Date(2000, i, 1)),
})))
const thisYear = new Date().getFullYear()
const years = Array.from({ length: 111 }, (_, i) => ({ value: String(thisYear - i), label: String(thisYear - i) }))

const impossible = computed(() => Boolean(parts.day && parts.month && parts.year) && model.value === '')
</script>

<template>
  <div class="space-y-1">
    <div class="grid grid-cols-[4.5rem_1fr_5.5rem] gap-2">
      <USelectMenu v-model="parts.day" :items="days" value-key="value" label-key="label" :placeholder="t('registration.birthDate.day')" class="w-full" />
      <USelectMenu v-model="parts.month" :items="months" value-key="value" label-key="label" :placeholder="t('registration.birthDate.month')" class="w-full" />
      <USelectMenu v-model="parts.year" :items="years" value-key="value" label-key="label" :placeholder="t('registration.birthDate.year')" class="w-full" />
    </div>
    <p v-if="impossible" class="text-xs text-red-600">{{ t('registration.birthDate.invalid') }}</p>
  </div>
</template>
