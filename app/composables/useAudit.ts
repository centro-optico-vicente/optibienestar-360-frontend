import type { Page } from '~/types/admin'
import type { DataChangeAuditLogDto, DataChangeAuditLogPageDto, ReportAuditLogDto } from '~/types/audit'

interface EntityAuditParams {
  entityKey: string
  entityUuid: string
  page?: number
  size?: number
  sort?: string
}

/**
 * Acceso a la bitácora de auditoría (/v1/admin/audit/*), genérica por entidad.
 * Permisos del backend: data-changes → AUDIT_VIEW_ALL · reports → REPORT_AUDIT_VIEW_ALL.
 */
export const useAudit = () => {
  const listDataChanges = (params: EntityAuditParams) =>
    useApi<DataChangeAuditLogPageDto>('/v1/admin/audit/data-changes', {
      query: {
        entityKey: params.entityKey,
        entityUuid: params.entityUuid,
        page: params.page ?? 0,
        size: params.size ?? 20,
        sort: params.sort ?? 'occurredAt,DESC',
      },
    })

  const firstChange = (entityKey: string, entityUuid: string) =>
    useApi<DataChangeAuditLogDto>('/v1/admin/audit/data-changes/first-change', {
      query: { entityKey, entityUuid },
    })

  const listReports = (params: EntityAuditParams) =>
    useApi<Page<ReportAuditLogDto>>('/v1/admin/audit/reports', {
      query: {
        entityKey: params.entityKey,
        entityUuid: params.entityUuid,
        page: params.page ?? 0,
        size: params.size ?? 20,
        sort: params.sort ?? 'generatedAt,DESC',
      },
    })

  const downloadReportUrl = (uuid: string) =>
    useApi<{ url: string }>(`/v1/admin/audit/reports/${uuid}/download`)

  return { listDataChanges, firstChange, listReports, downloadReportUrl }
}
