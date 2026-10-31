<script setup lang="ts">
// Verified professional licenses of a published B2P ally (V213): body +
// number, the trust data Venezuelan patients look for (M.P.P.S., Colegio de
// Médicos). Renders nothing when there are none.
import type { PublicAllyLicenseDto } from '~/types/licenses'

const props = defineProps<{ allyUuid: string }>()
const { t } = useI18n()
const licenses = ref<PublicAllyLicenseDto[]>([])

onMounted(async () => {
  try {
    licenses.value = await usePublicAllyLicenses().list(props.allyUuid)
  }
  catch {
    licenses.value = []
  }
})
</script>

<template>
  <div v-if="licenses.length" class="mt-5">
    <p class="text-xs font-semibold uppercase tracking-wide text-prohealth-500">{{ t('allies.public.licensesTitle') }}</p>
    <ul class="mt-2 flex flex-wrap gap-2">
      <li v-for="l in licenses" :key="`${l.licensingBodyCode}-${l.licenseNumber}`">
        <UBadge color="success" variant="subtle" icon="i-lucide-badge-check">
          {{ l.licensingBodyName }} · {{ l.licenseNumber }}
        </UBadge>
      </li>
    </ul>
  </div>
</template>
