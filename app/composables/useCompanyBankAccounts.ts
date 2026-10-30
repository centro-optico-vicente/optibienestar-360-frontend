import type { Page } from '~/types/admin'
import type { CompanyBankAccountDto, CompanyBankAccountRequest } from '~/types/payments'

interface ListParams {
  page?: number
  size?: number
  sort?: string[]
  q?: string
  includeInactive?: boolean
}

/**
 * The company's own bank accounts (V201): admin CRUD (`/v1/admin/company-bank-accounts`, permissions
 * COMPANY_BANK_ACCOUNT_VIEW/CREATE/UPDATE/DELETE) and the read-only list any authenticated payer sees
 * (`/v1/me/company-bank-accounts`) to know where to deposit.
 */
export const useCompanyBankAccounts = () => {
  const list = (params: ListParams = {}) =>
    useApi<Page<CompanyBankAccountDto>>('/v1/admin/company-bank-accounts', {
      query: {
        page: params.page ?? 0,
        size: params.size ?? 20,
        ...(params.sort?.length ? { sort: params.sort } : {}),
        ...(params.q ? { q: params.q } : {}),
        ...(params.includeInactive ? { includeInactive: 'true' } : {}),
      },
    })

  const get = (uuid: string) =>
    useApi<CompanyBankAccountDto>(`/v1/admin/company-bank-accounts/${uuid}`)

  const create = (body: CompanyBankAccountRequest) =>
    useApi<CompanyBankAccountDto>('/v1/admin/company-bank-accounts', { method: 'POST', body })

  const update = (uuid: string, body: CompanyBankAccountRequest) =>
    useApi<CompanyBankAccountDto>(`/v1/admin/company-bank-accounts/${uuid}`, { method: 'PUT', body })

  /** Soft delete — the backend only deactivates the account. */
  const remove = (uuid: string) =>
    useApi<void>(`/v1/admin/company-bank-accounts/${uuid}`, { method: 'DELETE' })

  /** Active accounts in display order, for payers (any authenticated user). */
  const forPayers = () =>
    useApi<CompanyBankAccountDto[]>('/v1/me/company-bank-accounts', { silent: true })

  return { list, get, create, update, remove, forPayers }
}
