<script setup lang="ts">
import type { CatalogItem } from '~/types/catalogs'

/**
 * One row of the vertical rank tree (`/dashboard/catalogs/promoter-ranks`,
 * side panel next to the table) — classic file-explorer style: a
 * +/− expand toggle, a folder icon, and an indent guide per level. The tree
 * is built once in the page from each rank's real `parentRankUuid` FK (this
 * hub plan) — a root has no parent, its children are the ranks that point at
 * it, recursively — this component only renders the `{item, children}` shape
 * it's handed; it has no opinion on how the tree was built.
 */
export interface RankTreeNode {
  item: CatalogItem
  children: RankTreeNode[]
}

const props = defineProps<{
  node: RankTreeNode
  selectedUuid?: string | null
}>()

const emit = defineEmits<{
  select: [item: CatalogItem]
}>()

// Expanded by default — the chain is short (today: 3 ranks) and the point is
// to see it all at a glance; collapsing is for when it grows.
const expanded = ref(true)
const hasChildren = computed(() => props.node.children.length > 0)
const isSelected = computed(() => props.selectedUuid === props.node.item.uuid)
</script>

<template>
  <li>
    <div
      class="flex items-center gap-1.5 py-1.5 px-1.5 rounded-lg cursor-pointer hover:bg-prohealth-50"
      :class="{ 'bg-primary-50 ring-1 ring-primary-200': isSelected }"
      @click="emit('select', node.item)"
    >
      <button
        v-if="hasChildren"
        type="button"
        class="w-4 h-4 flex items-center justify-center shrink-0 text-[11px] leading-none text-prohealth-500 border border-prohealth-300 rounded-sm bg-white"
        @click.stop="expanded = !expanded"
      >
        {{ expanded ? '−' : '+' }}
      </button>
      <span v-else class="w-4 h-4 shrink-0" />

      <UIcon
        :name="expanded && hasChildren ? 'i-lucide-folder-open' : 'i-lucide-folder'"
        class="w-4 h-4 text-amber-500 shrink-0"
      />

      <span class="text-sm font-medium truncate" :class="isSelected ? 'text-primary-700' : 'text-prohealth-900'">
        {{ node.item.name }}
      </span>
      <span v-if="node.item.code" class="text-[10px] font-mono text-prohealth-400 shrink-0">{{ node.item.code }}</span>
      <UIcon v-if="node.item.active === false" name="i-lucide-eye-off" class="w-3.5 h-3.5 text-prohealth-300 shrink-0" />
    </div>

    <ul v-if="hasChildren && expanded" class="pl-4 ml-2.5 border-l border-prohealth-200">
      <PromoterRankTreeNode
        v-for="child in node.children"
        :key="child.item.uuid"
        :node="child"
        :selected-uuid="selectedUuid"
        @select="emit('select', $event)"
      />
    </ul>
  </li>
</template>
