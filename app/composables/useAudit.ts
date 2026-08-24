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
  /**
   * Omitted/empty → global listing across every entity (needs AUDIT_VIEW_ALL /
   * REPORT_AUDIT_VIEW_ALL). Accepts one or more entityKeys — see the TODO on
   * `listDataChanges`/`listReports` for how multi-value is currently handled.
   */
  entityKey?: string | string[]
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

/** Normalizes `entityKey` (string | string[] | undefined) into a deduped, trimmed array. */
function normalizeEntityKeys(entityKey?: string | string[]): string[] {
  const raw = Array.isArray(entityKey) ? entityKey : entityKey ? [entityKey] : []
  return [...new Set(raw.map(k => k.trim()).filter(Boolean))]
}

/** Fan-out fetch size used when merging multiple single-entityKey requests client-side. */
const MULTI_ENTITY_FETCH_SIZE = 1000

function sliceMergedPage<T>(
  items: T[],
  sortDate: (item: T) => string,
  page: number,
  size: number,
): { content: T[], totalElements: number, totalPages: number, number: number, size: number, numberOfElements: number, first: boolean, last: boolean, empty: boolean } {
  const merged = [...items].sort((a, b) => new Date(sortDate(b)).getTime() - new Date(sortDate(a)).getTime())
  const totalElements = merged.length
  const start = page * size
  const content = merged.slice(start, start + size)
  return {
    content,
    totalElements,
    totalPages: Math.max(1, Math.ceil(totalElements / size)),
    number: page,
    size,
    numberOfElements: content.length,
    first: page === 0,
    last: start + size >= totalElements,
    empty: content.length === 0,
  }
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
  const fetchDataChangesPage = (params: EntityAuditParams, entityKey: string | undefined, page: number, size: number) =>
    useApi<DataChangeAuditLogPageDto>('/v1/admin/audit/data-changes', {
      query: {
        entityKey,
        entityUuid: params.entityUuid,
        actorUuid: params.actorUuid,
        action: params.action,
        from: params.from,
        to: params.to,
        filter: params.filter,
        page,
        size,
        sort: params.sort ?? 'occurredAt,DESC',
      },
    })

  const listDataChanges = async (params: EntityAuditParams = {}): Promise<DataChangeAuditLogPageDto> => {
    const keys = normalizeEntityKeys(params.entityKey)
    const page = params.page ?? 0
    const size = params.size ?? 20
    if (keys.length <= 1) {
      return fetchDataChangesPage(params, keys[0], page, size)
    }
    // TODO: AdminDataChangeAuditController#list only accepts a single String `entityKey`
    // @RequestParam (not List<String>/repeatable) — see backend source. Until it supports
    // multi-value entityKey, fan out one request per selected key and merge/paginate
    // client-side. Move this fan-out server-side once the backend supports it.
    const pages = await Promise.all(keys.map(k => fetchDataChangesPage(params, k, 0, MULTI_ENTITY_FETCH_SIZE)))
    const merged = pages.flatMap(p => p.content ?? [])
    return { ...sliceMergedPage(merged, item => item.occurredAt, page, size), firstChange: null }
  }

  const firstChange = (entityKey: string, entityUuid: string) =>
    useApi<DataChangeAuditLogDto>('/v1/admin/audit/data-changes/first-change', {
      query: { entityKey, entityUuid },
    })

  const fetchReportsPage = (params: ReportAuditParams, entityKey: string | undefined, page: number, size: number) =>
    useApi<Page<ReportAuditLogDto>>('/v1/admin/audit/reports', {
      query: {
        reportType: params.reportType,
        entityKey,
        entityUuid: params.entityUuid,
        actorUuid: params.actorUuid,
        format: params.format,
        from: params.from,
        to: params.to,
        filter: params.filter,
        page,
        size,
        sort: params.sort ?? 'generatedAt,DESC',
      },
    })

  const listReports = async (params: ReportAuditParams = {}): Promise<Page<ReportAuditLogDto>> => {
    const keys = normalizeEntityKeys(params.entityKey)
    const page = params.page ?? 0
    const size = params.size ?? 20
    if (keys.length <= 1) {
      return fetchReportsPage(params, keys[0], page, size)
    }
    // TODO: AdminReportAuditController#list only accepts a single String `entityKey`
    // @RequestParam (not List<String>/repeatable) — see backend source. Until it supports
    // multi-value entityKey, fan out one request per selected key and merge/paginate
    // client-side. Move this fan-out server-side once the backend supports it.
    const pages = await Promise.all(keys.map(k => fetchReportsPage(params, k, 0, MULTI_ENTITY_FETCH_SIZE)))
    const merged = pages.flatMap(p => p.content ?? [])
    return sliceMergedPage(merged, item => item.generatedAt, page, size)
  }

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
