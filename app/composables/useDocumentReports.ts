import { useAuthStore } from '~/stores/auth'

/**
 * Parameters accepted by Jasper reports (Comisiones & Pagos).
 */
export interface JasperReportParams {
  startDate?: string
  endDate?: string
  promoter?: string
  status?: string
  appliesTo?: string
  paymentMethod?: string
  plan?: string
  payoutReference?: string
  companyName?: string
  targetCurrency?: string
  conversionDate?: string
  direction?: string
}

export const useDocumentReports = () => {
  const { t } = useI18n()
  const { $i18n } = useNuxtApp()
  const config = useRuntimeConfig()
  const auth = useAuthStore()
  const toast = useToast()

  /**
   * Cleans and normalizes the table or resource name from a route path.
   * E.g. '/dashboard/allies' -> 'allies', 'scheduled-jobs' -> 'scheduled_jobs'.
   */
  function normalizeTableName(nameOrRoute: string): string {
    if (!nameOrRoute) return ''
    const cleanPath = nameOrRoute.replace(/^\/dashboard\//, '').split('?')[0] || ''
    const baseSegment = cleanPath.split('/')[0] || nameOrRoute
    return baseSegment.replace(/-/g, '_')
  }

  /**
   * Formats the current local date and time as YYYY-MM-DD_HH-mm.
   */
  function getTimestampString(): string {
    const d = new Date()
    const tzOffset = d.getTimezoneOffset() * 60000
    return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16).replace('T', '_').replace(':', '-')
  }

  /**
   * Triggers browser download for a Blob payload received from the backend API.
   */
  function triggerBlobDownload(blob: Blob, defaultFilename: string) {
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = defaultFilename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }

  /**
   * Validates that the end date is greater than or equal to the start date.
   * If invalid, displays an error toast and returns false.
   */
  function validateDateRange(startDate?: string, endDate?: string): boolean {
    if (!startDate || !endDate) return true
    const start = startDate.trim()
    const end = endDate.trim()
    if (start && end && end < start) {
      const message = t('reports.invalidDateRange', 'La fecha hacia debe ser mayor o igual a la fecha desde')
      toast.add({
        title: message,
        color: 'error',
        icon: 'i-lucide-circle-alert',
      })
      return false
    }
    return true
  }

  /**
   * Handles error response parsing (ProblemDetail RFC 7807) and toast notification.
   */
  async function handleReportError(response: Response, defaultErrorKey: string): Promise<never> {
    let message = ''
    try {
      const contentType = response.headers.get('content-type') || ''
      if (contentType.includes('json')) {
        const problem = await response.json()
        if (Array.isArray(problem.errors) && problem.errors.length > 0) {
          message = problem.errors.map((e: any) => e.message).join(' · ')
        } else {
          message = problem.detail || problem.title || ''
        }
      } else {
        const text = await response.text()
        if (text && text.length < 300) {
          message = text
        }
      }
    } catch {
      // Ignore body parsing error
    }

    if (response.status === 404) {
      const toastMsg = message || t('reports.noData', 'No hay datos para mostrar')
      toast.add({
        title: toastMsg,
        color: 'warning',
        icon: 'i-lucide-alert-triangle',
      })
      const error: any = new Error(toastMsg)
      error._reported = true
      error.status = 404
      throw error
    }

    if (response.status === 422) {
      const toastMsg = message || t('reports.invalidDateRange', 'La fecha hacia debe ser mayor o igual a la fecha desde')
      toast.add({
        title: toastMsg,
        color: 'error',
        icon: 'i-lucide-circle-alert',
      })
      const error: any = new Error(toastMsg)
      error._reported = true
      error.status = 422
      throw error
    }

    if (response.status === 403) {
      const toastMsg = message || t('errors.byStatus.403', 'No tienes permisos para generar este reporte')
      toast.add({
        title: toastMsg,
        color: 'error',
        icon: 'i-lucide-circle-alert',
      })
      const error: any = new Error(toastMsg)
      error._reported = true
      error.status = 403
      throw error
    }

    const toastMsg = message || t(defaultErrorKey)
    toast.add({
      title: toastMsg,
      color: 'error',
      icon: 'i-lucide-circle-alert',
    })
    const error: any = new Error(toastMsg)
    error._reported = true
    error.status = response.status
    throw error
  }

  /**
   * Fetches report binary stream with JWT auth and active locale headers.
   */
  async function executeReportFetch(endpoint: string, defaultErrorKey: string): Promise<Blob> {
    if (auth.refreshToken && auth.isAccessExpiringSoon()) {
      await auth.tryRefresh()
    }

    const activeLocale = String(unref($i18n.locale) ?? 'es')
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${auth.accessToken || ''}`,
        'Accept-Language': activeLocale,
      },
    })

    if (!response.ok) {
      await handleReportError(response, defaultErrorKey)
    }

    return await response.blob()
  }

  /**
   * Downloads a full table report (PDF or XLSX).
   */
  async function downloadTableReport(
    tableName: string,
    format: 'PDF' | 'XLSX' = 'PDF',
    customTitle?: string,
    filters?: { q?: string; includeInactive?: boolean }
  ) {
    const cleanTable = normalizeTableName(tableName)
    const baseURL = config.public.apiBaseUrl || ''
    const params = new URLSearchParams({ format })
    if (customTitle) params.set('title', customTitle)
    if (filters?.q) params.set('q', filters.q)
    if (filters?.includeInactive) params.set('includeInactive', 'true')
    const endpoint = `${baseURL}/v1/documents/tables/${cleanTable}?${params.toString()}`

    try {
      const blob = await executeReportFetch(endpoint, 'reports.tableError')
      const ext = format === 'XLSX' ? 'xlsx' : 'pdf'
      const timestamp = getTimestampString()
      triggerBlobDownload(blob, `${t('reports.listFilePrefix')}_${cleanTable}_${timestamp}.${ext}`)
      toast.add({
        title: t('reports.tableSuccess'),
        color: 'success',
        icon: 'i-lucide-check-circle',
      })
    } catch (err: any) {
      if (!err?._reported) {
        toast.add({
          title: err?.message || t('reports.tableError'),
          color: 'error',
          icon: 'i-lucide-circle-alert',
        })
      }
      throw err
    }
  }

  /**
   * Downloads a record-specific report by UUID (PDF or XLSX).
   */
  async function downloadRecordReport(
    tableName: string,
    uuid: string,
    format: 'PDF' | 'XLSX' = 'PDF',
    customTitle?: string
  ) {
    const cleanTable = normalizeTableName(tableName)
    const baseURL = config.public.apiBaseUrl || ''
    const endpoint = `${baseURL}/v1/documents/records/${cleanTable}/${uuid}?format=${format}${customTitle ? `&title=${encodeURIComponent(customTitle)}` : ''}`

    try {
      const blob = await executeReportFetch(endpoint, 'reports.recordError')
      const ext = format === 'XLSX' ? 'xlsx' : 'pdf'
      const timestamp = getTimestampString()
      triggerBlobDownload(blob, `${t('reports.recordFilePrefix')}_${cleanTable}_${uuid}_${timestamp}.${ext}`)
      toast.add({
        title: t('reports.recordSuccess'),
        color: 'success',
        icon: 'i-lucide-check-circle',
      })
    } catch (err: any) {
      if (!err?._reported) {
        toast.add({
          title: err?.message || t('reports.recordError'),
          color: 'error',
          icon: 'i-lucide-circle-alert',
        })
      }
      throw err
    }
  }

  /**
   * Downloads a specialized Jasper report (PDF or XLSX) with custom query filters.
   */
  async function downloadJasperReport(
    reportName: 'comisiones' | 'pagos' | 'pagos-comisiones' | 'pagos-afiliados' | 'commissions' | 'payments' | 'movimientos' | 'movimientos-pagos' | string,
    format: 'PDF' | 'XLSX' = 'PDF',
    filterParams: JasperReportParams = {}
  ) {
    if (!validateDateRange(filterParams.startDate, filterParams.endDate)) {
      const err: any = new Error(t('reports.invalidDateRange', 'La fecha hacia debe ser mayor o igual a la fecha desde'))
      err._reported = true
      err.status = 422
      throw err
    }

    const baseURL = config.public.apiBaseUrl || ''
    const params = new URLSearchParams({ format })
    if (filterParams.startDate) params.set('startDate', filterParams.startDate)
    if (filterParams.endDate) params.set('endDate', filterParams.endDate)
    if (filterParams.promoter) params.set('promoter', filterParams.promoter)
    if (filterParams.status) params.set('status', filterParams.status)
    if (filterParams.appliesTo) params.set('appliesTo', filterParams.appliesTo)
    if (filterParams.paymentMethod) params.set('paymentMethod', filterParams.paymentMethod)
    if (filterParams.plan) params.set('plan', filterParams.plan)
    if (filterParams.payoutReference) params.set('payoutReference', filterParams.payoutReference)
    if (filterParams.companyName) params.set('companyName', filterParams.companyName)
    if (filterParams.targetCurrency) params.set('targetCurrency', filterParams.targetCurrency)
    if (filterParams.conversionDate) params.set('conversionDate', filterParams.conversionDate)
    if (filterParams.direction) params.set('direction', filterParams.direction)

    const endpoint = `${baseURL}/v1/documents/jasper/${reportName}?${params.toString()}`

    try {
      const blob = await executeReportFetch(endpoint, 'reports.tableError')
      const ext = format === 'XLSX' ? 'xlsx' : 'pdf'
      const timestamp = getTimestampString()
      let baseName = 'reporte'
      if (reportName.includes('comision') && reportName.includes('pago')) {
        baseName = 'reporte_pagos_comisiones'
      } else if (reportName.startsWith('pago') || reportName.startsWith('payment')) {
        baseName = 'reporte_pagos_afiliados'
      } else if (reportName.includes('movimiento') || reportName.includes('movement')) {
        baseName = 'reporte_movimientos_pagos'
      } else {
        baseName = 'reporte_comisiones'
      }
      triggerBlobDownload(blob, `${baseName}_${timestamp}.${ext}`)
      toast.add({
        title: t('reports.tableSuccess'),
        color: 'success',
        icon: 'i-lucide-check-circle',
      })
    } catch (err: any) {
      if (!err?._reported) {
        toast.add({
          title: err?.message || t('reports.tableError'),
          color: 'error',
          icon: 'i-lucide-circle-alert',
        })
      }
      throw err
    }
  }

  return {
    normalizeTableName,
    validateDateRange,
    downloadTableReport,
    downloadRecordReport,
    downloadJasperReport,
  }
}
