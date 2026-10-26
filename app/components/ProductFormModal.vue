<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { SelectItem } from '~/types/options'
import {
  PRODUCT_TYPE_OPTIONS,
  type ProductCreateRequest,
  type ProductDto,
  type ProductType,
  type ProductUpdateRequest,
} from '~/types/products'

// Create/edit a product of the catalog master (hub ADR 0026). Edit always
// loads the full ProductDto with GET /v1/admin/products/{uuid} — the list row
// is a compact projection and must never seed the form. An empty "owner ally"
// means a GENERAL product (any ally may offer it); clearing the owner of an
// exclusive product sends `general: true`.
const props = defineProps<{
  open: boolean
  mode: 'create' | 'edit'
  productUuid: string | null
  canDelete: boolean
}>()

const emit = defineEmits<{
  'update:open': [boolean]
  'saved': [ProductDto]
  'delete-requested': [ProductDto]
}>()

const { t } = useI18n()
const productsApi = useProducts()
const allies = useAllies()
const { can } = usePermissions()
const toast = useToast()

const isOpen = computed({
  get: () => props.open,
  set: v => emit('update:open', v),
})

const submitting = ref(false)
const editLoading = ref(false)
const editing = ref<ProductDto | null>(null)
const formRef = ref<{ submit: () => Promise<void> } | null>(null)

interface ProductFormState {
  code: string
  name: string
  description: string
  productType: ProductType
  productCategoryUuid: string | undefined
  ownerAllyUuid: string | undefined
  requiresAppointment: boolean
  published: boolean
  active: boolean
}

const state = reactive<ProductFormState>({
  code: '',
  name: '',
  description: '',
  productType: 'SERVICE',
  productCategoryUuid: undefined,
  ownerAllyUuid: undefined,
  requiresAppointment: false,
  published: true,
  active: true,
})

function resetState() {
  state.code = ''
  state.name = ''
  state.description = ''
  state.productType = 'SERVICE'
  state.productCategoryUuid = undefined
  state.ownerAllyUuid = undefined
  state.requiresAppointment = false
  state.published = true
  state.active = true
}

const schema = computed(() => z.object({
  code: z.string().max(40, t('validation.maxChars', { n: 40 })).optional().or(z.literal('')),
  name: z.string().min(3, t('validation.minChars', { n: 3 })).max(200, t('validation.maxChars', { n: 200 })),
  productType: z.string({ message: t('validation.required') }).min(1, t('validation.required')),
  productCategoryUuid: z.string({ message: t('validation.required') }).min(1, t('validation.required')),
}))

// ---- Catalogs ----
const typeOptions = computed(() => PRODUCT_TYPE_OPTIONS.map(o => ({ label: t(o.labelKey), value: o.value })))
const categoryOptions = ref<SelectItem[]>([])

async function loadCategories() {
  if (categoryOptions.value.length) return
  try {
    const items = await usePublicCatalog('product-categories').list()
    categoryOptions.value = items
      .filter(i => i.active !== false)
      .map(i => ({ label: i.name, value: i.uuid }))
  }
  catch {
    categoryOptions.value = []
  }
}

// ---- Owner ally (server-side search; needs ALLY_VIEW_ALL) ----
const canSearchAllies = computed(() => can('ALLY_VIEW_ALL'))
const allySearchTerm = ref('')
const allyOptions = ref<SelectItem[]>([])
const allySearching = ref(false)
let allySearchTimer: ReturnType<typeof setTimeout> | undefined

async function searchAllies(q?: string) {
  if (!canSearchAllies.value) return
  allySearching.value = true
  try {
    const res = await allies.list({ q, size: 20 })
    const found = (res.content ?? []).map(a => ({ label: a.name, value: a.uuid }))
    // Keep the current owner selectable even when it's not in the result page.
    const current = allyOptions.value.find(o => o.value === state.ownerAllyUuid)
    allyOptions.value = current && !found.some(o => o.value === current.value) ? [current, ...found] : found
  }
  catch {
    // useApi already notified
  }
  finally {
    allySearching.value = false
  }
}

watch(allySearchTerm, (q) => {
  clearTimeout(allySearchTimer)
  const term = q.trim()
  if (term.length < 2) return
  allySearchTimer = setTimeout(() => searchAllies(term), 400)
})

// ---- Open / load ----
watch(() => props.open, async (open) => {
  if (!open) return
  resetState()
  editing.value = null
  allyOptions.value = []
  allySearchTerm.value = ''
  loadCategories()
  if (props.mode === 'create') {
    searchAllies()
    return
  }
  if (!props.productUuid) return
  editLoading.value = true
  try {
    const full = await productsApi.get(props.productUuid)
    editing.value = full
    state.code = full.code ?? ''
    state.name = full.name ?? ''
    state.description = full.description ?? ''
    state.productType = (full.productType as ProductType) || 'SERVICE'
    state.productCategoryUuid = full.productCategory_Uuid ?? undefined
    state.ownerAllyUuid = full.ownerAlly_Uuid ?? undefined
    state.requiresAppointment = full.requiresAppointment
    state.published = full.published ?? true
    state.active = full.active
    if (full.ownerAlly_Uuid) {
      allyOptions.value = [{ label: full.ownerAlly_Display ?? full.ownerAlly_Uuid, value: full.ownerAlly_Uuid }]
    }
    searchAllies()
  }
  catch {
    isOpen.value = false
  }
  finally {
    editLoading.value = false
  }
})

async function onSubmit(_event: FormSubmitEvent<Record<string, unknown>>) {
  submitting.value = true
  try {
    let saved: ProductDto
    if (props.mode === 'create') {
      const body: ProductCreateRequest = {
        code: state.code.trim() || undefined,
        name: state.name.trim(),
        description: state.description.trim() || undefined,
        productType: state.productType,
        productCategoryUuid: state.productCategoryUuid!,
        ownerAllyUuid: state.ownerAllyUuid || undefined,
        requiresAppointment: state.requiresAppointment,
        published: state.published,
      }
      saved = await productsApi.create(body)
      toast.add({ title: t('products.createdToast'), color: 'success', icon: 'i-lucide-check-circle' })
    }
    else {
      if (!props.productUuid) return
      const wasExclusive = !!editing.value?.ownerAlly_Uuid
      const body: ProductUpdateRequest = {
        code: state.code.trim() || undefined,
        name: state.name.trim(),
        description: state.description.trim(),
        productType: state.productType,
        productCategoryUuid: state.productCategoryUuid,
        requiresAppointment: state.requiresAppointment,
        published: state.published,
        active: state.active,
        ...(state.ownerAllyUuid
          ? { ownerAllyUuid: state.ownerAllyUuid }
          : (wasExclusive ? { general: true } : {})),
      }
      saved = await productsApi.update(props.productUuid, body)
      toast.add({ title: t('products.updatedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    }
    emit('saved', saved)
    isOpen.value = false
  }
  catch {
    // toast handled by useApi (422 messages come localized from the backend)
  }
  finally {
    submitting.value = false
  }
}

function requestDelete() {
  if (!editing.value) return
  const target = editing.value
  isOpen.value = false
  emit('delete-requested', target)
}
</script>

<template>
  <UModal
    v-model:open="isOpen"
    :title="mode === 'create' ? t('products.form.createTitle') : t('products.form.editTitle')"
    :description="t('products.form.description')"
    :ui="{ content: 'max-w-2xl' }"
  >
    <template #body>
      <div v-if="editLoading" class="py-10 flex justify-center">
        <UIcon name="i-lucide-loader-circle" class="w-6 h-6 animate-spin text-prohealth-400" />
      </div>
      <UForm
        v-else
        ref="formRef"
        :schema="schema"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <UFormField :label="t('products.form.fields.name')" name="name" required class="sm:col-span-2">
            <UInput v-model="state.name" class="w-full" />
          </UFormField>
          <UFormField :label="t('products.form.fields.code')" name="code" :help="mode === 'create' ? t('products.form.codeHelp') : undefined">
            <UInput v-model="state.code" class="w-full" />
          </UFormField>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('products.form.fields.type')" name="productType" required>
            <USelectMenu
              v-model="state.productType"
              :items="typeOptions"
              label-key="label"
              value-key="value"
              :search-input="false"
              class="w-full"
            />
          </UFormField>
          <UFormField :label="t('products.form.fields.category')" name="productCategoryUuid" required>
            <USelectMenu
              clear
              v-model="state.productCategoryUuid"
              :items="categoryOptions"
              label-key="label"
              value-key="value"
              :placeholder="t('common.select')"
              class="w-full"
            />
          </UFormField>
        </div>

        <UFormField :label="t('products.form.fields.description')" name="description">
          <UTextarea v-model="state.description" :rows="3" class="w-full" />
        </UFormField>

        <UFormField
          :label="t('products.form.fields.ownerAlly')"
          name="ownerAllyUuid"
          :help="canSearchAllies ? t('products.form.ownerAllyHelp') : t('products.form.ownerAllyNoPermission')"
        >
          <USelectMenu
            clear
            v-model="state.ownerAllyUuid"
            v-model:search-term="allySearchTerm"
            :items="allyOptions"
            label-key="label"
            value-key="value"
            ignore-filter
            icon="i-lucide-handshake"
            :loading="allySearching"
            :disabled="!canSearchAllies"
            :placeholder="t('products.form.generalPlaceholder')"
            :search-input="{ placeholder: t('products.form.allySearchPlaceholder'), icon: 'i-lucide-search' }"
            class="w-full"
          />
        </UFormField>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('products.form.fields.requiresAppointment')" name="requiresAppointment">
            <USwitch v-model="state.requiresAppointment" />
          </UFormField>
          <UFormField
            :label="t('products.form.fields.published')"
            name="published"
            :help="t('products.form.publishedHelp')"
          >
            <USwitch v-model="state.published" />
          </UFormField>
          <UFormField v-if="mode === 'edit'" :label="t('products.form.fields.active')" name="active">
            <USwitch v-model="state.active" />
          </UFormField>
        </div>
      </UForm>
    </template>

    <template #footer>
      <div class="w-full space-y-2">
        <p class="text-xs text-prohealth-500">{{ t('common.requiredFieldsHint') }}</p>
        <div class="flex items-center justify-between gap-3">
          <div v-if="mode === 'edit' && editing">
            <UTooltip :text="canDelete ? t('common.delete') : t('products.noPermission')">
              <UButton
                color="error"
                variant="ghost"
                icon="i-lucide-trash-2"
                size="sm"
                :label="t('common.delete')"
                :disabled="submitting || !canDelete"
                @click="requestDelete"
              />
            </UTooltip>
          </div>
          <div v-else />
          <div class="flex items-center gap-3">
            <UButton color="neutral" variant="ghost" :disabled="submitting" @click="isOpen = false">
              {{ t('common.cancel') }}
            </UButton>
            <UButton
              color="primary"
              :loading="submitting"
              :disabled="editLoading"
              icon="i-lucide-save"
              @click="formRef?.submit()"
            >
              {{ mode === 'create' ? t('products.new') : t('common.saveChanges') }}
            </UButton>
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>
