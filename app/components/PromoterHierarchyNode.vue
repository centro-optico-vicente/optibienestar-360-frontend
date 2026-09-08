<script setup lang="ts">
import type { PromoterHierarchyNodeDto } from '~/types/promoters'

/**
 * Un nodo del organigrama (`/dashboard/promoters/hierarchy`), recursivo —
 * se renderiza a sí mismo por cada hijo. Mismo patrón visual colapsable que
 * `RolePermissionsModal` (borde redondeado, header con chevron).
 */
const props = defineProps<{
  node: PromoterHierarchyNodeDto
  depth: number
  canAssignSupervisor: boolean
  canChangeRank: boolean
}>()

const emit = defineEmits<{
  'assign-supervisor': [uuid: string]
  'change-rank': [uuid: string]
}>()

// Expandido por defecto — un organigrama normalmente cabe entero en pantalla;
// el usuario colapsa las ramas que no le interesan, no al revés.
const expanded = ref(true)
const hasChildren = computed(() => props.node.children.length > 0)
</script>

<template>
  <div class="rounded-xl border border-prohealth-100 overflow-hidden">
    <div class="flex items-center gap-2 px-4 py-2.5 bg-prohealth-50/60">
      <button
        v-if="hasChildren"
        type="button"
        class="shrink-0 cursor-pointer"
        @click="expanded = !expanded"
      >
        <UIcon
          :name="expanded ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
          class="w-4 h-4 text-prohealth-400"
        />
      </button>
      <UIcon v-else name="i-lucide-user" class="w-4 h-4 text-prohealth-300 shrink-0" />

      <span class="font-semibold text-prohealth-800 truncate">{{ node.displayName }}</span>
      <UBadge v-if="node.rankName" color="neutral" variant="subtle" size="sm">{{ node.rankName }}</UBadge>
      <span class="text-xs font-mono text-prohealth-400">{{ node.referralCode }}</span>
      <span v-if="hasChildren" class="text-xs text-prohealth-400">({{ node.children.length }})</span>

      <div class="ml-auto flex items-center gap-1 shrink-0">
        <UTooltip v-if="canAssignSupervisor" :text="$t('promoters.hierarchy.assignSupervisor.action')">
          <UButton
            color="neutral"
            variant="ghost"
            size="xs"
            icon="i-lucide-user-round-cog"
            @click="emit('assign-supervisor', node.uuid)"
          />
        </UTooltip>
        <UTooltip v-if="canChangeRank" :text="$t('promoters.hierarchy.changeRank.action')">
          <UButton
            color="neutral"
            variant="ghost"
            size="xs"
            icon="i-lucide-arrow-up-down"
            @click="emit('change-rank', node.uuid)"
          />
        </UTooltip>
      </div>
    </div>

    <div v-if="hasChildren && expanded" class="p-2 pl-6 space-y-2 border-t border-prohealth-100">
      <PromoterHierarchyNode
        v-for="child in node.children"
        :key="child.uuid"
        :node="child"
        :depth="depth + 1"
        :can-assign-supervisor="canAssignSupervisor"
        :can-change-rank="canChangeRank"
        @assign-supervisor="emit('assign-supervisor', $event)"
        @change-rank="emit('change-rank', $event)"
      />
    </div>
  </div>
</template>
