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

export interface ScheduledJobDto {
  uuid: string
  code: string
  displayName: string
  description?: string
  // Programación
  cronExpression: string
  timezone: string
  enabled: boolean
  // Política de ejecución
  allowConcurrent: boolean
  maxSyncSeconds: number
  lockHeld: boolean
  // Snapshot de la última ejecución
  lastRunAt?: string
  lastRunStatus?: JobRunOutcome | string
  nextRunAt?: string
  // Auditoría
  active: boolean
  status?: string
  createdAt?: string
  updatedAt?: string
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
  /** knob de soft-delete */
  active?: boolean
  status?: string
}

/** Fila del histórico de ejecuciones de un job. */
export interface ScheduledJobRunDto {
  uuid: string
  jobUuid: string
  jobCode: string
  startedAt?: string
  finishedAt?: string
  durationMs?: number
  outcome?: JobRunOutcome | string
  triggeredBy?: JobTriggerSource | string
  triggeredByUserUuid?: string
  summary?: Record<string, unknown>
  errorMessage?: string
  createdAt?: string
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
