export type AuditMode = 'PER_ENTITY' | 'FORCE_ENABLED' | 'FORCE_DISABLED'

export interface ConfigSortOrder {
  field: string
  direction: 'ASC' | 'DESC'
}

/** Whitelist for `SystemConfigDto.defaultSort` — common columns every (or nearly every) entity has. */
export const COMMON_SORT_FIELDS = ['id', 'uuid', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy'] as const

export interface SystemConfigDto {
  uuid: string
  reportFooter: string
  auditCreateMode: AuditMode
  auditUpdateMode: AuditMode
  auditDeleteMode: AuditMode
  captureBeforeAfterMode: AuditMode
  reportAuditMode: AuditMode
  loginAuditEnabled: boolean
  loginSessionExpirationDays: number
  /** Global fallback default sort, restricted to COMMON_SORT_FIELDS. Empty/absent = unconfigured. */
  defaultSort?: ConfigSortOrder[] | null
  /** Medical allies may read their patients' medical history (backend V215, hub ADR 0032). Off by default. */
  patientMedicalAccessEnabled?: boolean
  updatedAt?: string
}

export interface UpdateSystemConfigRequest {
  reportFooter?: string
  auditCreateMode?: AuditMode
  auditUpdateMode?: AuditMode
  auditDeleteMode?: AuditMode
  captureBeforeAfterMode?: AuditMode
  reportAuditMode?: AuditMode
  loginAuditEnabled?: boolean
  loginSessionExpirationDays?: number
  defaultSort?: ConfigSortOrder[]
  patientMedicalAccessEnabled?: boolean
}

export const useSystemConfig = () => {
  const get = () => useApi<SystemConfigDto>('/v1/system-configs')

  const update = (body: UpdateSystemConfigRequest) =>
    useApi<SystemConfigDto>('/v1/system-configs', { method: 'PUT', body })


  return {
    get,
    update,
  }
}
