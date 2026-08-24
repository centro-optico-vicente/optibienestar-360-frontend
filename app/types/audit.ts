// Tipos de auditoría, alineados con el OpenAPI del backend (AdminDataChangeAuditController /
// AdminReportAuditController). Bitácora de cambios (data-change) y bitácora de reportes
// generados (report), ambas filtrables por entityKey + entityUuid.

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE'

/** GET /v1/admin/audit/data-changes — un cambio individual sobre una entidad. */
export interface DataChangeAuditLogDto {
  uuid: string
  entityKey: string
  entityUuid: string
  entityDisplay?: string | null
  action: AuditAction
  action_Display?: string | null
  // JSON genérico (mapa clave/valor); cada clave puede traer un sibling `<campo>_Display`.
  beforeJson?: Record<string, unknown> | null
  afterJson?: Record<string, unknown> | null
  actorUuid?: string | null
  actor_Display?: string | null
  requestMethod?: string | null
  requestPath?: string | null
  occurredAt: string
}

export interface DataChangeAuditLogPageDto {
  content: DataChangeAuditLogDto[]
  totalElements: number
  totalPages: number
  size: number
  number: number
  numberOfElements: number
  first: boolean
  last: boolean
  empty: boolean
  /** Fila más antigua para la entidad consultada (típicamente el CREATE). */
  firstChange?: DataChangeAuditLogDto | null
}

/** GET /v1/admin/audit/reports — un reporte generado. */
export interface ReportAuditLogDto {
  uuid: string
  reportType: string
  entityKey?: string | null
  entityUuid?: string | null
  entityDisplay?: string | null
  entityIdentifier?: string | null
  format: string
  parametersJson?: Record<string, unknown> | null
  actorUuid?: string | null
  actor_Display?: string | null
  fileUuid?: string | null
  fileName?: string | null
  sizeBytes?: number | null
  generatedAt: string
}
