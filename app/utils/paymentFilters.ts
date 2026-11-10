// State + query mapping for <PaymentMasterFilters>, shared by every payments list.
export interface PaymentMasterFilterState {
  memberUuid: string
  paymentMethodUuid: string
  bankUuid: string
  categoryUuid: string
  promoterUuid: string
  currency: string
  dateFrom: string
  dateTo: string
}

export const emptyPaymentMasterFilters = (): PaymentMasterFilterState => ({
  memberUuid: '',
  paymentMethodUuid: '',
  bankUuid: '',
  categoryUuid: '',
  promoterUuid: '',
  currency: '',
  dateFrom: '',
  dateTo: '',
})

/** Dedicated query params the backend list accepts (blank ones are omitted). */
export function paymentFilterQuery(f: PaymentMasterFilterState) {
  return {
    memberUuid: f.memberUuid || undefined,
    paymentMethodUuid: f.paymentMethodUuid || undefined,
    bankUuid: f.bankUuid || undefined,
    categoryUuid: f.categoryUuid || undefined,
    promoterUuid: f.promoterUuid || undefined,
    dateFrom: f.dateFrom || undefined,
    dateTo: f.dateTo || undefined,
  }
}

/** Currency has no dedicated param: it rides the RSQL `filter` (`currency.code` is allow-listed). */
export function joinRsql(...clauses: Array<string | null | undefined | false>): string | undefined {
  const parts = clauses.filter((c): c is string => !!c)
  return parts.length ? parts.join(';') : undefined
}
