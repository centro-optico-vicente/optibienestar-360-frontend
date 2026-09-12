// Tipos del vertical de Trabajos Programados (/v1/admin/scheduled-jobs).
//
// Cada job tiene un snapshot de su última ejecución embebido en el listado. El disparo
// manual (`run-now`) es híbrido: 200 cuando termina dentro de `maxSyncSeconds`, o 202
// cuando cae a asíncrono y hay que poll-ear el run vía /runs/{runUuid}. Las
// actualizaciones usan PATCH semantics (`code` no se puede cambiar).

/** Resultado de una ejecución de job. */
export type JobRunOutcome =
  | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'TIMEOUT' | 'SKIPPED_CONCURRENT' | 'CANCELED'

// `label` es el fallback en español; `labelKey` resuelve a i18n en el punto de uso.
export const JOB_RUN_OUTCOME_OPTIONS: { label: string, value: JobRunOutcome, labelKey: string }[] = [
  { label: 'En ejecución', value: 'RUNNING', labelKey: 'jobs.outcome.RUNNING' },
  { label: 'Éxito', value: 'SUCCESS', labelKey: 'jobs.outcome.SUCCESS' },
  { label: 'Fallido', value: 'FAILED', labelKey: 'jobs.outcome.FAILED' },
  { label: 'Timeout', value: 'TIMEOUT', labelKey: 'jobs.outcome.TIMEOUT' },
  { label: 'Omitido (concurrencia)', value: 'SKIPPED_CONCURRENT', labelKey: 'jobs.outcome.SKIPPED_CONCURRENT' },
  { label: 'Cancelado', value: 'CANCELED', labelKey: 'jobs.outcome.CANCELED' },
]

/** Origen del disparo de una ejecución. */
export type JobTriggerSource = 'SCHEDULED' | 'MANUAL' | 'STARTUP'

/** Scalars carry a localized `_Display` sibling (hub ADR 0014) — render it directly. */
export interface ScheduledJobDto {
  uuid: string
  code: string
  displayName: string
  description?: string
  // Programación
  cronExpression: string
  timezone: string
  enabled: boolean
  enabled_Display?: string | null
  // Política de ejecución
  allowConcurrent: boolean
  allowConcurrent_Display?: string | null
  maxSyncSeconds: number
  /** Reintentos adicionales tras el primer fallo. 0 = sin reintentos (default). */
  maxRetryAttempts: number
  /** Espera fija (segundos) entre intentos. Ignorado si maxRetryAttempts es 0. */
  retryDelaySeconds: number
  lockHeld: boolean
  lockHeld_Display?: string | null
  // Ejecutor (resuelto en vivo contra el registro de ScheduledJobRunner, no persistido)
  /** Clase Java que ejecuta este código, o null si no hay ninguna registrada. */
  runnerClass?: string | null
  /** false → el código no tiene ningún ScheduledJobRunner asociado; el job nunca se ejecutará. */
  runnerRegistered: boolean
  // Snapshot de la última ejecución
  lastRunAt?: string
  lastRunAt_Display?: string | null
  lastRunStatus?: JobRunOutcome | string
  lastRunStatus_Display?: string | null
  nextRunAt?: string
  nextRunAt_Display?: string | null
  // Auditoría
  active: boolean
  active_Display?: string | null
  status?: string
  status_Display?: string | null
  createdAt?: string
  createdAt_Display?: string | null
  updatedAt?: string
  updatedAt_Display?: string | null
}

/** Body de POST /v1/admin/scheduled-jobs. */
export interface ScheduledJobCreateRequest {
  /** UPPER_SNAKE_CASE, patrón ^[A-Z][A-Z0-9_]{0,79}$ */
  code: string
  displayName: string
  description?: string
  cronExpression: string
  timezone: string
  /** default true en el backend */
  enabled?: boolean
  /** default false en el backend */
  allowConcurrent?: boolean
  /** >= 0, default 30 en el backend */
  maxSyncSeconds?: number
  /** 0-10, default 0 en el backend */
  maxRetryAttempts?: number
  /** 0-3600, default 0 en el backend */
  retryDelaySeconds?: number
}

/** Body de PUT /v1/admin/scheduled-jobs/{uuid} (PATCH semantics; `code` no editable). */
export interface ScheduledJobUpdateRequest {
  displayName?: string
  description?: string
  cronExpression?: string
  /** IANA zone | "UTC" | "GMT[+/-h[:mm]]" */
  timezone?: string
  enabled?: boolean
  allowConcurrent?: boolean
  maxSyncSeconds?: number
  /** 0-10 */
  maxRetryAttempts?: number
  /** 0-3600 */
  retryDelaySeconds?: number
  /** knob de soft-delete */
  active?: boolean
  status?: string
}

/** Row of a job's execution history. Scalars carry a localized `_Display` sibling (hub ADR 0014). */
export interface ScheduledJobRunDto {
  uuid: string
  jobUuid: string
  jobCode: string
  startedAt?: string
  startedAt_Display?: string | null
  finishedAt?: string
  finishedAt_Display?: string | null
  durationMs?: number
  outcome?: JobRunOutcome | string
  outcome_Display?: string | null
  triggeredBy?: JobTriggerSource | string
  triggeredByUserUuid?: string
  summary?: Record<string, unknown>
  errorMessage?: string
  /** Intentos tomados hasta llegar al outcome final (1 = sin reintentos necesarios). */
  attemptCount?: number
  createdAt?: string
  createdAt_Display?: string | null
}

/**
 * Respuesta de POST /v1/admin/scheduled-jobs/{uuid}/run-now.
 * - 200 síncrono: `outcome` = "SUCCESS" | "FAILED", `summary` presente.
 * - 202 asíncrono: `outcome` = "RUNNING", `statusUrl` presente → poll-ear con getRun.
 */
export interface ManualRunResponse {
  runUuid: string
  outcome: 'SUCCESS' | 'FAILED' | 'RUNNING' | string
  summary?: Record<string, unknown>
  errorMessage?: string
  statusUrl?: string
}
