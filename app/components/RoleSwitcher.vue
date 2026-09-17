<script setup lang="ts">
import type { MyRole } from '~/types/auth'

/**
 * Selector de rol activo en el pie del sidebar. Solo se muestra cuando el
 * usuario tiene más de un rol efectivo — con uno solo, el llamador debe
 * seguir mostrando el texto plano actual (menos ruido de UI en el caso
 * mayoritario). Al cambiar de rol, useNav()/usePermissions() ya son
 * reactivos al store y recalculan el menú sin recargar la página.
 */
const { t } = useI18n()
const auth = useAuthStore()
const { fetchMyRoles, switchActiveRole } = useAuth()

const roles = ref<MyRole[]>([])
const loaded = ref(false)
const pending = ref(false)

onMounted(async () => {
  roles.value = await fetchMyRoles().catch(() => [])
  loaded.value = true
})

async function select(role: MyRole): Promise<void> {
  if (pending.value || role.name === auth.activeRole) return
  pending.value = true
  try {
    await switchActiveRole(role.uuid)
    await navigateTo('/dashboard')
  }
  finally {
    pending.value = false
  }
}

const items = computed(() => [
  roles.value.map(role => ({
    label: role.description || role.name,
    icon: role.name === auth.activeRole ? 'i-lucide-check' : undefined,
    onSelect: () => select(role),
  })),
])
</script>

<template>
  <!-- Antes de cargar, o con un solo rol efectivo, no hay nada que elegir: texto plano de siempre. -->
  <p v-if="!loaded || roles.length <= 1" class="text-xs text-prohealth-500 truncate">
    {{ auth.primaryRole }}
  </p>
  <UDropdownMenu v-else :items="items" :content="{ align: 'start' }">
    <button
      type="button"
      class="flex items-center gap-1 text-xs text-prohealth-500 truncate hover:text-prohealth-700 transition-colors"
      :aria-label="t('auth.switchRole')"
      :title="t('auth.switchRole')"
    >
      <span class="truncate">{{ auth.primaryRole }}</span>
      <UIcon name="i-lucide-chevron-down" class="w-3 h-3 shrink-0" />
    </button>
  </UDropdownMenu>
</template>
