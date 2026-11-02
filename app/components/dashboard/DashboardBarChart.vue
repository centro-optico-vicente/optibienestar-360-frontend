<script setup lang="ts">
import { DASHBOARD_COLORS, dashboardAxisTicks, type DashboardChartDatum } from '~/composables/useDashboard'

/**
 * Lightweight SVG bar chart (no chart library). Vertical bars for short
 * category labels (months), horizontal bars for long ones (service names).
 * Accessible: role="img" with <title>/<desc>, a <title> per bar as tooltip,
 * and a screen-reader-only table carrying the data.
 */
const props = withDefaults(defineProps<{
  data: DashboardChartDatum[]
  /** Accessible name of the chart (usually its visible title). */
  label: string
  description?: string
  orientation?: 'vertical' | 'horizontal'
  formatValue?: (value: number) => string
  color?: string
}>(), {
  description: undefined,
  orientation: 'vertical',
  formatValue: (value: number) => String(value),
  color: DASHBOARD_COLORS.prohealth,
})

const { t } = useI18n()
const titleId = useId()
const descId = useId()

const isEmpty = computed(() => props.data.length === 0 || props.data.every(d => !d.value))

const WIDTH = 600

// ---- Vertical layout ----
const V = { height: 260, left: 64, right: 12, top: 24, bottom: 32 }
const ticks = computed(() => dashboardAxisTicks(Math.max(0, ...props.data.map(d => d.value))))
const scaleTop = computed(() => ticks.value[ticks.value.length - 1] || 1)
const plotHeight = V.height - V.top - V.bottom
const plotWidth = WIDTH - V.left - V.right

const yOf = (value: number) => V.top + plotHeight - (Math.max(0, value) / scaleTop.value) * plotHeight

const verticalBars = computed(() => {
  const n = props.data.length || 1
  const slot = plotWidth / n
  const barWidth = Math.min(48, slot * 0.6)
  return props.data.map((d, i) => {
    const cx = V.left + slot * i + slot / 2
    const y = yOf(d.value)
    return {
      ...d,
      cx,
      x: cx - barWidth / 2,
      y,
      width: barWidth,
      height: V.top + plotHeight - y,
      fill: d.color ?? props.color,
    }
  })
})

// ---- Horizontal layout ----
const H = { row: 34, labelWidth: 190, right: 90, top: 8, bottom: 8 }
const horizontalHeight = computed(() => H.top + H.bottom + H.row * Math.max(1, props.data.length))
const horizontalMax = computed(() => Math.max(1, ...props.data.map(d => d.value)))
const MAX_LABEL = 26

const horizontalBars = computed(() => {
  const track = WIDTH - H.labelWidth - H.right
  return props.data.map((d, i) => {
    const y = H.top + H.row * i
    const width = (Math.max(0, d.value) / horizontalMax.value) * track
    return {
      ...d,
      shortLabel: d.label.length > MAX_LABEL ? `${d.label.slice(0, MAX_LABEL - 1)}…` : d.label,
      y,
      barY: y + 7,
      barHeight: H.row - 14,
      width: Math.max(width, d.value > 0 ? 2 : 0),
      textY: y + H.row / 2,
      fill: d.color ?? props.color,
    }
  })
})
</script>

<template>
  <div class="w-full">
    <div
      v-if="isEmpty"
      class="h-48 grid place-items-center rounded-xl bg-prohealth-50/60 text-center px-4"
    >
      <div class="text-prohealth-500">
        <UIcon name="i-lucide-chart-no-axes-column" class="w-6 h-6 mx-auto" />
        <p class="mt-2 text-xs">{{ t('dashboard.charts.noData') }}</p>
      </div>
    </div>

    <template v-else>
      <svg
        v-if="orientation === 'vertical'"
        :viewBox="`0 0 ${WIDTH} ${V.height}`"
        class="w-full h-auto"
        role="img"
        :aria-labelledby="titleId"
        :aria-describedby="description ? descId : undefined"
      >
        <title :id="titleId">{{ label }}</title>
        <desc v-if="description" :id="descId">{{ description }}</desc>

        <g aria-hidden="true">
          <g v-for="tick in ticks" :key="tick">
            <line
              :x1="V.left"
              :x2="WIDTH - V.right"
              :y1="yOf(tick)"
              :y2="yOf(tick)"
              class="stroke-prohealth-100"
              stroke-width="1"
            />
            <text
              :x="V.left - 8"
              :y="yOf(tick)"
              text-anchor="end"
              dominant-baseline="middle"
              class="fill-prohealth-500 text-[11px]"
            >{{ formatValue(tick) }}</text>
          </g>
        </g>

        <g v-for="bar in verticalBars" :key="bar.key">
          <title>{{ bar.label }}: {{ formatValue(bar.value) }}</title>
          <rect
            :x="bar.x"
            :y="bar.y"
            :width="bar.width"
            :height="bar.height"
            :fill="bar.fill"
            rx="4"
          />
          <text
            v-if="bar.value > 0"
            :x="bar.cx"
            :y="bar.y - 6"
            text-anchor="middle"
            class="fill-prohealth-900 text-[12px] font-semibold"
            aria-hidden="true"
          >{{ formatValue(bar.value) }}</text>
          <text
            :x="bar.cx"
            :y="V.height - 10"
            text-anchor="middle"
            class="fill-prohealth-600 text-[12px]"
            aria-hidden="true"
          >{{ bar.label }}</text>
        </g>
      </svg>

      <svg
        v-else
        :viewBox="`0 0 ${WIDTH} ${horizontalHeight}`"
        class="w-full h-auto"
        role="img"
        :aria-labelledby="titleId"
        :aria-describedby="description ? descId : undefined"
      >
        <title :id="titleId">{{ label }}</title>
        <desc v-if="description" :id="descId">{{ description }}</desc>

        <g v-for="bar in horizontalBars" :key="bar.key">
          <title>{{ bar.label }}: {{ formatValue(bar.value) }}</title>
          <text
            :x="H.labelWidth - 10"
            :y="bar.textY"
            text-anchor="end"
            dominant-baseline="middle"
            class="fill-prohealth-700 text-[13px]"
            aria-hidden="true"
          >{{ bar.shortLabel }}</text>
          <rect
            :x="H.labelWidth"
            :y="bar.barY"
            :width="WIDTH - H.labelWidth - H.right"
            :height="bar.barHeight"
            class="fill-prohealth-50"
            rx="4"
          />
          <rect
            :x="H.labelWidth"
            :y="bar.barY"
            :width="bar.width"
            :height="bar.barHeight"
            :fill="bar.fill"
            rx="4"
          />
          <text
            :x="H.labelWidth + bar.width + 8"
            :y="bar.textY"
            dominant-baseline="middle"
            class="fill-prohealth-900 text-[13px] font-semibold"
            aria-hidden="true"
          >{{ formatValue(bar.value) }}</text>
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
