<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'
import type { PublicAllyListItemDto } from '~/types/allies'

// Brand panel of the auth layout: live count of the public ally directory plus
// the logos of the first allies, magnified like the macOS Dock under the cursor.
// Decorative: on error or an empty directory it renders nothing (no made-up number).
// The magnify is a pure `transform: scale()`: every avatar keeps a fixed BASE_SIZE
// layout box and the row keeps its spacing, so hovering never reflows the text.

const BASE_SIZE = 32
const MAX_BOOST = 0.8
const RADIUS = 70
const MAX_LOGOS = 5
// Below this the exact figure reads small: show a generic "network" claim instead.
const MIN_COUNT_SHOWN = 20

const { t, n } = useI18n()
const publicPath = usePublicPath()
const reducedMotion = usePreferredReducedMotion()

const allies = ref<PublicAllyListItemDto[]>([])
const total = ref(0)
const loading = ref(true)

const headline = computed(() => total.value >= MIN_COUNT_SHOWN
  ? t('layout.auth.alliesCount', { count: n(total.value) }, total.value)
  : t('layout.auth.alliesNetwork'))

const itemRefs: HTMLElement[] = []
function setItemRef(el: Element | ComponentPublicInstance | null, i: number) {
  if (el instanceof HTMLElement) itemRefs[i] = el
}
const scales = ref<number[]>([])
let frame = 0

const magnify = computed(() => reducedMotion.value !== 'reduce')
// Vertical headroom so the largest scaled avatar (grown from its bottom edge) is not clipped.
const rowHeight = Math.ceil(BASE_SIZE * (1 + MAX_BOOST))

function scaleStyle(i: number) {
  if (!magnify.value) return undefined
  return { transform: `scale(${scales.value[i] ?? 1})` }
}

const nearest = computed(() => {
  let best = -1
  let bestScale = 1
  scales.value.forEach((s, i) => {
    if (s > bestScale) {
      bestScale = s
      best = i
    }
  })
  return best
})

function onMove(e: MouseEvent) {
  if (!magnify.value) return
  const x = e.clientX
  cancelAnimationFrame(frame)
  frame = requestAnimationFrame(() => {
    scales.value = itemRefs.slice(0, allies.value.length).map((el) => {
      const r = el.getBoundingClientRect()
      const d = Math.abs(x - (r.left + r.width / 2))
      return 1 + MAX_BOOST * Math.max(0, 1 - d / RADIUS)
    })
  })
}

function onLeave() {
  cancelAnimationFrame(frame)
  scales.value = []
}

onBeforeUnmount(() => cancelAnimationFrame(frame))

onMounted(async () => {
  try {
    const res = await usePublicAllies().list({ page: 0, size: MAX_LOGOS, silent: true })
    allies.value = res.content ?? []
    total.value = res.totalElements ?? 0
  }
  catch {
    total.value = 0
  }
  finally {
    loading.value = false
  }
})
</script>

<template>
  <div v-if="loading" class="flex items-center gap-3 bg-white/10 backdrop-blur rounded-xl px-4 py-3 max-w-sm">
    <div class="flex -space-x-2">
      <USkeleton v-for="i in 3" :key="i" class="w-8 h-8 rounded-full bg-white/20" />
    </div>
    <div class="space-y-1.5">
      <USkeleton class="h-3.5 w-28 bg-white/20" />
      <USkeleton class="h-3 w-20 bg-white/20" />
    </div>
  </div>

  <NuxtLink
    v-else-if="total > 0"
    :to="publicPath('/aliados')"
    :aria-label="t('layout.auth.alliesHint')"
    class="group flex items-end gap-3 bg-white/10 hover:bg-white/15 backdrop-blur rounded-xl px-4 py-3 max-w-sm transition-colors"
  >
    <!-- Fixed width (shrink-0) and fixed spacing: only the transforms change on hover. -->
    <div
      class="flex items-end shrink-0 -space-x-2 pe-2"
      :style="{ height: `${rowHeight}px` }"
      @mousemove="onMove"
      @mouseleave="onLeave"
    >
      <UTooltip v-for="(a, i) in allies" :key="a.uuid" :text="a.name">
        <div
          :ref="el => setItemRef(el, i)"
          class="relative shrink-0 rounded-full origin-bottom transition-transform duration-150 ease-out"
          :class="[nearest === i ? 'z-10' : '', !magnify ? 'hover:-translate-y-1' : '']"
          :style="[{ width: `${BASE_SIZE}px`, height: `${BASE_SIZE}px` }, scaleStyle(i)]"
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
