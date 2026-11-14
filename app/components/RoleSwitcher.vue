<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { MyRole } from '~/types/auth'
import { roleHome } from '~/utils/roleHome'

/**
 * Active-role selector in the sidebar footer. Only shown when the user has
 * more than one effective role — with just one, the caller keeps showing the
 * current plain text (less UI noise in the majority case). After switching,
 * useNav()/usePermissions() are already reactive to the store and recompute
 * the menu without a page reload, and the person lands on that role's home.
 *
 * The role every session starts with (the default) is marked under its name,
 * and the active role can be made the default from the same menu.
 */
const { t } = useI18n()
const toast = useToast()
const auth = useAuthStore()
const { fetchMyRoles, setDefaultRole, switchActiveRole } = useAuth()
const roleLabel = useRoleLabel()

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
    await navigateTo(roleHome(role.name))
  }
  finally {
    pending.value = false
  }
}

const activeMyRole = computed(() => roles.value.find(r => r.name === auth.activeRole) ?? null)

async function makeActiveDefault(): Promise<void> {
  const role = activeMyRole.value
  if (pending.value || !role || role.isDefault) return
  pending.value = true
  try {
    roles.value = await setDefaultRole(role.uuid)
    toast.add({
      title: t('auth.defaultRole.savedToast', { role: roleLabel(role.name, role.description) }),
      color: 'success',
      icon: 'i-lucide-check-circle',
    })
  }
  finally {
    pending.value = false
  }
}

const items = computed<DropdownMenuItem[][]>(() => {
  const groups: DropdownMenuItem[][] = [
    roles.value.map(role => ({
      label: roleLabel(role.name, role.description),
      icon: role.name === auth.activeRole ? 'i-lucide-check' : undefined,
      description: role.isDefault ? t('auth.defaultRole.badge') : undefined,
      onSelect: () => select(role),
    })),
  ]
  if (activeMyRole.value && !activeMyRole.value.isDefault) {
    groups.push([{
      label: t('auth.defaultRole.makeActiveDefault'),
      icon: 'i-lucide-star',
      onSelect: () => makeActiveDefault(),
    }])
  }
  return groups
})
</script>

<template>
  <!-- Before loading, or with a single effective role, there's nothing to pick: plain text as always. -->
  <p v-if="!loaded || roles.length <= 1" class="text-xs text-prohealth-500 truncate">
    {{ roleLabel(auth.primaryRole) }}
  </p>
  <UDropdownMenu v-else :items="items" :content="{ align: 'start' }">
    <button
      type="button"
      class="flex items-center gap-1 text-xs text-prohealth-500 truncate hover:text-prohealth-700 transition-colors"
      :aria-label="t('auth.switchRole')"
      :title="t('auth.switchRole')"
    >
      <span class="truncate">{{ roleLabel(auth.primaryRole) }}</span>
      <UIcon name="i-lucide-chevron-down" class="w-3 h-3 shrink-0" />
    </button>
  </UDropdownMenu>
</template>
