<script setup lang="ts">
import type { PaymentDto, PaymentStatus } from '~/types/payments'
import {
  PAYMENT_STATUS_OPTIONS,
  paymentMethodLabel,
  paymentStatusColor,
  paymentStatusLabel,
} from '~/types/payments'

definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'PAYMENT_VIEW_ALL',
})

useSeoMeta({ title: 'Pagos — OptiBienestar 360' })

const payments = usePayments()
const { can } = usePermissions()

const canRegister = computed(() => can('PAYMENT_REGISTER'))
const canApprove = computed(() => can('PAYMENT_APPROVE'))
const canReject = computed(() => can('PAYMENT_REJECT'))

// ---- Listing + filters + pagination ----
const data = ref<PaymentDto[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1) // UPagination is 1-based; the API is 0-based
const size = ref(20)
const search = ref('')
const statusFilter = ref<PaymentStatus | ''>('')

// Status filter options (with "Todos" first).
const statusFilterOptions = [{ label: 'Todos', value: '' }, ...PAYMENT_STATUS_OPTIONS]

function buildFilter(): string | undefined {
  // RSQL: status equality. The queue leverages the (status, received_at DESC) index.
  return statusFilter.value ? `status==${statusFilter.value}` : undefined
}

async function load() {
  loading.value = true
  try {
    const res = await payments.list({
      page: page.value - 1,
      size: size.value,
      sort: 'receivedAt,desc',
      filter: buildFilter(),
      // Free-text over referenceNumber, adminNotes and supportFileName.
      q: search.value.trim() || undefined,
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

watch([page, size], load)
watch(statusFilter, () => {
  page.value = 1
  load()
})
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    load()
  }, 400)
})

onMounted(load)

// ---- Presentation helpers ----
function formatMoney(v?: number | string | null, currency?: string | null): string {
  if (v === null || v === undefined || v === '') return '—'
  return `${Number(v).toFixed(2)} ${currency ?? ''}`.trim()
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es', { dateStyle: 'medium' })
}

// ---- Register (modal) ----
const formOpen = ref(false)

async function onSaved() {
  // A new payment enters as PENDING; reload honoring the current filter.
  page.value = 1
  await load()
}

// ---- Review (approve/reject) ----
const reviewOpen = ref(false)
const reviewAction = ref<'approve' | 'reject'>('approve')
const reviewTarget = ref<PaymentDto | null>(null)

function openReview(p: PaymentDto, action: 'approve' | 'reject') {
  reviewTarget.value = p
  reviewAction.value = action
  reviewOpen.value = true
}

function onReviewed(updated: PaymentDto) {
  // Replace the row in-place to reflect the new status without a full reload.
  const idx = data.value.findIndex(p => p.uuid === updated.uuid)
  if (idx !== -1) data.value[idx] = updated
}

function isPending(p: PaymentDto): boolean {
  return p.status === 'PENDING'
}
</script>

<template>
  <div class="space-y-5">
    <!-- Header -->
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-extrabold text-prohealth-900">Pagos</h1>
        <p class="text-sm text-prohealth-700/70 mt-1">
          Registro y revisión de pagos manuales: aprobación o rechazo con comprobante.
        </p>
      </div>
      <UTooltip :text="canRegister ? 'Registrar un nuevo pago' : 'No tienes permiso para registrar pagos'">
        <UButton
          color="primary"
          icon="i-lucide-plus"
          :disabled="!canRegister"
          @click="formOpen = true"
        >
          Registrar pago
        </UButton>
      </UTooltip>
    </div>

    <!-- Filters -->
    <div class="bg-white rounded-2xl border border-prohealth-100 p-4 flex flex-wrap items-center gap-3">
      <UInput
        v-model="search"
        placeholder="Buscar por referencia o notas…"
        icon="i-lucide-search"
        size="lg"
        class="w-full max-w-md"
      />
      <USelectMenu
        v-model="statusFilter"
        :items="statusFilterOptions"
        label-key="label"
        value-key="value"
        placeholder="Estado"
        icon="i-lucide-filter"
        class="w-44"
      />
    </div>

    <!-- Table -->
    <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
              <th class="px-5 py-3 font-semibold">Plan / Referencia</th>
              <th class="px-5 py-3 font-semibold">Monto</th>
              <th class="px-5 py-3 font-semibold">Método</th>
              <th class="px-5 py-3 font-semibold">Fecha</th>
              <th class="px-5 py-3 font-semibold">Comprobante</th>
              <th class="px-5 py-3 font-semibold">Estado</th>
              <th class="px-5 py-3 font-semibold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-prohealth-100">
            <TableSkeleton v-if="loading" :rows="8" :cols="7" />
            <tr v-else-if="data.length === 0">
              <td colspan="7" class="px-5 py-12 text-center text-prohealth-500">
                <UIcon name="i-lucide-receipt" class="w-8 h-8 mx-auto mb-2 text-prohealth-300" />
                Sin pagos
              </td>
            </tr>
            <tr
              v-for="p in data"
              v-else
              :key="p.uuid"
              class="hover:bg-prohealth-50/50 cursor-pointer"
              @click="navigateTo(`/dashboard/payments/${p.uuid}`)"
            >
              <td class="px-5 py-3">
                <div class="font-semibold text-prohealth-900 font-mono">{{ p.planCode || '—' }}</div>
                <div class="text-xs text-prohealth-500">
                  {{ p.referenceNumber || 'Sin referencia' }}
                  <UBadge v-if="p.inscription" color="primary" variant="subtle" size="sm" class="ml-1">Inscripción</UBadge>
                </div>
              </td>
              <td class="px-5 py-3 font-semibold text-prohealth-900">{{ formatMoney(p.amount, p.currency) }}</td>
              <td class="px-5 py-3 text-prohealth-700">{{ paymentMethodLabel(p.paymentMethod) }}</td>
              <td class="px-5 py-3 text-prohealth-600">{{ formatDate(p.paymentDate) }}</td>
              <td class="px-5 py-3">
                <UIcon
                  v-if="p.supportFileAvailable"
                  name="i-lucide-paperclip"
                  class="w-4 h-4 text-prohealth-500"
                />
                <span v-else class="text-prohealth-300">—</span>
              </td>
              <td class="px-5 py-3">
                <UBadge :color="paymentStatusColor(p.status)" variant="subtle" size="sm">
                  {{ paymentStatusLabel(p.status) }}
                </UBadge>
              </td>
              <td class="px-5 py-3" @click.stop>
                <div class="flex items-center justify-end gap-1">
                  <UTooltip text="Ver detalle">
                    <UButton
                      color="neutral"
                      variant="ghost"
                      icon="i-lucide-eye"
                      size="sm"
                      :to="`/dashboard/payments/${p.uuid}`"
                    />
                  </UTooltip>
                  <template v-if="isPending(p)">
                    <UTooltip :text="canApprove ? 'Aprobar' : 'No tienes permiso para aprobar'">
                      <UButton
                        color="success"
                        variant="ghost"
                        icon="i-lucide-check"
                        size="sm"
                        :disabled="!canApprove"
                        @click="openReview(p, 'approve')"
                      />
                    </UTooltip>
                    <UTooltip :text="canReject ? 'Rechazar' : 'No tienes permiso para rechazar'">
                      <UButton
                        color="error"
                        variant="ghost"
                        icon="i-lucide-x"
                        size="sm"
                        :disabled="!canReject"
                        @click="openReview(p, 'reject')"
                      />
                    </UTooltip>
                  </template>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="flex items-center justify-between px-5 py-3 border-t border-prohealth-100">
        <p class="text-xs text-prohealth-500">
          {{ data.length }} de {{ total }} pago(s)
        </p>
        <UPagination
          v-model:page="page"
          :total="total"
          :items-per-page="size"
        />
      </div>
    </div>

    <!-- Register modal -->
    <PaymentFormModal v-model:open="formOpen" @saved="onSaved" />

    <!-- Approve/reject modal -->
    <PaymentReviewModal
      v-model:open="reviewOpen"
      :action="reviewAction"
      :payment="reviewTarget"
      @reviewed="onReviewed"
    />
  </div>
</template>
