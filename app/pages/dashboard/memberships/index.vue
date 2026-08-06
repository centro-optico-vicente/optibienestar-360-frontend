<script setup lang="ts">
import type { SelectItem } from '~/types/options'
import { memberOptionLabel } from '~/types/members'

// Memberships have no global admin list in the backend — they are a sub-resource of a
// member (enroll/cancel/reactivate per member). So this page is a member picker that
// renders the shared <MemberMembershipsCard> for the chosen member, giving the
// top-level "Membresías" menu entry a real destination instead of the catch-all.
definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'MEMBERSHIP_VIEW_ALL',
})

const { t } = useI18n()

useSeoMeta({ title: () => `${t('memberships.page.title')} — OptiBienestar 360` })

const members = useMembers()

// ---- Member search (server-side, debounced) ----
// Search box lives inside the USelectMenu itself (search-term) so typing and
// picking a result happen in the same field instead of two separate widgets.
const memberSearchTerm = ref('')
const memberOptions = ref<SelectItem[]>([])
const searching = ref(false)
const selectedMemberUuid = ref<string>('')

let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(memberSearchTerm, (q) => {
  clearTimeout(searchTimer)
  const term = q.trim()
  // Don't clear memberOptions here: USelectMenu resets search-term to '' right after a
  // pick (resetSearchTermOnSelect/Blur), and wiping the list at that point would drop
  // the just-selected item, making the trigger fall back to showing the raw uuid
  // instead of its label.
  if (term.length < 2) return
  searchTimer = setTimeout(async () => {
    searching.value = true
    try {
      const res = await members.options({ q: term, limit: 10 })
      memberOptions.value = res.map(o => ({ label: memberOptionLabel(o), value: o.uuid }))
    }
    catch {
      memberOptions.value = []
    }
    finally {
      searching.value = false
    }
  }, 400)
})

const selectedMemberLabel = computed(() =>
  memberOptions.value.find(o => o.value === selectedMemberUuid.value)?.label ?? '')
</script>

<template>
  <div class="space-y-5">
    <!-- Header -->
    <div>
      <h1 class="text-2xl font-extrabold text-prohealth-900">{{ t('memberships.page.title') }}</h1>
      <p class="text-sm text-prohealth-700/70 mt-1">
        {{ t('memberships.page.description') }}
      </p>
    </div>

    <!-- Member picker -->
    <div class="bg-white rounded-2xl border border-prohealth-100 p-4 space-y-4">
      <UFormField :label="t('memberships.page.searchLabel')" :help="t('memberships.page.searchHelp')">
        <USelectMenu
          v-model="selectedMemberUuid"
          v-model:search-term="memberSearchTerm"
          :items="memberOptions"
          label-key="label"
          value-key="value"
          ignore-filter
          icon="i-lucide-search"
          :loading="searching"
          :placeholder="t('memberships.page.searchPlaceholder')"
          :search-input="{ placeholder: t('memberships.page.searchPlaceholder'), icon: 'i-lucide-search' }"
          class="w-full sm:max-w-md"
        />
      </UFormField>
      <p v-if="selectedMemberLabel" class="text-xs text-prohealth-500">
        {{ t('memberships.page.managingFor') }} <span class="font-semibold text-prohealth-700">{{ selectedMemberLabel }}</span>.
        <NuxtLink :to="`/dashboard/members/${selectedMemberUuid}`" class="text-cyan-700 hover:underline">{{ t('memberships.page.viewFullRecord') }}</NuxtLink>.
      </p>
    </div>

    <!-- Memberships of the selected member -->
    <MemberMembershipsCard v-if="selectedMemberUuid" :key="selectedMemberUuid" :member-uuid="selectedMemberUuid" />

    <!-- Empty state before choosing a member -->
    <div v-else class="bg-white rounded-2xl border border-prohealth-100 p-12 text-center">
      <UIcon name="i-lucide-badge-check" class="w-10 h-10 mx-auto mb-3 text-prohealth-300" />
      <p class="text-prohealth-700 font-semibold">{{ t('memberships.page.emptyTitle') }}</p>
      <p class="text-sm text-prohealth-500 mt-1">{{ t('memberships.page.emptyDescription') }}</p>
    </div>
  </div>
</template>
