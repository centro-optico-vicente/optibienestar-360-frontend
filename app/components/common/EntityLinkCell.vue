<script setup lang="ts">
// Shared "quick access to the master screen" cell, used by any table column
// that shows a FK's resolved `_Display` label (hub ADR 0014). Replaces the
// ad-hoc `<NuxtLink>` copied across members/index.vue, commissions/index.vue,
// payments/[uuid].vue, memberships/index.vue and job-runs/index.vue.
withDefaults(defineProps<{
  /** Target route, e.g. `/dashboard/promoters/${uuid}`; `null`/empty when there's no FK. */
  to?: string | null
  /** The resolved `_Display` label to show. */
  label?: string | null
  /** Whether the current user can view the target screen (usePermissions().can(...)). */
  can?: boolean
}>(), {
  to: null,
  label: null,
  can: true,
})
</script>

<template>
  <NuxtLink
    v-if="to && can"
    :to="to"
    class="text-primary-600 hover:underline"
  >
    {{ label || $t('common.empty') }}
  </NuxtLink>
  <UTooltip v-else-if="to" :text="$t('common.noAccessToScreen')">
    <span class="text-prohealth-400 cursor-not-allowed">{{ label || $t('common.empty') }}</span>
  </UTooltip>
  <span v-else class="text-prohealth-400">{{ label || $t('common.empty') }}</span>
</template>
