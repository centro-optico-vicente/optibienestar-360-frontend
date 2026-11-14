<script setup lang="ts">
import type { CampaignLifecycleStatus } from '~/types/campaign'
import { CAMPAIGN_LIFECYCLE_COLORS } from '~/types/campaign'

/** Lifecycle status of a campaign (hub ADR 0038): server `_Display` label, local fallback. Hidden without a status. */
const props = defineProps<{
  status?: CampaignLifecycleStatus | null
  display?: string | null
  size?: 'xs' | 'sm' | 'md'
}>()

const { t } = useI18n()
const label = computed(() => props.display || (props.status ? t(`campaigns.lifecycle.${props.status}`) : ''))
</script>

<template>
  <UBadge v-if="status" :color="CAMPAIGN_LIFECYCLE_COLORS[status] ?? 'neutral'" variant="subtle" :size="size ?? 'sm'">
    {{ label }}
  </UBadge>
</template>
