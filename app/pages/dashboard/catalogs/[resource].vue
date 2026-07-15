<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { CatalogDef, CatalogField, CatalogItem } from '~/types/catalogs'
import { getCatalogDef } from '~/utils/catalog-registry'

definePageMeta({
  layout: 'dashboard',
  // Resolves the catalog's own write key from the route param (V33): reaching a
  // catalog screen means being able to manage it.
  middleware: 'catalog-access',
})

const { t } = useI18n()
const route = useRoute()
const toast = useToast()

// Catalog definition from the route segment. Reactive: the component is reused
// when navigating between catalogs.
const def = computed(() => getCatalogDef(String(route.params.resource)))

// ---- i18n resolvers (registry carries `*Key`; literal label is the fallback) ----
function catLabel(d?: CatalogDef): string {
  return d ? (d.labelKey ? t(d.labelKey) : d.label) : ''
}
function catLabelSingular(d?: CatalogDef): string {
  return d ? (d.labelSingularKey ? t(d.labelSingularKey) : d.labelSingular) : ''
}
function fieldLabel(f: CatalogField): string {
  return f.labelKey ? t(f.labelKey) : f.label
}
function fieldRegexMsg(f: CatalogField): string {
  return f.regexMsgKey ? t(f.regexMsgKey, { n: f.max ?? 0 }) : (f.regexMsg ?? t('catalogs.validation.invalidFormat'))
}

useSeoMeta({
  title: () => t('common.seoTitle', { page: def.value ? catLabel(def.value) : t('catalogs.title') }),
})

const hasDescription = computed(() => def.value?.fields.some(f => f.name === 'description') ?? false)

// Table column count (for the skeleton and colspans).
const columnCount = computed(() => {
  let n = 2 // name + actions
  if (def.value?.codeField) n++
  if (def.value?.parentDisplayField) n++
  if (hasDescription.value) n++
  n++ // status
  return n
})

// ---- List ----
const items = ref<CatalogItem[]>([])
const loading = ref(false)
const search = ref('')

// Parent filter (e.g. cities by state).
const filterValue = ref<string>('')

function api() {
  return useCatalog(def.value!.basePath)
}

async function load() {
  if (!def.value) return
  loading.value = true
  try {
    const query = def.value.listFilter && filterValue.value
      ? { [def.value.listFilter.param]: filterValue.value }
      : undefined
    items.value = await api().list(query)
  }
  catch {
    items.value = []
  }
  finally {
    loading.value = false
  }
}

const filtered = computed(() => {
  const term = search.value.trim().toLowerCase()
  if (!term) return items.value
  return items.value.filter((i) => {
    const code = (i.code ?? i.isoCode ?? '').toLowerCase()
    return i.name.toLowerCase().includes(term) || code.includes(term)
  })
})

// ---- Parent catalog options (for FK selects and the filter) ----
const parentOptions = ref<Record<string, { label: string, value: string }[]>>({})

async function loadParents() {
  if (!def.value) return
  parentOptions.value = {}
  const parentFields = def.value.fields.filter(f => f.type === 'parent' && f.parentKey)
  await Promise.all(parentFields.map(async (f) => {
    const pdef = getCatalogDef(f.parentKey!)
    if (!pdef) return
    try {
      const list = await useCatalog(pdef.basePath).list()
      parentOptions.value[f.name] = list.map(i => ({
        label: pdef.codeField ? `${i[pdef.codeField] ?? ''} — ${i.name}` : i.name,
        value: i.uuid,
      }))
    }
    catch {
      parentOptions.value[f.name] = []
    }
  }))
}

// Options for the parent filter select (reuses the FK field's options).
const filterOptions = computed(() => {
  const field = def.value?.listFilter?.field
  return field ? (parentOptions.value[field as string] ?? []) : []
})

async function init() {
  if (!def.value) return
  search.value = ''
  filterValue.value = ''
  await Promise.all([loadParents(), load()])
}

onMounted(init)
watch(() => route.params.resource, init)
watch(filterValue, load)

// ---- Create/edit form ----
const formOpen = ref(false)
const mode = ref<'create' | 'edit'>('create')
const editingUuid = ref<string | null>(null)
const isSubmitting = ref(false)
const state = reactive<Record<string, string>>({})

// Fields visible in the current form (onlyCreate fields are hidden on edit).
const formFields = computed(() =>
  (def.value?.fields ?? []).filter(f => mode.value === 'create' || !f.onlyCreate),
)

const schema = computed(() => {
  const shape: Record<string, z.ZodTypeAny> = {}
  for (const f of formFields.value) {
    let s = z.string()
    if (f.max) s = s.max(f.max, t('validation.maxChars', { n: f.max }))
    if (f.regex) s = s.regex(f.regex, fieldRegexMsg(f))
    shape[f.name] = f.required ? s.min(1, t('validation.required')) : s.optional().or(z.literal(''))
  }
  return z.object(shape)
})

function resetForm() {
  for (const f of def.value?.fields ?? []) state[f.name] = ''
}

function openCreate() {
  mode.value = 'create'
  editingUuid.value = null
  resetForm()
  formOpen.value = true
}

function openEdit(item: CatalogItem) {
  mode.value = 'edit'
  editingUuid.value = item.uuid
  resetForm()
  for (const f of def.value?.fields ?? []) {
    state[f.name] = String((item as unknown as Record<string, unknown>)[f.name] ?? '')
  }
  formOpen.value = true
}

function buildBody(forCreate: boolean): Record<string, unknown> {
  const body: Record<string, unknown> = {}
  for (const f of def.value?.fields ?? []) {
    if (!forCreate && f.onlyCreate) continue
    const v = (state[f.name] ?? '').trim()
    if (f.required) body[f.name] = v
    else if (v) body[f.name] = v
  }
  return body
}

async function onSubmit(_e: FormSubmitEvent<Record<string, unknown>>) {
  if (!def.value) return
  isSubmitting.value = true
  try {
    if (mode.value === 'create') {
      await api().create(buildBody(true))
      toast.add({ title: t('catalogs.createdToast', { entity: catLabelSingular(def.value) }), color: 'success', icon: 'i-lucide-check-circle' })
    }
    else if (editingUuid.value) {
      await api().update(editingUuid.value, buildBody(false))
      toast.add({ title: t('catalogs.updatedToast', { entity: catLabelSingular(def.value) }), color: 'success', icon: 'i-lucide-check-circle' })
    }
    formOpen.value = false
    await load()
  }
  catch {
    // useApi already reported the error
  }
  finally {
    isSubmitting.value = false
  }
}

// ---- Delete ----
const deleteOpen = ref(false)
const deleting = ref(false)
const target = ref<CatalogItem | null>(null)

function openDelete(item: CatalogItem) {
  target.value = item
  deleteOpen.value = true
}

async function confirmDelete() {
  if (!target.value || !def.value) return
  deleting.value = true
  try {
    await api().remove(target.value.uuid)
    toast.add({ title: t('catalogs.deletedToast', { entity: catLabelSingular(def.value) }), color: 'success', icon: 'i-lucide-check-circle' })
    deleteOpen.value = false
    await load()
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
  <div v-if="!def" class="bg-white rounded-2xl border border-prohealth-100 p-10 text-center">
    <UIcon name="i-lucide-search-x" class="w-8 h-8 mx-auto mb-2 text-prohealth-300" />
    <p class="text-prohealth-700">{{ $t('catalogs.notFound') }}</p>
    <UButton class="mt-4" color="primary" variant="soft" to="/dashboard/catalogs">{{ $t('catalogs.viewCatalogs') }}</UButton>
  </div>

  <div v-else class="space-y-5">
    <!-- Header -->
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <div class="flex items-center gap-2 text-xs text-prohealth-500 mb-1">
          <NuxtLink to="/dashboard/catalogs" class="hover:text-prohealth-700">{{ $t('catalogs.breadcrumb') }}</NuxtLink>
          <UIcon name="i-lucide-chevron-right" class="w-3.5 h-3.5" />
          <span>{{ catLabel(def) }}</span>
        </div>
        <h1 class="text-2xl font-extrabold text-prohealth-900 flex items-center gap-2">
          <UIcon :name="def.icon" class="w-6 h-6 text-prohealth-600" />
          {{ catLabel(def) }}
        </h1>
      </div>
      <UButton color="primary" icon="i-lucide-plus" @click="openCreate">
        {{ $t('catalogs.new') }}
      </UButton>
    </div>

    <!-- Filters -->
    <div class="bg-white rounded-2xl border border-prohealth-100 p-4 flex flex-wrap gap-3">
      <UInput
        v-model="search"
        :placeholder="$t('catalogs.searchPlaceholder')"
        icon="i-lucide-search"
        size="lg"
        class="w-full max-w-md"
      />
      <USelectMenu
        v-if="def.listFilter"
        v-model="filterValue"
        :items="filterOptions"
        label-key="label"
        value-key="value"
        :placeholder="$t('catalogs.filterByParent')"
        class="w-full max-w-xs"
      />
    </div>

    <!-- Table -->
    <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
              <th v-if="def.codeField" class="px-5 py-3 font-semibold">{{ $t('catalogs.columns.code') }}</th>
              <th class="px-5 py-3 font-semibold">{{ $t('catalogs.columns.name') }}</th>
              <th v-if="def.parentDisplayField" class="px-5 py-3 font-semibold">{{ $t('catalogs.columns.parent') }}</th>
              <th v-if="hasDescription" class="px-5 py-3 font-semibold">{{ $t('catalogs.columns.description') }}</th>
              <th class="px-5 py-3 font-semibold">{{ $t('catalogs.columns.status') }}</th>
              <th class="px-5 py-3 font-semibold text-right">{{ $t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-prohealth-100">
            <TableSkeleton v-if="loading" :rows="6" :cols="columnCount" />
            <tr v-else-if="filtered.length === 0">
              <td :colspan="columnCount" class="px-5 py-12 text-center text-prohealth-500">
                <UIcon :name="def.icon" class="w-8 h-8 mx-auto mb-2 text-prohealth-300" />
                {{ $t('catalogs.empty') }}
              </td>
            </tr>
            <tr v-for="item in filtered" v-else :key="item.uuid" class="hover:bg-prohealth-50/50">
              <td v-if="def.codeField" class="px-5 py-3">
                <UBadge color="neutral" variant="subtle">{{ item[def.codeField] }}</UBadge>
              </td>
              <td class="px-5 py-3 font-medium text-prohealth-900">{{ item.name }}</td>
              <td v-if="def.parentDisplayField" class="px-5 py-3 text-prohealth-600">
                {{ item[def.parentDisplayField] || '—' }}
              </td>
              <td v-if="hasDescription" class="px-5 py-3 text-prohealth-600">
                {{ item.description || '—' }}
              </td>
              <td class="px-5 py-3">
                <UBadge :color="item.active ? 'success' : 'neutral'" variant="subtle" size="sm">
                  {{ item.active ? $t('catalogs.status.active') : $t('catalogs.status.inactive') }}
                </UBadge>
              </td>
              <td class="px-5 py-3">
                <div class="flex items-center justify-end gap-1">
                  <UTooltip :text="$t('common.edit')">
                    <UButton color="neutral" variant="ghost" icon="i-lucide-pencil" size="sm" @click="openEdit(item)" />
                  </UTooltip>
                  <UTooltip :text="$t('common.delete')">
                    <UButton color="error" variant="ghost" icon="i-lucide-trash-2" size="sm" @click="openDelete(item)" />
                  </UTooltip>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="px-5 py-3 border-t border-prohealth-100 text-xs text-prohealth-500">
        {{ $t('catalogs.recordCount', { count: filtered.length }) }}
      </div>
    </div>

    <!-- Create/edit modal -->
    <UModal
      v-model:open="formOpen"
      :title="mode === 'create' ? $t('catalogs.modalCreateTitle', { entity: catLabelSingular(def) }) : $t('catalogs.modalEditTitle', { entity: catLabelSingular(def) })"
    >
      <template #body>
        <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
          <UFormField
            v-for="f in formFields"
            :key="f.name"
            :label="fieldLabel(f)"
            :name="f.name"
            :required="f.required"
          >
            <USelectMenu
              v-if="f.type === 'parent'"
              v-model="state[f.name]"
              :items="parentOptions[f.name] ?? []"
              label-key="label"
              value-key="value"
              :placeholder="$t('catalogs.selectPlaceholder', { field: fieldLabel(f).toLowerCase() })"
              class="w-full"
            />
            <UTextarea
              v-else-if="f.type === 'textarea'"
              v-model="state[f.name]"
              :rows="2"
              :maxlength="f.max"
              class="w-full"
            />
            <UInput
              v-else
              v-model="state[f.name]"
              :placeholder="f.placeholder"
              :maxlength="f.max"
              class="w-full"
            />
          </UFormField>

          <div class="flex items-center justify-end gap-3 pt-2">
            <UButton color="neutral" variant="ghost" :disabled="isSubmitting" @click="formOpen = false">
              {{ $t('common.cancel') }}
            </UButton>
            <UButton type="submit" color="primary" :loading="isSubmitting" icon="i-lucide-save">
              {{ mode === 'create' ? $t('catalogs.create') : $t('common.save') }}
            </UButton>
          </div>
        </UForm>
      </template>
    </UModal>

    <!-- Delete modal -->
    <UModal v-model:open="deleteOpen" :title="$t('catalogs.deleteTitle', { entity: catLabelSingular(def).toLowerCase() })">
      <template #body>
        <p class="text-sm text-prohealth-700">
          {{ $t('catalogs.deleteConfirm', { name: target?.name ?? '' }) }}
        </p>
        <div class="flex items-center justify-end gap-3 pt-5">
          <UButton color="neutral" variant="ghost" :disabled="deleting" @click="deleteOpen = false">
            {{ $t('common.cancel') }}
          </UButton>
          <UButton color="error" :loading="deleting" icon="i-lucide-trash-2" @click="confirmDelete">
            {{ $t('common.delete') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
