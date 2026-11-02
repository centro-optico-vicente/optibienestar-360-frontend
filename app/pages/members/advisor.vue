<script setup lang="ts">
import type { MyAdvisorDto } from '~/types/members'

// "Mi asesor" (V201) — the caller's current advisor and the advisors they had before
// (GET /v1/me/member/advisor, MEMBER_ADVISOR_VIEW_OWN). Shared by the affiliate, advisor and ally
// portals: someone with no member record gets `exists=false`, shown as an empty state, never an error.
definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'MEMBER_ADVISOR_VIEW_OWN',
})

const { t } = useI18n()
const { formatDate } = useFormatters()
const members = useMembers()

useSeoMeta({ title: () => t('common.seoTitle', { page: t('members.advisor.title') }) })

const advisor = ref<MyAdvisorDto | null>(null)
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    advisor.value = await members.myAdvisor()
  }
  catch {
    advisor.value = null
  }
  finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-extrabold text-prohealth-900">{{ t('members.advisor.title') }}</h1>
        <p class="text-sm text-prohealth-700/70 mt-1">{{ t('members.advisor.subtitle') }}</p>
      </div>
      <RefreshButton :loading="loading" @refresh="load" />
    </div>

    <USkeleton v-if="loading && !advisor" class="h-32 rounded-2xl" />

    <div v-else-if="!advisor?.exists" class="bg-white rounded-2xl border border-prohealth-100 px-5 py-12 text-center text-prohealth-500">
      <UIcon name="i-lucide-user-round-x" class="w-8 h-8 mx-auto mb-2 text-prohealth-300" />
      {{ t('members.advisor.notEnrolled') }}
    </div>

    <template v-else>
      <div class="bg-white rounded-2xl border border-prohealth-100 p-5">
        <p class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">{{ t('members.advisor.current') }}</p>
        <p v-if="advisor.advisorName" class="text-lg font-bold text-prohealth-900 mt-1">{{ advisor.advisorName }}</p>
        <p v-else class="text-sm text-prohealth-500 mt-1">{{ t('members.advisor.none') }}</p>
      </div>

      <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden">
        <p class="px-5 py-3 text-sm font-semibold text-prohealth-800 border-b border-prohealth-100">{{ t('members.advisor.history') }}</p>
        <p v-if="advisor.history.length === 0" class="px-5 py-8 text-center text-sm text-prohealth-500">
          {{ t('members.advisor.historyEmpty') }}
        </p>
        <ul v-else class="divide-y divide-prohealth-100">
          <li v-for="(h, i) in advisor.history" :key="i" class="px-5 py-3 flex flex-wrap items-center justify-between gap-2">
            <p class="text-sm text-prohealth-800">
              <template v-if="h.fromName">
                {{ t('members.advisor.changed', { from: h.fromName, to: h.toName }) }}
              </template>
              <template v-else>
                {{ t('members.advisor.assigned', { to: h.toName }) }}
              </template>
            </p>
            <p class="text-xs text-prohealth-500">{{ h.assignedAt_Display ?? formatDate(h.assignedAt, 'datetime') }}</p>
          </li>
        </ul>
      </div>
    </template>
  </div>
</template>
