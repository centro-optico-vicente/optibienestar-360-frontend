// Tipos de auditoría, alineados con el OpenAPI del backend (AdminDataChangeAuditController /
// AdminReportAuditController / AdminLoginAuditController). Bitácora de cambios (data-change),
// bitácora de reportes generados (report) y bitácora de accesos/sesiones (login) — las dos
// primeras filtrables por entityKey + entityUuid (o globales si se omiten), la de logins
// filtrable por email/userUuid/result/rango de fechas.

import type { ConfigSortOrder } from '~/composables/useSystemConfig'

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE'

/** Matches backend enum `LoginAuditResult` (V61). */
export type LoginAuditResult = 'SUCCESS' | 'FAILED_CREDENTIALS' | 'FAILED_LOCKED' | 'FAILED_INACTIVE'

/** Matches backend enum `LoginSessionStatus` (V61) — only set for SUCCESS rows. */
export type LoginSessionStatus = 'ACTIVE' | 'LOGGED_OUT' | 'EXPIRED' | 'REVOKED'

/** GET /v1/admin/audit/logins — one login attempt / session row. */
export interface LoginAuditLogDto {
  uuid: string
  userUuid?: string | null
  attemptedEmail: string
  result: LoginAuditResult
  result_Display?: string | null
  roles?: string[] | null
  locale?: string | null
  ipAddress?: string | null
  userAgent?: string | null
  hostname?: string | null
  failureReason?: string | null
  sessionStatus?: LoginSessionStatus | null
  sessionExpiresAt?: string | null
  valid: boolean
  loggedOutAt?: string | null
  logoutReason?: string | null
  attemptedAt: string
}

export interface LoginAuditLogPageDto {
  content: LoginAuditLogDto[]
  totalElements: number
  totalPages: number
  size: number
  number: number
  numberOfElements: number
  first: boolean
  last: boolean
  empty: boolean
  /** The sort actually applied — present now that this endpoint is backed by `AppliedSortPage`. */
  appliedSort?: ConfigSortOrder[]
}

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
