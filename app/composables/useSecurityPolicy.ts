import type { SecurityPolicyDto, SecurityPolicyUpdateRequest } from '~/types/securityPolicy'

/**
 * The single active auth security policy (`GET/PUT /v1/admin/security-policy`).
 * GET requires `SECURITY_POLICY_VIEW`, PUT requires `SECURITY_POLICY_UPDATE`.
 */
export const useSecurityPolicy = () => {
  const get = () => useApi<SecurityPolicyDto>('/v1/admin/security-policy')

  const update = (body: SecurityPolicyUpdateRequest) =>
    useApi<SecurityPolicyDto>('/v1/admin/security-policy', { method: 'PUT', body })

  return { get, update }
}
