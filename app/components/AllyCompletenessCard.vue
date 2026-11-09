<script setup lang="ts">
// Completeness meter of the ally's own profile (hub ADR 0036): percent + the missing items. Used by the ally
// portal and by the registration wizard (hub ADR 0037).
defineProps<{ percent: number, missing: string[] }>()

const { t } = useI18n()

function missingLabel(key: string): string {
  return t(`allies.portal.registration.missing.${key}`, key)
}
</script>

<template>
  <div class="bg-white rounded-2xl border border-prohealth-100 p-6 space-y-3">
    <div class="flex items-center justify-between gap-3">
      <h2 class="font-bold text-prohealth-900">{{ t('allies.portal.registration.completenessTitle') }}</h2>
      <span class="text-sm font-bold text-prohealth-700">{{ percent }}%</span>
    </div>
    <UProgress :model-value="percent" :max="100" :color="percent >= 100 ? 'success' : 'primary'" />
    <p v-if="!missing.length" class="text-xs text-prohealth-500">{{ t('allies.portal.registration.completenessDone') }}</p>
    <template v-else>
      <p class="text-xs text-prohealth-500">{{ t('allies.portal.registration.completenessHint') }}</p>
      <ul class="flex flex-wrap gap-2">
        <li v-for="key in missing" :key="key">
          <UBadge color="neutral" variant="outline" icon="i-lucide-circle-dashed">{{ missingLabel(key) }}</UBadge>
        </li>
      </ul>
    </template>
  </div>
</template>
