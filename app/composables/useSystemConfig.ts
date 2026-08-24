export type AuditMode = 'PER_ENTITY' | 'FORCE_ENABLED' | 'FORCE_DISABLED'

export interface SystemConfigDto {
  uuid: string
  reportFooter: string
  dataChangeAuditMode: AuditMode
  reportAuditMode: AuditMode
  loginAuditEnabled: boolean
  loginSessionExpirationDays: number
  updatedAt?: string
}

export interface UpdateSystemConfigRequest {
  reportFooter?: string
  dataChangeAuditMode?: AuditMode
  reportAuditMode?: AuditMode
  loginAuditEnabled?: boolean
  loginSessionExpirationDays?: number
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
