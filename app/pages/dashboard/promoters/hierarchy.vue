<script setup lang="ts">
import type { PromoterHierarchyNodeDto } from '~/types/promoters'

definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'PROMOTER_VIEW_ALL',
})

const { t } = useI18n()
useSeoMeta({ title: () => t('common.seoTitle', { page: t('nav.items.promoterHierarchy.label') }) })

const hierarchyApi = usePromoterHierarchy()
const { can } = usePermissions()

const canAssignSupervisor = computed(() => can('PROMOTER_ASSIGN_SUPERVISOR'))
const canChangeRank = computed(() => can('PROMOTER_CHANGE_RANK'))

const tree = ref<PromoterHierarchyNodeDto[]>([])
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    tree.value = await hierarchyApi.hierarchyTree()
  }
  catch {
    tree.value = []
  }
  finally {
    loading.value = false
  }
}

onMounted(load)

// ---- Assign supervisor modal ----
const assignOpen = ref(false)
const assignTarget = ref<string | null>(null)

function openAssign(uuid: string) {
  assignTarget.value = uuid
  assignOpen.value = true
}

// ---- Change rank modal ----
const changeRankOpen = ref(false)
const changeRankTarget = ref<string | null>(null)

function openChangeRank(uuid: string) {
  changeRankTarget.value = uuid
  changeRankOpen.value = true
}

function onSaved() {
  load()
}
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-extrabold text-prohealth-900 flex items-center gap-2">
          <UIcon name="i-lucide-git-fork" class="w-6 h-6 text-prohealth-600" />
          {{ t('nav.items.promoterHierarchy.label') }}
        </h1>
        <p class="text-sm text-prohealth-500 mt-1">{{ t('promoters.hierarchy.pageSubtitle') }}</p>
      </div>
      <UButton color="neutral" variant="outline" icon="i-lucide-refresh-cw" :loading="loading" @click="load">
        {{ t('common.refresh') }}
      </UButton>
    </div>

    <div v-if="loading" class="space-y-3">
      <USkeleton v-for="i in 4" :key="i" class="h-12 w-full rounded-xl" />
    </div>

    <div v-else-if="tree.length === 0" class="bg-white rounded-2xl border border-prohealth-100 p-10 text-center">
      <UIcon name="i-lucide-users" class="w-8 h-8 mx-auto mb-2 text-prohealth-300" />
      <p class="text-prohealth-700">{{ t('promoters.hierarchy.empty') }}</p>
    </div>

    <div v-else class="space-y-3">
      <PromoterHierarchyNode
        v-for="root in tree"
        :key="root.uuid"
        :node="root"
        :depth="0"
        :can-assign-supervisor="canAssignSupervisor"
        :can-change-rank="canChangeRank"
        @assign-supervisor="openAssign"
        @change-rank="openChangeRank"
      />
    </div>

    <PromoterAssignSupervisorModal
      v-model:open="assignOpen"
      :promoter-uuid="assignTarget"
      @saved="onSaved"
    />
    <PromoterChangeRankModal
      v-model:open="changeRankOpen"
      :promoter-uuid="changeRankTarget"
      @saved="onSaved"
    />
  </div>
</template>
