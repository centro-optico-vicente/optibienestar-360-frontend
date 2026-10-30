import type { SavedOriginAccountDto } from '~/types/payments'

/**
 * The origin bank accounts the caller chose to remember (V204, COLLECTION_CREATE_OWN). They are saved by ticking
 * "remember this account" on a payment (`rememberOriginAccount`); here they are listed to reuse and removed.
 */
export const useMyBankAccounts = () => {
  const list = () => useApi<SavedOriginAccountDto[]>('/v1/me/bank-accounts', { silent: true })

  const remove = (uuid: string) => useApi<void>(`/v1/me/bank-accounts/${uuid}`, { method: 'DELETE' })

  return { list, remove }
}
