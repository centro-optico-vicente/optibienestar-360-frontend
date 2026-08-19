export interface SystemConfigDto {
  uuid: string
  reportFooter: string
  updatedAt?: string
}

export interface UpdateSystemConfigRequest {
  reportFooter: string
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
