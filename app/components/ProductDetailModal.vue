<script setup lang="ts">
import type { AllyProductDto } from '~/types/allies'
import type { ProductDto } from '~/types/products'

// Read view of one catalog product (hub ADR 0026): its data, the catalog image
// (upload private → publish), and the tab "Aliados que lo ofrecen" built from
// GET /v1/admin/products/{uuid}/offers (every ally offering it, any review state).
const props = defineProps<{
  open: boolean
  productUuid: string | null
}>()

const emit = defineEmits<{
  'update:open': [boolean]
  /** The image changed — the list should reload to refresh its thumbnail. */
  'changed': []
  'edit-requested': [string]
}>()

const { t } = useI18n()
const { formatCurrency } = useFormatters()
const productsApi = useProducts()
const { can } = usePermissions()
const toast = useToast()

const isOpen = computed({
  get: () => props.open,
  set: v => emit('update:open', v),
})

const canUpdate = computed(() => can('PRODUCT_UPDATE'))
const canUploadImage = computed(() => can('PRODUCT_IMAGE_UPLOAD'))
const canDeleteImage = computed(() => can('PRODUCT_IMAGE_DELETE'))
const canViewOffers = computed(() => can('ALLY_PRODUCT_VIEW_ALL'))
const canViewAllies = computed(() => can('ALLY_VIEW_ALL'))

const product = ref<ProductDto | null>(null)
const loading = ref(false)
const activeTab = ref('info')
const tabs = computed(() => [
  { label: t('products.detail.tabs.info'), value: 'info', icon: 'i-lucide-info' },
  ...(canViewOffers.value
    ? [{ label: t('products.detail.tabs.offers'), value: 'offers', icon: 'i-lucide-handshake' }]
    : []),
])

async function loadProduct() {
  if (!props.productUuid) return
  loading.value = true
  try {
    product.value = await productsApi.get(props.productUuid)
  }
  catch {
    isOpen.value = false
  }
  finally {
    loading.value = false
  }
}

// ---- Offers ----
const offers = ref<AllyProductDto[]>([])
const offersLoading = ref(false)

async function loadOffers() {
  if (!props.productUuid || !canViewOffers.value) return
  offersLoading.value = true
  try {
    const res = await productsApi.listOffers(props.productUuid, { size: 100 })
    offers.value = res.content ?? []
  }
  catch {
    offers.value = []
  }
  finally {
    offersLoading.value = false
  }
}

// The offering ally travels as the ADR 0014 pair `ally_Uuid` + `ally_Display`.
function allyLabel(o: AllyProductDto): string {
  return o.ally_Display || t('products.offers.ally')
}
function allyUuidOf(o: AllyProductDto): string | null | undefined {
  return o.ally_Uuid ?? o.allyUuid
}

watch(() => props.open, (open) => {
  if (!open) return
  product.value = null
  offers.value = []
  activeTab.value = 'info'
  loadProduct()
  loadOffers()
})

function money(v?: number | string | null): string {
  if (v === null || v === undefined || v === '') return t('common.empty')
  return formatCurrency(Number(v), 'USD')
}

function reviewStatusLabel(o: AllyProductDto): string {
  if (o.reviewStatus_Display) return o.reviewStatus_Display
  return o.reviewStatus ? t(`allies.products.reviewStatus.${o.reviewStatus}`, String(o.reviewStatus)) : t('common.empty')
}

function reviewStatusColor(s?: string): 'success' | 'warning' | 'error' | 'info' | 'neutral' {
  if (s === 'APPROVED') return 'success'
  if (s === 'PROPOSED') return 'warning'
  if (s === 'IN_REVIEW') return 'info'
  if (s === 'REJECTED') return 'error'
  return 'neutral'
}

// ---- Catalog image ----
const fileInput = ref<HTMLInputElement | null>(null)
const imageBusy = ref(false)

async function runImageAction(action: () => Promise<unknown>, toastKey: string) {
  if (!props.productUuid) return
  imageBusy.value = true
  try {
    await action()
    toast.add({ title: t(toastKey), color: 'success', icon: 'i-lucide-check-circle' })
    await loadProduct()
    emit('changed')
  }
  catch {
    // toast handled by useApi (e.g. 404/422 when there is no image yet)
  }
  finally {
    imageBusy.value = false
  }
}

async function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || !props.productUuid) return
  const uuid = props.productUuid
  await runImageAction(() => productsApi.uploadImage(uuid, file), 'products.image.uploadedToast')
}

function publishImage() {
  const uuid = props.productUuid
  if (uuid) runImageAction(() => productsApi.publishImage(uuid), 'products.image.publishedToast')
}
function unpublishImage() {
  const uuid = props.productUuid
  if (uuid) runImageAction(() => productsApi.unpublishImage(uuid), 'products.image.unpublishedToast')
}
function deleteImage() {
  const uuid = props.productUuid
  if (uuid) runImageAction(() => productsApi.deleteImage(uuid), 'products.image.deletedToast')
}

function requestEdit() {
  if (!props.productUuid) return
  const uuid = props.productUuid
  isOpen.value = false
  emit('edit-requested', uuid)
}
</script>

<template>
  <UModal
    v-model:open="isOpen"
    :title="product?.name ?? t('products.detail.title')"
    :description="product?.code ?? undefined"
    :ui="{ content: 'max-w-4xl' }"
  >
    <template #body>
      <div v-if="loading && !product" class="py-10 flex justify-center">
        <UIcon name="i-lucide-loader-circle" class="w-6 h-6 animate-spin text-prohealth-400" />
      </div>
      <div v-else-if="product" class="space-y-4">
        <UTabs v-model="activeTab" :items="tabs" :content="false" />

        <!-- Data + image -->
        <div v-show="activeTab === 'info'" class="grid grid-cols-1 md:grid-cols-3 gap-5">
          <dl class="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt class="text-xs text-prohealth-500">{{ t('products.columns.type') }}</dt>
              <dd class="text-prohealth-900">{{ product.productType_Display ?? t(`products.types.${product.productType}`, String(product.productType)) }}</dd>
            </div>
            <div>
              <dt class="text-xs text-prohealth-500">{{ t('products.columns.category') }}</dt>
              <dd class="text-prohealth-900">{{ product.productCategory_Display ?? t('common.empty') }}</dd>
            </div>
            <div>
              <dt class="text-xs text-prohealth-500">{{ t('products.columns.scope') }}</dt>
              <dd class="text-prohealth-900">
                <template v-if="product.exclusive">
                  {{ t('products.scope.exclusiveOf', { ally: product.ownerAlly_Display ?? t('common.empty') }) }}
                </template>
                <template v-else>{{ t('products.scope.general') }}</template>
              </dd>
            </div>
            <div>
              <dt class="text-xs text-prohealth-500">{{ t('products.columns.appointment') }}</dt>
              <dd class="text-prohealth-900">{{ product.requiresAppointment ? t('common.yes') : t('common.no') }}</dd>
            </div>
            <div>
              <dt class="text-xs text-prohealth-500">{{ t('products.columns.published') }}</dt>
              <dd class="text-prohealth-900">{{ product.published_Display ?? (product.published ? t('common.yes') : t('common.no')) }}</dd>
            </div>
            <div>
              <dt class="text-xs text-prohealth-500">{{ t('products.columns.status') }}</dt>
              <dd class="text-prohealth-900">{{ product.active ? t('products.active') : t('products.inactive') }}</dd>
            </div>
            <div>
              <dt class="text-xs text-prohealth-500">{{ t('products.detail.createdAt') }}</dt>
              <dd class="text-prohealth-900">{{ product.createdAt_Display ?? t('common.empty') }}</dd>
            </div>
            <div class="sm:col-span-2">
              <dt class="text-xs text-prohealth-500">{{ t('products.form.fields.description') }}</dt>
              <dd class="text-prohealth-900 whitespace-pre-line">{{ product.description || t('common.empty') }}</dd>
            </div>
          </dl>

          <div class="space-y-3">
            <p class="text-xs font-semibold uppercase tracking-wide text-prohealth-400">{{ t('products.image.title') }}</p>
            <div class="aspect-square rounded-xl border border-prohealth-100 bg-prohealth-50/40 flex items-center justify-center overflow-hidden">
              <img v-if="product.imageUrl" :src="product.imageUrl" :alt="product.name" class="w-full h-full object-cover">
              <div v-else class="text-center text-xs text-prohealth-400 px-4">
                <UIcon name="i-lucide-image-off" class="w-8 h-8 mx-auto mb-1" />
                {{ t('products.image.none') }}
              </div>
            </div>
            <p class="text-xs text-prohealth-500">{{ t('products.image.hint') }}</p>
            <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="onFileSelected">
            <div class="flex flex-wrap gap-2">
              <UButton
                size="xs"
                color="primary"
                variant="soft"
                icon="i-lucide-upload"
                :disabled="!canUploadImage"
                :loading="imageBusy"
                @click="fileInput?.click()"
              >
                {{ t('products.image.upload') }}
              </UButton>
              <UButton
                v-if="!product.imageUrl"
                size="xs"
                color="success"
                variant="soft"
                icon="i-lucide-eye"
                :disabled="!canUploadImage || imageBusy"
                @click="publishImage"
              >
                {{ t('products.image.publish') }}
              </UButton>
              <UButton
                v-else
                size="xs"
                color="neutral"
                variant="soft"
                icon="i-lucide-eye-off"
                :disabled="!canUploadImage || imageBusy"
                @click="unpublishImage"
              >
                {{ t('products.image.unpublish') }}
              </UButton>
              <UButton
                size="xs"
                color="error"
                variant="ghost"
                icon="i-lucide-trash-2"
                :disabled="!canDeleteImage || imageBusy"
                @click="deleteImage"
              >
                {{ t('products.image.delete') }}
              </UButton>
            </div>
          </div>
        </div>

        <!-- Allies that offer it -->
        <div v-if="canViewOffers" v-show="activeTab === 'offers'" class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
                <th class="px-4 py-2 font-semibold">{{ t('products.offers.columns.ally') }}</th>
                <th class="px-4 py-2 font-semibold">{{ t('products.offers.columns.price') }}</th>
                <th class="px-4 py-2 font-semibold">{{ t('products.offers.columns.discount') }}</th>
                <th class="px-4 py-2 font-semibold">{{ t('products.offers.columns.finalPrice') }}</th>
                <th class="px-4 py-2 font-semibold">{{ t('products.offers.columns.review') }}</th>
                <th class="px-4 py-2 font-semibold">{{ t('products.offers.columns.published') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-prohealth-100">
              <TableSkeleton v-if="offersLoading" :rows="3" :cols="6" />
              <tr v-else-if="offers.length === 0">
                <td colspan="6" class="px-4 py-8 text-center text-prohealth-500">
                  <UIcon name="i-lucide-handshake" class="w-7 h-7 mx-auto mb-2 text-prohealth-300" />
                  {{ t('products.offers.empty') }}
                </td>
              </tr>
              <tr v-for="o in offers" v-else :key="o.uuid" class="hover:bg-prohealth-50/50">
                <td class="px-4 py-2">
                  <NuxtLink
                    v-if="allyUuidOf(o) && canViewAllies"
                    :to="`/dashboard/allies/${allyUuidOf(o)}`"
                    class="font-semibold text-cyan-700 hover:underline"
                    @click="isOpen = false"
                  >
                    {{ allyLabel(o) }}
                  </NuxtLink>
                  <span v-else class="text-prohealth-700">{{ allyLabel(o) }}</span>
                </td>
                <td class="px-4 py-2 text-prohealth-700">{{ money(o.priceAmount) }}</td>
                <td class="px-4 py-2 text-prohealth-700">{{ o.discountPct != null && o.discountPct !== '' ? `${o.discountPct}%` : t('common.empty') }}</td>
                <td class="px-4 py-2 font-semibold text-prohealth-900">{{ money(o.finalPrice) }}</td>
                <td class="px-4 py-2">
                  <UBadge :color="reviewStatusColor(o.reviewStatus)" variant="subtle" size="sm" :title="o.reviewReason || undefined">
                    {{ reviewStatusLabel(o) }}
                  </UBadge>
                </td>
                <td class="px-4 py-2">
                  <UBadge :color="o.published ? 'success' : 'neutral'" variant="subtle" size="sm">
                    {{ o.published_Display ?? (o.published ? t('common.yes') : t('common.no')) }}
                  </UBadge>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="w-full flex items-center justify-end gap-3">
        <UButton color="neutral" variant="ghost" @click="isOpen = false">
          {{ t('common.close') }}
        </UButton>
        <UTooltip :text="canUpdate ? t('common.edit') : t('products.noPermission')">
          <UButton color="primary" icon="i-lucide-pencil" :disabled="!canUpdate || !product" @click="requestEdit">
            {{ t('common.edit') }}
          </UButton>
        </UTooltip>
      </div>
    </template>
  </UModal>
</template>
