<script setup lang="ts">
import { DASHBOARD_PALETTE, type DashboardChartDatum } from '~/composables/useDashboard'

/**
 * Lightweight SVG donut chart (no chart library) with a legend showing each
 * segment's value and share. Accessible: role="img" with <title>/<desc>, a
 * <title> per segment as tooltip, and a screen-reader-only table.
 */
const props = withDefaults(defineProps<{
  data: DashboardChartDatum[]
  /** Accessible name of the chart (usually its visible title). */
  label: string
  description?: string
  formatValue?: (value: number) => string
}>(), {
  description: undefined,
  formatValue: (value: number) => String(value),
})

const { t } = useI18n()
const titleId = useId()
const descId = useId()

// Shares keep the VE number convention like every other figure (ADR 0010).
const percentFormat = new Intl.NumberFormat('es-VE', { style: 'percent', maximumFractionDigits: 1 })

const total = computed(() => props.data.reduce((sum, d) => sum + Math.max(0, d.value), 0))
const isEmpty = computed(() => total.value <= 0)

const RADIUS = 70
const STROKE = 26
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

const segments = computed(() => {
  let offset = 0
  return props.data.map((d, i) => {
    const value = Math.max(0, d.value)
    const share = total.value > 0 ? value / total.value : 0
    const length = share * CIRCUMFERENCE
    const segment = {
      ...d,
      color: d.color ?? DASHBOARD_PALETTE[i % DASHBOARD_PALETTE.length]!,
      share,
      percent: percentFormat.format(share),
      dashArray: `${length} ${CIRCUMFERENCE - length}`,
      dashOffset: -offset,
    }
    offset += length
    return segment
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
        <UIcon name="i-lucide-chart-pie" class="w-6 h-6 mx-auto" />
        <p class="mt-2 text-xs">{{ t('dashboard.charts.noData') }}</p>
      </div>
    </div>

    <div v-else class="flex flex-col sm:flex-row items-center gap-6">
      <svg
        viewBox="0 0 200 200"
        class="w-44 max-w-full h-auto shrink-0"
        role="img"
        :aria-labelledby="titleId"
        :aria-describedby="description ? descId : undefined"
      >
        <title :id="titleId">{{ label }}</title>
        <desc v-if="description" :id="descId">{{ description }}</desc>
        <circle
          cx="100"
          cy="100"
          :r="RADIUS"
          fill="none"
          class="stroke-prohealth-50"
          :stroke-width="STROKE"
        />
        <g transform="rotate(-90 100 100)">
          <circle
            v-for="s in segments.filter(seg => seg.share > 0)"
            :key="s.key"
            cx="100"
            cy="100"
            :r="RADIUS"
            fill="none"
            :stroke="s.color"
            :stroke-width="STROKE"
            :stroke-dasharray="s.dashArray"
            :stroke-dashoffset="s.dashOffset"
          >
            <title>{{ s.label }}: {{ formatValue(s.value) }} ({{ s.percent }})</title>
          </circle>
        </g>
        <text
          x="100"
          y="96"
          text-anchor="middle"
          class="fill-prohealth-900 text-[26px] font-extrabold"
          aria-hidden="true"
        >{{ formatValue(total) }}</text>
        <text
          x="100"
          y="120"
          text-anchor="middle"
          class="fill-prohealth-500 text-[12px]"
          aria-hidden="true"
        >{{ t('dashboard.charts.total') }}</text>
      </svg>

      <ul class="w-full space-y-2 text-sm" aria-hidden="true">
        <li
          v-for="s in segments"
          :key="s.key"
          class="flex items-center gap-2"
        >
          <span class="w-3 h-3 rounded-sm shrink-0" :style="{ backgroundColor: s.color }" />
          <span class="flex-1 min-w-0 truncate text-prohealth-700" :title="s.label">{{ s.label }}</span>
          <span class="font-semibold text-prohealth-900 tabular-nums">{{ formatValue(s.value) }}</span>
          <span class="w-14 text-right text-xs text-prohealth-500 tabular-nums">{{ s.percent }}</span>
        </li>
      </ul>

      <table class="sr-only">
        <caption>{{ label }}</caption>
        <thead>
          <tr>
            <th scope="col">{{ t('dashboard.charts.table.category') }}</th>
            <th scope="col">{{ t('dashboard.charts.table.value') }}</th>
            <th scope="col">{{ t('dashboard.charts.table.share') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in segments" :key="s.key">
            <th scope="row">{{ s.label }}</th>
            <td>{{ formatValue(s.value) }}</td>
            <td>{{ s.percent }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
