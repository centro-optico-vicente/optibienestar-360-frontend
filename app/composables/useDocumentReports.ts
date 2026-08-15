import { useAuthStore } from '~/stores/auth'

export const useDocumentReports = () => {
  const config = useRuntimeConfig()
  const auth = useAuthStore()
  const toast = useToast()

  /**
   * Limpia y normaliza el nombre de la tabla o recurso desde la ruta.
   * Ej: '/dashboard/allies' -> 'allies', 'scheduled-jobs' -> 'scheduled_jobs'.
   */
  function normalizeTableName(nameOrRoute: string): string {
    if (!nameOrRoute) return ''
    const cleanPath = nameOrRoute.replace(/^\/dashboard\//, '').split('?')[0] || ''
    const baseSegment = cleanPath.split('/')[0] || nameOrRoute
    return baseSegment.replace(/-/g, '_')
  }

  /**
   * Dispara la descarga del archivo Blob recibido desde el backend.
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
   * Descarga el reporte de listado completo de una tabla (PDF o XLSX).
   */
  async function downloadTableReport(
    tableName: string,
    format: 'PDF' | 'XLSX' = 'PDF',
    customTitle?: string
  ) {
    const cleanTable = normalizeTableName(tableName)
    const baseURL = config.public.apiBaseUrl || ''
    const endpoint = `${baseURL}/v1/documents/tables/${cleanTable}?format=${format}${customTitle ? `&title=${encodeURIComponent(customTitle)}` : ''}`

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
        throw new Error(`Error ${response.status}: No se pudo generar el reporte de la tabla`)
      }

      const blob = await response.blob()
      const ext = format === 'XLSX' ? 'xlsx' : 'pdf'
      triggerBlobDownload(blob, `listado_${cleanTable}.${ext}`)
      toast.add({
        title: 'Reporte generado con éxito',
        color: 'success',
        icon: 'i-lucide-check-circle',
      })
    } catch (err: any) {
      toast.add({
        title: err?.message || 'Error al generar el reporte de la tabla',
        color: 'error',
        icon: 'i-lucide-circle-alert',
      })
    }
  }

  /**
   * Descarga la ficha/reporte de un registro individual por su UUID (PDF o XLSX).
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
        throw new Error(`Error ${response.status}: No se pudo generar el reporte del registro`)
      }

      const blob = await response.blob()
      const ext = format === 'XLSX' ? 'xlsx' : 'pdf'
      triggerBlobDownload(blob, `ficha_${cleanTable}_${uuid}.${ext}`)
      toast.add({
        title: 'Ficha generada con éxito',
        color: 'success',
        icon: 'i-lucide-check-circle',
      })
    } catch (err: any) {
      toast.add({
        title: err?.message || 'Error al generar la ficha del registro',
        color: 'error',
        icon: 'i-lucide-circle-alert',
      })
    }
  }

  return {
    normalizeTableName,
    downloadTableReport,
    downloadRecordReport,
  }
}
