<script setup lang="ts">
import { buildPageSizeItems, DEFAULT_PAGE_SIZE, UNPAGED_PAGE_SIZE } from '~/utils/pagination'
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { SelectItem } from '~/types/options'
import { toSelectItems } from '~/types/options'
import type {
  AllyDto,
  CreateAllyRequest,
  UpdateAllyRequest,
} from '~/types/allies'

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

// ---- List + pagination + search ----
const data = ref<AllyDto[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1) // UPagination is 1-based; the API is 0-based
const size = ref(DEFAULT_PAGE_SIZE)
const pageSizeItems = buildPageSizeItems(t)
const search = ref('')
const includeInactive = ref(false)

async function load() {
  loading.value = true
  try {
    const res = await allies.list({
      page: page.value - 1,
      size: size.value,
      sort: 'name,asc',
      q: search.value.trim() || undefined,
      includeInactive: includeInactive.value,
    })
    data.value = res.content ?? []
    total.value = res.totalElements ?? 0
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

watch(size, () => { page.value = 1 })
watch([page, size], load)
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    load()
  }, 400)
})
watch(includeInactive, () => { page.value = 1; load() })

// Partner status badge/select label; falls back to the raw value.
function statusLabel(status?: string | null): string {
  return status ? t(`allies.status.${status}`, status) : t('common.empty')
}

// ---- Catalogs for the form selects ----
const allyTypeOptions = ref<SelectItem[]>([])
const specialtyOptions = ref<SelectItem[]>([])
const stateOptions = ref<SelectItem[]>([])
const cityOptions = ref<SelectItem[]>([])
const { options: documentTypeOptions, load: loadDocumentTypes } = useDocumentTypes()

async function loadCatalogs() {
  const safeOptions = async (resource: string, limit = 200) => {
    try {
      return await useCatalogOptions(resource).options({ limit })
    }
    catch {
      return []
    }
  }
  const [types, specialties, states] = await Promise.all([
    safeOptions('ally-types'),
    safeOptions('medical-specialties'),
    safeOptions('states'),
  ])
  allyTypeOptions.value = toSelectItems(types)
  specialtyOptions.value = toSelectItems(specialties)
  stateOptions.value = toSelectItems(states)
}

// Cities cascade based on the selected state. `pendingCityUuid` lets openEdit
// preselect a city once its state's cities finish loading — otherwise the watcher's
// reset below would wipe the value the instant `selectedStateUuid` is set.
const selectedStateUuid = ref<string | undefined>(undefined)
const pendingCityUuid = ref<string | undefined>(undefined)
watch(selectedStateUuid, async (stateUuid) => {
  const keepCityUuid = pendingCityUuid.value
  pendingCityUuid.value = undefined
  cityOptions.value = []
  state.cityUuid = undefined
  if (!stateUuid) return
  try {
    const cities = await useCatalogOptions('cities').options({ parentUuid: stateUuid, limit: 200 })
    cityOptions.value = toSelectItems(cities)
    if (keepCityUuid) state.cityUuid = keepCityUuid
  }
  catch {
    cityOptions.value = []
  }
})

onMounted(async () => {
  await load()
  await Promise.all([loadCatalogs(), loadDocumentTypes()])
})

// ---- Create/edit form ----
const formOpen = ref(false)
const mode = ref<'create' | 'edit'>('create')
const editingUuid = ref<string | null>(null)
const editingItem = ref<AllyDto | null>(null)
const isSubmitting = ref(false)
// The list returns a compact projection (AllyListItemDto) with flat fields; on edit
// the full detail is loaded, and this flag shows the loading state in the modal.
const editLoading = ref(false)

const STATUS_OPTIONS = ['ACTIVE', 'INACTIVE', 'SUSPENDED']
const statusOptions = computed(() => STATUS_OPTIONS.map(s => ({ label: statusLabel(s), value: s })))

interface FormState {
  name: string
  allyTypeUuid: string | undefined
  taxDocumentType: string | undefined
  taxDocumentNumber: string
  email: string
  phone: string
  website: string
  address: string
  cityUuid: string | undefined
  description: string
  joinedAt: string
  published: boolean
  status: string
  specialtyUuids: string[]
}

const state = reactive<FormState>({
  name: '',
  allyTypeUuid: undefined,
  taxDocumentType: undefined,
  taxDocumentNumber: '',
  email: '',
  phone: '',
  website: '',
  address: '',
  cityUuid: undefined,
  description: '',
  joinedAt: '',
  published: false,
  status: 'ACTIVE',
  specialtyUuids: [],
})
// Kept outside `state` (a string-only-friendly form-state map) so the boolean isn't coerced.
// Distinct from `state.status` (business workflow value) — this is the soft-delete/reactivation flag.
const isActive = ref(true)

// Locale-reactive schema so validation messages follow the UI locale.
const schema = computed(() => {
  const base = {
    name: z.string().min(3, t('validation.minChars', { n: 3 })),
    allyTypeUuid: z.string({ message: t('validation.required') }).min(1, t('validation.required')),
    taxDocumentType: z.string().optional(),
    taxDocumentNumber: z.string().regex(/^\d*$/, t('validation.digitsOnly')).optional(),
    email: z.string().email(t('validation.emailInvalid')).optional().or(z.literal('')),
    phone: z.string().optional(),
    website: z.string().url(t('validation.invalidUrl')).optional().or(z.literal('')),
    address: z.string().optional(),
    description: z.string().optional(),
    joinedAt: z.string().optional(),
  }
  return mode.value === 'create' ? z.object(base) : z.object({ ...base, status: z.string() })
})

function resetForm() {
  state.name = ''
  state.allyTypeUuid = undefined
  state.taxDocumentType = undefined
  state.taxDocumentNumber = ''
  state.email = ''
  state.phone = ''
  state.website = ''
  state.address = ''
  state.cityUuid = undefined
  state.description = ''
  state.joinedAt = ''
  state.published = false
  state.status = 'ACTIVE'
  state.specialtyUuids = []
  isActive.value = true
  selectedStateUuid.value = undefined
  pendingCityUuid.value = undefined
}

function openCreate() {
  mode.value = 'create'
  editingUuid.value = null
  resetForm()
  formOpen.value = true
}

async function openEdit(a: AllyDto) {
  mode.value = 'edit'
  editingUuid.value = a.uuid
  editingItem.value = a
  resetForm()
  formOpen.value = true
  // The list row (AllyListItemDto) carries flat fields (allyTypeUuid, etc.) and omits
  // email, tax ID, website, specialties…; the form also expects the nested shape
  // (allyType.uuid). The full detail is loaded to populate reliably.
  editLoading.value = true
  try {
    const full = await allies.get(a.uuid)
    state.name = full.name ?? ''
    state.allyTypeUuid = full.allyType?.uuid
    state.taxDocumentType = full.taxDocumentType || undefined
    state.taxDocumentNumber = full.taxDocumentNumber ?? ''
    state.email = full.email ?? ''
    state.phone = full.phone ?? ''
    state.website = full.website ?? ''
    state.address = full.address ?? ''
    // The city select is populated by a cascade that keys off the selected state; set the
    // state first (from the embedded CityDto's own stateUuid) and stash the city so the
    // cascade watcher can apply it once that state's cities finish loading.
    pendingCityUuid.value = full.city?.uuid
    selectedStateUuid.value = full.city?.stateUuid
    state.description = full.description ?? ''
    state.joinedAt = full.joinedAt ?? ''
    state.published = full.published ?? false
    state.status = full.status || 'ACTIVE'
    state.specialtyUuids = (full.specialties ?? []).map(s => s.uuid)
    isActive.value = full.active ?? true
  }
  catch {
    // The detail failed to load (useApi already notified); close the modal.
    formOpen.value = false
  }
  finally {
    editLoading.value = false
  }
}

async function onSubmit(_event: FormSubmitEvent<Record<string, unknown>>) {
  isSubmitting.value = true
  try {
    if (mode.value === 'create') {
      const body: CreateAllyRequest = {
        name: state.name,
        allyTypeUuid: state.allyTypeUuid!,
        taxDocumentType: state.taxDocumentType || undefined,
        taxDocumentNumber: state.taxDocumentNumber || undefined,
        email: state.email || undefined,
        phone: state.phone || undefined,
        website: state.website || undefined,
        address: state.address || undefined,
        cityUuid: state.cityUuid,
        description: state.description || undefined,
        joinedAt: state.joinedAt || undefined,
        published: state.published,
        specialtyUuids: state.specialtyUuids.length ? state.specialtyUuids : undefined,
      }
      await allies.create(body)
      toast.add({ title: t('allies.createdToast'), color: 'success', icon: 'i-lucide-check-circle' })
    }
    else if (editingUuid.value) {
      const body: UpdateAllyRequest = {
        name: state.name,
        allyTypeUuid: state.allyTypeUuid,
        taxDocumentType: state.taxDocumentType || undefined,
        taxDocumentNumber: state.taxDocumentNumber || undefined,
        email: state.email || undefined,
        phone: state.phone || undefined,
        website: state.website || undefined,
        address: state.address || undefined,
        cityUuid: state.cityUuid,
        description: state.description || undefined,
        joinedAt: state.joinedAt || undefined,
        published: state.published,
        status: state.status,
        active: isActive.value,
        // Replaces the full specialties set.
        specialtyUuids: state.specialtyUuids,
      }
      await allies.update(editingUuid.value, body)
      toast.add({ title: t('allies.updatedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    }
    formOpen.value = false
    await load()
  }
  catch {
    // useApi already notified the error (409 duplicate tax ID, 422, etc.)
  }
  finally {
    isSubmitting.value = false
  }
}

// ---- Delete ----
const deleteOpen = ref(false)
const deleting = ref(false)
const target = ref<AllyDto | null>(null)
const usageChecking = ref(false)
const usageInfo = ref<{ inUse: boolean, count: number } | null>(null)

async function openDelete(a: AllyDto) {
  target.value = a
  deleteOpen.value = true
  usageChecking.value = true
  usageInfo.value = null
  try {
    usageInfo.value = await allies.usage(a.uuid)
  }
  catch {
    // Fallback: treat as "in use" for safety (soft-deactivate instead of physical delete).
    usageInfo.value = null
  }
  finally {
    usageChecking.value = false
  }
}

// Shortcut from the edit modal so the user doesn't have to close it first
// and hunt for the row's trash icon. Closes the edit modal so the two
// dialogs never stack.
function openDeleteFromEdit() {
  if (!editingItem.value) return
  formOpen.value = false
  openDelete(editingItem.value)
}

async function confirmDelete() {
  if (!target.value) return
  deleting.value = true
  const wasPhysical = usageInfo.value?.inUse === false
  try {
    await allies.remove(target.value.uuid, wasPhysical)
    toast.add({
      title: wasPhysical
        ? t('allies.deletedPermanentToast')
        : t('allies.deactivatedToast'),
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
        <ReportPrintButton />
        <UTooltip :text="canCreate ? t('allies.createTooltip') : t('allies.noPermissionCreate')">
          <UButton
            color="primary"
            icon="i-lucide-handshake"
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
    </div>

    <!-- Table -->
    <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden flex flex-col h-[calc(100vh-19rem)] min-h-[24rem]">
      <div class="overflow-auto flex-1">
        <table class="w-full text-sm">
          <thead class="sticky top-0 bg-white z-10">
            <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
              <th class="px-5 py-3 font-semibold">{{ t('allies.columns.ally') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('allies.columns.type') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('allies.columns.taxId') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('allies.columns.city') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('allies.columns.published') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('allies.columns.status') }}</th>
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
              :class="{ 'opacity-60': a.active === false }"
              @click="navigateTo(`/dashboard/allies/${a.uuid}`)"
            >
              <td class="px-5 py-3">
                <div class="font-semibold text-prohealth-900">{{ a.name }}</div>
                <div class="text-xs text-prohealth-500">{{ a.email || t('common.empty') }}</div>
              </td>
              <td class="px-5 py-3 text-prohealth-700">{{ a.allyType?.name || t('common.empty') }}</td>
              <td class="px-5 py-3 text-prohealth-700">
                <span v-if="a.taxDocumentNumber">{{ a.taxDocumentType }}-{{ a.taxDocumentNumber }}</span>
                <span v-else class="text-prohealth-400">{{ t('common.empty') }}</span>
              </td>
              <td class="px-5 py-3 text-prohealth-700">{{ a.city?.name || t('common.empty') }}</td>
              <td class="px-5 py-3">
                <UBadge :color="a.published ? 'success' : 'neutral'" variant="subtle" size="sm">
                  {{ a.published ? t('allies.published') : t('allies.draft') }}
                </UBadge>
              </td>
              <td class="px-5 py-3">
                <UBadge
                  :color="a.status === 'ACTIVE' ? 'success' : 'warning'"
                  variant="subtle"
                  size="sm"
                >
                  {{ a.status ? statusLabel(a.status) : t('common.empty') }}
                </UBadge>
              </td>
              <td class="px-5 py-3" @click.stop>
                <div class="flex items-center justify-end gap-1">
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
                      color="neutral"
                      variant="ghost"
                      icon="i-lucide-pencil"
                      size="sm"
                      :disabled="!canUpdate"
                      @click="openEdit(a)"
                    />
                  </UTooltip>
                  <UTooltip :text="canDelete ? t('common.delete') : t('allies.noPermissionDelete')">
                    <UButton
                      color="error"
                      variant="ghost"
                      icon="i-lucide-trash-2"
                      size="sm"
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
    <UModal
      v-model:open="formOpen"
      :title="mode === 'create' ? t('allies.form.createTitle') : t('allies.form.editTitle')"
      :description="mode === 'create' ? t('allies.form.createDescription') : t('allies.form.editDescription')"
      :ui="{ content: 'max-w-2xl' }"
    >
      <template #body>
        <div v-if="editLoading" class="py-12 flex flex-col items-center justify-center gap-2 text-prohealth-500">
          <UIcon name="i-lucide-loader-circle" class="w-6 h-6 animate-spin" />
          <span class="text-sm">{{ t('allies.form.loadingDetail') }}</span>
        </div>
        <UForm
          v-else
          :schema="schema"
          :state="state"
          class="space-y-4"
          @submit="onSubmit"
        >
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField :label="t('allies.form.fields.name')" name="name" required>
              <UInput v-model="state.name" class="w-full" />
            </UFormField>
            <UFormField :label="t('allies.form.fields.allyType')" name="allyTypeUuid" required>
              <USelectMenu
                v-model="state.allyTypeUuid"
                :items="allyTypeOptions"
                label-key="label"
                value-key="value"
                :placeholder="t('common.select')"
                class="w-full"
              />
            </UFormField>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField :label="t('allies.form.fields.taxDocumentType')" name="taxDocumentType">
              <USelectMenu
                v-model="state.taxDocumentType"
                :items="documentTypeOptions"
                label-key="label"
                value-key="value"
                :placeholder="t('common.select')"
                class="w-full"
              />
            </UFormField>
            <UFormField :label="t('allies.form.fields.taxDocumentNumber')" name="taxDocumentNumber">
              <UInput v-model="state.taxDocumentNumber" class="w-full" />
            </UFormField>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField :label="t('allies.form.fields.email')" name="email">
              <UInput v-model="state.email" type="email" class="w-full" />
            </UFormField>
            <UFormField :label="t('allies.form.fields.phone')" name="phone">
              <UInput v-model="state.phone" class="w-full" />
            </UFormField>
          </div>

          <UFormField :label="t('allies.form.fields.website')" name="website">
            <UInput v-model="state.website" placeholder="https://…" class="w-full" />
          </UFormField>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField :label="t('allies.form.fields.state')" name="stateUuid">
              <USelectMenu
                v-model="selectedStateUuid"
                :items="stateOptions"
                label-key="label"
                value-key="value"
                :placeholder="t('common.select')"
                class="w-full"
              />
            </UFormField>
            <UFormField :label="t('allies.form.fields.city')" name="cityUuid">
              <USelectMenu
                v-model="state.cityUuid"
                :items="cityOptions"
                label-key="label"
                value-key="value"
                :disabled="!selectedStateUuid"
                :placeholder="t('allies.form.selectCityFirst')"
                class="w-full"
              />
            </UFormField>
          </div>

          <UFormField :label="t('allies.form.fields.address')" name="address">
            <UInput v-model="state.address" class="w-full" />
          </UFormField>

          <UFormField :label="t('allies.form.fields.description')" name="description">
            <UTextarea v-model="state.description" :rows="2" class="w-full" />
          </UFormField>

          <UFormField :label="t('allies.form.fields.specialties')" name="specialtyUuids">
            <USelectMenu
              v-model="state.specialtyUuids"
              :items="specialtyOptions"
              label-key="label"
              value-key="value"
              multiple
              icon="i-lucide-list-checks"
              :placeholder="t('allies.form.selectMultiple')"
              class="w-full"
            />
          </UFormField>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <UFormField :label="t('allies.form.fields.joinedAt')" name="joinedAt">
              <UInput v-model="state.joinedAt" type="date" class="w-full" />
            </UFormField>
            <UFormField :label="t('allies.form.fields.published')" name="published">
              <USwitch v-model="state.published" />
            </UFormField>
            <UFormField v-if="mode === 'edit'" :label="t('allies.form.fields.status')" name="status">
              <USelectMenu
                v-model="state.status"
                :items="statusOptions"
                label-key="label"
                value-key="value"
                class="w-full"
              />
            </UFormField>
            <UFormField v-if="mode === 'edit'" :label="t('allies.form.fields.active')">
              <USwitch v-model="isActive" />
            </UFormField>
          </div>

          <p class="text-xs text-prohealth-500">{{ t('common.requiredFieldsHint') }}</p>

          <div class="flex items-center justify-between gap-3 pt-2">
            <div v-if="mode === 'edit' && editingItem">
              <UTooltip :text="canDelete ? t('common.delete') : t('allies.noPermissionDelete')">
                <UButton
                  color="error"
                  variant="ghost"
                  icon="i-lucide-trash-2"
                  size="sm"
                  :label="t('common.delete')"
                  :disabled="isSubmitting || !canDelete"
                  @click="openDeleteFromEdit"
                />
              </UTooltip>
            </div>
            <div v-else />

            <div class="flex items-center gap-3">
              <UButton color="neutral" variant="ghost" :disabled="isSubmitting" @click="formOpen = false">
                {{ t('common.cancel') }}
              </UButton>
              <UButton type="submit" color="primary" :loading="isSubmitting" icon="i-lucide-save">
                {{ mode === 'create' ? t('allies.form.submitCreate') : t('common.saveChanges') }}
              </UButton>
            </div>
          </div>
        </UForm>
      </template>
    </UModal>

    <!-- Delete confirmation modal -->
    <UModal v-model:open="deleteOpen" :title="t('allies.delete.title')">
      <template #body>
        <div v-if="usageChecking" class="flex items-center gap-2 text-sm text-prohealth-600">
          <UIcon name="i-lucide-loader-2" class="w-4 h-4 animate-spin" />
          {{ t('common.loading') }}
        </div>
        <p v-else class="text-sm text-prohealth-700">
          {{
            usageInfo?.inUse === false
              ? t('allies.deleteConfirmPermanent')
              : t('allies.deleteConfirmDeactivate', { count: usageInfo?.count ?? 0 })
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
  </div>
</template>
