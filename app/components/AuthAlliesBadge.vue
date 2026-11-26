<script setup lang="ts">
import type { AllySegment, PublicAllyListItemDto } from '~/types/allies'
import type { AlliesCounterMode } from '~/types/organizations'

// Brand panel of the auth layout: public allies counter plus the logos of the first
// allies, magnified like the macOS Dock under the cursor. Visibility and figure come
// from GET /v1/public/organization/stats (ADR 0042): the backend applies the configured
// minimum, so `count = null` means "show the generic phrase", and `mode` picks which
// allies are counted (professional / commercial / both), which the text names. Logos
// still come from the public directory, filtered by the same segment. Decorative: on
// error or an empty directory it renders nothing.
//
// Dock without reflow: the avatar row has a fixed size reserved for the expanded state,
// avatars are absolutely placed at their rest slots and hover only changes transforms —
// `scale()` from the bottom edge plus a `translateX()` by the growth of their
// neighbours, anchored at the pointer — so magnified avatars move aside instead of
// covering each other and the text column never moves.

const BASE_SIZE = 32
const MAX_BOOST = 0.7
const RADIUS = 60
const GAP = 2
const MAX_LOGOS = 5
// Room for the avatar ring/shadow above the largest scaled avatar.
const HEADROOM = 4

// Per counter mode: directory segment of the logos and the i18n keys of the headline.
const MODE_SEGMENT: Partial<Record<AlliesCounterMode, AllySegment>> = {
  PROFESSIONAL: 'B2P',
  COMMERCIAL: 'B2B',
}
const MODE_KEYS: Partial<Record<AlliesCounterMode, { count: string, network: string }>> = {
  PROFESSIONAL: { count: 'layout.auth.alliesProfessionalCount', network: 'layout.auth.alliesProfessionalNetwork' },
  COMMERCIAL: { count: 'layout.auth.alliesCommercialCount', network: 'layout.auth.alliesCommercialNetwork' },
}
const DEFAULT_KEYS = { count: 'layout.auth.alliesCount', network: 'layout.auth.alliesNetwork' }

const { t, n } = useI18n()
const publicPath = usePublicPath()
const reducedMotion = usePreferredReducedMotion()

const { stats, load: loadStats } = usePublicOrganizationStats()
const allies = ref<PublicAllyListItemDto[]>([])
const loading = ref(true)

const count = computed(() => stats.value?.allies.count ?? null)
const visible = computed(() => !!stats.value?.allies.visible && allies.value.length > 0)

const headline = computed(() => {
  const mode = stats.value?.allies.mode
  const keys = (mode && MODE_KEYS[mode]) || DEFAULT_KEYS
  return count.value != null
    ? t(keys.count, { count: n(count.value) }, count.value)
    : t(keys.network)
})

const magnify = computed(() => reducedMotion.value !== 'reduce')

interface DockItem { scale: number, dx: number }

/**
 * Classic dock math for `count` avatars with the pointer at `px` (relative to the left
 * edge of the first rest slot): each scale falls off linearly with the distance to its
 * rest center; the expanded row is laid out left to right and shifted so the point under
 * the pointer stays still, which splits the growth to both sides of the pointer.
 */
function dockLayout(count: number, px: number): { items: DockItem[], left: number, right: number } {
  const step = BASE_SIZE + GAP
  const scales = Array.from({ length: count }, (_, i) => {
    const d = Math.abs(px - (i * step + BASE_SIZE / 2))
    return 1 + MAX_BOOST * Math.max(0, 1 - d / RADIUS)
  })
  const shift = scales.reduce((acc, s, i) =>
    acc + BASE_SIZE * (s - 1) * Math.min(1, Math.max(0, (px - i * step) / BASE_SIZE)), 0)
  let x = -shift
  const items = scales.map((s, i) => {
    const w = BASE_SIZE * s
    const dx = x + w / 2 - (i * step + BASE_SIZE / 2)
    x += w + GAP
    return { scale: s, dx }
  })
  const restWidth = count * step - GAP
  return { items, left: shift, right: x - GAP - restWidth }
}

const restWidth = computed(() => Math.max(0, allies.value.length * (BASE_SIZE + GAP) - GAP))

// Horizontal room the expanded row can take beyond the rest slots on either side
// (worst case over every pointer position), reserved up front so hover never reflows.
const sidePad = computed(() => {
  const count = allies.value.length
  if (!magnify.value || count === 0) return 0
  let max = 0
  for (let px = -RADIUS; px <= restWidth.value + RADIUS; px++) {
    const { left, right } = dockLayout(count, px)
    max = Math.max(max, left, right)
  }
  return Math.ceil(max)
})

const rowStyle = computed(() => ({
  width: `${restWidth.value + 2 * sidePad.value}px`,
  height: `${magnify.value ? Math.ceil(BASE_SIZE * (1 + MAX_BOOST)) + HEADROOM : BASE_SIZE + HEADROOM}px`,
}))

const rowRef = ref<HTMLElement | null>(null)
const dock = ref<DockItem[]>([])
let frame = 0

const nearest = computed(() => {
  let best = -1
  let bestScale = 1
  dock.value.forEach((d, i) => {
    if (d.scale > bestScale) {
      bestScale = d.scale
      best = i
    }
  })
  return best
})

function itemStyle(i: number) {
  const d = dock.value[i]
  return {
    left: `${sidePad.value + i * (BASE_SIZE + GAP)}px`,
    width: `${BASE_SIZE}px`,
    height: `${BASE_SIZE}px`,
    ...(magnify.value && d ? { transform: `translateX(${d.dx}px) scale(${d.scale})` } : {}),
  }
}

function onMove(e: MouseEvent) {
  if (!magnify.value || !rowRef.value) return
  const x = e.clientX - rowRef.value.getBoundingClientRect().left - sidePad.value
  cancelAnimationFrame(frame)
  frame = requestAnimationFrame(() => {
    dock.value = dockLayout(allies.value.length, x).items
  })
}

function onLeave() {
  cancelAnimationFrame(frame)
  dock.value = []
}

onBeforeUnmount(() => cancelAnimationFrame(frame))

onMounted(async () => {
  try {
    // Sequential: the logos' segment depends on the counter mode, and a hidden card needs no logos.
    const s = await loadStats()
    if (!s?.allies.visible) return
    const segment = s.allies.mode ? MODE_SEGMENT[s.allies.mode] : undefined
    const res = await usePublicAllies()
      .list({ page: 0, size: MAX_LOGOS, silent: true, ...(segment ? { segment } : {}) })
      .catch(() => null)
    allies.value = res?.content ?? []
  }
  finally {
    loading.value = false
  }
})
</script>

<template>
  <div v-if="loading" class="flex items-center gap-3 bg-white/10 backdrop-blur rounded-xl px-4 py-3 max-w-md">
    <div class="flex -space-x-2">
      <USkeleton v-for="i in 3" :key="i" class="w-8 h-8 rounded-full bg-white/20" />
    </div>
    <div class="space-y-1.5">
      <USkeleton class="h-3.5 w-28 bg-white/20" />
      <USkeleton class="h-3 w-20 bg-white/20" />
    </div>
  </div>

  <NuxtLink
    v-else-if="visible"
    :to="publicPath('/aliados')"
    :aria-label="t('layout.auth.alliesHint')"
    class="group flex items-end gap-3 bg-white/10 hover:bg-white/15 backdrop-blur rounded-xl px-4 py-3 max-w-md transition-colors"
  >
    <!-- Fixed size reserved for the expanded dock: hover only changes transforms. -->
    <div
      ref="rowRef"
      class="relative shrink-0"
      :style="rowStyle"
      @mousemove="onMove"
      @mouseleave="onLeave"
    >
      <UTooltip v-for="(a, i) in allies" :key="a.uuid" :text="a.name">
        <div
          class="absolute bottom-0 rounded-full origin-bottom transition-transform duration-150 ease-out"
          :class="[nearest === i ? 'z-10' : '', !magnify ? 'hover:-translate-y-1' : '']"
          :style="itemStyle(i)"
        >
          <UAvatar
            :src="a.logoUrl || undefined"
            :alt="a.name"
            class="size-full bg-white text-prohealth-700 ring-2 ring-white/40 shadow"
            :ui="{ image: 'object-contain p-0.5' }"
          />
        </div>
      </UTooltip>
    </div>
    <div class="min-w-0 text-sm pb-1">
      <div class="font-semibold">{{ headline }}</div>
      <div class="opacity-80">{{ t('layout.auth.alliesTrust') }}</div>
      <!-- Visible call to action: without it nothing tells the badge is a link. -->
      <div class="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold underline underline-offset-4 decoration-white/40 group-hover:decoration-white">
        {{ t('layout.auth.alliesHint') }}
        <UIcon name="i-lucide-arrow-right" class="size-3.5 transition-transform group-hover:translate-x-0.5" />
      </div>
    </div>
  </NuxtLink>
</template>
