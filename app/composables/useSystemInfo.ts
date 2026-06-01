export interface SystemInfo {
  application: string
  version: string
  versionDate: string
  profile: string
  timestamp: string
}

/**
 * Información del sistema/backend (GET /v1/system-info). Público.
 */
export const useSystemInfo = () => {
  const get = () => useApi<SystemInfo>('/v1/system-info', { skipAuth: true, silent: true })
  return { get }
}
