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
}

export const useDocumentReports = () => {
  const { t } = useI18n()
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
      if (auth.refreshToken && auth.isAccessExpiringSoon()) {
        await auth.tryRefresh()
      }

      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${auth.accessToken || ''}`,
        },
      })

      if (!response.ok) {
        throw new Error(t('reports.tableError'))
      }

      const blob = await response.blob()
      const ext = format === 'XLSX' ? 'xlsx' : 'pdf'
      const timestamp = getTimestampString()
      triggerBlobDownload(blob, `${t('reports.listFilePrefix')}_${cleanTable}_${timestamp}.${ext}`)
      toast.add({
        title: t('reports.tableSuccess'),
        color: 'success',
        icon: 'i-lucide-check-circle',
      })
    } catch (err: any) {
      toast.add({
        title: err?.message || t('reports.tableError'),
        color: 'error',
        icon: 'i-lucide-circle-alert',
      })
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
      if (auth.refreshToken && auth.isAccessExpiringSoon()) {
        await auth.tryRefresh()
      }

      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${auth.accessToken || ''}`,
        },
      })

      if (!response.ok) {
        throw new Error(t('reports.recordError'))
      }

      const blob = await response.blob()
      const ext = format === 'XLSX' ? 'xlsx' : 'pdf'
      const timestamp = getTimestampString()
      triggerBlobDownload(blob, `${t('reports.recordFilePrefix')}_${cleanTable}_${uuid}_${timestamp}.${ext}`)
      toast.add({
        title: t('reports.recordSuccess'),
        color: 'success',
        icon: 'i-lucide-check-circle',
      })
    } catch (err: any) {
      toast.add({
        title: err?.message || t('reports.recordError'),
        color: 'error',
        icon: 'i-lucide-circle-alert',
      })
    }
  }

  /**
   * Downloads a specialized Jasper report (PDF or XLSX) with custom query filters.
   */
  async function downloadJasperReport(
    reportName: 'comisiones' | 'pagos' | 'pagos-comisiones' | 'pagos-afiliados' | 'commissions' | 'payments' | string,
    format: 'PDF' | 'XLSX' = 'PDF',
    filterParams: JasperReportParams = {}
  ) {
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

    const endpoint = `${baseURL}/v1/documents/jasper/${reportName}?${params.toString()}`

    try {
      if (auth.refreshToken && auth.isAccessExpiringSoon()) {
        await auth.tryRefresh()
      }

      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${auth.accessToken || ''}`,
        },
      })

      if (!response.ok) {
        throw new Error(t('reports.tableError'))
      }

      const blob = await response.blob()
      const ext = format === 'XLSX' ? 'xlsx' : 'pdf'
      const timestamp = getTimestampString()
      let baseName = 'reporte'
      if (reportName.includes('comision') && reportName.includes('pago')) {
        baseName = 'reporte_pagos_comisiones'
      } else if (reportName.startsWith('pago') || reportName.startsWith('payment')) {
        baseName = 'reporte_pagos_afiliados'
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
      toast.add({
        title: err?.message || t('reports.tableError'),
        color: 'error',
        icon: 'i-lucide-circle-alert',
      })
      throw err
    }
  }

  return {
    normalizeTableName,
    downloadTableReport,
    downloadRecordReport,
    downloadJasperReport,
  }
}
