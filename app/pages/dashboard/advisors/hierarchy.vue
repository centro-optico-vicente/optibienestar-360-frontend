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
const toast = useToast()
const { can } = usePermissions()

const canAssignSupervisor = computed(() => can('PROMOTER_ASSIGN_SUPERVISOR'))
const canChangeRank = computed(() => can('PROMOTER_CHANGE_RANK'))

const tabs = computed(() => [
  { label: t('promoters.hierarchy.tabs.tree'), value: 'tree', icon: 'i-lucide-network' },
  { label: t('promoters.hierarchy.tabs.list'), value: 'list', icon: 'i-lucide-list' },
])
const activeTab = ref('tree')

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

// ---- Assign supervisor modal (also fed by drag-and-drop on the tree tab) ----
const assignOpen = ref(false)
const assignTarget = ref<string | null>(null)
const assignPresetSupervisor = ref<string | null>(null)

function openAssign(uuid: string) {
  assignTarget.value = uuid
  assignPresetSupervisor.value = null
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

// ---- Drag-and-drop reassignment (tree tab) ----
function findNode(nodes: PromoterHierarchyNodeDto[], uuid: string): PromoterHierarchyNodeDto | null {
  for (const n of nodes) {
    if (n.uuid === uuid) return n
    const found = findNode(n.children, uuid)
    if (found) return found
  }
  return null
}
function collectUuids(node: PromoterHierarchyNodeDto, out: Set<string>) {
  out.add(node.uuid)
  for (const child of node.children) collectUuids(child, out)
}

function onDropReassign({ draggedUuid, targetUuid }: { draggedUuid: string, targetUuid: string }) {
  const draggedNode = findNode(tree.value, draggedUuid)
  if (!draggedNode) return
  // Dropping a node onto one of its own descendants would create a cycle —
  // the backend would reject it too, but catching it here avoids a round-trip.
  const descendants = new Set<string>()
  collectUuids(draggedNode, descendants)
  if (descendants.has(targetUuid)) {
    toast.add({
      title: t('promoters.hierarchy.dragDrop.cycleError'),
      color: 'error',
      icon: 'i-lucide-alert-triangle',
    })
    return
  }
  assignTarget.value = draggedUuid
  assignPresetSupervisor.value = targetUuid
  assignOpen.value = true
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

    <UTabs v-model="activeTab" :items="tabs" :content="false" />

    <div v-if="loading" class="space-y-3">
      <USkeleton v-for="i in 4" :key="i" class="h-12 w-full rounded-xl" />
    </div>

    <div v-else-if="tree.length === 0" class="bg-white rounded-2xl border border-prohealth-100 p-10 text-center">
      <UIcon name="i-lucide-users" class="w-8 h-8 mx-auto mb-2 text-prohealth-300" />
      <p class="text-prohealth-700">{{ t('promoters.hierarchy.empty') }}</p>
    </div>

    <template v-else>
      <!-- Visual tree — drag a box onto another to reassign its supervisor -->
      <div v-show="activeTab === 'tree'" class="bg-white rounded-2xl border border-prohealth-100 p-6 overflow-x-auto">
        <p v-if="canAssignSupervisor" class="text-xs text-prohealth-500 mb-4 flex items-center gap-1.5">
          <UIcon name="i-lucide-move" class="w-3.5 h-3.5" />
          {{ t('promoters.hierarchy.dragDrop.hint') }}
        </p>
        <ul class="org-tree-root flex justify-center">
          <PromoterHierarchyOrgChart
            v-for="root in tree"
            :key="root.uuid"
            :node="root"
            :can-assign-supervisor="canAssignSupervisor"
            :can-change-rank="canChangeRank"
            @change-rank="openChangeRank"
            @drop-reassign="onDropReassign"
          />
        </ul>
      </div>

      <!-- Collapsible list — same actions, no drag-and-drop -->
      <div v-show="activeTab === 'list'" class="space-y-3">
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
    </template>

    <PromoterAssignSupervisorModal
      v-model:open="assignOpen"
      :promoter-uuid="assignTarget"
      :preset-supervisor-uuid="assignPresetSupervisor"
      @saved="onSaved"
    />
    <PromoterChangeRankModal
      v-model:open="changeRankOpen"
      :promoter-uuid="changeRankTarget"
      @saved="onSaved"
    />
  </div>
</template>

<style scoped>
.org-tree-root {
  padding: 0;
}
</style>
