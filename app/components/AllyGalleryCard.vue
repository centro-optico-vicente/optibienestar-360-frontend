<script setup lang="ts">
// The ally's own image gallery card (hub ADR 0027), shared by the ally portal and the registration wizard.
defineProps<{ allyUuid: string, readonly?: boolean }>()

const { t } = useI18n()
</script>

<template>
  <div id="ally-gallery" class="bg-white rounded-2xl border border-prohealth-100 p-6 space-y-2 scroll-mt-20">
    <h2 class="font-bold text-prohealth-900">{{ t('allies.portal.gallery.title') }}</h2>
    <p class="text-xs text-prohealth-500">{{ t('allies.portal.gallery.hint') }}</p>
    <MediaGalleryEditor :key="allyUuid" :base="`/v1/me/allies/${allyUuid}/media`" :readonly="readonly" />
  </div>
</template>
