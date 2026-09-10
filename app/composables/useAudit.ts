import type { Page } from '~/types/admin'
import type {
  AuditAction,
  DataChangeAuditLogDto,
  DataChangeAuditLogPageDto,
  LoginAuditLogPageDto,
  LoginAuditResult,
  ReportAuditLogDto,
} from '~/types/audit'
import type { JobRunOutcome, JobTriggerSource, ScheduledJobRunDto } from '~/types/scheduling'

interface EntityAuditParams {
  /**
   * Omitted/empty → global listing across every entity (needs AUDIT_VIEW_ALL /
   * REPORT_AUDIT_VIEW_ALL). Accepts one or more entityKeys — see the TODO on
   * `listDataChanges`/`listReports` for how multi-value is currently handled.
   */
  entityKey?: string | string[]
  entityUuid?: string
  actorUuid?: string
  /** Accepts one or more actions — see the fan-out TODO on `listDataChanges`. */
  action?: AuditAction | AuditAction[]
  from?: string
  to?: string
  filter?: string
  page?: number
  size?: number
  sort?: string
}

/** Normalizes a `string | string[] | undefined` filter into a deduped, trimmed array. */
function normalizeValues<T extends string>(value?: T | T[]): T[] {
  const raw = Array.isArray(value) ? value : value ? [value] : []
  return [...new Set(raw.map(v => v.trim()).filter(Boolean))] as T[]
}

/** Cartesian product of two filter-value arrays, using `undefined` as "no filter" for an empty side. */
function crossProduct<A extends string, B extends string>(as: A[], bs: B[]): Array<[A | undefined, B | undefined]> {
  const left = as.length ? as : [undefined]
  const right = bs.length ? bs : [undefined]
  return left.flatMap(a => right.map((b): [A | undefined, B | undefined] => [a, b]))
}

/**
 * Fan-out fetch size used when merging multiple single-filter requests client-side.
 * Must not exceed the backend's page size cap (MAX_PAGE_SIZE = 200 in
 * ReportAuditQueryService/DataChangeAuditQueryService/LoginAuditQueryService),
 * or the request is rejected with a 422 before any merging happens.
 */
const MULTI_ENTITY_FETCH_SIZE = 200

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

interface ReportAuditParams extends Omit<EntityAuditParams, 'action'> {
  reportType?: string
  /** Accepts one or more formats — see the fan-out TODO on `listReports`. */
  format?: string | string[]
}

interface JobRunAuditParams {
  jobUuid?: string
  /** Accepts one or more outcomes — see the fan-out TODO on `listJobRuns`. */
  outcome?: JobRunOutcome | JobRunOutcome[]
  /** Accepts one or more trigger sources — see the fan-out TODO on `listJobRuns`. */
  triggeredBy?: JobTriggerSource | JobTriggerSource[]
  from?: string
  to?: string
  page?: number
  size?: number
  sort?: string[]
}

interface LoginAuditParams {
  /** Deep-link target for the "ver sesión" action on data-changes/reports rows — the session's own uuid. */
  uuid?: string
  email?: string
  userUuid?: string
  /** Accepts one or more results — see the fan-out TODO on `listLogins`. */
  result?: LoginAuditResult | LoginAuditResult[]
  from?: string
  to?: string
  filter?: string
  page?: number
  size?: number
  sort?: string[]
}

/**
 * Acceso a la bitácora de auditoría (/v1/admin/audit/*).
 * data-changes/reports son genéricos por entidad, pero pasar sin entityKey/entityUuid
 * consulta el histórico global (AUDIT_VIEW_ALL / REPORT_AUDIT_VIEW_ALL respectivamente).
 * logins es siempre global (AUDIT_VIEW_LOGIN).
 */
export const useAudit = () => {
  const fetchDataChangesPage = (
    params: EntityAuditParams,
    entityKey: string | undefined,
    action: AuditAction | undefined,
    page: number,
    size: number,
  ) =>
    useApi<DataChangeAuditLogPageDto>('/v1/admin/audit/data-changes', {
      query: {
        entityKey,
        entityUuid: params.entityUuid,
        actorUuid: params.actorUuid,
        action,
        from: params.from,
        to: params.to,
        filter: params.filter,
        page,
        size,
        sort: params.sort ?? 'occurredAt,DESC',
      },
    })

  const listDataChanges = async (params: EntityAuditParams = {}): Promise<DataChangeAuditLogPageDto> => {
    const keys = normalizeValues(params.entityKey)
    const actions = normalizeValues(params.action)
    const page = params.page ?? 0
    const size = params.size ?? 20
    const combos = crossProduct(keys, actions)
    if (combos.length <= 1) {
      const [key, action] = combos[0] ?? [undefined, undefined]
      return fetchDataChangesPage(params, key, action, page, size)
    }
    // TODO: AdminDataChangeAuditController#list only accepts single String/enum
    // `entityKey`/`action` @RequestParam (not List<...>/repeatable) — see backend
    // source. Until it supports multi-value filters, fan out one request per
    // selected entityKey×action combination and merge/paginate client-side. Move
    // this fan-out server-side once the backend supports it.
    const pages = await Promise.all(
      combos.map(([key, action]) => fetchDataChangesPage(params, key, action, 0, MULTI_ENTITY_FETCH_SIZE)),
    )
    const merged = pages.flatMap(p => p.content ?? [])
    return { ...sliceMergedPage(merged, item => item.occurredAt, page, size), firstChange: null }
  }

  const firstChange = (entityKey: string, entityUuid: string) =>
    useApi<DataChangeAuditLogDto>('/v1/admin/audit/data-changes/first-change', {
      query: { entityKey, entityUuid },
    })

  const fetchReportsPage = (
    params: ReportAuditParams,
    entityKey: string | undefined,
    format: string | undefined,
    page: number,
    size: number,
  ) =>
    useApi<Page<ReportAuditLogDto>>('/v1/admin/audit/reports', {
      query: {
        reportType: params.reportType,
        entityKey,
        entityUuid: params.entityUuid,
        actorUuid: params.actorUuid,
        format,
        from: params.from,
        to: params.to,
        filter: params.filter,
        page,
        size,
        sort: params.sort ?? 'generatedAt,DESC',
      },
    })

  const listReports = async (params: ReportAuditParams = {}): Promise<Page<ReportAuditLogDto>> => {
    const keys = normalizeValues(params.entityKey)
    const formats = normalizeValues(params.format)
    const page = params.page ?? 0
    const size = params.size ?? 20
    const combos = crossProduct(keys, formats)
    if (combos.length <= 1) {
      const [key, format] = combos[0] ?? [undefined, undefined]
      return fetchReportsPage(params, key, format, page, size)
    }
    // TODO: AdminReportAuditController#list only accepts a single String
    // `entityKey`/`format` @RequestParam (not List<String>/repeatable) — see
    // backend source. Until it supports multi-value filters, fan out one request
    // per selected entityKey×format combination and merge/paginate client-side.
    // Move this fan-out server-side once the backend supports it.
    const pages = await Promise.all(
      combos.map(([key, format]) => fetchReportsPage(params, key, format, 0, MULTI_ENTITY_FETCH_SIZE)),
    )
    const merged = pages.flatMap(p => p.content ?? [])
    return sliceMergedPage(merged, item => item.generatedAt, page, size)
  }

  const downloadReportUrl = (uuid: string) =>
    useApi<{ url: string }>(`/v1/admin/audit/reports/${uuid}/download`)

  const fetchLoginsPage = (params: LoginAuditParams, result: LoginAuditResult | undefined, page: number, size: number) =>
    useApi<LoginAuditLogPageDto>('/v1/admin/audit/logins', {
      query: {
        uuid: params.uuid,
        email: params.email,
        userUuid: params.userUuid,
        result,
        from: params.from,
        to: params.to,
        filter: params.filter,
        page,
        size,
        ...(params.sort?.length ? { sort: params.sort } : {}),
      },
    })

  const listLogins = async (params: LoginAuditParams = {}): Promise<LoginAuditLogPageDto> => {
    const results = normalizeValues(params.result)
    const page = params.page ?? 0
    const size = params.size ?? 20
    if (results.length <= 1) {
      return fetchLoginsPage(params, results[0], page, size)
    }
    // TODO: AdminLoginAuditController#list only accepts a single `LoginAuditResult`
    // @RequestParam (not List<...>/repeatable) — see backend source. Until it
    // supports multi-value `result`, fan out one request per selected result and
    // merge/paginate client-side. Move this fan-out server-side once supported.
    const pages = await Promise.all(results.map(r => fetchLoginsPage(params, r, 0, MULTI_ENTITY_FETCH_SIZE)))
    const merged = pages.flatMap(p => p.content ?? [])
    return sliceMergedPage(merged, item => item.attemptedAt, page, size)
  }

  const fetchJobRunsPage = (
    params: JobRunAuditParams,
    outcome: JobRunOutcome | undefined,
    triggeredBy: JobTriggerSource | undefined,
    page: number,
    size: number,
  ) =>
    useApi<Page<ScheduledJobRunDto>>('/v1/admin/audit/job-runs', {
      query: {
        jobUuid: params.jobUuid,
        outcome,
        triggeredBy,
        from: params.from,
        to: params.to,
        page,
        size,
        ...(params.sort?.length ? { sort: params.sort } : {}),
      },
    })

  /** GET /v1/admin/audit/job-runs — cross-job execution history (Seguridad → "Ejecuciones programadas"). */
  const listJobRuns = async (params: JobRunAuditParams = {}): Promise<Page<ScheduledJobRunDto>> => {
    const outcomes = normalizeValues(params.outcome)
    const triggers = normalizeValues(params.triggeredBy)
    const page = params.page ?? 0
    const size = params.size ?? 20
    const combos = crossProduct(outcomes, triggers)
    if (combos.length <= 1) {
      const [outcome, triggeredBy] = combos[0] ?? [undefined, undefined]
      return fetchJobRunsPage(params, outcome, triggeredBy, page, size)
    }
    // TODO: AdminScheduledJobRunAuditController#list only accepts single enum
    // `outcome`/`triggeredBy` @RequestParam (not List<...>/repeatable) — see
    // backend source. Until it supports multi-value filters, fan out one request
    // per selected outcome×triggeredBy combination and merge/paginate client-side.
    // Move this fan-out server-side once the backend supports it.
    const pages = await Promise.all(
      combos.map(([outcome, triggeredBy]) => fetchJobRunsPage(params, outcome, triggeredBy, 0, MULTI_ENTITY_FETCH_SIZE)),
    )
    const merged = pages.flatMap(p => p.content ?? [])
    return sliceMergedPage(merged, item => item.startedAt ?? item.createdAt ?? '', page, size)
  }

  return { listDataChanges, firstChange, listReports, downloadReportUrl, listLogins, listJobRuns }
}
