<script setup lang="ts">
import type { ApiError } from '~/types/auth'
import {
  MEDIA_ACCEPT,
  MEDIA_MAX_FILE_MB,
  MEDIA_MAX_ITEMS,
  type MediaItemDto,
} from '~/types/media'

// Reusable image gallery editor (hub ADR 0027) for any owner (ally, product,
// ally offer; admin or partner portal): ordered grid, primary star, upload,
// external https URL, inline caption, delete with confirm. Uploads are
// published immediately. Backend 403/422 messages are shown inline and as a toast.
const props = withDefaults(defineProps<{
  /** Owner route, e.g. `/v1/admin/products/{uuid}/media`. */
  base: string
  canRead?: boolean
  canUpload?: boolean
  canUpdate?: boolean
  canDelete?: boolean
  /** Forces every write off (e.g. a VIEWER member of the ally). */
  readonly?: boolean
  /** Extra hint under the title (e.g. offers fall back to the product's images). */
  emptyHint?: string
}>(), {
  canRead: true,
  canUpload: true,
  canUpdate: true,
  canDelete: true,
  readonly: false,
  emptyHint: undefined,
})

const emit = defineEmits<{
  /** The gallery changed (upload, URL, primary, order, delete). */
  changed: [MediaItemDto[]]
}>()

const { t } = useI18n()
const media = useMedia()
const toast = useToast()

const uploadAllowed = computed(() => props.canUpload && !props.readonly)
const updateAllowed = computed(() => props.canUpdate && !props.readonly)
const deleteAllowed = computed(() => props.canDelete && !props.readonly)

const items = ref<MediaItemDto[]>([])
const loading = ref(false)
const busy = ref(false)
const errorMessage = ref('')

const atLimit = computed(() => items.value.length >= MEDIA_MAX_ITEMS)

function sorted(list: MediaItemDto[]): MediaItemDto[] {
  return [...list].sort((a, b) => a.sortOrder - b.sortOrder)
}

function fail(err: unknown) {
  const message = (err as ApiError)?.message || t('errors.unexpected')
  errorMessage.value = message
  toast.add({ title: message, color: 'error', icon: 'i-lucide-circle-alert' })
}

async function load() {
  if (!props.base || !props.canRead) {
    items.value = []
    return
  }
  loading.value = true
  errorMessage.value = ''
  try {
    items.value = sorted(await media.list(props.base))
  }
  catch (err) {
    items.value = []
    fail(err)
  }
  finally {
    loading.value = false
  }
}

watch(() => [props.base, props.canRead], load, { immediate: true })

/** Runs a write, then reloads the list from the response or the server. */
async function run(action: () => Promise<unknown>, successKey?: string, reload = true) {
  busy.value = true
  errorMessage.value = ''
  try {
    await action()
    if (successKey) toast.add({ title: t(successKey), color: 'success', icon: 'i-lucide-check-circle' })
    if (reload) await load()
    emit('changed', items.value)
    return true
  }
  catch (err) {
    fail(err)
    return false
  }
  finally {
    busy.value = false
  }
}

// ---- Upload ----
const fileInput = ref<HTMLInputElement | null>(null)

async function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!file.type.startsWith('image/')) {
    errorMessage.value = t('media.errors.notImage')
    return
  }
  if (file.size > MEDIA_MAX_FILE_MB * 1024 * 1024) {
    errorMessage.value = t('media.errors.tooLarge', { mb: MEDIA_MAX_FILE_MB })
    return
  }
  await run(() => media.upload(props.base, file), 'media.uploadedToast')
}

// ---- External URL ----
const urlOpen = ref(false)
const urlValue = ref('')
const urlCaption = ref('')
const urlError = computed(() => {
  const v = urlValue.value.trim()
  if (!v) return ''
  return /^https:\/\/\S+$/i.test(v) ? '' : t('media.errors.httpsOnly')
})

function openUrlForm() {
  urlValue.value = ''
  urlCaption.value = ''
  urlOpen.value = true
}

async function submitUrl() {
  const url = urlValue.value.trim()
  if (!url || urlError.value) return
  const ok = await run(
    () => media.addUrl(props.base, { url, ...(urlCaption.value.trim() ? { caption: urlCaption.value.trim() } : {}) }),
    'media.urlAddedToast',
  )
  if (ok) urlOpen.value = false
}

// ---- Primary / caption ----
function makePrimary(item: MediaItemDto) {
  if (item.primary) return
  run(() => media.update(props.base, item.uuid, { primary: true }), 'media.primaryToast')
}

const editingUuid = ref<string | null>(null)
const captionDraft = ref('')

function startCaption(item: MediaItemDto) {
  editingUuid.value = item.uuid
  captionDraft.value = item.caption ?? ''
}

async function saveCaption(item: MediaItemDto) {
  const caption = captionDraft.value.trim()
  editingUuid.value = null
  if (caption === (item.caption ?? '')) return
  await run(() => media.update(props.base, item.uuid, { caption }), 'media.captionSavedToast')
}

// ---- Order (arrows + drag and drop) ----
async function applyOrder(next: MediaItemDto[]) {
  const previous = items.value
  items.value = next // optimistic
  const ok = await run(async () => {
    items.value = sorted(await media.reorder(props.base, next.map(i => i.uuid)))
  }, undefined, false)
  if (!ok) items.value = previous
}

function move(index: number, delta: -1 | 1) {
  const target = index + delta
  if (target < 0 || target >= items.value.length) return
  const next = [...items.value]
  const [moved] = next.splice(index, 1)
  next.splice(target, 0, moved!)
  applyOrder(next)
}

const dragIndex = ref<number | null>(null)
const overIndex = ref<number | null>(null)

function onDragStart(index: number, event: DragEvent) {
  if (!updateAllowed.value) return
  dragIndex.value = index
  event.dataTransfer?.setData('text/plain', String(index))
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

function onDrop(index: number) {
  const from = dragIndex.value
  dragIndex.value = null
  overIndex.value = null
  if (from === null || from === index) return
  const next = [...items.value]
  const [moved] = next.splice(from, 1)
  next.splice(index, 0, moved!)
  applyOrder(next)
}

// ---- Delete ----
const deleteTarget = ref<MediaItemDto | null>(null)
const deleteOpen = computed({
  get: () => deleteTarget.value !== null,
  set: (v) => { if (!v) deleteTarget.value = null },
})

async function confirmDelete() {
  const target = deleteTarget.value
  if (!target) return
  const ok = await run(() => media.remove(props.base, target.uuid), 'media.deletedToast')
  if (ok) deleteTarget.value = null
}

defineExpose({ reload: load })
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <p class="text-xs font-semibold uppercase tracking-wide text-prohealth-400">
        {{ t('media.title') }}
        <span class="ml-1 normal-case font-medium text-prohealth-500" data-testid="media-count">
          {{ t('media.count', { n: items.length, max: MEDIA_MAX_ITEMS }) }}
        </span>
      </p>
      <div v-if="uploadAllowed" class="flex flex-wrap gap-2">
        <input ref="fileInput" type="file" :accept="MEDIA_ACCEPT" class="hidden" @change="onFileSelected">
        <UButton
          size="xs"
          color="primary"
          variant="soft"
          icon="i-lucide-upload"
          :disabled="atLimit || busy"
          :loading="busy"
          @click="fileInput?.click()"
        >
          {{ t('media.upload') }}
        </UButton>
        <UButton
          size="xs"
          color="neutral"
          variant="soft"
          icon="i-lucide-link"
          :disabled="atLimit || busy"
          @click="openUrlForm"
        >
          {{ t('media.addUrl') }}
        </UButton>
      </div>
    </div>

    <p v-if="uploadAllowed" class="text-xs text-prohealth-500">
      {{ t('media.hint', { mb: MEDIA_MAX_FILE_MB }) }}
      <span v-if="atLimit" class="text-amber-700 font-medium"> {{ t('media.limitReached', { max: MEDIA_MAX_ITEMS }) }}</span>
    </p>
    <p v-else-if="props.readonly || !props.canUpload" class="text-xs text-prohealth-500">{{ t('media.readonlyHint') }}</p>

    <UAlert
      v-if="errorMessage"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      :title="errorMessage"
      close
      @update:open="(v: boolean) => { if (!v) errorMessage = '' }"
    />

    <div v-if="!canRead" class="rounded-xl border border-dashed border-prohealth-200 py-6 text-center text-xs text-prohealth-400">
      {{ t('media.noReadPermission') }}
    </div>

    <div v-else-if="loading && items.length === 0" class="py-8 flex justify-center">
      <UIcon name="i-lucide-loader-circle" class="w-6 h-6 animate-spin text-prohealth-400" />
    </div>

    <div v-else-if="items.length === 0" class="rounded-xl border border-dashed border-prohealth-200 py-8 text-center text-xs text-prohealth-400 px-4">
      <UIcon name="i-lucide-image-off" class="w-8 h-8 mx-auto mb-1" />
      {{ t('media.empty') }}
      <p v-if="emptyHint" class="mt-1 text-prohealth-500">{{ emptyHint }}</p>
    </div>

    <ul v-else class="grid grid-cols-2 sm:grid-cols-3 gap-3">
      <li
        v-for="(item, index) in items"
        :key="item.uuid"
        class="rounded-xl border bg-white overflow-hidden flex flex-col"
        :class="[
          item.primary ? 'border-lime-300 ring-1 ring-lime-200' : 'border-prohealth-100',
          overIndex === index && dragIndex !== null ? 'outline outline-2 outline-cyan-400' : '',
        ]"
        :draggable="updateAllowed"
        @dragstart="onDragStart(index, $event)"
        @dragover.prevent="overIndex = index"
        @dragleave="overIndex = null"
        @drop.prevent="onDrop(index)"
        @dragend="dragIndex = null; overIndex = null"
      >
        <div class="relative aspect-square bg-prohealth-50/40">
          <img :src="item.url" :alt="item.caption || item.fileName || ''" class="w-full h-full object-cover" loading="lazy">
          <UBadge v-if="item.primary" color="success" variant="solid" size="sm" class="absolute top-2 left-2">
            {{ t('media.primary') }}
          </UBadge>
          <UBadge color="neutral" variant="subtle" size="sm" class="absolute top-2 right-2">
            {{ t(`media.source.${item.source}`) }}
          </UBadge>
        </div>

        <div class="p-2 space-y-2 flex-1 flex flex-col">
          <div v-if="editingUuid === item.uuid" class="flex gap-1">
            <UInput
              v-model="captionDraft"
              size="xs"
              :placeholder="t('media.captionPlaceholder')"
              class="flex-1"
              autofocus
              @keydown.enter.prevent="saveCaption(item)"
              @keydown.esc="editingUuid = null"
            />
            <UButton size="xs" color="primary" variant="soft" icon="i-lucide-check" :aria-label="t('common.save')" @click="saveCaption(item)" />
          </div>
          <button
            v-else
            type="button"
            class="text-left text-xs min-h-5 truncate"
            :class="[item.caption ? 'text-prohealth-800' : 'text-prohealth-400 italic', updateAllowed ? 'hover:underline' : 'cursor-default']"
            :disabled="!updateAllowed"
            :title="updateAllowed ? t('media.editCaption') : undefined"
            @click="startCaption(item)"
          >
            {{ item.caption || t('media.noCaption') }}
          </button>

          <div class="mt-auto flex items-center justify-between gap-1">
            <div class="flex items-center">
              <UTooltip :text="item.primary ? t('media.primary') : t('media.makePrimary')">
                <UButton
                  size="xs"
                  color="warning"
                  variant="ghost"
                  icon="i-lucide-star"
                  :class="item.primary ? 'text-amber-500' : 'text-prohealth-300'"
                  :disabled="!updateAllowed || busy || item.primary"
                  :aria-label="t('media.makePrimary')"
                  @click="makePrimary(item)"
                />
              </UTooltip>
              <UButton
                size="xs"
                color="neutral"
                variant="ghost"
                icon="i-lucide-arrow-left"
                :disabled="!updateAllowed || busy || index === 0"
                :aria-label="t('media.moveEarlier')"
                @click="move(index, -1)"
              />
              <UButton
                size="xs"
                color="neutral"
                variant="ghost"
                icon="i-lucide-arrow-right"
                :disabled="!updateAllowed || busy || index === items.length - 1"
                :aria-label="t('media.moveLater')"
                @click="move(index, 1)"
              />
            </div>
            <UButton
              v-if="deleteAllowed"
              size="xs"
              color="error"
              variant="ghost"
              icon="i-lucide-trash-2"
              :disabled="busy"
              :aria-label="t('common.delete')"
              @click="deleteTarget = item"
            />
          </div>
        </div>
      </li>
    </ul>

    <!-- External URL -->
    <UModal v-model:open="urlOpen" :title="t('media.urlModal.title')" :description="t('media.urlModal.description')">
      <template #body>
        <div class="space-y-4">
          <UFormField :label="t('media.urlModal.url')" :error="urlError || undefined" required>
            <UInput v-model="urlValue" placeholder="https://" icon="i-lucide-link" class="w-full" @keydown.enter.prevent="submitUrl" />
          </UFormField>
          <UFormField :label="t('media.urlModal.caption')">
            <UInput v-model="urlCaption" :placeholder="t('media.captionPlaceholder')" class="w-full" />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="w-full flex items-center justify-end gap-3">
          <UButton color="neutral" variant="ghost" :disabled="busy" @click="urlOpen = false">
            {{ t('common.cancel') }}
          </UButton>
          <UButton color="primary" icon="i-lucide-plus" :loading="busy" :disabled="!urlValue.trim() || !!urlError" @click="submitUrl">
            {{ t('media.urlModal.submit') }}
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Delete confirmation -->
    <UModal v-model:open="deleteOpen" :title="t('media.delete.title')">
      <template #body>
        <p class="text-sm text-prohealth-700">{{ t('media.delete.confirm') }}</p>
        <p v-if="deleteTarget?.primary && items.length > 1" class="text-xs text-prohealth-500 mt-2">
          {{ t('media.delete.primaryNote') }}
        </p>
      </template>
      <template #footer>
        <div class="w-full flex items-center justify-end gap-3">
          <UButton color="neutral" variant="ghost" :disabled="busy" @click="deleteTarget = null">
            {{ t('common.cancel') }}
          </UButton>
          <UButton color="error" icon="i-lucide-trash-2" :loading="busy" @click="confirmDelete">
            {{ t('common.delete') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
