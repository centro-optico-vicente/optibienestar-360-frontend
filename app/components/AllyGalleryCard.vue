<script setup lang="ts">
// The ally's own image gallery card (hub ADR 0027), shared by the ally portal and the registration wizard.
// `pending`: the ally is not approved yet, so its images are not public until then (#320).
const props = defineProps<{ allyUuid: string, readonly?: boolean, pending?: boolean }>()
/** Forwarded from the editor: the logo counts for the profile completeness, which must be reloaded (#316). */
const emit = defineEmits<{ changed: [] }>()

const { t } = useI18n()
</script>

<template>
  <div id="ally-gallery" class="bg-white rounded-2xl border border-prohealth-100 p-6 space-y-2 scroll-mt-20">
    <h2 class="font-bold text-prohealth-900">{{ t('allies.portal.gallery.title') }}</h2>
    <p class="text-xs text-prohealth-500">{{ props.pending ? t('allies.portal.gallery.hintPending') : t('allies.portal.gallery.hint') }}</p>
    <MediaGalleryEditor
      :key="allyUuid"
      :base="`/v1/me/allies/${allyUuid}/media`"
      :readonly="props.readonly"
      :deferred-publish="props.pending"
      @changed="emit('changed')"
    />
  </div>
</template>
