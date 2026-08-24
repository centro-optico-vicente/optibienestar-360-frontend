import type { Page } from '~/types/admin'
import type {
  AuditAction,
  DataChangeAuditLogDto,
  DataChangeAuditLogPageDto,
  LoginAuditLogPageDto,
  LoginAuditResult,
  ReportAuditLogDto,
} from '~/types/audit'

interface EntityAuditParams {
  /** Omitted (both) → global listing across every entity (needs AUDIT_VIEW_ALL / REPORT_AUDIT_VIEW_ALL). */
  entityKey?: string
  entityUuid?: string
  actorUuid?: string
  action?: AuditAction
  from?: string
  to?: string
  filter?: string
  page?: number
  size?: number
  sort?: string
}

interface ReportAuditParams extends EntityAuditParams {
  reportType?: string
  format?: string
}

interface LoginAuditParams {
  email?: string
  userUuid?: string
  result?: LoginAuditResult
  from?: string
  to?: string
  filter?: string
  page?: number
  size?: number
  sort?: string
}

/**
 * Acceso a la bitácora de auditoría (/v1/admin/audit/*).
 * data-changes/reports son genéricos por entidad, pero pasar sin entityKey/entityUuid
 * consulta el histórico global (AUDIT_VIEW_ALL / REPORT_AUDIT_VIEW_ALL respectivamente).
 * logins es siempre global (AUDIT_VIEW_LOGIN).
 */
export const useAudit = () => {
  const listDataChanges = (params: EntityAuditParams = {}) =>
    useApi<DataChangeAuditLogPageDto>('/v1/admin/audit/data-changes', {
      query: {
        entityKey: params.entityKey,
        entityUuid: params.entityUuid,
        actorUuid: params.actorUuid,
        action: params.action,
        from: params.from,
        to: params.to,
        filter: params.filter,
        page: params.page ?? 0,
        size: params.size ?? 20,
        sort: params.sort ?? 'occurredAt,DESC',
      },
    })

  const firstChange = (entityKey: string, entityUuid: string) =>
    useApi<DataChangeAuditLogDto>('/v1/admin/audit/data-changes/first-change', {
      query: { entityKey, entityUuid },
    })

  const listReports = (params: ReportAuditParams = {}) =>
    useApi<Page<ReportAuditLogDto>>('/v1/admin/audit/reports', {
      query: {
        reportType: params.reportType,
        entityKey: params.entityKey,
        entityUuid: params.entityUuid,
        actorUuid: params.actorUuid,
        format: params.format,
        from: params.from,
        to: params.to,
        filter: params.filter,
        page: params.page ?? 0,
        size: params.size ?? 20,
        sort: params.sort ?? 'generatedAt,DESC',
      },
    })

  const downloadReportUrl = (uuid: string) =>
    useApi<{ url: string }>(`/v1/admin/audit/reports/${uuid}/download`)

  const listLogins = (params: LoginAuditParams = {}) =>
    useApi<LoginAuditLogPageDto>('/v1/admin/audit/logins', {
      query: {
        email: params.email,
        userUuid: params.userUuid,
        result: params.result,
        from: params.from,
        to: params.to,
        filter: params.filter,
        page: params.page ?? 0,
        size: params.size ?? 20,
        sort: params.sort ?? 'attemptedAt,DESC',
      },
    })

  return { listDataChanges, firstChange, listReports, downloadReportUrl, listLogins }
}
