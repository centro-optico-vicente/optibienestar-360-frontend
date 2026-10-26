<script setup lang="ts">
import type { PublicImageDto } from '~/types/media'

// Read-only gallery for the public pages (hub ADR 0027): primary image first,
// prev/next arrows and thumbnails. Falls back to the card image (`logoUrl` /
// `imageUrl`) when the detail has no `images`; renders `placeholder` slot
// content (or nothing) when there is no image at all.
const props = defineProps<{
  images?: PublicImageDto[] | null
  /** `logoUrl` / `imageUrl` of the same record. */
  fallbackUrl?: string | null
  alt: string
}>()

const { t } = useI18n()

const list = computed<PublicImageDto[]>(() => {
  const own = (props.images ?? []).filter(i => !!i.url)
  // Primary first, keeping the backend order for the rest.
  const sorted = [...own].sort((a, b) => Number(!!b.primary) - Number(!!a.primary))
  if (sorted.length) return sorted
  return props.fallbackUrl ? [{ url: props.fallbackUrl, primary: true }] : []
})

const index = ref(0)
watch(list, () => { index.value = 0 })

const current = computed(() => list.value[index.value] ?? null)

function go(delta: number) {
  const n = list.value.length
  if (n < 2) return
  index.value = (index.value + delta + n) % n
}
</script>

<template>
  <div v-if="current" class="space-y-2">
    <div class="relative aspect-video sm:aspect-[16/10] rounded-2xl overflow-hidden border border-prohealth-100 bg-prohealth-50/40">
      <img :src="current.url" :alt="current.caption || alt" class="w-full h-full object-cover">
      <template v-if="list.length > 1">
        <UButton
          color="neutral"
          variant="solid"
          size="sm"
          icon="i-lucide-chevron-left"
          class="absolute left-2 top-1/2 -translate-y-1/2 rounded-full"
          :aria-label="t('media.previous')"
          @click="go(-1)"
        />
        <UButton
          color="neutral"
          variant="solid"
          size="sm"
          icon="i-lucide-chevron-right"
          class="absolute right-2 top-1/2 -translate-y-1/2 rounded-full"
          :aria-label="t('media.next')"
          @click="go(1)"
        />
      </template>
      <p
        v-if="current.caption"
        class="absolute bottom-0 inset-x-0 bg-black/50 text-white text-xs px-3 py-1.5"
      >
        {{ current.caption }}
      </p>
    </div>
    <div v-if="list.length > 1" class="flex gap-2 overflow-x-auto pb-1">
      <button
        v-for="(img, i) in list"
        :key="`${img.url}-${i}`"
        type="button"
        class="shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2"
        :class="i === index ? 'border-cyan-500' : 'border-transparent opacity-70 hover:opacity-100'"
        :aria-label="t('media.showImage', { n: i + 1 })"
        @click="index = i"
      >
        <img :src="img.url" :alt="img.caption || alt" class="w-full h-full object-cover" loading="lazy">
      </button>
    </div>
  </div>
</template>
