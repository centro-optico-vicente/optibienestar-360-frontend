<script setup lang="ts">
// OptiBienestar 360 logo (Manual de Marca OB360, 15-oct-2026, p. 03).
// Assets come from the designer's files (2026-10-18): the horizontal logo is
// rasterized from "LOGO NUEVO OPTIBIENESTAR 360.eps" at 1200 px (its SVG export
// embeds hundreds of raster gradient tiles, ~1 MB, so a PNG is lighter); the
// colour version drops the white sticker outline for light backgrounds, the
// negativo is its white silhouette; the isotipo is "ISOTIPO NUEVO ... EDITABLE.png".
// Sources live outside git in ~/workspace/fenix-core/optibienestar/logos/.
//
// Manual rules enforced here:
// - Minimum digital width of 120 px for the horizontal versions.
// - Protection zone: free space around the logo equal to the height of the "P"
//   of "PLAN" (~12% of the logo height), applied as padding.
// - Never distort: only the width is set, the height follows the aspect ratio.
// Pick the variant by background: `horizontal` on white/light, `negativo` on
// Azul Profundo / brand gradient, `isotipo` where only a square mark fits.
import horizontalUrl from '~/assets/brand/ob360-logo-horizontal.png'
import negativoUrl from '~/assets/brand/ob360-logo-negativo.png'
import isotipoUrl from '~/assets/brand/ob360-isotipo.png'

type BrandLogoVariant = 'horizontal' | 'negativo' | 'isotipo'

const props = withDefaults(defineProps<{
  variant?: BrandLogoVariant
  /** Rendered width in px (without the protection padding). */
  width?: number
}>(), {
  variant: 'horizontal',
  width: undefined,
})

const MIN_HORIZONTAL_WIDTH = 120
const PROTECTION_RATIO = 0.12

const SOURCES: Record<BrandLogoVariant, { src: string, ratio: number, defaultWidth: number }> = {
  horizontal: { src: horizontalUrl, ratio: 331 / 1476, defaultWidth: 160 },
  negativo: { src: negativoUrl, ratio: 331 / 1476, defaultWidth: 160 },
  isotipo: { src: isotipoUrl, ratio: 1, defaultWidth: 32 },
}

const source = computed(() => SOURCES[props.variant])

const renderedWidth = computed(() => {
  const requested = props.width ?? source.value.defaultWidth
  return props.variant === 'isotipo' ? requested : Math.max(requested, MIN_HORIZONTAL_WIDTH)
})

const renderedHeight = computed(() => Math.round(renderedWidth.value * source.value.ratio))

const padding = computed(() => `${Math.round(renderedHeight.value * PROTECTION_RATIO)}px`)
</script>

<template>
  <span class="inline-flex shrink-0" :style="{ padding }">
    <img
      :src="source.src"
      alt="OptiBienestar 360"
      :width="renderedWidth"
      :height="renderedHeight"
      class="block max-w-none"
      :style="{ width: `${renderedWidth}px`, height: `${renderedHeight}px` }"
    >
  </span>
</template>
