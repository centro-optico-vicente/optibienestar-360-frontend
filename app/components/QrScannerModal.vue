<script setup lang="ts">
import type { IScannerControls } from '@zxing/browser'

// Camera QR scanner for the ally counter. Reads the affiliate's Digital
// Credential QR (it encodes the member UUID, which GET /v1/ally/validate/{value}
// accepts as-is) and emits the decoded text once.
//
// @zxing/browser is plain JavaScript: the nginx CSP (`script-src 'self'`) blocks
// WebAssembly, so wasm-based decoders are not an option. It is imported lazily so
// the validator page doesn't pay for it until the camera is opened.
const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'scanned': [value: string]
}>()

const { t } = useI18n()

const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})

const video = ref<HTMLVideoElement | null>(null)
const starting = ref(false)
const errorKey = ref<string | null>(null)
let controls: IScannerControls | null = null

function stop() {
  controls?.stop()
  controls = null
}

async function start() {
  errorKey.value = null
  if (!navigator.mediaDevices?.getUserMedia) {
    errorKey.value = 'validator.scanner.unsupported'
    return
  }
  starting.value = true
  try {
    await nextTick()
    if (!video.value) return
    const { BrowserQRCodeReader } = await import('@zxing/browser')
    const reader = new BrowserQRCodeReader()
    controls = await reader.decodeFromConstraints(
      { video: { facingMode: { ideal: 'environment' } } },
      video.value,
      (result) => {
        if (!result) return
        const text = result.getText().trim()
        if (!text) return
        stop()
        emit('scanned', text)
        isOpen.value = false
      },
    )
  }
  catch (err) {
    const name = (err as { name?: string })?.name
    errorKey.value = name === 'NotAllowedError' || name === 'SecurityError'
      ? 'validator.scanner.denied'
      : name === 'NotFoundError' || name === 'OverconstrainedError'
        ? 'validator.scanner.noCamera'
        : 'validator.scanner.failed'
  }
  finally {
    starting.value = false
  }
}

watch(() => props.open, (open) => {
  if (open) start()
  else stop()
})

onBeforeUnmount(stop)
</script>

<template>
  <UModal v-model:open="isOpen" :title="t('validator.scanner.title')" :description="t('validator.scanner.description')">
    <template #body>
      <div class="space-y-3">
        <div class="relative aspect-square w-full max-w-sm mx-auto overflow-hidden rounded-2xl bg-prohealth-950">
          <video ref="video" class="w-full h-full object-cover" muted playsinline />
          <div class="pointer-events-none absolute inset-8 rounded-xl border-2 border-white/70" />
          <div v-if="starting" class="absolute inset-0 grid place-items-center text-white text-sm">
            <UIcon name="i-lucide-loader-circle" class="w-6 h-6 animate-spin" />
          </div>
        </div>
        <UAlert
          v-if="errorKey"
          color="warning"
          variant="subtle"
          icon="i-lucide-camera-off"
          :title="t(errorKey)"
          :description="t('validator.scanner.fallback')"
        />
      </div>
    </template>
  </UModal>
</template>
