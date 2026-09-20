import type { Page } from '~/types/admin'
import type {
  JobRunOutcome,
  JobTriggerSource,
  ManualRunResponse,
  ScheduledJobCreateRequest,
  ScheduledJobDto,
  ScheduledJobRunDto,
  ScheduledJobUpdateRequest,
} from '~/types/scheduling'

interface ListParams {
  page?: number
  size?: number
  /** Multi-column sort, e.g. `['code,asc']` — repeated as `sort=` query params. */
  sort?: string[]
  filter?: string
  q?: string
  includeInactive?: boolean
}

interface RunListParams {
  page?: number
  size?: number
  /** Multi-column sort — repeated as `sort=` query params. */
  sort?: string[]
  outcome?: JobRunOutcome
  triggeredBy?: JobTriggerSource
  /** ISO instant (inclusive), filters by `startedAt`. */
  from?: string
  /** ISO instant (inclusive), filters by `startedAt`. */
  to?: string
}

/**
 * Acceso al vertical de Trabajos Programados (/v1/admin/scheduled-jobs).
 * Permisos del backend por acción:
 * - list/get/listRuns/getRun → JOB_VIEW_ALL · create → JOB_CREATE
 * - update → JOB_UPDATE · remove → JOB_DELETE · runNow → JOB_RUN_NOW
 *
 * `runNow` es híbrido: la respuesta trae `outcome: "RUNNING"` + `statusUrl` cuando el
 * backend responde 202 (asíncrono); en ese caso poll-ear con `getRun(uuid, runUuid)`.
 */
export const useScheduledJobs = () => {
  const list = (params: ListParams = {}) =>
    useApi<Page<ScheduledJobDto>>('/v1/admin/scheduled-jobs', {
      query: {
        page: params.page ?? 0,
        size: params.size ?? 50,
        ...(params.sort?.length ? { sort: params.sort } : {}),
        ...(params.filter ? { filter: params.filter } : {}),
        ...(params.q ? { q: params.q } : {}),
        ...(params.includeInactive ? { includeInactive: 'true' } : {}),
      },
    })

  const get = (uuid: string) =>
    useApi<ScheduledJobDto>(`/v1/admin/scheduled-jobs/${uuid}`)

  const create = (body: ScheduledJobCreateRequest) =>
    useApi<ScheduledJobDto>('/v1/admin/scheduled-jobs', { method: 'POST', body })

  const update = (uuid: string, body: ScheduledJobUpdateRequest) =>
    useApi<ScheduledJobDto>(`/v1/admin/scheduled-jobs/${uuid}`, { method: 'PUT', body })

  const remove = (uuid: string, physical = false) =>
    useApi<null>(`/v1/admin/scheduled-jobs/${uuid}`, { method: 'DELETE', query: physical ? { physical: true } : {} })

  /** "Ping" of FK usage before deleting: lets the UI offer a physical delete vs. a deactivation. */
  const usage = (uuid: string) =>
    useApi<{ inUse: boolean, count: number }>(`/v1/admin/scheduled-jobs/${uuid}/usage`)

  /** Dispara el job ahora (sync 200 o async 202 → poll con getRun). */
  const runNow = (uuid: string) =>
    useApi<ManualRunResponse>(`/v1/admin/scheduled-jobs/${uuid}/run-now`, { method: 'POST', body: {} })

  /** Histórico de ejecuciones del job (paginado). */
  const listRuns = (uuid: string, params: RunListParams = {}) =>
    useApi<Page<ScheduledJobRunDto>>(`/v1/admin/scheduled-jobs/${uuid}/runs`, {
      query: {
        page: params.page ?? 0,
        size: params.size ?? 20,
        ...(params.sort?.length ? { sort: params.sort } : {}),
        ...(params.outcome ? { outcome: params.outcome } : {}),
        ...(params.triggeredBy ? { triggeredBy: params.triggeredBy } : {}),
        ...(params.from ? { from: params.from } : {}),
        ...(params.to ? { to: params.to } : {}),
      },
    })

  /** Una ejecución puntual (para poll-ear un disparo manual asíncrono). */
  const getRun = (uuid: string, runUuid: string) =>
    useApi<ScheduledJobRunDto>(`/v1/admin/scheduled-jobs/${uuid}/runs/${runUuid}`)

  return { list, get, create, update, remove, usage, runNow, listRuns, getRun }
}
