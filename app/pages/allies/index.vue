<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { CatalogItem } from '~/types/catalogs'
import { canOperateAtCounter, type AllyProductDto, type DiscountType, type MyAllyDto } from '~/types/allies'
import { discountRequestFields } from '~/utils/offerDiscount'
import type { SelectItem } from '~/types/options'
import { ROLES } from '~/types/auth'
import { PRODUCT_TYPE_OPTIONS, type ProductType } from '~/types/products'

// Partner panel: propose products and services (POST /v1/me/allies/products,
// born in PROPOSED — hub ADR 0026). The ally either offers an existing product
// of the catalog or proposes a new item that becomes exclusive to it.
// The backend requires the user to have OWNER/STAFF membership in the given ally.
//
// The ally is resolved from GET /v1/me/allies — never typed. One ally (the common
// case) needs no picker; a user spanning several gets one.
definePageMeta({
  layout: 'dashboard',
  middleware: 'role',
  roles: [ROLES.ALLY],
})

const { t } = useI18n()
// The public directory link follows the UI language (/aliados or /en/allies).
const publicPath = usePublicPath()

useSeoMeta({ title: () => t('allies.portal.seoTitle') })

const allies = useAllies()
const myAllies = useMyAllies()
const toast = useToast()

// ---- Which ally am I proposing for? ----
const myAllyList = ref<MyAllyDto[]>([])
const alliesLoading = ref(true)

const allyOptions = computed(() => myAllyList.value.map(a => ({ label: a.name, value: a.uuid })))
const selectedAlly = computed(() => myAllyList.value.find(a => a.uuid === state.allyUuid) ?? null)
// VIEWER members only read the galleries (writes answer 403 — hub ADR 0027).
const canEditMedia = computed(() => canOperateAtCounter(selectedAlly.value?.allyRole))
// ---- Own offers (galleries) ----
const myOffers = ref<AllyProductDto[]>([])
const openOffer = ref<string | null>(null)

async function loadMyOffers() {
  const uuid = selectedAlly.value?.uuid
  openOffer.value = null
  if (!uuid) {
    myOffers.value = []
    return
  }
  try {
    myOffers.value = (await myAllies.listProducts(uuid)).content ?? []
  }
  catch {
    myOffers.value = []
  }
}

const hasNoAlly = computed(() => !alliesLoading.value && myAllyList.value.length === 0)

async function loadMyAllies() {
  try {
    myAllyList.value = await myAllies.list()
    // The backend returns primary first, so the head is the sensible default.
    state.allyUuid = myAllyList.value[0]?.uuid ?? ''
  }
  catch {
    // useApi already notified; hasNoAlly renders the empty state.
  }
  finally {
    alliesLoading.value = false
  }
}

// ---- Categories catalog ----
const categoryOptions = ref<{ label: string, value: string }[]>([])

async function loadCategories() {
  try {
    const items = await usePublicCatalog('product-categories').list({ size: '-1' })
    categoryOptions.value = items
      .filter((i: CatalogItem) => i.active !== false)
      .map((i: CatalogItem) => ({ label: i.name, value: i.uuid }))
  }
  catch {
    categoryOptions.value = []
  }
}

// ---- Existing product search ----
// GET /v1/me/allies/products/offerable: what the selected ally may still offer
// (general products plus its own exclusive ones, minus those already offered).
// Membership-gated, so it needs no admin key.
const productSearchTerm = ref('')
const productOptions = ref<SelectItem[]>([])
const productSearching = ref(false)
let searchTimer: ReturnType<typeof setTimeout> | undefined

async function searchProducts(q?: string) {
  if (!state.allyUuid) {
    productOptions.value = []
    return
  }
  productSearching.value = true
  try {
    const res = await allies.listOfferableProducts(state.allyUuid, { q })
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
  // Don't clear the options on '' — USelectMenu resets the term right after a pick.
  if (term.length < 2) return
  searchTimer = setTimeout(() => searchProducts(term), 400)
})

onMounted(async () => {
  loadCategories()
  await loadMyAllies()
  searchProducts()
})

// ---- Proposal form ----
const isSubmitting = ref(false)
const lastProposed = ref<AllyProductDto | null>(null)

const source = ref<'existing' | 'exclusive'>('existing')
const sourceItems = computed(() => [
  { label: t('allies.portal.sourceExisting'), value: 'existing' },
  { label: t('allies.portal.sourceExclusive'), value: 'exclusive' },
])
const typeOptions = computed(() => PRODUCT_TYPE_OPTIONS.map(o => ({ label: t(o.labelKey), value: o.value })))

const state = reactive({
  allyUuid: '',
  productUuid: undefined as string | undefined,
  productCategoryUuid: undefined as string | undefined,
  productType: 'SERVICE' as ProductType,
  name: '',
  description: '',
  priceAmount: '',
  discountType: 'PERCENTAGE' as DiscountType,
  discountPct: '',
  discountAmount: '',
  exclusions: '',
  requiresAppointment: false,
})

// `state` must exist before this watcher reads `selectedAlly`.
watch(() => selectedAlly.value?.uuid, loadMyOffers)

// The offerable list depends on the ally: switching it resets the pick.
watch(() => state.allyUuid, (uuid, previous) => {
  if (!previous) return
  state.productUuid = undefined
  productOptions.value = []
  if (uuid) searchProducts()
})

// Locale-reactive schema so validation messages follow the UI locale; item
// fields are only required when proposing a new exclusive item.
const schema = computed(() => {
  const required = z.string({ message: t('validation.required') }).min(1, t('validation.required'))
  const optional = z.any().optional()
  const isNew = source.value === 'exclusive'
  return z.object({
    allyUuid: z.string().min(1, t('validation.required')).uuid(t('validation.invalidUuid')),
    productUuid: isNew ? optional : required,
    productCategoryUuid: isNew ? required : optional,
    name: isNew ? z.string().min(3, t('validation.minChars', { n: 3 })) : optional,
    description: z.string().optional(),
    priceAmount: z.string().regex(/^\d*(\.\d{1,2})?$/, t('validation.invalidAmount')).optional().or(z.literal('')),
    discountPct: z.string().regex(/^\d*(\.\d{1,2})?$/, t('validation.invalidPercent')).optional().or(z.literal('')),
    discountAmount: state.discountType === 'FLAT'
      ? z.string().regex(/^\d+(\.\d{1,2})?$/, t('validation.invalidAmount'))
      : optional,
  })
})

async function onSubmit(_event: FormSubmitEvent<Record<string, unknown>>) {
  isSubmitting.value = true
  try {
    const terms = {
      priceAmount: state.priceAmount || undefined,
      ...discountRequestFields(state.discountType, state.discountPct, state.discountAmount),
      exclusions: state.exclusions.trim() || undefined,
    }
    lastProposed.value = await allies.proposeProduct(source.value === 'existing'
      ? { allyUuid: state.allyUuid, productUuid: state.productUuid!, ...terms }
      : {
          allyUuid: state.allyUuid,
          productCategoryUuid: state.productCategoryUuid!,
          productType: state.productType,
          name: state.name,
          description: state.description || undefined,
          requiresAppointment: state.requiresAppointment,
          ...terms,
        })
    toast.add({
      title: t('allies.portal.proposedToast'),
      description: t('allies.portal.proposedToastDescription'),
      color: 'success',
      icon: 'i-lucide-check-circle',
    })
    loadMyOffers()
    // Keep allyUuid for the next proposal; clear the rest.
    state.productUuid = undefined
    state.productCategoryUuid = undefined
    state.productType = 'SERVICE'
    state.name = ''
    state.description = ''
    state.priceAmount = ''
    state.discountType = 'PERCENTAGE'
    state.discountPct = ''
    state.discountAmount = ''
    state.exclusions = ''
    state.requiresAppointment = false
  }
  catch {
    // useApi already notified the error (403 if you don't have OWNER/STAFF membership in that ally)
  }
  finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="space-y-6 max-w-2xl">
    <div>
      <h1 class="text-2xl font-extrabold text-prohealth-900">{{ t('allies.portal.title') }}</h1>
      <p class="text-sm text-prohealth-700/70 mt-1">
        {{ t('allies.portal.subtitle') }}
      </p>
    </div>

    <!-- No ally: the form can't produce a valid proposal, so say why instead of
         letting it 403 on submit. -->
    <UAlert
      v-if="hasNoAlly"
      color="warning"
      variant="subtle"
      icon="i-lucide-building-2"
      :title="t('allies.portal.noAllyTitle')"
      :description="t('allies.portal.noAllyDescription')"
    />

    <!-- Last proposal -->
    <UAlert
      v-if="lastProposed"
      color="success"
      variant="subtle"
      icon="i-lucide-clock"
      :title="t('allies.portal.lastProposedTitle', { name: lastProposed.name })"
      :description="t('allies.portal.lastProposedDescription')"
    />

    <!-- Own gallery (hub ADR 0027): published immediately -->
    <div v-if="selectedAlly" class="bg-white rounded-2xl border border-prohealth-100 p-6 space-y-2">
      <h2 class="font-bold text-prohealth-900">{{ t('allies.portal.gallery.title') }}</h2>
      <p class="text-xs text-prohealth-500">{{ t('allies.portal.gallery.hint') }}</p>
      <MediaGalleryEditor
        :key="selectedAlly.uuid"
        :base="`/v1/me/allies/${selectedAlly.uuid}/media`"
        :readonly="!canEditMedia"
      />
    </div>

    <!-- Own offers (any review state), each with its gallery (hub ADR 0027) -->
    <div v-if="selectedAlly" class="bg-white rounded-2xl border border-prohealth-100 p-6 space-y-3">
      <div>
        <h2 class="font-bold text-prohealth-900">{{ t('allies.portal.gallery.offersTitle') }}</h2>
        <p class="text-xs text-prohealth-500">{{ t('allies.portal.gallery.offersHint') }}</p>
      </div>
      <p v-if="!myOffers.length" class="text-xs text-prohealth-400">{{ t('allies.portal.gallery.offersEmpty') }}</p>
      <ul v-else class="divide-y divide-prohealth-100">
        <li v-for="o in myOffers" :key="o.uuid" class="py-3">
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="font-semibold text-sm text-prohealth-900 truncate">{{ o.name }}</p>
              <p class="text-xs text-prohealth-500">
                {{ o.reviewStatus_Display ?? t(`allies.products.reviewStatus.${o.reviewStatus}`, String(o.reviewStatus ?? '')) }}
              </p>
            </div>
            <UButton
              size="xs"
              color="primary"
              variant="soft"
              icon="i-lucide-images"
              @click="openOffer = openOffer === o.uuid ? null : o.uuid"
            >
              {{ openOffer === o.uuid ? t('allies.portal.gallery.hide') : t('allies.portal.gallery.show') }}
            </UButton>
          </div>
          <MediaGalleryEditor
            v-if="openOffer === o.uuid"
            :key="o.uuid"
            class="mt-3"
            :base="`/v1/me/allies/products/${o.uuid}/media`"
            :readonly="!canEditMedia"
            :empty-hint="t('media.offerFallbackHint')"
          />
        </li>
      </ul>
    </div>

    <!-- Form -->
    <div v-if="!hasNoAlly" class="bg-white rounded-2xl border border-prohealth-100 p-6">
      <h2 class="font-bold text-prohealth-900 mb-1">{{ t('allies.portal.formTitle') }}</h2>
      <p class="text-xs text-prohealth-500 mb-5">
        {{ t('allies.portal.formHint') }}
      </p>

      <UForm
        :schema="schema"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <!-- Ally picker only when there's a real choice to make; otherwise the single
             ally is resolved silently and just shown for confirmation. -->
        <UFormField
          v-if="allyOptions.length > 1"
          :label="t('allies.portal.fields.ally')"
          name="allyUuid"
          required
          :help="t('allies.portal.fields.allyHelp')"
        >
          <USelectMenu
            clear
            v-model="state.allyUuid"
            :items="allyOptions"
            label-key="label"
            value-key="value"
            icon="i-lucide-building-2"
            :placeholder="t('common.select')"
            class="w-full"
          />
        </UFormField>
        <p v-else-if="selectedAlly" class="text-xs text-prohealth-500 flex items-center gap-1.5">
          <UIcon name="i-lucide-building-2" class="w-3.5 h-3.5" />
          {{ selectedAlly.name }}
        </p>

        <UFormField :label="t('allies.portal.fields.source')">
          <URadioGroup v-model="source" :items="sourceItems" orientation="horizontal" />
        </UFormField>

        <!-- Offer an existing product of the catalog -->
        <UFormField
          v-if="source === 'existing'"
          :label="t('allies.portal.fields.product')"
          name="productUuid"
          :help="t('allies.portal.productHelp')"
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
            :placeholder="t('allies.portal.productSearchPlaceholder')"
            :search-input="{ placeholder: t('allies.portal.productSearchPlaceholder'), icon: 'i-lucide-search' }"
            class="w-full"
          />
        </UFormField>

        <!-- New item, exclusive to this ally -->
        <template v-else>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField :label="t('allies.portal.fields.type')" name="productType" required>
              <USelectMenu
                v-model="state.productType"
                :items="typeOptions"
                label-key="label"
                value-key="value"
                :search-input="false"
                class="w-full"
              />
            </UFormField>
            <UFormField :label="t('allies.portal.fields.category')" name="productCategoryUuid" required>
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

          <UFormField :label="t('allies.portal.fields.name')" name="name" required>
            <UInput v-model="state.name" :placeholder="t('allies.portal.namePlaceholder')" class="w-full" />
          </UFormField>

          <UFormField :label="t('allies.portal.fields.description')" name="description">
            <UTextarea v-model="state.description" :rows="2" class="w-full" />
          </UFormField>

          <UFormField :label="t('allies.portal.fields.requiresAppointment')" name="requiresAppointment">
            <USwitch v-model="state.requiresAppointment" />
          </UFormField>
        </template>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('allies.portal.fields.price')" name="priceAmount">
            <UInput v-model="state.priceAmount" placeholder="100.00" class="w-full" />
          </UFormField>
        </div>
        <OfferDiscountFields
          v-model:type="state.discountType"
          v-model:pct="state.discountPct"
          v-model:amount="state.discountAmount"
          :price="state.priceAmount"
          :percent-label="t('allies.portal.fields.discount')"
        />

        <UFormField :label="t('allies.portal.fields.exclusions')" name="exclusions" :help="t('allies.products.form.exclusionsHelp')">
          <UTextarea
            v-model="state.exclusions"
            :rows="2"
            :placeholder="t('allies.products.form.exclusionsPlaceholder')"
            class="w-full"
          />
        </UFormField>

        <div class="flex items-center justify-between gap-3 pt-2">
          <p class="text-xs text-prohealth-500">{{ t('common.requiredFieldsHint') }}</p>
          <UButton type="submit" color="primary" :loading="isSubmitting" icon="i-lucide-send">
            {{ t('allies.portal.submit') }}
          </UButton>
        </div>
      </UForm>
    </div>

    <!-- Help -->
    <div class="rounded-2xl border border-cyan-200 bg-cyan-50/60 p-5 text-sm text-prohealth-800 space-y-2">
      <p class="font-semibold flex items-center gap-2">
        <UIcon name="i-lucide-info" class="w-4 h-4 text-cyan-600" />
        {{ t('allies.portal.help.title') }}
      </p>
      <ol class="list-decimal list-inside space-y-1 text-prohealth-700">
        <li>{{ t('allies.portal.help.step1') }}</li>
        <li>{{ t('allies.portal.help.step2') }}</li>
        <li>{{ t('allies.portal.help.step3pre') }}<NuxtLink :to="publicPath('/aliados')" class="text-cyan-700 hover:underline">{{ t('allies.portal.help.step3link') }}</NuxtLink>{{ t('allies.portal.help.step3post') }}</li>
      </ol>
    </div>
  </div>
</template>
