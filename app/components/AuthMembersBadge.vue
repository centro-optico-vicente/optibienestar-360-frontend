<script setup lang="ts">
// Brand panel of the auth layout: public members counter (ADR 0042). Same card as
// AuthAlliesBadge but with an icon instead of faces (privacy), no link and no detail
// page. The backend decides visibility and applies the configured minimum: `count = null`
// shows a generic phrase. Hidden by default (mode HIDDEN) and on any error; no skeleton,
// so a hidden card never flashes.

const { t, n } = useI18n()
const { stats, load } = usePublicOrganizationStats()

const members = computed(() => stats.value?.members ?? null)
const visible = computed(() => !!members.value?.visible)

const headline = computed(() => {
  const count = members.value?.count ?? null
  if (count == null) return t('layout.auth.membersGeneric')
  const key = members.value?.mode === 'MEMBERS_AND_BENEFICIARIES'
    ? 'layout.auth.peopleProtectedCount'
    : 'layout.auth.membersCount'
  return t(key, { count: n(count) }, count)
})

onMounted(() => load())
</script>

<template>
  <div
    v-if="visible"
    class="flex items-center gap-3 bg-white/10 backdrop-blur rounded-xl px-4 py-3 max-w-md"
  >
    <div class="shrink-0 flex items-center justify-center size-10 rounded-full bg-white text-prohealth-700 ring-2 ring-white/40 shadow">
      <UIcon name="i-lucide-heart-handshake" class="size-5" />
    </div>
    <div class="min-w-0 text-sm">
      <div class="font-semibold">{{ headline }}</div>
      <div class="opacity-80">{{ t('layout.auth.membersTrust') }}</div>
    </div>
  </div>
</template>
