<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { SelectItem } from '~/types/options'
import type {
  AllyProductCreateRequest,
  AllyProductDto,
  AllyProductUpdateRequest,
} from '~/types/allies'
import { PRODUCT_TYPE_OPTIONS, type ProductType } from '~/types/products'

// Create/edit an ally's offer of the products catalog (hub ADR 0026), used by
// dashboard/allies/[uuid].vue. On create the admin either offers an existing
// GENERAL product (searchable, from /v1/admin/products?exclusive=false) or
// creates a new item EXCLUSIVE to this ally. On edit the full offer is loaded
// with GET /{uuid} — never the list row — and the item fields (category, type,
// name, description, appointment) are only editable when the product is
// exclusive to this ally; for a general product only the offer terms change.
const props = defineProps<{
  open: boolean
  allyUuid: string
  mode: 'create' | 'edit'
  /** Offer uuid to edit (edit mode). */
  offerUuid: string | null
  canDelete: boolean
}>()

const emit = defineEmits<{
  'update:open': [boolean]
  'saved': [AllyProductDto]
  'delete-requested': [AllyProductDto]
}>()

const { t } = useI18n()
const allies = useAllies()
const productsApi = useProducts()
const { can } = usePermissions()
const toast = useToast()

const isOpen = computed({
  get: () => props.open,
  set: v => emit('update:open', v),
})

const submitting = ref(false)
const editLoading = ref(false)
const editing = ref<AllyProductDto | null>(null)
// Save button lives in the modal's #footer slot, outside the <UForm> element,
// so it can't use type="submit"; it triggers validation via this instead.
const formRef = ref<{ submit: () => Promise<void> } | null>(null)

/** Picking a general product needs read access to the products master. */
const canPickGeneral = computed(() => can('PRODUCT_VIEW_ALL'))
const source = ref<'general' | 'exclusive'>('general')
const sourceItems = computed(() => [
  { label: t('allies.products.form.sourceGeneral'), value: 'general', disabled: !canPickGeneral.value },
  { label: t('allies.products.form.sourceExclusive'), value: 'exclusive' },
])

/** Item fields are sent (and validated) only for an exclusive product. */
const editsItemFields = computed(() =>
  props.mode === 'create' ? source.value === 'exclusive' : !!editing.value?.exclusive)

interface OfferFormState {
  productUuid: string | undefined
  productCategoryUuid: string | undefined
  productType: ProductType
  name: string
  description: string
  requiresAppointment: boolean
  priceAmount: string
  discountPct: string
  exclusions: string
  published: boolean
}

const state = reactive<OfferFormState>({
  productUuid: undefined,
  productCategoryUuid: undefined,
  productType: 'SERVICE',
  name: '',
  description: '',
  requiresAppointment: false,
  priceAmount: '',
  discountPct: '',
  exclusions: '',
  published: false,
})

function resetState() {
  state.productUuid = undefined
  state.productCategoryUuid = undefined
  state.productType = 'SERVICE'
  state.name = ''
  state.description = ''
  state.requiresAppointment = false
  state.priceAmount = ''
  state.discountPct = ''
  state.exclusions = ''
  state.published = false
}

function decimalString(v?: number | string | null): string {
  return v === null || v === undefined ? '' : String(v)
}

const schema = computed(() => {
  const required = z.string({ message: t('validation.required') }).min(1, t('validation.required'))
  const optional = z.any().optional()
  return z.object({
    productUuid: props.mode === 'create' && source.value === 'general' ? required : optional,
    productCategoryUuid: editsItemFields.value ? required : optional,
    name: editsItemFields.value ? z.string().min(3, t('validation.minChars', { n: 3 })) : optional,
    priceAmount: z.string().regex(/^\d*(\.\d{1,2})?$/, t('validation.invalidAmount')).optional().or(z.literal('')),
    discountPct: z.string().regex(/^\d*(\.\d{1,2})?$/, t('validation.invalidPercent')).optional().or(z.literal('')),
  })
})

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

// ---- General product search (server-side, debounced) ----
const productSearchTerm = ref('')
const productOptions = ref<SelectItem[]>([])
const productSearching = ref(false)
let searchTimer: ReturnType<typeof setTimeout> | undefined

async function searchProducts(q?: string) {
  if (!canPickGeneral.value) return
  productSearching.value = true
  try {
    const res = await productsApi.list({ q, exclusive: false, size: 20, sort: ['name,asc'] })
    productOptions.value = (res.content ?? []).map(p => ({
      label: p.productCategory_Display ? `${p.name} · ${p.productCategory_Display}` : p.name,
      value: p.uuid,
    }))
  }
  catch {
    productOptions.value = []
  }
  finally {
    productSearching.value = false
  }
}

watch(productSearchTerm, (q) => {
  clearTimeout(searchTimer)
  const term = q.trim()
  // Don't clear the options on '' — USelectMenu resets the term right after a
  // pick, and wiping the list would make the trigger show the raw uuid.
  if (term.length < 2) return
  searchTimer = setTimeout(() => searchProducts(term), 400)
})

// ---- Open / load ----
watch(() => props.open, async (open) => {
  if (!open) return
  resetState()
  editing.value = null
  source.value = canPickGeneral.value ? 'general' : 'exclusive'
  productSearchTerm.value = ''
  loadCategories()
  if (props.mode === 'create') {
    searchProducts()
    return
  }
  if (!props.offerUuid) return
  editLoading.value = true
  try {
    const full = await allies.getProduct(props.allyUuid, props.offerUuid)
    editing.value = full
    state.productUuid = full.productUuid
    state.productCategoryUuid = full.productCategory?.uuid
    state.productType = (full.productType as ProductType) || 'SERVICE'
    state.name = full.name ?? ''
    state.description = full.description ?? ''
    state.requiresAppointment = full.requiresAppointment ?? false
    state.priceAmount = decimalString(full.priceAmount)
    state.discountPct = decimalString(full.discountPct)
    state.exclusions = full.exclusions ?? ''
    state.published = full.published ?? false
  }
  catch {
    // useApi already notified; close rather than show an empty form.
    isOpen.value = false
  }
  finally {
    editLoading.value = false
  }
})

async function onSubmit(_event: FormSubmitEvent<Record<string, unknown>>) {
  submitting.value = true
  try {
    let saved: AllyProductDto
    if (props.mode === 'create') {
      const terms = {
        priceAmount: state.priceAmount || undefined,
        discountPct: state.discountPct || undefined,
        exclusions: state.exclusions.trim() || undefined,
      }
      const body: AllyProductCreateRequest = source.value === 'general'
        ? { productUuid: state.productUuid!, ...terms }
        : {
            productCategoryUuid: state.productCategoryUuid!,
            productType: state.productType,
            name: state.name,
            description: state.description || undefined,
            requiresAppointment: state.requiresAppointment,
            ...terms,
          }
      saved = await allies.createProduct(props.allyUuid, body)
      toast.add({ title: t('allies.products.createdToast'), color: 'success', icon: 'i-lucide-check-circle' })
    }
    else {
      if (!props.offerUuid) return
      const body: AllyProductUpdateRequest = {
        priceAmount: state.priceAmount || undefined,
        discountPct: state.discountPct || undefined,
        // Empty string clears the exclusions.
        exclusions: state.exclusions.trim(),
        published: state.published,
        // Item fields only for an exclusive product (422 otherwise).
        ...(editsItemFields.value
          ? {
              productCategoryUuid: state.productCategoryUuid,
              productType: state.productType,
              name: state.name,
              description: state.description || undefined,
              requiresAppointment: state.requiresAppointment,
            }
          : {}),
      }
      saved = await allies.updateProduct(props.allyUuid, props.offerUuid, body)
      toast.add({ title: t('allies.products.updatedToast'), color: 'success', icon: 'i-lucide-check-circle' })
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
    :title="mode === 'create' ? t('allies.products.form.createTitle') : t('allies.products.form.editTitle')"
    :description="mode === 'create' ? t('allies.products.form.createDescription') : t('allies.products.form.editDescription')"
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
        <!-- Create: general product vs. new exclusive item -->
        <UFormField
          v-if="mode === 'create'"
          :label="t('allies.products.form.source')"
          :help="canPickGeneral ? undefined : t('allies.products.form.sourceGeneralNoPermission')"
        >
          <URadioGroup v-model="source" :items="sourceItems" orientation="horizontal" />
        </UFormField>

        <UFormField
          v-if="mode === 'create' && source === 'general'"
          :label="t('allies.products.form.fields.product')"
          name="productUuid"
          :help="t('allies.products.form.productSearchHelp')"
          required
        >
          <USelectMenu
            clear
            v-model="state.productUuid"
            v-model:search-term="productSearchTerm"
            :items="productOptions"
            label-key="label"
            value-key="value"
            ignore-filter
            icon="i-lucide-search"
            :loading="productSearching"
            :placeholder="t('allies.products.form.productSearchPlaceholder')"
            :search-input="{ placeholder: t('allies.products.form.productSearchPlaceholder'), icon: 'i-lucide-search' }"
            class="w-full"
          />
        </UFormField>

        <!-- Edit of a general product: item data is read-only here -->
        <div
          v-if="mode === 'edit' && editing && !editing.exclusive"
          class="rounded-xl border border-prohealth-100 bg-prohealth-50/40 p-4 text-sm space-y-1"
        >
          <p class="font-semibold text-prohealth-900">{{ editing.name }}</p>
          <p class="text-prohealth-600">
            {{ editing.productType_Display ?? editing.productType }}
            · {{ editing.productCategory?.name || t('common.empty') }}
          </p>
          <p class="text-xs text-prohealth-500 pt-1">{{ t('allies.products.form.generalLockedHint') }}</p>
        </div>

        <!-- Item fields (new exclusive item, or edit of an exclusive one) -->
        <template v-if="editsItemFields">
          <p class="text-xs font-semibold uppercase tracking-wide text-prohealth-400">{{ t('allies.products.form.itemSection') }}</p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField :label="t('allies.products.form.fields.type')" name="productType" required>
              <USelectMenu
                v-model="state.productType"
                :items="typeOptions"
                label-key="label"
                value-key="value"
                :search-input="false"
                class="w-full"
              />
            </UFormField>
            <UFormField :label="t('allies.products.form.fields.category')" name="productCategoryUuid" required>
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

          <UFormField :label="t('allies.products.form.fields.name')" name="name" required>
            <UInput v-model="state.name" class="w-full" />
          </UFormField>

          <UFormField :label="t('allies.products.form.fields.description')" name="description">
            <UTextarea v-model="state.description" :rows="2" class="w-full" />
          </UFormField>

          <UFormField :label="t('allies.products.form.fields.requiresAppointment')" name="requiresAppointment">
            <USwitch v-model="state.requiresAppointment" />
          </UFormField>
        </template>

        <!-- Offer terms -->
        <p class="text-xs font-semibold uppercase tracking-wide text-prohealth-400">{{ t('allies.products.form.offerSection') }}</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('allies.products.form.fields.price')" name="priceAmount">
            <UInput v-model="state.priceAmount" placeholder="100.00" class="w-full" />
          </UFormField>
          <UFormField :label="t('allies.products.form.fields.discount')" name="discountPct">
            <UInput v-model="state.discountPct" placeholder="10.00" class="w-full" />
          </UFormField>
        </div>

        <UFormField
          :label="t('allies.products.form.fields.exclusions')"
          name="exclusions"
          :help="t('allies.products.form.exclusionsHelp')"
        >
          <UTextarea
            v-model="state.exclusions"
            :rows="2"
            :placeholder="t('allies.products.form.exclusionsPlaceholder')"
            class="w-full"
          />
        </UFormField>

        <UFormField v-if="mode === 'edit'" :label="t('allies.products.form.fields.published')" name="published">
          <USwitch v-model="state.published" />
        </UFormField>
      </UForm>
    </template>

    <template #footer>
      <div class="w-full space-y-2">
        <p class="text-xs text-prohealth-500">{{ t('common.requiredFieldsHint') }}</p>

        <div class="flex items-center justify-between gap-3">
          <div v-if="mode === 'edit' && editing">
            <UTooltip :text="canDelete ? t('common.delete') : t('allies.noPermission')">
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
              {{ mode === 'create' ? t('allies.products.add') : t('common.saveChanges') }}
            </UButton>
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>
