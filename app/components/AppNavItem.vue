<script setup lang="ts">
import { isNavGroup, mosaicTarget } from '~/utils/nav'
import type { NavEntry, NavGroup, NavLeaf } from '~/utils/nav'

// Una entrada del sidebar: ítem simple o grupo colapsable con botón de mosaico.
// El narrowing leaf/grupo se hace aquí en <script> (nullable bajo v-if) para que
// vue-tsc lo verifique de forma fiable, en vez de sobre la unión en el template.
const props = defineProps<{
  entry: NavEntry
  openGroup: string | null
  activeGroupKey: string | null
}>()

const emit = defineEmits<{
  toggle: [key: string]
  navigate: []
}>()

const ACTIVE_LINK = 'bg-prohealth-50 text-prohealth-700 font-semibold'

const group = computed<NavGroup | null>(() => (isNavGroup(props.entry) ? props.entry : null))
const leaf = computed<NavLeaf | null>(() => (isNavGroup(props.entry) ? null : props.entry))
const isOpen = computed<boolean>(() => group.value != null && props.openGroup === group.value.key)
const isActiveGroup = computed<boolean>(() => group.value != null && props.activeGroupKey === group.value.key)
</script>

<template>
  <!-- Ítem simple (Panel, Pagos, Reportes…) -->
  <NuxtLink
    v-if="leaf"
    :to="leaf.to"
    :active-class="leaf.exact ? '' : ACTIVE_LINK"
    :exact-active-class="ACTIVE_LINK"
    class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-prohealth-900/80 hover:bg-prohealth-50 hover:text-prohealth-700 transition-colors"
    @click="emit('navigate')"
  >
    <UIcon :name="leaf.icon" class="w-5 h-5" />
    {{ leaf.label }}
  </NuxtLink>

  <!-- Grupo colapsable con botón de mosaico -->
  <div v-else-if="group">
    <div
      class="flex items-center rounded-lg transition-colors"
      :class="isActiveGroup ? 'text-prohealth-700' : 'text-prohealth-900/80'"
    >
      <button
        type="button"
        class="flex-1 flex items-center gap-3 pl-3 pr-2 py-2.5 rounded-lg text-sm hover:bg-prohealth-50 hover:text-prohealth-700 transition-colors"
        :class="{ 'font-semibold': isActiveGroup }"
        :aria-expanded="isOpen"
        @click="emit('toggle', group.key)"
      >
        <UIcon :name="group.icon" class="w-5 h-5 shrink-0" />
        <span class="flex-1 text-left">{{ group.label }}</span>
        <UIcon
          name="i-lucide-chevron-down"
          class="w-4 h-4 shrink-0 text-prohealth-400 transition-transform"
          :class="isOpen ? 'rotate-180' : ''"
        />
      </button>
      <NuxtLink
        :to="mosaicTarget(group)"
        class="mr-1 p-1.5 rounded-md text-prohealth-400 hover:bg-prohealth-100 hover:text-prohealth-600 transition-colors"
        :title="$t('nav.viewAllMosaic')"
        :aria-label="$t('nav.viewAllMosaic')"
        @click="emit('navigate')"
      >
        <UIcon name="i-lucide-layout-grid" class="w-4 h-4" />
      </NuxtLink>
    </div>

    <ul
      v-show="isOpen"
      class="mt-1 mb-1 ml-5 pl-3 border-l border-prohealth-100 space-y-1"
    >
      <li v-for="child in group.children" :key="child.to">
        <NuxtLink
          :to="child.to"
          :active-class="ACTIVE_LINK"
          class="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-prohealth-900/70 hover:bg-prohealth-50 hover:text-prohealth-700 transition-colors"
          @click="emit('navigate')"
        >
          <UIcon :name="child.icon" class="w-4 h-4 shrink-0" />
          <span class="truncate">{{ child.label }}</span>
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>
