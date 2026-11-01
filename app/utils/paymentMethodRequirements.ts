// What an account must hold when it accepts several payment methods (hub ADR 0033): the union of the
// `mandatory*` checks of every method it accepts, read from the payment methods catalog (same rule as the backend).

/** The `mandatory*` checks a payment method carries (a subset of `CatalogItem`). */
export interface MethodChecks {
  mandatoryBank?: boolean
  mandatoryIdentification?: boolean
  mandatoryAccountType?: boolean
  mandatoryAccountCode?: boolean
  mandatoryBankAccount?: boolean
  mandatoryPhone?: boolean
  mandatoryEmail?: boolean
}

export interface RequiredAccountFields {
  bank: boolean
  identification: boolean
  accountType: boolean
  /** Structured account number (`mandatoryAccountCode`). */
  accountCode: boolean
  /** Free-form account identifier (`mandatoryBankAccount`: Ubii, international transfer…). */
  bankAccount: boolean
  /** Either number flag: the company accounts keep a single number column. */
  accountNumber: boolean
  phone: boolean
  email: boolean
}

export function requiredFields(methods: MethodChecks[]): RequiredAccountFields {
  const any = (pick: (m: MethodChecks) => boolean | undefined) => methods.some(m => Boolean(pick(m)))
  const accountCode = any(m => m.mandatoryAccountCode)
  const bankAccount = any(m => m.mandatoryBankAccount)
  return {
    bank: any(m => m.mandatoryBank),
    identification: any(m => m.mandatoryIdentification),
    accountType: any(m => m.mandatoryAccountType),
    accountCode,
    bankAccount,
    accountNumber: accountCode || bankAccount,
    phone: any(m => m.mandatoryPhone),
    email: any(m => m.mandatoryEmail),
  }
}
