<script setup lang="ts">
import { COMMISSION_STATUS_OPTIONS } from '~/types/promoters'
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
useSeoMeta({ title: () => t('commissions.report.seoTitle') })

const documentReports = useDocumentReports()
const promotersApi = usePromoters()
const { can } = usePermissions()
const canViewPromoter = computed(() => can('PROMOTER_VIEW_ALL'))
const canViewCurrency = computed(() => can('CURRENCY_VIEW_ALL'))

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

function currencyLink(code: string | null | undefined): string | null {
  return code ? `/dashboard/catalogs/currencies?code=${encodeURIComponent(code)}` : null
}

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
  { label: t('commissions.report.promoterAll'), value: ALL_VALUE },
  ...promoters.value.map(p => ({
    label: `${p.displayName} (${p.referralCode || 'Sin código'})`,
    value: p.uuid,
  })),
])

function formatDateIso(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const commFilters = reactive({
  startDate: '',
  endDate: '',
  promoter: ALL_VALUE,
  status: ALL_VALUE,
  appliesTo: ALL_VALUE,
  targetCurrency: 'USD',
  conversionDate: formatDateIso(new Date()),
})

const commStatusOptions = computed(() => [
  { label: t('commissions.report.statusAll'), value: ALL_VALUE },
  ...COMMISSION_STATUS_OPTIONS.map(o => ({
    label: t(o.labelKey, o.label),
    value: o.value,
  })),
])

const commAppliesToOptions = computed(() => [
  { label: t('commissions.report.appliesToAll'), value: ALL_VALUE },
  { label: t('commissions.report.appliesToInscription'), value: 'INSCRIPTION' },
  { label: t('commissions.report.appliesToMonthly'), value: 'MONTHLY' },
])

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

function setCommPreset(preset: DatePreset) {
  const range = getDatePresetRange(preset)
  commFilters.startDate = range.startDate
  commFilters.endDate = range.endDate
}

function resetCommFilters() {
  commFilters.startDate = ''
  commFilters.endDate = ''
  commFilters.promoter = ALL_VALUE
  commFilters.status = ALL_VALUE
  commFilters.appliesTo = ALL_VALUE
  commFilters.targetCurrency = 'USD'
  commFilters.conversionDate = formatDateIso(new Date())
}

const isDateRangeInvalid = computed(() => {
  return Boolean(
    commFilters.startDate &&
    commFilters.endDate &&
    commFilters.endDate.trim() < commFilters.startDate.trim()
  )
})

async function executeDownload(format: 'PDF' | 'XLSX') {
  if (isDateRangeInvalid.value) {
    documentReports.validateDateRange(commFilters.startDate, commFilters.endDate)
    return
  }

  if (format === 'PDF') generatingPdf.value = true
  else generatingXlsx.value = true

  try {
    await documentReports.downloadJasperReport('comisiones', format, {
      startDate: commFilters.startDate || undefined,
      endDate: commFilters.endDate || undefined,
      promoter: (commFilters.promoter && commFilters.promoter !== ALL_VALUE) ? commFilters.promoter : undefined,
      status: (commFilters.status && commFilters.status !== ALL_VALUE) ? commFilters.status : undefined,
      appliesTo: (commFilters.appliesTo && commFilters.appliesTo !== ALL_VALUE) ? commFilters.appliesTo : undefined,
      targetCurrency: commFilters.targetCurrency || 'USD',
      conversionDate: commFilters.conversionDate || undefined,
    })
  } catch (error: any) {
    console.error('Error al generar el reporte Jasper de comisiones:', error)
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
            {{ t('commissions.report.breadcrumbRoot') }}
          </NuxtLink>
          <span>/</span>
          <span class="text-prohealth-900 font-medium">{{ t('commissions.report.breadcrumbCurrent') }}</span>
        </div>
        <h1 class="text-2xl font-extrabold text-prohealth-900 flex items-center gap-2">
          <UIcon name="i-lucide-file-text" class="w-7 h-7 text-primary-600" />
          {{ t('commissions.report.title') }}
        </h1>
        <p class="text-sm text-prohealth-700/80">
          {{ t('commissions.report.subtitle') }}
        </p>
      </div>

      <NuxtLink to="/dashboard/security/reports">
        <UButton
          color="neutral"
          variant="outline"
          icon="i-lucide-history"
          size="sm"
        >
          {{ t('commissions.report.historyButton') }}
        </UButton>
      </NuxtLink>
    </div>

    <!-- Main Filter and Action Card -->
    <div class="rounded-2xl border border-prohealth-100 bg-white p-6 shadow-xs space-y-6">
      <div class="flex items-center justify-between border-b border-prohealth-100 pb-4">
        <div>
          <h2 class="text-base font-bold text-prohealth-900 flex items-center gap-2">
            <UIcon name="i-lucide-sliders-horizontal" class="w-5 h-5 text-primary-600" />
            {{ t('commissions.report.paramsTitle') }}
          </h2>
          <p class="text-xs text-prohealth-600 mt-0.5">
            {{ t('commissions.report.paramsSubtitle') }}
          </p>
        </div>
        <UBadge color="primary" variant="subtle" size="md">JasperReports</UBadge>
      </div>

      <!-- Presets de fecha -->
      <div>
        <label class="block text-xs font-semibold text-prohealth-700 mb-1.5">
          {{ t('commissions.report.quickPresets') }}
        </label>
        <div class="flex flex-wrap items-center gap-2">
          <UButton
            size="xs"
            color="neutral"
            variant="subtle"
            icon="i-lucide-list"
            @click="setCommPreset('all')"
          >
            {{ t('commissions.report.presetAll') }}
          </UButton>
          <UButton
            size="xs"
            color="neutral"
            variant="subtle"
            icon="i-lucide-calendar"
            @click="setCommPreset('currentYear')"
          >
            {{ t('commissions.report.presetCurrentYear') }}
          </UButton>
          <UButton
            size="xs"
            color="neutral"
            variant="subtle"
            icon="i-lucide-calendar-arrow-up"
            @click="setCommPreset('previousMonth')"
          >
            {{ t('commissions.report.presetPreviousMonth') }}
          </UButton>
          <UButton
            size="xs"
            color="neutral"
            variant="subtle"
            icon="i-lucide-calendar-days"
            @click="setCommPreset('currentMonth')"
          >
            {{ t('commissions.report.presetCurrentMonth') }}
          </UButton>
        </div>
      </div>

      <!-- Rango de fechas con AppDatePicker -->
      <div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-prohealth-700 mb-1">
              {{ t('commissions.report.startDate') }}
            </label>
            <AppDatePicker
              v-model="commFilters.startDate"
              placeholder="DD/MM/AAAA"
            />
          </div>
          <div>
            <label class="block text-xs font-semibold text-prohealth-700 mb-1">
              {{ t('commissions.report.endDate') }}
            </label>
            <AppDatePicker
              v-model="commFilters.endDate"
              placeholder="DD/MM/AAAA"
            />
          </div>
        </div>
        <p v-if="isDateRangeInvalid" class="text-xs text-error-600 mt-1.5 flex items-center gap-1 font-medium">
          <UIcon name="i-lucide-alert-circle" class="w-3.5 h-3.5 shrink-0" />
          {{ t('reports.invalidDateRange') }}
        </p>
      </div>

      <!-- Promotor Comercial -->
      <div>
        <label class="block text-xs font-semibold text-prohealth-700 mb-1">
          {{ t('commissions.report.promoter') }}
        </label>
        <div class="flex items-center gap-2">
          <USelectMenu
            clear
            v-model="commFilters.promoter"
            :items="promoterOptions"
            label-key="label"
            value-key="value"
            icon="i-lucide-user"
            :placeholder="t('commissions.report.promoterAll')"
            :ui="{ content: 'z-[100]' }"
            class="w-full"
          />
          <CommonEntityQuickLinkButton
            :to="commFilters.promoter && commFilters.promoter !== ALL_VALUE ? `/dashboard/promoters/${commFilters.promoter}` : null"
            :can="canViewPromoter"
            @navigate="(to: string) => navigateTo(to)"
          />
        </div>
      </div>

      <!-- Estado y Concepto -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-semibold text-prohealth-700 mb-1">
            {{ t('commissions.report.status') }}
          </label>
          <USelectMenu
            clear
            v-model="commFilters.status"
            :items="commStatusOptions"
            label-key="label"
            value-key="value"
            icon="i-lucide-tag"
            :placeholder="t('commissions.report.statusAll')"
            :ui="{ content: 'z-[100]' }"
            class="w-full"
          />
        </div>

        <div>
          <label class="block text-xs font-semibold text-prohealth-700 mb-1">
            {{ t('commissions.report.appliesTo') }}
          </label>
          <USelectMenu
            clear
            v-model="commFilters.appliesTo"
            :items="commAppliesToOptions"
            label-key="label"
            value-key="value"
            icon="i-lucide-layers"
            :placeholder="t('commissions.report.appliesToAll')"
            :ui="{ content: 'z-[100]' }"
            class="w-full"
          />
        </div>
      </div>

      <!-- Conversión de Moneda y Fecha -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-semibold text-prohealth-700 mb-1">
            {{ t('commissions.report.targetCurrency') }}
          </label>
          <div class="flex items-center gap-2">
            <USelectMenu
              clear
              v-model="commFilters.targetCurrency"
              :items="currencyOptions"
              label-key="label"
              value-key="value"
              icon="i-lucide-coins"
              :ui="{ content: 'z-[100]' }"
              class="w-full"
            />
            <CommonEntityQuickLinkButton
              :to="currencyLink(commFilters.targetCurrency)"
              :can="canViewCurrency"
              @navigate="(to: string) => navigateTo(to)"
            />
          </div>
          <p class="text-[11px] text-prohealth-500 mt-1">
            {{ t('commissions.report.currencyHelp') }}
          </p>
        </div>

        <div>
          <label class="block text-xs font-semibold text-prohealth-700 mb-1">
            {{ t('commissions.report.conversionDate') }}
          </label>
          <AppDatePicker
            v-model="commFilters.conversionDate"
            placeholder="DD/MM/AAAA"
          />
          <p class="text-[11px] text-prohealth-500 mt-1">
            {{ t('commissions.report.currencyHelp') }}
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
          @click="resetCommFilters"
        >
          {{ t('commissions.report.clearFilters') }}
        </UButton>

        <div class="flex items-center gap-3">
          <UButton
            color="success"
            variant="outline"
            icon="i-lucide-file-spreadsheet"
            :loading="generatingXlsx"
            :disabled="isDateRangeInvalid"
            @click="executeDownload('XLSX')"
          >
            {{ t('commissions.report.downloadExcel') }}
          </UButton>

          <UButton
            color="error"
            variant="outline"
            icon="i-lucide-file-text"
            :loading="generatingPdf"
            :disabled="isDateRangeInvalid"
            @click="executeDownload('PDF')"
          >
            {{ t('commissions.report.downloadPdf') }}
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>
