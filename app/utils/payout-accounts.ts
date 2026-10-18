import type { PromoterPayoutAccountDto } from '~/types/promoters'

// Display helpers for advisor payout accounts (backend V184), shared by the
// admin tab and the advisor portal card.

/** Masks an account number to its last 4 digits ("•••• 2345"). */
export function maskAccountNumber(accountNumber?: string | null): string {
  if (!accountNumber) return ''
  return accountNumber.length <= 4 ? accountNumber : `•••• ${accountNumber.slice(-4)}`
}

/** "V-12345678" or '' when the holder document is not set. */
export function payoutHolderDocument(account: PromoterPayoutAccountDto): string {
  return account.holderDocumentType && account.holderDocumentNumber
    ? `${account.holderDocumentType}-${account.holderDocumentNumber}`
    : ''
}

/**
 * The single most identifying destination value of an account, whatever its
 * method: masked account number, else phone, else free identifier, else email.
 */
export function payoutDestination(account: PromoterPayoutAccountDto): string {
  if (account.accountNumber) return maskAccountNumber(account.accountNumber)
  return account.phone || account.accountIdentifier || account.email || ''
}
