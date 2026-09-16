<script setup lang="ts">
import type { PromoterHierarchyNodeDto } from '~/types/promoters'

/**
 * One box of the visual org-chart (`/dashboard/promoters/hierarchy`, "Árbol
 * visual" tab) — recursive, same re-emit pattern as `PromoterHierarchyNode`
 * (the accordion/list view). Renders as an `<li>` so a parent `<ul>` (this
 * component's own, for its children, or the page's for the root list) gets
 * the classic CSS org-chart connector lines for free — see `<style>` below.
 *
 * Drag-and-drop: native HTML5 DnD, no extra library. `dragstart` puts the
 * dragged promoter's uuid on the data transfer; a `drop` on another box reads
 * it back and emits `drop-reassign` (bubbled up through every level, exactly
 * like `assign-supervisor`/`change-rank`) — the page does the cycle check and
 * opens the confirm modal. The backend re-validates rank order and cycles
 * regardless; this is just so an invalid drop doesn't silently no-op.
 */
const props = defineProps<{
  node: PromoterHierarchyNodeDto
  canAssignSupervisor: boolean
  canChangeRank: boolean
}>()

const emit = defineEmits<{
  'change-rank': [uuid: string]
  'drop-reassign': [payload: { draggedUuid: string, targetUuid: string }]
}>()

const hasChildren = computed(() => props.node.children.length > 0)
const { can } = usePermissions()
const canViewPromoter = computed(() => can('PROMOTER_VIEW_ALL'))

const isDragOver = ref(false)
const isDragging = ref(false)

function onDragStart(e: DragEvent) {
  if (!props.canAssignSupervisor) return
  e.dataTransfer?.setData('text/plain', props.node.uuid)
  e.dataTransfer!.effectAllowed = 'move'
  isDragging.value = true
}
function onDragEnd() {
  isDragging.value = false
}
function onDragOver(e: DragEvent) {
  if (!props.canAssignSupervisor) return
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
}
function onDragEnter() {
  if (props.canAssignSupervisor) isDragOver.value = true
}
function onDragLeave() {
  isDragOver.value = false
}
function onDrop(e: DragEvent) {
  isDragOver.value = false
  if (!props.canAssignSupervisor) return
  const draggedUuid = e.dataTransfer?.getData('text/plain')
  if (!draggedUuid || draggedUuid === props.node.uuid) return
  emit('drop-reassign', { draggedUuid, targetUuid: props.node.uuid })
}
</script>

<template>
  <li class="org-node">
    <div
      class="node-box"
      :class="{ 'is-drag-over': isDragOver, 'is-dragging': isDragging }"
      :draggable="canAssignSupervisor"
      @dragstart="onDragStart"
      @dragend="onDragEnd"
      @dragover="onDragOver"
      @dragenter="onDragEnter"
      @dragleave="onDragLeave"
      @drop="onDrop"
    >
      <div class="flex items-center justify-center gap-1.5">
        <UIcon v-if="canAssignSupervisor" name="i-lucide-grip-vertical" class="w-3.5 h-3.5 text-prohealth-300 shrink-0" />
        <UIcon name="i-lucide-user-round" class="w-4 h-4 text-prohealth-400 shrink-0" />
        <span class="font-semibold text-sm truncate max-w-[10rem]">
          <CommonEntityLinkCell :to="`/dashboard/promoters/${node.uuid}`" :label="node.displayName" :can="canViewPromoter" />
        </span>
      </div>
      <div class="flex items-center justify-center gap-1.5 mt-1">
        <UBadge v-if="node.rankName" color="primary" variant="subtle" size="xs">{{ node.rankName }}</UBadge>
        <span class="text-[11px] font-mono text-prohealth-400">{{ node.referralCode }}</span>
      </div>
      <div v-if="canChangeRank" class="mt-1.5">
        <UButton color="neutral" variant="ghost" size="xs" icon="i-lucide-arrow-up-down" @click="emit('change-rank', node.uuid)">
          {{ $t('promoters.hierarchy.changeRank.action') }}
        </UButton>
      </div>
    </div>

    <ul v-if="hasChildren">
      <PromoterHierarchyOrgChart
        v-for="child in node.children"
        :key="child.uuid"
        :node="child"
        :can-assign-supervisor="canAssignSupervisor"
        :can-change-rank="canChangeRank"
        @change-rank="emit('change-rank', $event)"
        @drop-reassign="emit('drop-reassign', $event)"
      />
    </ul>
  </li>
</template>

<style scoped>
/* Classic CSS org-chart connectors — a li's ::before/::after draw the
   horizontal branch to its siblings, and its own ul::before draws the
   vertical drop down to its children. Single-child nodes skip the branch
   entirely (nothing to connect to). */
.org-node {
  list-style: none;
  text-align: center;
  position: relative;
  padding: 24px 12px 0;
  white-space: nowrap;
}
.org-node ul {
  display: flex;
  justify-content: center;
  padding-top: 24px;
  position: relative;
}
.org-node ul::before {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  border-left: 1px solid var(--org-line-color, #d4dce6);
  width: 0;
  height: 24px;
}
.org-node::before,
.org-node::after {
  content: '';
  position: absolute;
  top: 0;
  right: 50%;
  border-top: 1px solid var(--org-line-color, #d4dce6);
  width: 50%;
  height: 24px;
}
.org-node::after {
  right: auto;
  left: 50%;
  border-left: 1px solid var(--org-line-color, #d4dce6);
}
.org-node:only-child {
  padding-top: 0;
}
.org-node:only-child::before,
.org-node:only-child::after {
  display: none;
}
.org-node:first-child::before,
.org-node:last-child::after {
  border: 0 none;
}
.org-node:last-child::before {
  border-right: 1px solid var(--org-line-color, #d4dce6);
  border-radius: 0 6px 0 0;
}
.org-node:first-child::after {
  border-radius: 6px 0 0 0;
}

.node-box {
  display: inline-block;
  min-width: 9.5rem;
  padding: 10px 14px;
  border-radius: 0.85rem;
  border: 1px solid rgb(226 232 240);
  background: white;
  cursor: default;
  transition: box-shadow 0.15s, border-color 0.15s, transform 0.1s;
}
.node-box[draggable='true'] {
  cursor: grab;
}
.node-box.is-dragging {
  opacity: 0.5;
}
.node-box.is-drag-over {
  border-color: var(--ui-primary, #3b82f6);
  box-shadow: 0 0 0 2px var(--ui-primary, #3b82f6);
  transform: scale(1.03);
}
</style>
