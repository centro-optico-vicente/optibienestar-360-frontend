<script setup lang="ts">
import { CalendarDate } from '@internationalized/date'
import { es, en } from '@nuxt/ui/locale'

const props = withDefaults(
  defineProps<{
    modelValue?: string
    placeholder?: string
    disabled?: boolean
    clearable?: boolean
    icon?: string
    size?: 'sm' | 'md' | 'lg'
  }>(),
  {
    modelValue: '',
    placeholder: 'DD/MM/AAAA',
    disabled: false,
    clearable: true,
    icon: 'i-lucide-calendar',
    size: 'md',
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const { t, locale } = useI18n()
const open = ref(false)
const inputValue = ref('')

const nuxtUiLocale = computed(() => (locale.value === 'en' ? en : es))
provide(Symbol.for('nuxt-ui.locale-context'), nuxtUiLocale)

function isValidDate(y: number, m: number, d: number): boolean {
  if (y < 1900 || y > 2100) return false
  if (m < 1 || m > 12) return false
  if (d < 1 || d > 31) return false
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
}

function parseDateStringToIso(raw: string): string | null {
  const s = raw.trim()
  if (!s) return ''

  // 1. ISO format: YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
  const isoMatch = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/)
  if (isoMatch && isoMatch[1] && isoMatch[2] && isoMatch[3]) {
    const y = parseInt(isoMatch[1], 10)
    const m = parseInt(isoMatch[2], 10)
    const d = parseInt(isoMatch[3], 10)
    if (isValidDate(y, m, d)) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    }
  }

  // 2. Latin / European format: DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmyMatch = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/)
  if (dmyMatch && dmyMatch[1] && dmyMatch[2] && dmyMatch[3]) {
    const d = parseInt(dmyMatch[1], 10)
    const m = parseInt(dmyMatch[2], 10)
    const y = parseInt(dmyMatch[3], 10)
    if (isValidDate(y, m, d)) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    }
  }

  // 3. Compact 8-digit strings (DDMMYYYY or YYYYMMDD)
  if (/^\d{8}$/.test(s)) {
    const endYear = parseInt(s.slice(4, 8), 10)
    if (endYear >= 1900 && endYear <= 2100) {
      const d = parseInt(s.slice(0, 2), 10)
      const m = parseInt(s.slice(2, 4), 10)
      if (isValidDate(endYear, m, d)) {
        return `${endYear}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      }
    }
    const startYear = parseInt(s.slice(0, 4), 10)
    if (startYear >= 1900 && startYear <= 2100) {
      const m = parseInt(s.slice(4, 6), 10)
      const d = parseInt(s.slice(6, 8), 10)
      if (isValidDate(startYear, m, d)) {
        return `${startYear}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      }
    }
  }

  return null
}

function formatIsoToDisplay(iso?: string): string {
  if (!iso) return ''
  const parts = iso.split('-')
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`
  }
  return iso
}

function parseToCalendarDate(iso?: string): CalendarDate | undefined {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return undefined
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return undefined
  return new CalendarDate(y, m, d)
}

watch(
  () => props.modelValue,
  (newVal) => {
    const formatted = formatIsoToDisplay(newVal)
    if (formatted !== inputValue.value) {
      inputValue.value = formatted
    }
  },
  { immediate: true }
)

const calendarValue = computed<any>({
  get: () => {
    if (props.modelValue) return parseToCalendarDate(props.modelValue)
    const iso = parseDateStringToIso(inputValue.value)
    if (iso) return parseToCalendarDate(iso)
    return undefined
  },
  set: (val: any) => {
    onDateSelect(val)
  },
})

const displayPlaceholder = computed(() => {
  if (!props.placeholder || props.placeholder === 'Seleccionar fecha') {
    return 'DD/MM/AAAA'
  }
  if (props.placeholder.includes('AAAA') || props.placeholder.includes('YYYY') || props.placeholder.includes('/')) {
    return props.placeholder
  }
  return `${props.placeholder} (DD/MM/AAAA)`
})

function onInput(e: Event) {
  const val = (e.target as HTMLInputElement).value
  inputValue.value = val
  if (val.trim().length >= 8) {
    const iso = parseDateStringToIso(val)
    if (iso && iso !== props.modelValue) {
      emit('update:modelValue', iso)
    }
  } else if (!val.trim() && props.modelValue) {
    emit('update:modelValue', '')
  }
}

function commitInput() {
  const text = inputValue.value.trim()
  if (!text) {
    if (props.modelValue) {
      emit('update:modelValue', '')
    }
    inputValue.value = ''
    return
  }

  const iso = parseDateStringToIso(text)
  if (iso) {
    emit('update:modelValue', iso)
    inputValue.value = formatIsoToDisplay(iso)
  } else {
    // Si el formato es inválido, restablece al último valor válido
    inputValue.value = formatIsoToDisplay(props.modelValue)
  }
}

function onDateSelect(val: any) {
  if (!val) {
    emit('update:modelValue', '')
    inputValue.value = ''
    open.value = false
    return
  }
  const isoString = typeof val.toString === 'function' ? val.toString() : String(val)
  emit('update:modelValue', isoString)
  inputValue.value = formatIsoToDisplay(isoString)
  open.value = false
}

function selectToday() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const iso = `${y}-${m}-${d}`
  emit('update:modelValue', iso)
  inputValue.value = formatIsoToDisplay(iso)
  open.value = false
}

function clear() {
  emit('update:modelValue', '')
  inputValue.value = ''
  open.value = false
}
</script>

<template>
  <div class="relative w-full">
    <UInput
      :model-value="inputValue"
      type="text"
      :placeholder="displayPlaceholder"
      :disabled="disabled"
      :size="size"
      class="w-full"
      @input="onInput"
      @change="commitInput"
      @blur="commitInput"
      @keydown.enter.prevent="commitInput"
      @keydown.down.alt.prevent="open = true"
    >
      <template #trailing>
        <div class="flex items-center gap-1">
          <button
            v-if="clearable && modelValue && !disabled"
            type="button"
            tabindex="-1"
            class="text-prohealth-400 hover:text-prohealth-700 p-0.5 rounded cursor-pointer transition-colors"
            :title="t('common.clear', 'Limpiar')"
            @click.stop="clear"
          >
            <UIcon name="i-lucide-x" class="w-3.5 h-3.5" />
          </button>

          <UPopover
            v-model:open="open"
            :disabled="disabled"
            :content="{ align: 'end', side: 'bottom', sideOffset: 6 }"
          >
            <button
              type="button"
              tabindex="-1"
              :disabled="disabled"
              class="text-prohealth-500 hover:text-prohealth-800 p-1 rounded hover:bg-prohealth-100/60 transition-colors cursor-pointer flex items-center justify-center disabled:cursor-not-allowed disabled:opacity-50"
              :title="t('common.openCalendar', 'Abrir calendario')"
            >
              <UIcon :name="icon" class="w-4 h-4" />
            </button>

            <template #content>
              <div class="p-3 space-y-3 bg-white">
                <UCalendar
                  :model-value="calendarValue"
                  @update:model-value="onDateSelect"
                />
                <div class="flex items-center justify-between pt-2 border-t border-prohealth-100">
                  <UButton
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    icon="i-lucide-calendar-days"
                    @click="selectToday"
                  >
                    {{ t('common.today', 'Hoy') }}
                  </UButton>
                  <UButton
                    v-if="modelValue"
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    icon="i-lucide-x"
                    @click="clear"
                  >
                    {{ t('common.clear', 'Limpiar') }}
                  </UButton>
                </div>
              </div>
            </template>
          </UPopover>
        </div>
      </template>
    </UInput>
  </div>
</template>
