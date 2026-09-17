<script setup lang="ts">
import type { MyRole } from '~/types/auth'

/**
 * Active-role selector in the sidebar footer. Only shown when the user has
 * more than one effective role — with just one, the caller keeps showing the
 * current plain text (less UI noise in the majority case). After switching,
 * useNav()/usePermissions() are already reactive to the store and recompute
 * the menu without a page reload.
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
  <!-- Before loading, or with a single effective role, there's nothing to pick: plain text as always. -->
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
