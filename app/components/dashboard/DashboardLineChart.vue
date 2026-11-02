<script setup lang="ts">
import { DASHBOARD_COLORS, dashboardAxisTicks, type DashboardChartDatum } from '~/composables/useDashboard'

/**
 * Lightweight SVG line chart (no chart library) for monthly series.
 * Accessible: role="img" with <title>/<desc>, a <title> per point as tooltip,
 * and a screen-reader-only table carrying the data.
 */
const props = withDefaults(defineProps<{
  data: DashboardChartDatum[]
  /** Accessible name of the chart (usually its visible title). */
  label: string
  description?: string
  formatValue?: (value: number) => string
  /** Axis tick formatter (e.g. compact money); defaults to `formatValue`. */
  formatTick?: (value: number) => string
  color?: string
}>(), {
  description: undefined,
  formatValue: (value: number) => String(value),
  formatTick: undefined,
  color: DASHBOARD_COLORS.prohealth,
})

const { t } = useI18n()
const titleId = useId()
const descId = useId()
const gradientId = useId()

const isEmpty = computed(() => props.data.length === 0 || props.data.every(d => !d.value))
const tickLabel = (value: number) => (props.formatTick ?? props.formatValue)(value)

const WIDTH = 600
const L = { height: 260, left: 64, right: 24, top: 28, bottom: 32 }
const plotHeight = L.height - L.top - L.bottom
const plotWidth = WIDTH - L.left - L.right

const ticks = computed(() => dashboardAxisTicks(Math.max(0, ...props.data.map(d => d.value))))
const scaleTop = computed(() => ticks.value[ticks.value.length - 1] || 1)
const yOf = (value: number) => L.top + plotHeight - (Math.max(0, value) / scaleTop.value) * plotHeight
const baseline = L.top + plotHeight

const points = computed(() => {
  const n = props.data.length
  return props.data.map((d, i) => ({
    ...d,
    x: n <= 1 ? L.left + plotWidth / 2 : L.left + (plotWidth * i) / (n - 1),
    y: yOf(d.value),
  }))
})

const linePath = computed(() =>
  points.value.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '))

const areaPath = computed(() => {
  const pts = points.value
  if (!pts.length) return ''
  const first = pts[0]!
  const last = pts[pts.length - 1]!
  return `${linePath.value} L${last.x.toFixed(1)},${baseline} L${first.x.toFixed(1)},${baseline} Z`
})

/** Value labels over each point only while they fit without overlapping. */
const showPointLabels = computed(() => props.data.length <= 6)
</script>

<template>
  <div class="w-full">
    <div
      v-if="isEmpty"
      class="h-48 grid place-items-center rounded-xl bg-prohealth-50/60 text-center px-4"
    >
      <div class="text-prohealth-500">
        <UIcon name="i-lucide-chart-line" class="w-6 h-6 mx-auto" />
        <p class="mt-2 text-xs">{{ t('dashboard.charts.noData') }}</p>
      </div>
    </div>

    <template v-else>
      <svg
        :viewBox="`0 0 ${WIDTH} ${L.height}`"
        class="w-full h-auto"
        role="img"
        :aria-labelledby="titleId"
        :aria-describedby="description ? descId : undefined"
      >
        <title :id="titleId">{{ label }}</title>
        <desc v-if="description" :id="descId">{{ description }}</desc>
        <defs>
          <linearGradient :id="gradientId" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" :stop-color="color" stop-opacity="0.25" />
            <stop offset="100%" :stop-color="color" stop-opacity="0" />
          </linearGradient>
        </defs>

        <g aria-hidden="true">
          <g v-for="tick in ticks" :key="tick">
            <line
              :x1="L.left"
              :x2="WIDTH - L.right"
              :y1="yOf(tick)"
              :y2="yOf(tick)"
              class="stroke-prohealth-100"
              stroke-width="1"
            />
            <text
              :x="L.left - 8"
              :y="yOf(tick)"
              text-anchor="end"
              dominant-baseline="middle"
              class="fill-prohealth-500 text-[11px]"
            >{{ tickLabel(tick) }}</text>
          </g>
          <path :d="areaPath" :fill="`url(#${gradientId})`" />
          <path
            :d="linePath"
            fill="none"
            :stroke="color"
            stroke-width="3"
            stroke-linejoin="round"
            stroke-linecap="round"
          />
        </g>

        <g v-for="p in points" :key="p.key">
          <title>{{ p.label }}: {{ formatValue(p.value) }}</title>
          <!-- Larger transparent hit area so the tooltip is easy to reach. -->
          <circle :cx="p.x" :cy="p.y" r="12" fill="transparent" />
          <circle :cx="p.x" :cy="p.y" r="4.5" fill="white" :stroke="color" stroke-width="2.5" />
          <text
            v-if="showPointLabels"
            :x="p.x"
            :y="p.y - 12"
            text-anchor="middle"
            class="fill-prohealth-900 text-[12px] font-semibold"
            aria-hidden="true"
          >{{ formatValue(p.value) }}</text>
          <text
            :x="p.x"
            :y="L.height - 10"
            text-anchor="middle"
            class="fill-prohealth-600 text-[12px]"
            aria-hidden="true"
          >{{ p.label }}</text>
        </g>
      </svg>

      <table class="sr-only">
        <caption>{{ label }}</caption>
        <thead>
          <tr>
            <th scope="col">{{ t('dashboard.charts.table.category') }}</th>
            <th scope="col">{{ t('dashboard.charts.table.value') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="d in data" :key="d.key">
            <th scope="row">{{ d.label }}</th>
            <td>{{ formatValue(d.value) }}</td>
          </tr>
        </tbody>
      </table>
    </template>
  </div>
</template>
