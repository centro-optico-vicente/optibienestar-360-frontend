<script setup lang="ts">
// Birth date as a single field, the same date input the rest of the forms use (member,
// beneficiary, portfolio). v-model is `yyyy-MM-dd`, or '' while it is empty or out of range.
const model = defineModel<string>({ default: '' })

const { t } = useI18n()

const pad = (n: number) => String(n).padStart(2, '0')
const now = new Date()
const max = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
const min = `${now.getFullYear() - 110}-01-01`

const raw = ref(model.value)

// An outside change (restoring a saved request) refreshes the field.
watch(model, (value) => {
  if (value !== valid(raw.value)) raw.value = value
})

function valid(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= min && value <= max ? value : ''
}

watch(raw, (value) => { model.value = valid(value ?? '') })

const outOfRange = computed(() => Boolean(raw.value) && model.value === '')
</script>

<template>
  <div class="space-y-1">
    <UInput v-model="raw" type="date" :min="min" :max="max" class="w-full" />
    <p v-if="outOfRange" class="text-xs text-red-600">{{ t('registration.birthDate.invalid') }}</p>
  </div>
</template>
