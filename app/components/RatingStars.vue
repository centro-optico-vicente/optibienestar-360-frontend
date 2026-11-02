<script setup lang="ts">
/**
 * 1–5 star rating. Two modes:
 * - Read-only (default): renders `modelValue` (an average, fractional stars
 *   allowed — the fill is clipped proportionally) plus, optionally, the numeric
 *   value and the vote count. With no value it renders nothing, or the
 *   "no ratings yet" label when `showEmpty` is set.
 * - Editable (`editable`): a radio group of 5 whole stars (`v-model`), hover
 *   preview and arrow-key navigation.
 *
 * The star is an inline SVG (not a Lucide mask icon) so the fill can be painted.
 */
const props = withDefaults(defineProps<{
  modelValue?: number | null
  /** Votes behind an average (read-only). Shown as "(n)" when `showCount`. */
  count?: number | null
  editable?: boolean
  size?: 'xs' | 'sm' | 'md' | 'lg'
  /** Read-only: print the value with one decimal next to the stars. */
  showValue?: boolean
  /** Read-only: print the vote count. Defaults to true when `count` is given. */
  showCount?: boolean
  /** Read-only: show a muted "no ratings yet" label instead of nothing. */
  showEmpty?: boolean
  /** Accessible name of the group (editable) or prefix of the value (read-only). */
  label?: string
  disabled?: boolean
}>(), {
  modelValue: null,
  count: null,
  editable: false,
  size: 'sm',
  showValue: false,
  showCount: undefined,
  showEmpty: false,
  label: undefined,
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

const { t, locale } = useI18n()

const STARS = [1, 2, 3, 4, 5] as const

const sizeClass = computed(() => ({
  xs: 'w-3.5 h-3.5',
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-7 h-7',
}[props.size]))

const textClass = computed(() => (props.size === 'lg' || props.size === 'md' ? 'text-sm' : 'text-xs'))

const hover = ref<number | null>(null)

const value = computed(() => {
  const v = props.modelValue
  return v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v)
})

/** What the stars paint: hover preview while editing, the value otherwise. */
const shown = computed(() => (props.editable && hover.value !== null ? hover.value : value.value ?? 0))

/** Fill percentage of the n-th star (fractional averages clip the last one). */
function fill(n: number): number {
  return Math.round(Math.min(Math.max(shown.value - (n - 1), 0), 1) * 100)
}

const formattedValue = computed(() =>
  value.value === null
    ? ''
    : new Intl.NumberFormat(locale.value, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value.value))

const displayCount = computed(() => (props.showCount ?? props.count !== null) && props.count !== null)

const readonlyAria = computed(() => {
  const base = t('rating.ariaValue', { value: formattedValue.value })
  const withCount = props.count !== null ? `${base}, ${t('rating.count', { n: props.count }, props.count)}` : base
  return props.label ? `${props.label}: ${withCount}` : withCount
})

function select(n: number) {
  if (props.disabled) return
  emit('update:modelValue', n)
}

function onKeydown(e: KeyboardEvent) {
  if (props.disabled) return
  const current = value.value ?? 0
  if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
    e.preventDefault()
    select(Math.min(current + 1, 5))
  }
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
    e.preventDefault()
    select(Math.max(current - 1, 1))
  }
}

const STAR_PATH = 'M12 2.5l2.93 5.94 6.56.95-4.75 4.63 1.12 6.53L12 17.47l-5.86 3.08 1.12-6.53L2.51 9.39l6.56-.95L12 2.5z'
</script>

<template>
  <!-- Editable: radio group of whole stars -->
  <div
    v-if="editable"
    role="radiogroup"
    :aria-label="label"
    class="inline-flex items-center gap-1"
    :class="disabled ? 'opacity-60' : ''"
    @mouseleave="hover = null"
    @keydown="onKeydown"
  >
    <button
      v-for="n in STARS"
      :key="n"
      type="button"
      role="radio"
      :aria-checked="value === n"
      :aria-label="t('rating.starLabel', { n }, n)"
      :tabindex="(value ?? 1) === n ? 0 : -1"
      :disabled="disabled"
      class="relative rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 transition-transform"
      :class="disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:scale-110'"
      @mouseenter="hover = disabled ? null : n"
      @focus="hover = null"
      @click="select(n)"
    >
      <svg viewBox="0 0 24 24" :class="sizeClass" aria-hidden="true">
        <path
          :d="STAR_PATH"
          stroke-width="1.5"
          stroke-linejoin="round"
          :class="fill(n) > 0 ? 'fill-amber-400 stroke-amber-500' : 'fill-transparent stroke-prohealth-300'"
        />
      </svg>
    </button>
  </div>

  <!-- Read-only: average + count -->
  <span
    v-else-if="value !== null"
    role="img"
    :aria-label="readonlyAria"
    class="inline-flex items-center gap-1.5 align-middle"
  >
    <span class="inline-flex items-center gap-0.5" aria-hidden="true">
      <span v-for="n in STARS" :key="n" class="relative inline-block" :class="sizeClass">
        <svg viewBox="0 0 24 24" class="absolute inset-0 w-full h-full">
          <path :d="STAR_PATH" stroke-width="1.5" stroke-linejoin="round" class="fill-prohealth-100 stroke-prohealth-200" />
        </svg>
        <span v-if="fill(n) > 0" class="absolute inset-y-0 left-0 overflow-hidden" :style="{ width: `${fill(n)}%` }">
          <svg viewBox="0 0 24 24" class="h-full" :class="sizeClass">
            <path :d="STAR_PATH" stroke-width="1.5" stroke-linejoin="round" class="fill-amber-400 stroke-amber-500" />
          </svg>
        </span>
      </span>
    </span>
    <span v-if="showValue || displayCount" class="text-prohealth-600 tabular-nums" :class="textClass" aria-hidden="true">
      <span v-if="showValue" class="font-semibold text-prohealth-800">{{ formattedValue }}</span>
      <span v-if="displayCount"> ({{ count }})</span>
    </span>
  </span>

  <span v-else-if="showEmpty" class="text-prohealth-400" :class="textClass">
    {{ t('rating.none') }}
  </span>
</template>
