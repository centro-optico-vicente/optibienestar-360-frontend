<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { EntityConfigDto } from '~/composables/useEntityConfig'
import { COMMON_SORT_FIELDS } from '~/composables/useSystemConfig'
import type { ConfigSortOrder } from '~/composables/useSystemConfig'

definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'ENTITY_CONFIG_VIEW',
})

const { t } = useI18n()

useSeoMeta({ title: () => t('entityConfig.seoTitle') })

const entityConfigApi = useEntityConfig()
const { can } = usePermissions()
const toast = useToast()

const canCreate = computed(() => can('ENTITY_CONFIG_CREATE'))
const canUpdate = computed(() => can('ENTITY_CONFIG_UPDATE'))
const canDelete = computed(() => can('ENTITY_CONFIG_DELETE'))

const SORT_FIELD_OPTIONS = COMMON_SORT_FIELDS.map(f => ({ label: f, value: f }))
const SORT_DIRECTION_OPTIONS = [
  { label: t('entityConfig.ascLabel'), value: 'ASC' as const },
  { label: t('entityConfig.descLabel'), value: 'DESC' as const },
]

// ---- List ----
const data = ref<EntityConfigDto[]>([])
const loading = ref(false)
const search = ref('')

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return data.value
  return data.value.filter(e =>
    e.entityKey.toLowerCase().includes(q) || e.displayName.toLowerCase().includes(q))
})

function summarizeSort(sort?: ConfigSortOrder[] | null): string {
  if (!sort || sort.length === 0) return t('common.empty')
  return sort.map(o => `${o.field} ${o.direction}`).join(', ')
}

async function load() {
  loading.value = true
  try {
    data.value = await entityConfigApi.list()
  }
  catch {
    data.value = []
  }
  finally {
    loading.value = false
  }
}
onMounted(load)

// "Clear filters and refresh": the only filter here is the client-side search box.
function resetFilters() {
  search.value = ''
  load()
}

// ---- Create ----
const createOpen = ref(false)
const isCreating = ref(false)
const createState = reactive({ entityKey: '', displayName: '', tableName: '' })

const createSchema = computed(() =>
  z.object({
    entityKey: z.string().min(1, t('validation.required')).max(80),
    displayName: z.string().min(1, t('validation.required')).max(120),
    tableName: z.string().max(120).optional(),
  })
)

function openCreate() {
  createState.entityKey = ''
  createState.displayName = ''
  createState.tableName = ''
  createOpen.value = true
}

async function onCreateSubmit(_event: FormSubmitEvent<Record<string, unknown>>) {
  isCreating.value = true
  try {
    await entityConfigApi.create({
      entityKey: createState.entityKey.trim(),
      displayName: createState.displayName.trim(),
      tableName: createState.tableName?.trim() || undefined,
    })
    toast.add({ title: t('entityConfig.createdToast'), color: 'success', icon: 'i-lucide-check-circle' })
    createOpen.value = false
    await load()
  }
  catch {
    // useApi already shows the error toast (e.g. 409 duplicate entityKey)
  }
  finally {
    isCreating.value = false
  }
}

// ---- Edit ----
const editOpen = ref(false)
const isSubmitting = ref(false)
const editingKey = ref<string | null>(null)
const editingDisplayName = ref('')

interface EditState {
  enabled: boolean
  auditCreate: boolean
  auditUpdate: boolean
  auditDelete: boolean
  auditReport: boolean
  captureBeforeAfter: boolean
  defaultSort: ConfigSortOrder[]
  notes: string
}

const editState = reactive<EditState>({
  enabled: true,
  auditCreate: true,
  auditUpdate: true,
  auditDelete: true,
  auditReport: true,
  captureBeforeAfter: true,
  defaultSort: [],
  notes: '',
})

// Snapshot of the last-loaded edit state, used to warn before a refresh
// discards unsaved changes.
const editSnapshot = ref('')
function snapEditState() { return JSON.stringify(editState) }
const isEditDirty = computed(() => editSnapshot.value !== '' && snapEditState() !== editSnapshot.value)
const discardConfirmOpen = ref(false)
const editReloading = ref(false)

function populateEditForm(e: EntityConfigDto) {
  editingKey.value = e.entityKey
  editingDisplayName.value = e.displayName
  editState.enabled = e.enabled
  editState.auditCreate = e.auditCreate
  editState.auditUpdate = e.auditUpdate
  editState.auditDelete = e.auditDelete
  editState.auditReport = e.auditReport
  editState.captureBeforeAfter = e.captureBeforeAfter
  editState.defaultSort = e.defaultSort ? [...e.defaultSort] : []
  editState.notes = e.notes || ''
  editSnapshot.value = snapEditState()
}

function openEdit(e: EntityConfigDto) {
  populateEditForm(e)
  editOpen.value = true
}

async function reloadEditForm() {
  if (!editingKey.value) return
  editReloading.value = true
  try { populateEditForm(await entityConfigApi.get(editingKey.value)) }
  catch { /* useApi already notified */ }
  finally { editReloading.value = false }
}
function onEditRefresh() {
  if (isEditDirty.value) discardConfirmOpen.value = true
  else reloadEditForm()
}
function discardAndRefresh() {
  discardConfirmOpen.value = false
  reloadEditForm()
}

function addSortRow() {
  editState.defaultSort.push({ field: '', direction: 'ASC' })
}

function removeSortRow(index: number) {
  editState.defaultSort.splice(index, 1)
}

async function onEditSubmit(_event: FormSubmitEvent<Record<string, unknown>>) {
  if (!editingKey.value) return
  isSubmitting.value = true
  try {
    await entityConfigApi.update(editingKey.value, {
      enabled: editState.enabled,
      auditCreate: editState.auditCreate,
      auditUpdate: editState.auditUpdate,
      auditDelete: editState.auditDelete,
      auditReport: editState.auditReport,
      captureBeforeAfter: editState.captureBeforeAfter,
      // Rows left with an empty field are dropped rather than sent — an
      // unnamed sort key would just be silently ignored downstream anyway.
      defaultSort: editState.defaultSort.filter(o => o.field.trim().length > 0),
      notes: editState.notes.trim() || undefined,
    })
    toast.add({ title: t('entityConfig.updatedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    editOpen.value = false
    await load()
  }
  catch {
    // handled by useApi
  }
  finally {
    isSubmitting.value = false
  }
}

// ---- Delete ----
const deleteOpen = ref(false)
const deleting = ref(false)
const target = ref<EntityConfigDto | null>(null)

function openDelete(e: EntityConfigDto) {
  target.value = e
  deleteOpen.value = true
}

async function confirmDelete() {
  if (!target.value) return
  deleting.value = true
  try {
    await entityConfigApi.remove(target.value.entityKey)
    toast.add({ title: t('entityConfig.deletedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    deleteOpen.value = false
    await load()
  }
  catch {
    // handled by useApi
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
        <h1 class="text-2xl font-extrabold text-prohealth-900">{{ t('entityConfig.title') }}</h1>
        <p class="text-sm text-prohealth-700/70 mt-1">{{ t('entityConfig.subtitle') }}</p>
      </div>
      <div class="flex items-center gap-2">
        <ListRefreshMenu :loading="loading" variant="ghost" @refresh="load" @reset="resetFilters" />
        <UTooltip v-if="canCreate" :text="t('entityConfig.createTitle')">
          <UButton color="primary" variant="outline" icon="i-lucide-plus" @click="openCreate">
            {{ t('common.new') }}
          </UButton>
        </UTooltip>
      </div>
    </div>

    <!-- Search -->
    <div class="bg-white rounded-2xl border border-prohealth-100 p-4">
      <UInput
        v-model="search"
        :placeholder="t('entityConfig.searchPlaceholder')"
        icon="i-lucide-search"
        size="lg"
        class="w-full max-w-md"
      />
    </div>

    <!-- Table -->
    <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden">
      <div class="overflow-auto">
        <table class="w-full text-sm">
          <thead class="bg-white">
            <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
              <th class="px-5 py-3 font-semibold">{{ t('entityConfig.columns.entity') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('entityConfig.columns.enabled') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('entityConfig.columns.defaultSort') }}</th>
              <th class="px-5 py-3 font-semibold text-right">{{ t('entityConfig.columns.actions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-prohealth-100">
            <TableSkeleton v-if="loading" :rows="6" :cols="4" />
            <tr v-else-if="filtered.length === 0">
              <td colspan="4" class="px-5 py-12 text-center text-prohealth-500">
                <UIcon name="i-lucide-database-zap" class="w-8 h-8 mx-auto mb-2 text-prohealth-300" />
                {{ t('entityConfig.empty') }}
              </td>
            </tr>
            <tr v-for="e in filtered" v-else :key="e.entityKey" class="hover:bg-prohealth-50/50">
              <td class="px-5 py-3">
                <div class="font-semibold text-prohealth-900">{{ e.displayName }}</div>
                <div class="text-xs text-prohealth-500">{{ e.entityKey }}</div>
              </td>
              <td class="px-5 py-3">
                <UBadge :color="e.enabled ? 'success' : 'neutral'" variant="subtle" size="sm">
                  {{ e.enabled_Display ?? (e.enabled ? t('common.yes') : t('common.no')) }}
                </UBadge>
              </td>
              <td class="px-5 py-3 text-prohealth-700">{{ summarizeSort(e.defaultSort) }}</td>
              <td class="px-5 py-3" @click.stop>
                <div class="flex items-center justify-end gap-1">
                  <UTooltip :text="canUpdate ? t('common.edit') : ''">
                    <UButton
                      color="info"
                      variant="ghost"
                      icon="i-lucide-pencil"
                      size="sm"
                      :disabled="!canUpdate"
                      @click="openEdit(e)"
                    />
                  </UTooltip>
                  <UTooltip :text="canDelete ? t('common.delete') : ''">
                    <UButton
                      color="error"
                      variant="ghost"
                      icon="i-lucide-trash-2"
                      size="sm"
                      class="ms-2"
                      :disabled="!canDelete"
                      @click="openDelete(e)"
                    />
                  </UTooltip>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Create modal -->
    <UModal
      v-model:open="createOpen"
      :title="t('entityConfig.createTitle')"
      :description="t('entityConfig.createDescription')"
    >
      <template #body>
        <UForm :schema="createSchema" :state="createState" class="space-y-4" @submit="onCreateSubmit">
          <UFormField :label="t('entityConfig.entityKey')" :help="t('entityConfig.entityKeyHelp')" name="entityKey" required>
            <UInput v-model="createState.entityKey" :placeholder="t('entityConfig.entityKeyPlaceholder')" class="w-full" />
          </UFormField>
          <UFormField :label="t('entityConfig.displayName')" name="displayName" required>
            <UInput v-model="createState.displayName" :placeholder="t('entityConfig.displayNamePlaceholder')" class="w-full" />
          </UFormField>
          <UFormField :label="t('entityConfig.tableName')" name="tableName">
            <UInput v-model="createState.tableName" :placeholder="t('entityConfig.tableNamePlaceholder')" class="w-full" />
          </UFormField>

          <div class="flex items-center justify-end gap-3 pt-2">
            <UButton color="neutral" variant="ghost" :disabled="isCreating" @click="createOpen = false">
              {{ t('common.cancel') }}
            </UButton>
            <UButton type="submit" color="primary" variant="outline" :loading="isCreating" icon="i-lucide-save">
              {{ t('common.saveNew') }}
            </UButton>
          </div>
        </UForm>
      </template>
    </UModal>

    <!-- Edit modal -->
    <UModal
      v-model:open="editOpen"
      :title="t('entityConfig.editTitle', { entity: editingDisplayName })"
      :description="t('entityConfig.editDescription')"
      :ui="{ content: 'max-w-xl' }"
    >
      <template #body>
        <UForm :state="editState" class="space-y-4" @submit="onEditSubmit">
          <UFormField :label="t('entityConfig.fields.enabled')" name="enabled">
            <USwitch v-model="editState.enabled" />
          </UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField :label="t('entityConfig.fields.auditCreate')" name="auditCreate">
              <USwitch v-model="editState.auditCreate" :disabled="!editState.enabled" />
            </UFormField>
            <UFormField :label="t('entityConfig.fields.auditUpdate')" name="auditUpdate">
              <USwitch v-model="editState.auditUpdate" :disabled="!editState.enabled" />
            </UFormField>
            <UFormField :label="t('entityConfig.fields.auditDelete')" name="auditDelete">
              <USwitch v-model="editState.auditDelete" :disabled="!editState.enabled" />
            </UFormField>
            <UFormField :label="t('entityConfig.fields.auditReport')" name="auditReport">
              <USwitch v-model="editState.auditReport" :disabled="!editState.enabled" />
            </UFormField>
          </div>
          <UFormField :label="t('entityConfig.fields.captureBeforeAfter')" name="captureBeforeAfter">
            <USwitch v-model="editState.captureBeforeAfter" :disabled="!editState.enabled" />
          </UFormField>

          <div class="space-y-3 pt-3 border-t border-prohealth-100">
            <p class="text-xs text-prohealth-700/70">{{ t('entityConfig.fields.defaultSortHelp') }}</p>

            <div v-for="(row, index) in editState.defaultSort" :key="index" class="flex flex-wrap items-center gap-2">
              <UInput
                v-model="row.field"
                :placeholder="t('entityConfig.fields.defaultSortFieldPlaceholder')"
                :aria-label="t('entityConfig.fields.defaultSortField')"
                class="w-full sm:w-56"
              />
              <USelectMenu
                v-model="row.direction"
                :items="SORT_DIRECTION_OPTIONS"
                label-key="label"
                value-key="value"
                :search-input="false"
                :aria-label="t('entityConfig.fields.defaultSortDirection')"
                class="w-full sm:w-44"
              />
              <UButton
                color="error"
                variant="ghost"
                icon="i-lucide-trash-2"
                size="sm"
                :aria-label="t('entityConfig.fields.removeSortRow')"
                @click="removeSortRow(index)"
              />
            </div>

            <UButton color="neutral" variant="outline" icon="i-lucide-plus" size="sm" @click="addSortRow">
              {{ t('entityConfig.fields.addSortRow') }}
            </UButton>
          </div>

          <UFormField :label="t('entityConfig.fields.notes')" name="notes">
            <UTextarea
              v-model="editState.notes"
              :placeholder="t('entityConfig.fields.notesPlaceholder')"
              :rows="2"
              class="w-full"
            />
          </UFormField>

          <div class="flex items-center justify-end gap-3 pt-2">
            <RefreshButton
              :icon-only="false"
              :label="t('common.refresh')"
              :title="t('common.refresh')"
              :loading="editReloading"
              :disabled="isSubmitting"
              @refresh="onEditRefresh"
            />
            <UButton color="neutral" variant="ghost" :disabled="isSubmitting" @click="editOpen = false">
              {{ t('common.cancel') }}
            </UButton>
            <UButton type="submit" color="info" variant="outline" :loading="isSubmitting" icon="i-lucide-save">
              {{ t('entityConfig.saveButton') }}
            </UButton>
          </div>
        </UForm>
      </template>
    </UModal>

    <!-- Delete confirmation modal -->
    <UModal v-model:open="deleteOpen" :title="t('entityConfig.deleteTitle')">
      <template #body>
        <i18n-t keypath="entityConfig.deleteConfirm" tag="p" class="text-sm text-prohealth-700" scope="global">
          <template #entity>
            <span class="font-semibold">{{ target?.displayName }}</span>
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

    <!-- Discard unsaved changes before refreshing the edit form -->
    <UModal v-model:open="discardConfirmOpen" :title="t('common.discardChangesTitle')">
      <template #body>
        <p class="text-sm text-prohealth-700">{{ t('common.discardChangesBody') }}</p>
        <div class="flex items-center justify-end gap-3 pt-5">
          <UButton color="neutral" variant="ghost" @click="discardConfirmOpen = false">{{ t('common.cancel') }}</UButton>
          <UButton color="warning" icon="i-lucide-refresh-cw" @click="discardAndRefresh">{{ t('common.discardAndRefresh') }}</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
