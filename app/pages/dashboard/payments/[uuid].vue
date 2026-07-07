<script setup lang="ts">
import type { ApiError } from '~/types/auth'
import type { PaymentDto } from '~/types/payments'
import {
  paymentMethodLabel,
  paymentStatusColor,
  paymentStatusLabel,
} from '~/types/payments'

definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'PAYMENT_VIEW_ALL',
})

useSeoMeta({ title: 'Detalle de pago — OptiBienestar 360' })

const route = useRoute()
const paymentUuid = route.params.uuid as string

const payments = usePayments()
const { can } = usePermissions()

const canApprove = computed(() => can('PAYMENT_APPROVE'))
const canReject = computed(() => can('PAYMENT_REJECT'))

// ---- Payment load ----
const payment = ref<PaymentDto | null>(null)
const loading = ref(true)
const notFound = ref(false)

async function loadPayment() {
  loading.value = true
  try {
    payment.value = await payments.get(paymentUuid)
  }
  catch (err) {
    if ((err as ApiError).status === 404) notFound.value = true
    payment.value = null
  }
  finally {
    loading.value = false
  }
}

onMounted(loadPayment)

const isPending = computed(() => payment.value?.status === 'PENDING')

// ---- Presentation helpers ----
function formatMoney(v?: number | string | null, currency?: string | null): string {
  if (v === null || v === undefined || v === '') return '—'
  return `${Number(v).toFixed(2)} ${currency ?? ''}`.trim()
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es', { dateStyle: 'medium' })
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' })
}

function formatPeriod(iso?: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es', { month: 'long', year: 'numeric' })
}

function formatSize(bytes?: number | null): string {
  if (bytes === null || bytes === undefined) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ---- View proof (presigned URL) ----
const loadingSupport = ref(false)

async function viewSupport() {
  if (!payment.value) return
  loadingSupport.value = true
  try {
    const res = await payments.supportUrl(payment.value.uuid)
    // Opens in a new tab; useApi already notifies 404/422 (no proof / R2 off).
    window.open(res.url, '_blank', 'noopener')
  }
  catch {
    // toast via useApi
  }
  finally {
    loadingSupport.value = false
  }
}

// ---- Review (approve/reject) ----
const reviewOpen = ref(false)
const reviewAction = ref<'approve' | 'reject'>('approve')

function openReview(action: 'approve' | 'reject') {
  reviewAction.value = action
  reviewOpen.value = true
}

function onReviewed(updated: PaymentDto) {
  payment.value = updated
}
</script>

<template>
  <div class="space-y-5">
    <!-- Back -->
    <UButton
      color="neutral"
      variant="ghost"
      icon="i-lucide-arrow-left"
      to="/dashboard/payments"
      size="sm"
    >
      Pagos
    </UButton>

    <!-- Loading -->
    <div v-if="loading" class="bg-white rounded-2xl border border-prohealth-100 p-6 space-y-3">
      <USkeleton class="h-7 w-64 rounded" />
      <USkeleton class="h-4 w-40 rounded" />
      <USkeleton class="h-4 w-full max-w-lg rounded" />
    </div>

    <!-- Not found -->
    <div v-else-if="notFound || !payment" class="bg-white rounded-2xl border border-prohealth-100 p-12 text-center">
      <UIcon name="i-lucide-search-x" class="w-10 h-10 mx-auto mb-3 text-prohealth-300" />
      <p class="text-prohealth-700 font-semibold">Pago no encontrado</p>
      <p class="text-sm text-prohealth-500 mt-1">El registro no existe o fue eliminado.</p>
    </div>

    <template v-else>
      <!-- Header + actions -->
      <div class="bg-white rounded-2xl border border-prohealth-100 p-6">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div class="flex items-center gap-3 flex-wrap">
              <h1 class="text-2xl font-extrabold text-prohealth-900">
                {{ formatMoney(payment.amount, payment.currency) }}
              </h1>
              <UBadge :color="paymentStatusColor(payment.status)" variant="subtle">
                {{ paymentStatusLabel(payment.status) }}
              </UBadge>
              <UBadge v-if="payment.inscription" color="primary" variant="subtle">Inscripción</UBadge>
            </div>
            <p class="text-sm text-prohealth-500 mt-1">
              {{ paymentMethodLabel(payment.paymentMethod) }} · {{ formatDate(payment.paymentDate) }}
            </p>
          </div>

          <div v-if="isPending" class="flex items-center gap-2">
            <UTooltip :text="canReject ? 'Rechazar pago' : 'No tienes permiso para rechazar'">
              <UButton
                color="error"
                variant="soft"
                icon="i-lucide-x"
                :disabled="!canReject"
                @click="openReview('reject')"
              >
                Rechazar
              </UButton>
            </UTooltip>
            <UTooltip :text="canApprove ? 'Aprobar pago' : 'No tienes permiso para aprobar'">
              <UButton
                color="success"
                icon="i-lucide-check"
                :disabled="!canApprove"
                @click="openReview('approve')"
              >
                Aprobar
              </UButton>
            </UTooltip>
          </div>
        </div>
      </div>

      <!-- Payment detail -->
      <div class="bg-white rounded-2xl border border-prohealth-100 p-6">
        <h2 class="font-bold text-prohealth-900 mb-4">Detalle del pago</h2>
        <dl class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 text-sm">
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">Monto</dt>
            <dd class="text-prohealth-900 text-lg font-semibold mt-0.5">{{ formatMoney(payment.amount, payment.currency) }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">Método</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ paymentMethodLabel(payment.paymentMethod) }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">Referencia</dt>
            <dd class="text-prohealth-800 mt-0.5 font-mono">{{ payment.referenceNumber || '—' }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">Fecha del pago</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ formatDate(payment.paymentDate) }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">Recibido</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ formatDateTime(payment.receivedAt) }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">Asignación</dt>
            <dd class="text-prohealth-800 mt-0.5">
              {{ payment.inscription ? 'Inscripción (cargo único)' : `Mensualidad · ${formatPeriod(payment.appliedPeriod)}` }}
            </dd>
          </div>
        </dl>
      </div>

      <!-- Membership -->
      <div class="bg-white rounded-2xl border border-prohealth-100 p-6">
        <h2 class="font-bold text-prohealth-900 mb-4">Afiliación</h2>
        <dl class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 text-sm">
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">Plan</dt>
            <dd class="text-prohealth-800 mt-0.5 font-mono">{{ payment.planCode || '—' }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">Afiliado</dt>
            <dd class="mt-0.5">
              <NuxtLink :to="`/dashboard/members/${payment.memberUuid}`" class="text-cyan-700 hover:underline font-mono text-xs break-all">
                {{ payment.memberUuid }}
              </NuxtLink>
            </dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">Membresía</dt>
            <dd class="text-prohealth-800 mt-0.5 font-mono text-xs break-all">{{ payment.membershipUuid }}</dd>
          </div>
        </dl>
      </div>

      <!-- Proof of payment -->
      <div class="bg-white rounded-2xl border border-prohealth-100 p-6">
        <h2 class="font-bold text-prohealth-900 mb-4">Comprobante</h2>
        <div v-if="payment.supportFileAvailable" class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <UIcon name="i-lucide-file-text" class="w-8 h-8 text-prohealth-400" />
            <div>
              <p class="text-sm font-medium text-prohealth-800">{{ payment.supportFileName || 'Comprobante' }}</p>
              <p class="text-xs text-prohealth-500">
                {{ payment.supportFileContentType || 'archivo' }}
                <template v-if="payment.supportFileSizeBytes"> · {{ formatSize(payment.supportFileSizeBytes) }}</template>
              </p>
            </div>
          </div>
          <UButton
            color="primary"
            variant="soft"
            icon="i-lucide-external-link"
            :loading="loadingSupport"
            @click="viewSupport"
          >
            Ver comprobante
          </UButton>
        </div>
        <div v-else class="flex items-center gap-2 text-sm text-prohealth-500">
          <UIcon name="i-lucide-file-x" class="w-5 h-5 text-prohealth-300" />
          Sin comprobante adjunto.
        </div>
      </div>

      <!-- Review -->
      <div class="bg-white rounded-2xl border border-prohealth-100 p-6">
        <h2 class="font-bold text-prohealth-900 mb-4">Revisión</h2>
        <dl class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 text-sm">
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">Estado</dt>
            <dd class="mt-0.5">
              <UBadge :color="paymentStatusColor(payment.status)" variant="subtle" size="sm">
                {{ paymentStatusLabel(payment.status) }}
              </UBadge>
            </dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">Revisado</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ formatDateTime(payment.reviewedAt) }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">Revisado por</dt>
            <dd class="text-prohealth-800 mt-0.5 font-mono text-xs break-all">{{ payment.reviewedByUserUuid || '—' }}</dd>
          </div>
          <div class="sm:col-span-2 lg:col-span-3">
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">Motivo / nota</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ payment.reviewReason || '—' }}</dd>
          </div>
        </dl>
      </div>

      <!-- Admin notes -->
      <div v-if="payment.adminNotes" class="bg-white rounded-2xl border border-prohealth-100 p-6">
        <h2 class="font-bold text-prohealth-900 mb-2">Notas administrativas</h2>
        <p class="text-sm text-prohealth-700 whitespace-pre-line">{{ payment.adminNotes }}</p>
      </div>

      <!-- Metadata -->
      <div class="bg-white rounded-2xl border border-prohealth-100 p-6">
        <h2 class="font-bold text-prohealth-900 mb-4">Metadatos</h2>
        <dl class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 text-sm">
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">Creado</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ formatDateTime(payment.createdAt) }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">Última actualización</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ formatDateTime(payment.updatedAt) }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">UUID</dt>
            <dd class="text-prohealth-800 mt-0.5 font-mono text-xs break-all">{{ payment.uuid }}</dd>
          </div>
        </dl>
      </div>
    </template>

    <!-- Approve/reject modal -->
    <PaymentReviewModal
      v-model:open="reviewOpen"
      :action="reviewAction"
      :payment="payment"
      @reviewed="onReviewed"
    />
  </div>
</template>
