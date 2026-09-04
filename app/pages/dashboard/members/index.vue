<script setup lang="ts">
import { buildPageSizeItems, DEFAULT_PAGE_SIZE, UNPAGED_PAGE_SIZE } from '~/utils/pagination'
import type {
  MemberDto,
  MemberListItemDto,
} from '~/types/members'
import type { SortDirection } from '~/composables/useTableSort'

type MemberRow = MemberListItemDto | MemberDto

definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'MEMBER_VIEW_ALL',
})

const { t } = useI18n()

useSeoMeta({ title: () => t('common.seoTitle', { page: t('members.title') }) })

const members = useMembers()
const { can } = usePermissions()
const toast = useToast()

const canCreate = computed(() => can('MEMBER_CREATE'))
const canUpdate = computed(() => can('MEMBER_UPDATE'))
const canDelete = computed(() => can('MEMBER_DELETE'))
const canViewAuditChanges = computed(() => can('AUDIT_VIEW_ALL') || can('MEMBER_RECORD_AUDIT_VIEW'))
const canViewAuditReports = computed(() => can('REPORT_AUDIT_VIEW_ALL') || can('MEMBER_REPORT_AUDIT_VIEW'))
const canViewAudit = computed(() => canViewAuditChanges.value || canViewAuditReports.value)

const auditOpen = ref(false)
const auditTarget = ref<MemberListItemDto | null>(null)

function openAudit(m: MemberListItemDto) {
  auditTarget.value = m
  auditOpen.value = true
}

// ---- List + pagination + search ----
const data = ref<MemberListItemDto[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1) // UPagination is 1-based; the API is 0-based
const size = ref(DEFAULT_PAGE_SIZE)
const pageSizeItems = buildPageSizeItems(t)
const search = ref('')
const includeInactive = ref(false)
// Empty by default: no `sort=` is sent until the user clicks a column, so
// the backend's own default-sort fallback (entity_config → system_configs
// → enrolledAt DESC) applies.
const sort = useTableSort([])
const hasActiveSort = computed(() => sort.hasActiveSort.value)
const isMultiSort = computed(() => sort.orders.value.length > 1)

async function load() {
  loading.value = true
  try {
    const res = await members.list({
      page: page.value - 1,
      size: size.value,
      sort: sort.sortParam.value,
      // The backend exposes free-text search (trigram, accent-insensitive)
      q: search.value.trim() || undefined,
      includeInactive: includeInactive.value,
    })
    data.value = res.content ?? []
    total.value = res.totalElements ?? 0
    // No column clicked yet → reflect the server's own default in the header arrows.
    if (sort.orders.value.length === 0 && res.appliedSort?.length) {
      resetting.value = true
      sort.seedServerDefault(res.appliedSort.map(o => ({ field: o.field, direction: o.direction.toLowerCase() as SortDirection })))
      await nextTick()
      resetting.value = false
    }
  }
  catch {
    // useApi already shows the error toast
    data.value = []
    total.value = 0
  }
  finally {
    loading.value = false
  }
}

// Guards the filter watchers so "clear filters and refresh" fires a single reload.
const resetting = ref(false)

watch(size, () => { if (!resetting.value) page.value = 1 })
watch([page, size], () => { if (!resetting.value) load() })
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, () => {
  if (resetting.value) return
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    load()
  }, 400)
})
watch(includeInactive, () => { if (!resetting.value) { page.value = 1; load() } })
watch(sort.orders, () => { if (!resetting.value) load() }, { deep: true })

async function resetFilters() {
  resetting.value = true
  search.value = ''
  includeInactive.value = false
  sort.reset()
  size.value = DEFAULT_PAGE_SIZE
  page.value = 1
  await nextTick()
  resetting.value = false
  load()
}

// Member status select label (form dropdown, not server-resolved); falls back to the raw value.
function statusLabel(s?: string | null): string {
  return s ? t(`members.status.${s}`, s) : t('common.empty')
}

// Effective status label for the table row: `active` (soft-delete flag) wins over the
// business `status` field, so a soft-deleted record always reads "Inactivo" instead of
// whatever business status it happened to have. Prefers the server-resolved `_Display`
// siblings (hub ADR 0014) over local i18n lookups.
function effectiveStatusLabel(m: MemberListItemDto): string {
  if (m.active === false) return m.active_Display ?? t('members.status.INACTIVE')
  return m.status_Display ?? t('common.empty')
}

// `?edit=<uuid>` / `?delete=<uuid>` let the member detail page ("Editar"/"Eliminar")
// reopen this page's modals without duplicating them on a second page.
const route = useRoute()
const router = useRouter()

onMounted(async () => {
  await load()
  const editUuid = route.query.edit as string | undefined
  const deleteUuid = route.query.delete as string | undefined
  const targetUuid = editUuid || deleteUuid
  if (!targetUuid) return
  await router.replace({ query: {} })
  try {
    const found = await members.get(targetUuid)
    if (editUuid) openEdit(found)
    else openDelete(found)
  }
  catch {
    // Invalid/removed uuid: silently ignore, stay on the list.
  }
})

// ---- Create/edit form (MemberFormModal.vue) ----
const formOpen = ref(false)
const mode = ref<'create' | 'edit'>('create')
const editingItem = ref<MemberRow | null>(null)

function openCreate() {
  mode.value = 'create'
  editingItem.value = null
  formOpen.value = true
}

function openEdit(m: MemberRow) {
  mode.value = 'edit'
  editingItem.value = m
  formOpen.value = true
}

async function onMemberSaved() {
  await load()
}

function onMemberRestored() {
  load()
}

function onMemberDeleteRequested(m: MemberRow) {
  openDelete(m)
}

// ---- Restore (undo soft-delete, row-level shortcut) ----
const restoring = ref(false)

async function restoreMember(m: MemberListItemDto) {
  restoring.value = true
  try {
    await members.update(m.uuid, { active: true })
    toast.add({ title: t('members.restoredToast'), color: 'success', icon: 'i-lucide-check-circle' })
    await load()
  }
  catch {
    // toast handled by useApi
  }
  finally {
    restoring.value = false
  }
}

// ---- Delete ----
const deleteOpen = ref(false)
const deleting = ref(false)
const target = ref<MemberRow | null>(null)
const usageChecking = ref(false)
const usageInfo = ref<{ inUse: boolean, count: number } | null>(null)

async function openDelete(m: MemberRow) {
  target.value = m
  deleteOpen.value = true
  usageChecking.value = true
  usageInfo.value = null
  try {
    usageInfo.value = await members.usage(m.uuid)
  }
  catch {
    // Fallback: treat as "in use" for safety (soft-deactivate instead of physical delete).
    usageInfo.value = null
  }
  finally {
    usageChecking.value = false
  }
}

async function confirmDelete() {
  if (!target.value) return
  deleting.value = true
  const wasPhysical = usageInfo.value?.inUse === false
  try {
    await members.remove(target.value.uuid, wasPhysical)
    toast.add({
      title: wasPhysical
        ? t('members.deletedPermanentToast')
        : t('members.deactivatedToast'),
      color: wasPhysical ? 'success' : 'info',
      icon: wasPhysical ? 'i-lucide-check-circle' : 'i-lucide-info',
    })
    deleteOpen.value = false
    // If the page is left empty after deleting, step back one.
    if (data.value.length === 1 && page.value > 1) page.value -= 1
    else await load()
  }
  catch {
    // toast handled by useApi
  }
  finally {
    deleting.value = false
  }
}

// ---- Presentation helpers ----
function displayName(m: MemberListItemDto): string {
  return m.fullName || t('common.empty')
}
</script>

<template>
  <div class="space-y-5">
    <!-- Header -->
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-extrabold text-prohealth-900">{{ t('members.title') }}</h1>
        <p class="text-sm text-prohealth-700/70 mt-1">
          {{ t('members.subtitle') }}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <ListRefreshMenu :loading="loading" variant="ghost" @refresh="load" @reset="resetFilters" />
        <ReportPrintButton variant="ghost" />
        <UTooltip :text="canCreate ? t('members.createTooltip') : t('members.noPermissionCreate')">
          <UButton
            color="primary"
            variant="outline"
            icon="i-lucide-plus"
            :disabled="!canCreate"
            @click="openCreate"
          >
            {{ t('common.new') }}
          </UButton>
        </UTooltip>
      </div>
    </div>

    <!-- Search -->
    <div class="bg-white rounded-2xl border border-prohealth-100 p-4 flex flex-wrap items-center gap-3">
      <UInput
        v-model="search"
        :placeholder="t('members.searchPlaceholder')"
        icon="i-lucide-search"
        size="lg"
        class="w-full max-w-md"
      />
      <UCheckbox v-model="includeInactive" :label="$t('catalogs.includeInactive')" class="self-center" />
      <UButton
        v-if="hasActiveSort"
        variant="link"
        color="neutral"
        size="sm"
        icon="i-lucide-list-restart"
        :title="t('common.clearSortHint')"
        @click="sort.reset()"
      >
        {{ t('common.clearSort') }}
      </UButton>
    </div>

    <!-- Table -->
    <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden flex flex-col h-[calc(100vh-19rem)] min-h-[24rem]">
      <div class="overflow-auto flex-1">
        <table class="w-full text-sm">
          <thead class="sticky top-0 bg-white z-10">
            <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('fullName')">
                {{ t('members.columns.member') }}
                <SortIndicator :state="sort.stateOf('fullName')" :multi-active="isMultiSort" @clear="sort.remove('fullName')" />
              </th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('documentNumber')">
                {{ t('members.columns.document') }}
                <SortIndicator :state="sort.stateOf('documentNumber')" :multi-active="isMultiSort" @clear="sort.remove('documentNumber')" />
              </th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('phone')">
                {{ t('members.columns.phone') }}
                <SortIndicator :state="sort.stateOf('phone')" :multi-active="isMultiSort" @clear="sort.remove('phone')" />
              </th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('enrolledAt')">
                {{ t('members.columns.enrolledAt') }}
                <SortIndicator :state="sort.stateOf('enrolledAt')" :multi-active="isMultiSort" @clear="sort.remove('enrolledAt')" />
              </th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('currentPromoter_Display')">
                {{ t('members.columns.promoter') }}
                <SortIndicator :state="sort.stateOf('currentPromoter_Display')" :multi-active="isMultiSort" @clear="sort.remove('currentPromoter_Display')" />
              </th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('status')">
                {{ t('members.columns.status') }}
                <SortIndicator :state="sort.stateOf('status')" :multi-active="isMultiSort" @clear="sort.remove('status')" />
              </th>
              <th class="px-5 py-3 font-semibold text-right">{{ t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-prohealth-100">
            <TableSkeleton v-if="loading" :rows="8" :cols="7" />
            <tr v-else-if="data.length === 0">
              <td colspan="7" class="px-5 py-12 text-center text-prohealth-500">
                <UIcon name="i-lucide-users" class="w-8 h-8 mx-auto mb-2 text-prohealth-300" />
                {{ t('members.empty') }}
              </td>
            </tr>
            <tr
              v-for="m in data"
              v-else
              :key="m.uuid"
              class="hover:bg-prohealth-50/50 cursor-pointer"
              :class="{ 'opacity-60': m.active === false }"
              @click="navigateTo(`/dashboard/members/${m.uuid}`)"
            >
              <td class="px-5 py-3">
                <div class="font-semibold text-prohealth-900">{{ displayName(m) }}</div>
              </td>
              <td class="px-5 py-3 text-prohealth-700">
                <span v-if="m.documentNumber">{{ m.documentType }} {{ m.documentNumber }}</span>
                <span v-else class="text-prohealth-400">{{ t('common.empty') }}</span>
              </td>
              <td class="px-5 py-3 text-prohealth-700">{{ m.phone || t('common.empty') }}</td>
              <td class="px-5 py-3 text-prohealth-600">{{ m.enrolledAt_Display || t('common.empty') }}</td>
              <td class="px-5 py-3" @click.stop>
                <NuxtLink
                  v-if="m.currentPromoter_Uuid"
                  :to="`/dashboard/promoters/${m.currentPromoter_Uuid}`"
                  class="text-primary-600 hover:underline"
                >
                  {{ m.currentPromoter_Display || t('common.empty') }}
                </NuxtLink>
                <span v-else class="text-prohealth-400">{{ t('common.empty') }}</span>
              </td>
              <td class="px-5 py-3">
                <UBadge
                  :color="m.active === false ? 'neutral' : (m.status === 'ACTIVE' ? 'success' : 'warning')"
                  variant="subtle"
                  size="sm"
                >
                  {{ effectiveStatusLabel(m) }}
                </UBadge>
              </td>
              <td class="px-5 py-3" @click.stop>
                <div class="flex items-center justify-end gap-1">
                  <UTooltip :text="t('members.viewDetailTooltip')">
                    <UButton
                      color="neutral"
                      variant="ghost"
                      icon="i-lucide-eye"
                      size="sm"
                      :to="`/dashboard/members/${m.uuid}`"
                    />
                  </UTooltip>
                  <UTooltip :text="canUpdate ? t('common.edit') : t('members.noPermissionEdit')">
                    <UButton
                      color="info"
                      variant="ghost"
                      icon="i-lucide-pencil"
                      size="sm"
                      :disabled="!canUpdate"
                      @click="openEdit(m)"
                    />
                  </UTooltip>
                  <ReportPrintButton
                    table-name="members"
                    :record-uuid="m.uuid"
                    icon-only
                    variant="ghost"
                    size="sm"
                  />
                  <UTooltip v-if="canViewAudit" :text="t('audit.trigger')">
                    <UButton
                      color="neutral"
                      variant="ghost"
                      icon="i-lucide-history"
                      size="sm"
                      @click="openAudit(m)"
                    />
                  </UTooltip>
                  <UTooltip :text="canDelete ? t('common.delete') : t('members.noPermissionDelete')">
                    <UButton
                      color="error"
                      variant="ghost"
                      icon="i-lucide-trash-2"
                      size="sm"
                      class="ms-2"
                      :disabled="!canDelete"
                      @click="openDelete(m)"
                    />
                  </UTooltip>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="flex items-center flex-wrap justify-between gap-3 px-5 py-3 border-t border-prohealth-100 shrink-0">
        <p class="text-xs text-prohealth-500">
          {{ t('members.paginationSummary', { shown: data.length, total }) }}
        </p>
        <div class="flex items-center gap-3">
          <UPagination
            v-if="size !== UNPAGED_PAGE_SIZE"
            v-model:page="page"
            :total="total"
            :items-per-page="size"
          />
          <UTooltip :text="$t('catalogs.pageSizeLabel')">
            <USelectMenu
              v-model="size"
              :items="pageSizeItems"
              label-key="label"
              value-key="value"
              icon="i-lucide-list"
              :search-input="false"
              :aria-label="$t('catalogs.pageSizeLabel')"
              class="w-40"
            />
          </UTooltip>
        </div>
      </div>
    </div>

    <!-- Create/edit modal -->
    <MemberFormModal
      v-model:open="formOpen"
      :mode="mode"
      :member="editingItem"
      :can-delete="canDelete"
      @saved="onMemberSaved"
      @restored="onMemberRestored"
      @delete-requested="onMemberDeleteRequested"
    />

    <!-- Delete confirmation modal -->
    <UModal v-model:open="deleteOpen" :title="t('members.delete.title')">
      <template #body>
        <div v-if="usageChecking" class="flex items-center gap-2 text-sm text-prohealth-600">
          <UIcon name="i-lucide-loader-2" class="w-4 h-4 animate-spin" />
          {{ t('common.loading') }}
        </div>
        <p v-else class="text-sm text-prohealth-700">
          {{
            usageInfo?.inUse === false
              ? t('members.deleteConfirmPermanent')
              : t('members.deleteConfirmDeactivate', { count: usageInfo?.count ?? 0 })
          }}
        </p>
        <div class="flex items-center justify-end gap-3 pt-5">
          <UButton color="neutral" variant="ghost" :disabled="deleting" @click="deleteOpen = false">
            {{ t('common.cancel') }}
          </UButton>
          <UButton color="error" :loading="deleting" :disabled="usageChecking" icon="i-lucide-trash-2" @click="confirmDelete">
            {{ t('common.delete') }}
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Audit modal -->
    <AuditModal
      v-if="auditTarget"
      v-model:open="auditOpen"
      entity-key="member"
      :entity-uuid="auditTarget.uuid"
      :entity-label="displayName(auditTarget)"
      :can-view-changes="canViewAuditChanges"
      :can-view-reports="canViewAuditReports"
    />
  </div>
</template>
