<script setup lang="ts">
import type { PermissionDomainDto, RoleDto } from '~/types/admin'

/**
 * Modal de edición de permisos de un rol — compartido entre roles/index.vue
 * (listado) y roles/[uuid].vue (detalle) para que ambas vistas queden siempre
 * en sincronía (tamaño, comportamiento, catálogo).
 */
const props = defineProps<{
  open: boolean
  role: RoleDto | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  /** El rol guardó cambios de permisos exitosamente. */
  'saved': []
}>()

const isOpen = computed({
  get: () => props.open,
  set: value => emit('update:open', value),
})

const { t } = useI18n()
const rolesApi = useRoles()
const toast = useToast()

const domains = ref<PermissionDomainDto[]>([])
const catalogLoaded = ref(false)

async function loadCatalog() {
  try {
    domains.value = await rolesApi.permissions()
    expandedDomains.value = new Set(domains.value.map(d => d.uuid))
  }
  catch {
    domains.value = []
  }
  finally {
    catalogLoaded.value = true
  }
}

const totalPermissions = computed(() =>
  domains.value.reduce((acc, d) => acc + d.permissions.length, 0),
)

// ---- Collapsible groups, same pattern as AuditModal's change log ----
const expandedDomains = ref<Set<string>>(new Set())

function isExpanded(domainUuid: string) {
  return expandedDomains.value.has(domainUuid)
}

function toggleExpanded(domainUuid: string) {
  const next = new Set(expandedDomains.value)
  if (next.has(domainUuid)) next.delete(domainUuid)
  else next.add(domainUuid)
  expandedDomains.value = next
}

function expandAllDomains() {
  expandedDomains.value = new Set(domains.value.map(d => d.uuid))
}

function collapseAllDomains() {
  expandedDomains.value = new Set()
}

const isSubmitting = ref(false)
const loadingPerms = ref(false)
const selected = ref<string[]>([])

function isChecked(uuid: string) {
  return selected.value.includes(uuid)
}

function togglePermission(uuid: string, checked: boolean) {
  if (checked) {
    if (!selected.value.includes(uuid)) selected.value.push(uuid)
  }
  else {
    selected.value = selected.value.filter(u => u !== uuid)
  }
}

function domainState(domain: PermissionDomainDto): boolean | 'indeterminate' {
  const ids = domain.permissions.map(p => p.uuid)
  const count = ids.filter(id => selected.value.includes(id)).length
  if (count === 0) return false
  if (count === ids.length) return true
  return 'indeterminate'
}

function toggleDomain(domain: PermissionDomainDto, checked: boolean) {
  const ids = domain.permissions.map(p => p.uuid)
  if (checked) {
    const set = new Set([...selected.value, ...ids])
    selected.value = [...set]
  }
  else {
    selected.value = selected.value.filter(u => !ids.includes(u))
  }
}

// ---- Bulk toggles by action, across every domain in the catalog ----
interface ActionToggle {
  key: string
  labelKey: string
  suffixes: string[]
  /** Codes matching a suffix here are excluded even if they also match `suffixes`. */
  exclude?: string[]
}

const ACTION_TOGGLES: ActionToggle[] = [
  { key: 'create', labelKey: 'security.roles.bulkActions.create', suffixes: ['_CREATE'] },
  { key: 'update', labelKey: 'security.roles.bulkActions.update', suffixes: ['_UPDATE'] },
  { key: 'delete', labelKey: 'security.roles.bulkActions.delete', suffixes: ['_DELETE'] },
  // `_VIEW` also matches `_RECORD_AUDIT_VIEW`/`_REPORT_AUDIT_VIEW`, which have their
  // own dedicated toggles below — excluded here to avoid double-counting.
  { key: 'viewAll', labelKey: 'security.roles.bulkActions.viewAll', suffixes: ['_VIEW_ALL', '_VIEW'], exclude: ['_RECORD_AUDIT_VIEW', '_REPORT_AUDIT_VIEW'] },
  { key: 'reportGenerate', labelKey: 'security.roles.bulkActions.reportGenerate', suffixes: ['_REPORT_GENERATE'] },
  { key: 'auditView', labelKey: 'security.roles.bulkActions.auditView', suffixes: ['_RECORD_AUDIT_VIEW'] },
  { key: 'reportAuditView', labelKey: 'security.roles.bulkActions.reportAuditView', suffixes: ['_REPORT_AUDIT_VIEW'] },
]

function permissionsForAction(toggle: ActionToggle): string[] {
  const ids: string[] = []
  for (const domain of domains.value) {
    for (const p of domain.permissions) {
      const matches = toggle.suffixes.some(sfx => p.code.endsWith(sfx))
      const excluded = toggle.exclude?.some(sfx => p.code.endsWith(sfx)) ?? false
      if (matches && !excluded) ids.push(p.uuid)
    }
  }
  return ids
}

function actionState(toggle: ActionToggle): boolean | 'indeterminate' {
  const ids = permissionsForAction(toggle)
  if (ids.length === 0) return false
  const count = ids.filter(id => selected.value.includes(id)).length
  if (count === 0) return false
  if (count === ids.length) return true
  return 'indeterminate'
}

function toggleByAction(toggle: ActionToggle, checked: boolean) {
  const ids = permissionsForAction(toggle)
  if (checked) {
    const set = new Set([...selected.value, ...ids])
    selected.value = [...set]
  }
  else {
    selected.value = selected.value.filter(u => !ids.includes(u))
  }
}

async function loadSelected(roleUuid: string) {
  selected.value = []
  loadingPerms.value = true
  try {
    selected.value = await rolesApi.getRolePermissions(roleUuid)
  }
  catch {
    selected.value = []
  }
  finally {
    loadingPerms.value = false
  }
}

// Reset/load whenever the modal opens for a role. The catalog is fetched once
// and reused across every role the modal is opened for.
watch([() => props.open, () => props.role], ([open, role]) => {
  if (!open || !role) return
  if (!catalogLoaded.value) loadCatalog()
  loadSelected(role.uuid)
})

async function onSave() {
  if (!props.role || selected.value.length === 0) return
  isSubmitting.value = true
  try {
    await rolesApi.updateRolePermissions(props.role.uuid, selected.value)
    toast.add({ title: t('security.roles.permissionsUpdatedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    isOpen.value = false
    emit('saved')
  }
  catch {
    // useApi ya notificó el error
  }
  finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="isOpen"
    :title="t('security.roles.permissionsModalTitle', { name: role?.name ?? '' })"
    :description="t('security.roles.permissionsModalDescription')"
    :ui="{ content: 'max-w-5xl' }"
  >
    <template #body>
      <div v-if="loadingPerms || !catalogLoaded" class="space-y-4 max-h-[60vh] overflow-hidden">
        <div v-for="i in 3" :key="i" class="rounded-xl border border-prohealth-100 overflow-hidden">
          <div class="px-4 py-2.5 bg-prohealth-50/60 border-b border-prohealth-100">
            <USkeleton class="h-4 w-40 rounded" />
          </div>
          <div class="p-3 grid sm:grid-cols-2 gap-3">
            <USkeleton v-for="j in 4" :key="j" class="h-5 w-full rounded" />
          </div>
        </div>
      </div>

      <div v-else class="space-y-4">
        <!-- Bulk toggles by action, across all domains -->
        <div class="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-prohealth-100 bg-prohealth-50/40 px-4 py-3">
          <span class="text-xs font-semibold uppercase tracking-wide text-prohealth-400">
            {{ t('security.roles.bulkActions.label') }}
          </span>
          <label
            v-for="action in ACTION_TOGGLES"
            :key="action.key"
            class="flex items-center gap-2 cursor-pointer"
          >
            <UCheckbox
              :model-value="actionState(action)"
              @update:model-value="(v: boolean | 'indeterminate') => toggleByAction(action, v === true)"
            />
            <span class="text-sm text-prohealth-700">{{ t(action.labelKey) }}</span>
          </label>
        </div>

        <div v-if="domains.length > 0" class="flex justify-end gap-3">
          <UButton color="neutral" variant="link" size="xs" @click="expandAllDomains">
            {{ t('security.roles.expandAllGroups') }}
          </UButton>
          <UButton color="neutral" variant="link" size="xs" @click="collapseAllDomains">
            {{ t('security.roles.collapseAllGroups') }}
          </UButton>
        </div>

        <div class="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          <div
            v-for="domain in domains"
            :key="domain.uuid"
            class="rounded-xl border border-prohealth-100 overflow-hidden"
          >
            <div class="flex items-center gap-2 px-4 py-2.5 bg-prohealth-50/60 border-b border-prohealth-100">
              <UCheckbox
                :model-value="domainState(domain)"
                @update:model-value="(v: boolean | 'indeterminate') => toggleDomain(domain, v === true)"
                @click.stop
              />
              <button
                type="button"
                class="flex flex-1 items-center gap-2 text-left cursor-pointer"
                @click="toggleExpanded(domain.uuid)"
              >
                <UIcon v-if="domain.icon" :name="domain.icon" class="w-4 h-4 text-prohealth-500" />
                <span class="font-semibold text-prohealth-800">{{ domain.name }}</span>
                <span class="text-xs text-prohealth-400">({{ domain.permissions.length }})</span>
                <UIcon
                  :name="isExpanded(domain.uuid) ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
                  class="w-4 h-4 text-prohealth-400 ml-auto"
                />
              </button>
            </div>
            <div v-if="isExpanded(domain.uuid)" class="p-4 grid sm:grid-cols-2 gap-x-4 gap-y-3">
              <label
                v-for="p in domain.permissions"
                :key="p.uuid"
                class="flex items-start gap-2.5 rounded-lg px-2.5 py-2 hover:bg-prohealth-50/50 cursor-pointer"
              >
                <UCheckbox
                  :model-value="isChecked(p.uuid)"
                  @update:model-value="(v: boolean | 'indeterminate') => togglePermission(p.uuid, v === true)"
                />
                <span class="text-sm">
                  <span class="font-medium text-prohealth-800">{{ p.name }}</span>
                  <span v-if="p.description" class="block text-xs text-prohealth-500">{{ p.description }}</span>
                </span>
              </label>
            </div>
          </div>

          <p v-if="domains.length === 0" class="text-sm text-amber-600">
            {{ t('security.roles.permissionsCatalogError') }}
          </p>
        </div>
      </div>

      <div class="flex items-center justify-between gap-3 pt-4 mt-2 border-t border-prohealth-100">
        <span class="text-xs text-prohealth-500">
          {{ t('security.roles.permissionsCount', { selected: selected.length, total: totalPermissions }) }}
        </span>
        <div class="flex items-center gap-3">
          <UButton color="neutral" variant="ghost" :disabled="isSubmitting" @click="isOpen = false">
            {{ t('common.cancel') }}
          </UButton>
          <UTooltip :text="selected.length === 0 ? t('security.roles.selectAtLeastOnePermission') : ''">
            <UButton
              color="primary"
              icon="i-lucide-save"
              :loading="isSubmitting"
              :disabled="selected.length === 0 || loadingPerms"
              @click="onSave"
            >
              {{ t('security.roles.savePermissions') }}
            </UButton>
          </UTooltip>
        </div>
      </div>
    </template>
  </UModal>
</template>
