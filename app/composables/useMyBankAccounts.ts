import type { MyBankAccountRequest, SavedOriginAccountDto } from '~/types/payments'

/**
 * The caller's own origin bank accounts (V204). Own data, so any logged-in user may use them — no permission:
 * the backend always scopes to the caller's person. Ticking "remember this account" on a payment adds to the
 * same list; the "Mis cuentas bancarias" screen lists, adds, edits and removes them.
 */
export const useMyBankAccounts = () => {
  // `silent`: the payment form hides the picker when there is nothing to show, so a failure is not worth a toast.
  const list = () => useApi<SavedOriginAccountDto[]>('/v1/me/bank-accounts', { silent: true })

  const get = (uuid: string) => useApi<SavedOriginAccountDto>(`/v1/me/bank-accounts/${uuid}`)

  const create = (body: MyBankAccountRequest) =>
    useApi<SavedOriginAccountDto>('/v1/me/bank-accounts', { method: 'POST', body })

  const update = (uuid: string, body: MyBankAccountRequest) =>
    useApi<SavedOriginAccountDto>(`/v1/me/bank-accounts/${uuid}`, { method: 'PUT', body })

  const remove = (uuid: string) => useApi<void>(`/v1/me/bank-accounts/${uuid}`, { method: 'DELETE' })

  return { list, get, create, update, remove }
}
