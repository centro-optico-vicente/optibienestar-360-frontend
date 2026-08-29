import type { ConfigSortOrder } from '~/composables/useSystemConfig'

export interface EntityConfigDto {
  uuid: string
  entityKey: string
  displayName: string
  tableName?: string | null
  enabled: boolean
  auditCreate: boolean
  auditUpdate: boolean
  auditDelete: boolean
  auditReport: boolean
  captureBeforeAfter: boolean
  /** Per-entity default sort — field names are the entity's own list-item keys (e.g. `name`, `allyTypeName`). */
  defaultSort?: ConfigSortOrder[] | null
  notes?: string | null
  updatedAt?: string
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
export const useEntityConfig = () => {
  const list = () => useApi<EntityConfigDto[]>('/v1/admin/entity-config')

  const get = (entityKey: string) => useApi<EntityConfigDto>(`/v1/admin/entity-config/${entityKey}`)

  const create = (body: CreateEntityConfigRequest) =>
    useApi<EntityConfigDto>('/v1/admin/entity-config', { method: 'POST', body })

  const update = (entityKey: string, body: UpdateEntityConfigRequest) =>
    useApi<EntityConfigDto>(`/v1/admin/entity-config/${entityKey}`, { method: 'PUT', body })

  const remove = (entityKey: string) =>
    useApi<null>(`/v1/admin/entity-config/${entityKey}`, { method: 'DELETE' })

  return { list, get, create, update, remove }
}
