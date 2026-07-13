<script setup lang="ts">
import logoUrl from '~/assets/centro-optico-vicente-logo.png'
</script>

<template>
  <div class="min-h-screen grid lg:grid-cols-2 bg-white">
    <aside class="hidden lg:flex relative bg-hero-prohealth overflow-hidden">
      <div class="absolute inset-0 opacity-30">
        <div class="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-cyan-400/30 blur-3xl" />
        <div class="absolute bottom-0 right-0 w-[28rem] h-[28rem] rounded-full bg-lime-400/20 blur-3xl" />
      </div>

      <div class="relative z-10 flex flex-col justify-between p-12 text-white w-full">
        <NuxtLink to="/" class="flex items-center gap-2">
          <img :src="logoUrl" alt="Centro Óptico Vicente" class="w-9 h-9 rounded-full bg-white/15 backdrop-blur object-contain">
          <span class="font-extrabold text-xl">OptiBienestar 360</span>
        </NuxtLink>

        <div>
          <h1 class="text-4xl xl:text-5xl font-extrabold leading-tight max-w-md">
            {{ $t('layout.auth.tagline') }}
          </h1>
          <p class="mt-4 text-prohealth-100/90 max-w-md">
            {{ $t('layout.auth.lead') }}
          </p>

          <div class="mt-8 flex items-center gap-3 bg-white/10 backdrop-blur rounded-xl px-4 py-3 max-w-sm">
            <div class="flex -space-x-2">
              <span class="w-8 h-8 rounded-full bg-lime-400 border-2 border-white/30" />
              <span class="w-8 h-8 rounded-full bg-cyan-400 border-2 border-white/30" />
              <span class="w-8 h-8 rounded-full bg-prohealth-300 border-2 border-white/30" />
            </div>
            <div class="text-sm">
              <div class="font-semibold">{{ $t('layout.auth.affiliatesCount') }}</div>
              <div class="opacity-80">{{ $t('layout.auth.affiliatesTrust') }}</div>
            </div>
          </div>
        </div>

        <span class="text-xs opacity-70">{{ $t('layout.copyrightShort', { year: new Date().getFullYear() }) }}</span>
      </div>
    </aside>

    <section class="flex items-center justify-center p-6 lg:p-12">
      <div class="w-full max-w-md">
        <slot />
      </div>
    </section>
  </div>
</template>
