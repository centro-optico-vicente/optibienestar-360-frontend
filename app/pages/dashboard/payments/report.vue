<script setup lang="ts">
import { PAYMENT_METHOD_OPTIONS, PAYMENT_STATUS_OPTIONS } from '~/types/payments'
import type { PromoterDto } from '~/types/promoters'
import type { PlanDto } from '~/types/plans'

definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: [
    'PAYMENT_REPORT_GENERATE',
    'REPORT_REPORT_GENERATE',
    'PAYMENT_VIEW_ALL',
  ],
})

const { t } = useI18n()
useSeoMeta({ title: () => 'Reporte de Pagos de Afiliados — OptiBienestar 360' })

const documentReports = useDocumentReports()
const promotersApi = usePromoters()
const plansApi = usePlans()
const toast = useToast()
const { can } = usePermissions()
const canViewPromoter = computed(() => can('PROMOTER_VIEW_ALL'))
const canViewPlan = computed(() => can('PLAN_VIEW_ALL'))

const generatingPdf = ref(false)
const generatingXlsx = ref(false)

const promoters = ref<PromoterDto[]>([])
const plans = ref<PlanDto[]>([])
const loadingCatalogs = ref(false)

const defaultCurrencyOptions = [
  { label: 'USD — Dólar Estadounidense ($)', value: 'USD' },
  { label: 'VES — Bolívar Venezolano (Bs.)', value: 'VES' },
  { label: 'EUR — Euro (€)', value: 'EUR' },
]
const currencyOptions = ref(defaultCurrencyOptions)

async function loadCatalogs() {
  loadingCatalogs.value = true
  try {
    const [promotersRes, plansRes] = await Promise.allSettled([
      promotersApi.list({ size: 100, sort: ['displayName,asc'] }),
      plansApi.list({ size: 100, sort: ['name,asc'] }),
    ])
    if (promotersRes.status === 'fulfilled') {
      promoters.value = promotersRes.value.content ?? []
    }
    if (plansRes.status === 'fulfilled') {
      plans.value = plansRes.value.content ?? []
    }
  } catch (err: any) {
    console.error('Error cargando promotores/planes:', err)
  }

  try {
    const curRes = await useApi<Array<{ uuid?: string; code: string; label: string; active?: boolean }>>('/v1/admin/currencies/options')
    if (curRes && curRes.length > 0) {
      currencyOptions.value = curRes
        .filter(c => c.active !== false)
        .map(c => ({
          label: c.label || `${c.code}`,
          value: c.code,
        }))
    }
  } catch {
    // Si no tiene permisos a currencies/options o falla, mantiene defaultCurrencyOptions
  } finally {
    loadingCatalogs.value = false
  }
}

onMounted(loadCatalogs)

const ALL_VALUE = 'ALL'

const promoterOptions = computed(() => [
  { label: 'Todos los promotores', value: ALL_VALUE },
  ...promoters.value.map(p => ({
    label: `${p.displayName} (${p.referralCode || 'Sin código'})`,
    value: p.uuid,
  })),
])

const planOptions = computed(() => [
  { label: 'Todos los planes de cobertura', value: ALL_VALUE },
  ...plans.value.map(pl => ({
    label: `${pl.name} (${pl.code})`,
    value: pl.uuid,
  })),
])

const payFilters = reactive({
  startDate: '',
  endDate: '',
  status: ALL_VALUE,
  paymentMethod: ALL_VALUE,
  plan: ALL_VALUE,
  promoter: ALL_VALUE,
  targetCurrency: 'USD',
})

const payStatusOptions = computed(() => [
  { label: 'Todos los estados', value: ALL_VALUE },
  ...PAYMENT_STATUS_OPTIONS.map(o => ({
    label: t(o.labelKey, o.label),
    value: o.value,
  })),
])

const payMethodOptions = computed(() => [
  { label: 'Todos los métodos de pago', value: ALL_VALUE },
  ...PAYMENT_METHOD_OPTIONS.map(o => ({
    label: t(o.labelKey, o.label),
    value: o.value,
  })),
])

function formatDateIso(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

type DatePreset = 'all' | 'currentYear' | 'previousMonth' | 'currentMonth'

function getDatePresetRange(preset: DatePreset): { startDate: string; endDate: string } {
  if (preset === 'all') {
    return { startDate: '', endDate: '' }
  }
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()

  if (preset === 'currentYear') {
    return {
      startDate: formatDateIso(new Date(year, 0, 1)),
      endDate: formatDateIso(new Date(year, 11, 31)),
    }
  }

  if (preset === 'previousMonth') {
    return {
      startDate: formatDateIso(new Date(year, month - 1, 1)),
      endDate: formatDateIso(new Date(year, month, 0)),
    }
  }

  // currentMonth
  return {
    startDate: formatDateIso(new Date(year, month, 1)),
    endDate: formatDateIso(new Date(year, month + 1, 0)),
  }
}

function setPayPreset(preset: DatePreset) {
  const range = getDatePresetRange(preset)
  payFilters.startDate = range.startDate
  payFilters.endDate = range.endDate
}

function resetPayFilters() {
  payFilters.startDate = ''
  payFilters.endDate = ''
  payFilters.status = ALL_VALUE
  payFilters.paymentMethod = ALL_VALUE
  payFilters.plan = ALL_VALUE
  payFilters.promoter = ALL_VALUE
  payFilters.targetCurrency = 'USD'
}

async function executeDownload(format: 'PDF' | 'XLSX') {
  if (format === 'PDF') generatingPdf.value = true
  else generatingXlsx.value = true

  try {
    await documentReports.downloadJasperReport('pagos', format, {
      startDate: payFilters.startDate || undefined,
      endDate: payFilters.endDate || undefined,
      status: (payFilters.status && payFilters.status !== ALL_VALUE) ? payFilters.status : undefined,
      paymentMethod: (payFilters.paymentMethod && payFilters.paymentMethod !== ALL_VALUE) ? payFilters.paymentMethod : undefined,
      plan: (payFilters.plan && payFilters.plan !== ALL_VALUE) ? payFilters.plan : undefined,
      promoter: (payFilters.promoter && payFilters.promoter !== ALL_VALUE) ? payFilters.promoter : undefined,
      targetCurrency: payFilters.targetCurrency || 'USD',
    })
  } catch (error: any) {
    console.error('Error al generar el reporte Jasper de pagos:', error)
  } finally {
    if (format === 'PDF') generatingPdf.value = false
    else generatingXlsx.value = false
  }
}
</script>

<template>
  <div class="space-y-6 max-w-5xl mx-auto">
    <!-- Header -->
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div class="space-y-1">
        <div class="flex items-center gap-2 text-sm text-prohealth-600">
          <NuxtLink to="/dashboard/payments" class="hover:underline flex items-center gap-1">
            <UIcon name="i-lucide-arrow-left" class="w-4 h-4" />
            Afiliaciones / Pagos
          </NuxtLink>
          <span>/</span>
          <span class="text-prohealth-900 font-medium">Reporte de Pagos</span>
        </div>
        <h1 class="text-2xl font-extrabold text-prohealth-900 flex items-center gap-2">
          <UIcon name="i-lucide-file-spreadsheet" class="w-7 h-7 text-primary-600" />
          Reporte de Pagos de Afiliados
        </h1>
        <p class="text-sm text-prohealth-700/80">
          Auditoría de cobranzas y recaudación de afiliaciones, agrupado por método de pago (Efectivo, Pago Móvil, Zelle, Transferencia).
        </p>
      </div>

      <NuxtLink to="/dashboard/security/reports">
        <UButton
          color="neutral"
          variant="outline"
          icon="i-lucide-history"
          size="sm"
        >
          Historial de descargas
        </UButton>
      </NuxtLink>
    </div>

    <!-- Main Filter and Action Card -->
    <div class="rounded-2xl border border-prohealth-100 bg-white p-6 shadow-xs space-y-6">
      <div class="flex items-center justify-between border-b border-prohealth-100 pb-4">
        <div>
          <h2 class="text-base font-bold text-prohealth-900 flex items-center gap-2">
            <UIcon name="i-lucide-sliders-horizontal" class="w-5 h-5 text-primary-600" />
            Parámetros del Reporte de Pagos
          </h2>
          <p class="text-xs text-prohealth-600 mt-0.5">
            Personaliza las fechas de registro, método, estado y plan. Deja vacío para abarcar todos los registros.
          </p>
        </div>
        <UBadge color="primary" variant="subtle" size="md">JasperReports</UBadge>
      </div>

      <!-- Presets de fecha -->
      <div>
        <label class="block text-xs font-semibold text-prohealth-700 mb-1.5">
          Accesos rápidos de fecha:
        </label>
        <div class="flex flex-wrap items-center gap-2">
          <UButton
            size="xs"
            color="neutral"
            variant="subtle"
            icon="i-lucide-list"
            @click="setPayPreset('all')"
          >
            Todo el historial
          </UButton>
          <UButton
            size="xs"
            color="neutral"
            variant="subtle"
            icon="i-lucide-calendar"
            @click="setPayPreset('currentYear')"
          >
            Año actual
          </UButton>
          <UButton
            size="xs"
            color="neutral"
            variant="subtle"
            icon="i-lucide-calendar-arrow-up"
            @click="setPayPreset('previousMonth')"
          >
            Mes anterior
          </UButton>
          <UButton
            size="xs"
            color="neutral"
            variant="subtle"
            icon="i-lucide-calendar-days"
            @click="setPayPreset('currentMonth')"
          >
            Mes actual
          </UButton>
        </div>
      </div>

      <!-- Rango de fechas manual -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-semibold text-prohealth-700 mb-1">
            Fecha de Pago Desde
          </label>
          <UInput
            v-model="payFilters.startDate"
            type="date"
            class="w-full"
          />
        </div>
        <div>
          <label class="block text-xs font-semibold text-prohealth-700 mb-1">
            Fecha de Pago Hasta
          </label>
          <UInput
            v-model="payFilters.endDate"
            type="date"
            class="w-full"
          />
        </div>
      </div>

      <!-- Estado y Método -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-semibold text-prohealth-700 mb-1">
            Estado del Pago
          </label>
          <USelect
            v-model="payFilters.status"
            :items="payStatusOptions"
            label-key="label"
            value-key="value"
            icon="i-lucide-shield-check"
            placeholder="Todos los estados"
            :ui="{ content: 'z-[100]' }"
            class="w-full"
          />
        </div>

        <div>
          <label class="block text-xs font-semibold text-prohealth-700 mb-1">
            Método de Pago
          </label>
          <USelect
            v-model="payFilters.paymentMethod"
            :items="payMethodOptions"
            label-key="label"
            value-key="value"
            icon="i-lucide-wallet"
            placeholder="Todos los métodos"
            :ui="{ content: 'z-[100]' }"
            class="w-full"
          />
        </div>
      </div>

      <!-- Plan y Promotor -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-semibold text-prohealth-700 mb-1">
            Plan de Cobertura
          </label>
          <div class="flex items-center gap-2">
            <USelect
              v-model="payFilters.plan"
              :items="planOptions"
              label-key="label"
              value-key="value"
              icon="i-lucide-package"
              :ui="{ content: 'z-[100]' }"
              class="w-full"
            />
            <CommonEntityQuickLinkButton
              :to="payFilters.plan && payFilters.plan !== ALL_VALUE ? `/dashboard/plans/${payFilters.plan}` : null"
              :can="canViewPlan"
              @navigate="(to: string) => navigateTo(to)"
            />
          </div>
        </div>

        <div>
          <label class="block text-xs font-semibold text-prohealth-700 mb-1">
            Promotor Asociado
          </label>
          <div class="flex items-center gap-2">
            <USelect
              v-model="payFilters.promoter"
              :items="promoterOptions"
              label-key="label"
              value-key="value"
              icon="i-lucide-user"
              placeholder="Todos los promotores"
              :ui="{ content: 'z-[100]' }"
              class="w-full"
            />
            <CommonEntityQuickLinkButton
              :to="payFilters.promoter && payFilters.promoter !== ALL_VALUE ? `/dashboard/promoters/${payFilters.promoter}` : null"
              :can="canViewPromoter"
              @navigate="(to: string) => navigateTo(to)"
            />
          </div>
        </div>
      </div>

      <!-- Conversión de Moneda -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-semibold text-prohealth-700 mb-1">
            Moneda de Salida (Conversión)
          </label>
          <USelect
            v-model="payFilters.targetCurrency"
            :items="currencyOptions"
            label-key="label"
            value-key="value"
            icon="i-lucide-coins"
            :ui="{ content: 'z-[100]' }"
            class="w-full"
          />
          <p class="text-[11px] text-prohealth-500 mt-1">
            Convierte el monto de cada pago a la tasa de cambio vigente a su fecha de pago.
          </p>
        </div>
      </div>

      <!-- Actions -->
      <div class="pt-5 border-t border-prohealth-100 flex flex-wrap items-center justify-between gap-3">
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-rotate-ccw"
          size="sm"
          @click="resetPayFilters"
        >
          Limpiar filtros
        </UButton>

        <div class="flex items-center gap-3">
          <UButton
            color="success"
            variant="outline"
            icon="i-lucide-file-spreadsheet"
            :loading="generatingXlsx"
            @click="executeDownload('XLSX')"
          >
            Descargar Excel
          </UButton>

          <UButton
            color="error"
            variant="outline"
            icon="i-lucide-file-text"
            :loading="generatingPdf"
            @click="executeDownload('PDF')"
          >
            Descargar PDF
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>
