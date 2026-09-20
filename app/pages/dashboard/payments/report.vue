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
useSeoMeta({ title: () => t('payments.collectionsReport.seoTitle') })

const documentReports = useDocumentReports()
const promotersApi = usePromoters()
const plansApi = usePlans()
const { can } = usePermissions()
const canViewPromoter = computed(() => can('PROMOTER_VIEW_ALL'))
const canViewPlan = computed(() => can('PLAN_VIEW_ALL'))
const canViewCurrency = computed(() => can('CURRENCY_VIEW_ALL'))

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

function currencyLink(code: string | null | undefined): string | null {
  return code ? `/dashboard/catalogs/currencies?code=${encodeURIComponent(code)}` : null
}
const dynamicPaymentMethods = ref<Array<{ label: string; value: string }>>([])

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
  }

  try {
    const pmRes = await useApi<Array<{ uuid?: string; code?: string; value?: string; label?: string; active?: boolean }>>('/v1/admin/payment-methods/options')
    if (pmRes && pmRes.length > 0) {
      dynamicPaymentMethods.value = pmRes
        .filter(m => m.active !== false)
        .map(m => ({
          label: m.label || m.code || m.value || '',
          value: m.code || m.value || '',
        }))
        .filter(m => m.value !== '')
    }
  } catch {
    // Mantiene fallback a PAYMENT_METHOD_OPTIONS
  } finally {
    loadingCatalogs.value = false
  }
}

onMounted(loadCatalogs)

const ALL_VALUE = 'ALL'

const promoterOptions = computed(() => [
  { label: t('payments.collectionsReport.promoterAll'), value: ALL_VALUE },
  ...promoters.value.map(p => ({
    label: `${p.displayName} (${p.referralCode || 'Sin código'})`,
    value: p.uuid,
  })),
])

const planOptions = computed(() => [
  { label: t('payments.collectionsReport.planAll'), value: ALL_VALUE },
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
  { label: t('payments.collectionsReport.statusAll'), value: ALL_VALUE },
  ...PAYMENT_STATUS_OPTIONS.map(o => ({
    label: t(o.labelKey, o.label),
    value: o.value,
  })),
])

const payMethodOptions = computed(() => {
  if (dynamicPaymentMethods.value.length > 0) {
    return [
      { label: t('payments.collectionsReport.methodAll'), value: ALL_VALUE },
      ...dynamicPaymentMethods.value,
    ]
  }
  return [
    { label: t('payments.collectionsReport.methodAll'), value: ALL_VALUE },
    ...PAYMENT_METHOD_OPTIONS.map(o => ({
      label: t(o.labelKey, o.label),
      value: o.value,
    })),
  ]
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
            {{ t('payments.collectionsReport.breadcrumbRoot') }}
          </NuxtLink>
          <span>/</span>
          <span class="text-prohealth-900 font-medium">{{ t('payments.collectionsReport.breadcrumbCurrent') }}</span>
        </div>
        <h1 class="text-2xl font-extrabold text-prohealth-900 flex items-center gap-2">
          <UIcon name="i-lucide-file-spreadsheet" class="w-7 h-7 text-primary-600" />
          {{ t('payments.collectionsReport.title') }}
        </h1>
        <p class="text-sm text-prohealth-700/80">
          {{ t('payments.collectionsReport.subtitle') }}
        </p>
      </div>

      <NuxtLink to="/dashboard/security/reports">
        <UButton
          color="neutral"
          variant="outline"
          icon="i-lucide-history"
          size="sm"
        >
          {{ t('payments.collectionsReport.historyButton') }}
        </UButton>
      </NuxtLink>
    </div>

    <!-- Main Filter and Action Card -->
    <div class="rounded-2xl border border-prohealth-100 bg-white p-6 shadow-xs space-y-6">
      <div class="flex items-center justify-between border-b border-prohealth-100 pb-4">
        <div>
          <h2 class="text-base font-bold text-prohealth-900 flex items-center gap-2">
            <UIcon name="i-lucide-sliders-horizontal" class="w-5 h-5 text-primary-600" />
            {{ t('payments.collectionsReport.paramsTitle') }}
          </h2>
          <p class="text-xs text-prohealth-600 mt-0.5">
            {{ t('payments.collectionsReport.paramsSubtitle') }}
          </p>
        </div>
        <UBadge color="primary" variant="subtle" size="md">JasperReports</UBadge>
      </div>

      <!-- Presets de fecha -->
      <div>
        <label class="block text-xs font-semibold text-prohealth-700 mb-1.5">
          {{ t('payments.collectionsReport.quickPresets') }}
        </label>
        <div class="flex flex-wrap items-center gap-2">
          <UButton
            size="xs"
            color="neutral"
            variant="subtle"
            icon="i-lucide-list"
            @click="setPayPreset('all')"
          >
            {{ t('payments.collectionsReport.presetAll') }}
          </UButton>
          <UButton
            size="xs"
            color="neutral"
            variant="subtle"
            icon="i-lucide-calendar"
            @click="setPayPreset('currentYear')"
          >
            {{ t('payments.collectionsReport.presetCurrentYear') }}
          </UButton>
          <UButton
            size="xs"
            color="neutral"
            variant="subtle"
            icon="i-lucide-calendar-arrow-up"
            @click="setPayPreset('previousMonth')"
          >
            {{ t('payments.collectionsReport.presetPreviousMonth') }}
          </UButton>
          <UButton
            size="xs"
            color="neutral"
            variant="subtle"
            icon="i-lucide-calendar-days"
            @click="setPayPreset('currentMonth')"
          >
            {{ t('payments.collectionsReport.presetCurrentMonth') }}
          </UButton>
        </div>
      </div>

      <!-- Rango de fechas con AppDatePicker -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-semibold text-prohealth-700 mb-1">
            {{ t('payments.collectionsReport.startDate') }}
          </label>
          <AppDatePicker
            v-model="payFilters.startDate"
            placeholder="DD/MM/AAAA"
          />
        </div>
        <div>
          <label class="block text-xs font-semibold text-prohealth-700 mb-1">
            {{ t('payments.collectionsReport.endDate') }}
          </label>
          <AppDatePicker
            v-model="payFilters.endDate"
            placeholder="DD/MM/AAAA"
          />
        </div>
      </div>

      <!-- Estado y Método -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-semibold text-prohealth-700 mb-1">
            {{ t('payments.collectionsReport.status') }}
          </label>
          <USelectMenu
            clear
            v-model="payFilters.status"
            :items="payStatusOptions"
            label-key="label"
            value-key="value"
            icon="i-lucide-shield-check"
            :placeholder="t('payments.collectionsReport.statusAll')"
            :ui="{ content: 'z-[100]' }"
            class="w-full"
          />
        </div>

        <div>
          <label class="block text-xs font-semibold text-prohealth-700 mb-1">
            {{ t('payments.collectionsReport.paymentMethod') }}
          </label>
          <USelectMenu
            clear
            v-model="payFilters.paymentMethod"
            :items="payMethodOptions"
            label-key="label"
            value-key="value"
            icon="i-lucide-wallet"
            :placeholder="t('payments.collectionsReport.methodAll')"
            :ui="{ content: 'z-[100]' }"
            class="w-full"
          />
        </div>
      </div>

      <!-- Plan y Promotor -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-semibold text-prohealth-700 mb-1">
            {{ t('payments.collectionsReport.plan') }}
          </label>
          <div class="flex items-center gap-2">
            <USelectMenu
              clear
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
            {{ t('payments.collectionsReport.promoter') }}
          </label>
          <div class="flex items-center gap-2">
            <USelectMenu
              clear
              v-model="payFilters.promoter"
              :items="promoterOptions"
              label-key="label"
              value-key="value"
              icon="i-lucide-user"
              :placeholder="t('payments.collectionsReport.promoterAll')"
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
            {{ t('payments.collectionsReport.targetCurrency') }}
          </label>
          <div class="flex items-center gap-2">
            <USelectMenu
              clear
              v-model="payFilters.targetCurrency"
              :items="currencyOptions"
              label-key="label"
              value-key="value"
              icon="i-lucide-coins"
              :ui="{ content: 'z-[100]' }"
              class="w-full"
            />
            <CommonEntityQuickLinkButton
              :to="currencyLink(payFilters.targetCurrency)"
              :can="canViewCurrency"
              @navigate="(to: string) => navigateTo(to)"
            />
          </div>
          <p class="text-[11px] text-prohealth-500 mt-1">
            {{ t('payments.collectionsReport.currencyHelp') }}
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
          {{ t('payments.collectionsReport.clearFilters') }}
        </UButton>

        <div class="flex items-center gap-3">
          <UButton
            color="success"
            variant="outline"
            icon="i-lucide-file-spreadsheet"
            :loading="generatingXlsx"
            @click="executeDownload('XLSX')"
          >
            {{ t('payments.collectionsReport.downloadExcel') }}
          </UButton>

          <UButton
            color="error"
            variant="outline"
            icon="i-lucide-file-text"
            :loading="generatingPdf"
            @click="executeDownload('PDF')"
          >
            {{ t('payments.collectionsReport.downloadPdf') }}
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>
