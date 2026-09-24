<script setup lang="ts">
import { buildPageSizeItems, DEFAULT_PAGE_SIZE, UNPAGED_PAGE_SIZE } from '~/utils/pagination'
import type {
  AllyDto,
  AllyListItemDto,
} from '~/types/allies'
import type { SortDirection } from '~/composables/useTableSort'

// The admin table renders AllyListItemDto rows; openEdit / openDelete are also
// reachable from openFromQuery with a full AllyDto loaded by GET /{uuid}.
type AllyRow = AllyListItemDto | AllyDto

definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'ALLY_VIEW_ALL',
})

const { t } = useI18n()

useSeoMeta({ title: () => t('common.seoTitle', { page: t('allies.title') }) })

const allies = useAllies()
const { can } = usePermissions()
const toast = useToast()

const canCreate = computed(() => can('ALLY_CREATE'))
const canUpdate = computed(() => can('ALLY_UPDATE'))
const canDelete = computed(() => can('ALLY_DELETE'))
const canViewCity = computed(() => can('CITY_VIEW_ALL'))
const canViewAuditChanges = computed(() => can('AUDIT_VIEW_ALL') || can('ALLY_RECORD_AUDIT_VIEW'))
const canViewAuditReports = computed(() => can('REPORT_AUDIT_VIEW_ALL') || can('ALLY_REPORT_AUDIT_VIEW'))
const canViewAudit = computed(() => canViewAuditChanges.value || canViewAuditReports.value)

const auditOpen = ref(false)
const auditTarget = ref<AllyRow | null>(null)

function openAudit(a: AllyRow) {
  auditTarget.value = a
  auditOpen.value = true
}

// ---- List + pagination + search ----
const data = ref<AllyListItemDto[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1) // UPagination is 1-based; the API is 0-based
const size = ref(DEFAULT_PAGE_SIZE)
const pageSizeItems = buildPageSizeItems(t)
const search = ref('')
const includeInactive = ref(false)
// Empty by default: no `sort=` is sent until the user clicks a column, so the
// backend's own default-sort fallback (entity_config → system_configs →
// createdAt DESC) applies. A pre-loaded entry here would never clear — this
// table has no "Creado" header to toggle it off — so it would silently stick
// as a phantom secondary sort behind whatever column the user picks.
const sort = useTableSort([])
const hasActiveSort = computed(() => sort.hasActiveSort.value)
const isMultiSort = computed(() => sort.orders.value.length > 1)

async function load() {
  loading.value = true
  try {
    const res = await allies.list({
      page: page.value - 1,
      size: size.value,
      sort: sort.sortParam.value,
      q: search.value.trim() || undefined,
      includeInactive: includeInactive.value,
    })
    data.value = res.content ?? []
    total.value = res.totalElements ?? 0
    // No column clicked yet → reflect the server's own default (entity_config
    // → system_configs → createdAt DESC) in the header arrows, so the table
    // never looks "unsorted" when it actually isn't. Guarded by `resetting`
    // so this assignment doesn't re-trigger `watch(sort.orders, ...)` below —
    // once populated, sort.orders is non-empty and this branch simply stops
    // running, so a later user click is never overwritten by it.
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

// Set while resetFilters() clears several refs at once, so their watchers don't
// each fire a redundant load() before the single explicit one.
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

// "Limpiar filtros y actualizar" from the list refresh menu.
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

// Partner status badge/select label; falls back to the raw value.
function statusLabel(status?: string | null): string {
  return status ? t(`allies.status.${status}`, status) : t('common.empty')
}

// Effective status label for the table row: `active` (soft-delete flag) wins over the
// business `status` field, so a soft-deleted record always reads "Inactivo" instead of
// whatever business status it happened to have (or "Sin información" when status is null).
function effectiveStatusLabel(a: AllyRow): string {
  if (a.active === false) return t('allies.status.INACTIVE')
  // Prefer the server-resolved `_Display` (ADR 0014); fall back to the local
  // label map for a full AllyDto loaded via GET /{uuid} (no `_Display` there).
  const display = 'status_Display' in a ? a.status_Display : null
  return display ?? (a.status ? statusLabel(a.status) : t('common.empty'))
}

onMounted(async () => {
  await load()
  await openFromQuery()
})

// Lets the ally detail page deep-link into this page's edit/delete modals
// (they have no standalone equivalent on the detail page itself).
const route = useRoute()
const router = useRouter()
async function openFromQuery() {
  const editUuid = route.query.edit as string | undefined
  const deleteUuid = route.query.delete as string | undefined
  const targetUuid = editUuid || deleteUuid
  if (!targetUuid) return
  await router.replace({ query: {} })
  try {
    const full = await allies.get(targetUuid)
    if (editUuid) openEdit(full)
    else openDelete(full)
  }
  catch {
    // useApi already notified (e.g. 404); nothing else to do.
  }
}

// ---- Create/edit form (AllyFormModal.vue) ----
const formOpen = ref(false)
const mode = ref<'create' | 'edit'>('create')
const editingItem = ref<AllyRow | null>(null)

function openCreate() {
  mode.value = 'create'
  editingItem.value = null
  formOpen.value = true
}

function openEdit(a: AllyRow) {
  mode.value = 'edit'
  editingItem.value = a
  formOpen.value = true
}

async function onAllySaved() {
  await load()
}

function onAllyRestored() {
  load()
}

function onAllyDeleteRequested(a: AllyRow) {
  openDelete(a)
}

// ---- Delete ----
const deleteOpen = ref(false)
const deleting = ref(false)
const target = ref<AllyRow | null>(null)

function openDelete(a: AllyRow) {
  target.value = a
  deleteOpen.value = true
}

// ---- Restore (undo soft-delete, row-level shortcut) ----
const restoring = ref(false)

async function restoreAlly(a: AllyRow) {
  restoring.value = true
  try {
    await allies.restore(a.uuid)
    toast.add({ title: t('allies.restoredToast'), color: 'success', icon: 'i-lucide-check-circle' })
    await load()
  }
  catch {
    // toast handled by useApi
  }
  finally {
    restoring.value = false
  }
}

async function confirmDelete() {
  if (!target.value) return
  deleting.value = true
  try {
    await allies.remove(target.value.uuid)
    toast.add({ title: t('allies.deletedToast'), color: 'success', icon: 'i-lucide-check-circle' })
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
</script>

<template>
  <div class="space-y-5">
    <!-- Header -->
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-extrabold text-prohealth-900">{{ t('allies.title') }}</h1>
        <p class="text-sm text-prohealth-700/70 mt-1">
          {{ t('allies.subtitle') }}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <ListRefreshMenu variant="ghost" :loading="loading" @refresh="load" @reset="resetFilters" />
        <ReportPrintButton variant="ghost" :search-query="search" :include-inactive="includeInactive" />
        <UTooltip :text="canCreate ? t('allies.createTooltip') : t('allies.noPermissionCreate')">
          <UButton
            color="primary"
            variant="outline"
            icon="i-lucide-plus"
            :disabled="!canCreate"
            @click="openCreate"
          >
            {{ t('allies.new') }}
          </UButton>
        </UTooltip>
      </div>
    </div>

    <!-- Search -->
    <div class="bg-white rounded-2xl border border-prohealth-100 p-4 flex flex-wrap items-center gap-3">
      <UInput
        v-model="search"
        :placeholder="t('allies.searchPlaceholder')"
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
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('name')">
                {{ t('allies.columns.ally') }}
                <SortIndicator :state="sort.stateOf('name')" :multi-active="isMultiSort" @clear="sort.remove('name')" />
              </th>
              <th class="px-5 py-3 font-semibold select-none">
                {{ t('allies.columns.type') }}
              </th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('taxDocumentNumber')">
                {{ t('allies.columns.taxId') }}
                <SortIndicator :state="sort.stateOf('taxDocumentNumber')" :multi-active="isMultiSort" @clear="sort.remove('taxDocumentNumber')" />
              </th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('city_Display')">
                {{ t('allies.columns.city') }}
                <SortIndicator :state="sort.stateOf('city_Display')" :multi-active="isMultiSort" @clear="sort.remove('city_Display')" />
              </th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('published')">
                {{ t('allies.columns.published') }}
                <SortIndicator :state="sort.stateOf('published')" :multi-active="isMultiSort" @clear="sort.remove('published')" />
              </th>
              <th class="px-5 py-3 font-semibold cursor-pointer select-none" @click="sort.toggle('status')">
                {{ t('allies.columns.status') }}
                <SortIndicator :state="sort.stateOf('status')" :multi-active="isMultiSort" @clear="sort.remove('status')" />
              </th>
              <th class="px-5 py-3 font-semibold text-right">{{ t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-prohealth-100">
            <TableSkeleton v-if="loading" :rows="8" :cols="7" />
            <tr v-else-if="data.length === 0">
              <td colspan="7" class="px-5 py-12 text-center text-prohealth-500">
                <UIcon name="i-lucide-handshake" class="w-8 h-8 mx-auto mb-2 text-prohealth-300" />
                {{ t('allies.empty') }}
              </td>
            </tr>
            <tr
              v-for="a in data"
              v-else
              :key="a.uuid"
              class="hover:bg-prohealth-50/50 cursor-pointer"
              @click="navigateTo(`/dashboard/allies/${a.uuid}`)"
              @dblclick="navigateTo(`/dashboard/allies/${a.uuid}`)"
            >
              <td class="px-5 py-3">
                <div class="font-semibold text-prohealth-900">{{ a.name }}</div>
              </td>
              <td class="px-5 py-3 text-prohealth-700" @click.stop>
                <div v-if="a.allyTypeNames?.length" class="flex flex-wrap gap-1">
                  <UBadge
                    v-for="name in a.allyTypeNames"
                    :key="name"
                    color="neutral"
                    variant="subtle"
                    size="sm"
                  >
                    {{ name }}
                  </UBadge>
                </div>
                <span v-else class="text-prohealth-400">{{ t('common.empty') }}</span>
              </td>
              <td class="px-5 py-3 text-prohealth-700">
                <span v-if="a.taxDocumentNumber">{{ a.taxDocumentType }}-{{ a.taxDocumentNumber }}</span>
                <span v-else class="text-prohealth-400">{{ t('common.empty') }}</span>
              </td>
              <td class="px-5 py-3 text-prohealth-700" @click.stop>
                <CommonEntityLinkCell
                  :to="a.city_Uuid ? `/dashboard/catalogs/cities?edit=${a.city_Uuid}` : null"
                  :label="a.city_Display"
                  :can="canViewCity"
                />
              </td>
              <td class="px-5 py-3">
                <UBadge :color="a.published ? 'success' : 'neutral'" variant="subtle" size="sm">
                  {{ a.published ? t('allies.published') : t('allies.draft') }}
                </UBadge>
              </td>
              <td class="px-5 py-3">
                <UBadge
                  :color="a.active === false ? 'neutral' : (a.status === 'ACTIVE' ? 'success' : 'warning')"
                  variant="subtle"
                  size="sm"
                >
                  {{ effectiveStatusLabel(a) }}
                </UBadge>
              </td>
              <td class="px-5 py-3" @click.stop>
                <div class="flex items-center justify-end gap-1">
                  <!-- Primary actions -->
                  <UTooltip :text="t('allies.viewDetailTooltip')">
                    <UButton
                      color="neutral"
                      variant="ghost"
                      icon="i-lucide-eye"
                      size="sm"
                      :to="`/dashboard/allies/${a.uuid}`"
                    />
                  </UTooltip>
                  <UTooltip :text="canUpdate ? t('common.edit') : t('allies.noPermissionEdit')">
                    <UButton
                      color="info"
                      variant="ghost"
                      icon="i-lucide-pencil"
                      size="sm"
                      :disabled="!canUpdate"
                      @click="openEdit(a)"
                    />
                  </UTooltip>

                  <!-- Read-only tools -->
                  <ReportPrintButton
                    table-name="allies"
                    :record-uuid="a.uuid"
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
                      @click="openAudit(a)"
                    />
                  </UTooltip>

                  <!-- Destructive action, separated from the rest -->
                  <RestoreButton
                    v-if="a.active === false"
                    :active="a.active"
                    :allowed="canDelete"
                    :loading="restoring"
                    size="sm"
                    icon-only
                    class="ms-2"
                    @restore="restoreAlly(a)"
                  />
                  <UTooltip v-else :text="canDelete ? t('common.delete') : t('allies.noPermissionDelete')">
                    <UButton
                      color="error"
                      variant="ghost"
                      icon="i-lucide-trash-2"
                      size="sm"
                      class="ms-2"
                      :disabled="!canDelete"
                      @click="openDelete(a)"
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
          {{ t('allies.paginationSummary', { shown: data.length, total }) }}
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
    <AllyFormModal
      v-model:open="formOpen"
      :mode="mode"
      :ally="editingItem"
      :can-delete="canDelete"
      @saved="onAllySaved"
      @restored="onAllyRestored"
      @delete-requested="onAllyDeleteRequested"
    />

    <!-- Delete confirmation modal -->
    <UModal v-model:open="deleteOpen" :title="t('allies.delete.title')">
      <template #body>
        <i18n-t keypath="allies.delete.confirm" tag="p" class="text-sm text-prohealth-700" scope="global">
          <template #name>
            <span class="font-semibold">{{ target?.name }}</span>
          </template>
        </i18n-t>
        <div class="flex items-center justify-end gap-3 pt-5">
          <UButton color="neutral" variant="ghost" :disabled="deleting" @click="deleteOpen = false">
            {{ t('common.cancel') }}
          </UButton>
          <UButton color="error" :loading="deleting" icon="i-lucide-trash-2" @click="confirmDelete">
            {{ t('common.delete') }}
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Audit modal -->
    <AuditModal
      v-if="auditTarget"
      v-model:open="auditOpen"
      entity-key="ally"
      :entity-uuid="auditTarget.uuid"
      :entity-label="auditTarget.name"
      :can-view-changes="canViewAuditChanges"
      :can-view-reports="canViewAuditReports"
    />
  </div>
</template>
