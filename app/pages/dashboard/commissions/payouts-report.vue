<script setup lang="ts">
import type { PromoterDto } from '~/types/promoters'

definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: [
    'COMMISSION_REPORT_GENERATE',
    'REPORT_REPORT_GENERATE',
    'COMMISSION_VIEW_ALL',
    'COMMISSION_VIEW_OWN',
  ],
})

const { t } = useI18n()
useSeoMeta({ title: () => 'Reporte de Pagos de Comisiones — OptiBienestar 360' })

const documentReports = useDocumentReports()
const promotersApi = usePromoters()
const toast = useToast()
const { can } = usePermissions()
const canViewPromoter = computed(() => can('PROMOTER_VIEW_ALL'))

const generatingPdf = ref(false)
const generatingXlsx = ref(false)

const promoters = ref<PromoterDto[]>([])
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
    const res = await promotersApi.list({ size: 100, sort: ['displayName,asc'] })
    promoters.value = res.content ?? []
  } catch (err: any) {
    console.error('Error cargando promotores:', err)
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

const payoutFilters = reactive({
  startDate: '',
  endDate: '',
  promoter: ALL_VALUE,
  payoutReference: '',
  targetCurrency: 'USD',
})

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

function setPayoutPreset(preset: DatePreset) {
  const range = getDatePresetRange(preset)
  payoutFilters.startDate = range.startDate
  payoutFilters.endDate = range.endDate
}

function resetPayoutFilters() {
  payoutFilters.startDate = ''
  payoutFilters.endDate = ''
  payoutFilters.promoter = ALL_VALUE
  payoutFilters.payoutReference = ''
  payoutFilters.targetCurrency = 'USD'
}

async function executeDownload(format: 'PDF' | 'XLSX') {
  if (format === 'PDF') generatingPdf.value = true
  else generatingXlsx.value = true

  try {
    await documentReports.downloadJasperReport('pagos-comisiones', format, {
      startDate: payoutFilters.startDate || undefined,
      endDate: payoutFilters.endDate || undefined,
      promoter: (payoutFilters.promoter && payoutFilters.promoter !== ALL_VALUE) ? payoutFilters.promoter : undefined,
      payoutReference: payoutFilters.payoutReference.trim() || undefined,
      targetCurrency: payoutFilters.targetCurrency || 'USD',
    })
  } catch (error: any) {
    console.error('Error al generar el reporte Jasper de pagos de comisiones:', error)
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
          <NuxtLink to="/dashboard/commissions" class="hover:underline flex items-center gap-1">
            <UIcon name="i-lucide-arrow-left" class="w-4 h-4" />
            Comercial
          </NuxtLink>
          <span>/</span>
          <span class="text-prohealth-900 font-medium">Reporte de Pagos de Comisiones</span>
        </div>
        <h1 class="text-2xl font-extrabold text-prohealth-900 flex items-center gap-2">
          <UIcon name="i-lucide-file-check-2" class="w-7 h-7 text-primary-600" />
          Reporte de Pagos de Comisiones
        </h1>
        <p class="text-sm text-prohealth-700/80">
          Liquidaciones y desembolsos efectivamente pagados a promotores (estado Pagada / PAID), con fecha de pago y referencia bancaria.
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
            Parámetros del Reporte de Pagos Realizados
          </h2>
          <p class="text-xs text-prohealth-600 mt-0.5">
            Filtra por fecha de desembolso, promotor o referencia de pago. Solo incluye comisiones en estado PAGADA (PAID).
          </p>
        </div>
        <UBadge color="primary" variant="subtle" size="md">JasperReports</UBadge>
      </div>

      <!-- Presets de fecha -->
      <div>
        <label class="block text-xs font-semibold text-prohealth-700 mb-1.5">
          Accesos rápidos de fecha de desembolso:
        </label>
        <div class="flex flex-wrap items-center gap-2">
          <UButton
            size="xs"
            color="neutral"
            variant="subtle"
            icon="i-lucide-list"
            @click="setPayoutPreset('all')"
          >
            Todo el historial
          </UButton>
          <UButton
            size="xs"
            color="neutral"
            variant="subtle"
            icon="i-lucide-calendar"
            @click="setPayoutPreset('currentYear')"
          >
            Año actual
          </UButton>
          <UButton
            size="xs"
            color="neutral"
            variant="subtle"
            icon="i-lucide-calendar-arrow-up"
            @click="setPayoutPreset('previousMonth')"
          >
            Mes anterior
          </UButton>
          <UButton
            size="xs"
            color="neutral"
            variant="subtle"
            icon="i-lucide-calendar-days"
            @click="setPayoutPreset('currentMonth')"
          >
            Mes actual
          </UButton>
        </div>
      </div>

      <!-- Rango de fechas manual -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-semibold text-prohealth-700 mb-1">
            Fecha Desembolso Desde
          </label>
          <UInput
            v-model="payoutFilters.startDate"
            type="date"
            class="w-full"
          />
        </div>
        <div>
          <label class="block text-xs font-semibold text-prohealth-700 mb-1">
            Fecha Desembolso Hasta
          </label>
          <UInput
            v-model="payoutFilters.endDate"
            type="date"
            class="w-full"
          />
        </div>
      </div>

      <!-- Promotor y Referencia -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-semibold text-prohealth-700 mb-1">
            Promotor Comercial
          </label>
          <div class="flex items-center gap-2">
            <USelectMenu
              clear
              v-model="payoutFilters.promoter"
              :items="promoterOptions"
              label-key="label"
              value-key="value"
              icon="i-lucide-user"
              placeholder="Todos los promotores"
              :ui="{ content: 'z-[100]' }"
              class="w-full"
            />
            <CommonEntityQuickLinkButton
              :to="payoutFilters.promoter && payoutFilters.promoter !== ALL_VALUE ? `/dashboard/promoters/${payoutFilters.promoter}` : null"
              :can="canViewPromoter"
              @navigate="(to: string) => navigateTo(to)"
            />
          </div>
        </div>

        <div>
          <label class="block text-xs font-semibold text-prohealth-700 mb-1">
            Referencia de Pago / Desembolso
          </label>
          <UInput
            v-model="payoutFilters.payoutReference"
            placeholder="Ej: PAG-202609-001 o N° Transferencia"
            icon="i-lucide-hash"
            class="w-full"
          />
        </div>
      </div>

      <!-- Conversión de Moneda -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-semibold text-prohealth-700 mb-1">
            Moneda de Salida (Conversión)
          </label>
          <USelectMenu
            clear
            v-model="payoutFilters.targetCurrency"
            :items="currencyOptions"
            label-key="label"
            value-key="value"
            icon="i-lucide-coins"
            :ui="{ content: 'z-[100]' }"
            class="w-full"
          />
          <p class="text-[11px] text-prohealth-500 mt-1">
            Convierte el monto de cada comisión a la tasa de cambio vigente a su fecha de pago.
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
          @click="resetPayoutFilters"
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
