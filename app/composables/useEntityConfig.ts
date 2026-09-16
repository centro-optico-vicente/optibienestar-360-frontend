import type { ConfigSortOrder } from '~/composables/useSystemConfig'
import type { Page } from '~/types/admin'

/** Boolean flags and `updatedAt` carry a localized `_Display` sibling (hub ADR 0014). */
export interface EntityConfigDto {
  uuid: string
  entityKey: string
  displayName: string
  tableName?: string | null
  enabled: boolean
  enabled_Display?: string | null
  auditCreate: boolean
  auditUpdate: boolean
  auditDelete: boolean
  auditReport: boolean
  captureBeforeAfter: boolean
  /** Per-entity default sort — field names are the entity's own list-item keys (e.g. `name`, `allyType_Display`). */
  defaultSort?: ConfigSortOrder[] | null
  notes?: string | null
  updatedAt?: string
  updatedAt_Display?: string | null
}

export interface CreateEntityConfigRequest {
  entityKey: string
  displayName: string
  tableName?: string
  notes?: string
}

export interface UpdateEntityConfigRequest {
  enabled: boolean
  auditCreate: boolean
  auditUpdate: boolean
  auditDelete: boolean
  auditReport: boolean
  captureBeforeAfter: boolean
  defaultSort?: ConfigSortOrder[]
  notes?: string
}

/**
 * Admin CRUD for `entity_config` (audit toggles + default sort per entity),
 * gated by the granular ENTITY_CONFIG_VIEW/_CREATE/_UPDATE/_DELETE —
 * SYSTEM role only for now (backend V81).
 */
interface ListParams {
  page?: number
  size?: number
  sort?: string[]
  filter?: string
}

export const useEntityConfig = () => {
  const list = (params: ListParams = {}) =>
    useApi<Page<EntityConfigDto>>('/v1/admin/entity-config', {
      query: {
        page: params.page ?? 0,
        size: params.size ?? 20,
        ...(params.sort?.length ? { sort: params.sort } : {}),
        ...(params.filter ? { filter: params.filter } : {}),
      },
    })

  const get = (entityKey: string) => useApi<EntityConfigDto>(`/v1/admin/entity-config/${entityKey}`)

  const create = (body: CreateEntityConfigRequest) =>
    useApi<EntityConfigDto>('/v1/admin/entity-config', { method: 'POST', body })

  const update = (entityKey: string, body: UpdateEntityConfigRequest) =>
    useApi<EntityConfigDto>(`/v1/admin/entity-config/${entityKey}`, { method: 'PUT', body })

  const remove = (entityKey: string) =>
    useApi<null>(`/v1/admin/entity-config/${entityKey}`, { method: 'DELETE' })

  return { list, get, create, update, remove }
}
