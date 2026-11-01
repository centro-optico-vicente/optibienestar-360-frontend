import type { CompanyBankAccountDto } from '~/types/payments'
import type { PromoterPayoutAccountDto } from '~/types/promoters'

// Text builders for copying a bank account (a company account or an advisor's payout account) into a bank app.
// Pure functions (no Vue, no i18n) so the exact formats are easy to read and to test.

/** Payment method code whose payments go to a phone number (Pago Móvil). */
export const MOBILE_PAYMENT_METHOD = 'PAGO_MOVIL'

/** The fields a copy needs, whatever kind of account they come from. */
export interface CopyableAccount {
  /** The method this copy is for (the payment line's method); empty = no particular method (public page, admin views). */
  methodCode?: string | null
  methodName?: string | null
  /** Every method the account accepts (V217), for the "Acepta: …" line and to know if it takes Pago Móvil. */
  acceptedMethods?: { code: string, name: string }[]
  /** Catalog uuid of the bank — only to look up its official name for the tooltip (hub ADR 0030). */
  bankUuid?: string | null
  /** SUDEBAN code of the bank, e.g. "0105". */
  bankCode?: string | null
  bankName?: string | null
  accountType?: string | null
  accountNumber?: string | null
  holderName?: string | null
  /** As stored, e.g. "J-12345678-9"; normalized only when copied. */
  document?: string | null
  phone?: string | null
  email?: string | null
}

/**
 * With a method (the payment line's), only the fields of that method are kept for display and copy: a Pago Móvil
 * shows the phone and no account number / type, any other method shows the account and no phone. This is display
 * only — what an account must hold is validated by the backend from the methods' `mandatory*` checks.
 */
function restrictToMethod(account: CopyableAccount, methodCode?: string | null): CopyableAccount {
  const method = methodCode ? account.acceptedMethods?.find(m => m.code === methodCode) : undefined
  if (!methodCode) return account
  const mobile = isMobilePayment(methodCode)
  return {
    ...account,
    methodCode,
    methodName: method?.name ?? account.methodName,
    accountType: mobile ? null : account.accountType,
    accountNumber: mobile ? null : account.accountNumber,
    phone: mobile ? account.phone : null,
  }
}

export function fromCompanyAccount(a: CompanyBankAccountDto, methodCode?: string | null): CopyableAccount {
  return restrictToMethod({
    acceptedMethods: (a.paymentMethods ?? []).map(m => ({ code: m.code, name: m.name })),
    bankUuid: a.bank_Uuid,
    bankCode: a.bankCode ?? a.bank_Code,
    bankName: a.bank_Display,
    accountType: a.accountType,
    accountNumber: a.accountNumber,
    holderName: a.holderName,
    document: a.holderDocument,
    phone: a.phone,
    email: a.email,
  }, methodCode)
}

export function fromPayoutAccount(a: PromoterPayoutAccountDto, methodCode?: string | null): CopyableAccount {
  return restrictToMethod({
    acceptedMethods: (a.paymentMethods ?? []).map(m => ({ code: m.code, name: m.name })),
    bankUuid: a.bank_Uuid,
    bankCode: a.bank_Code,
    bankName: a.bank_Display,
    accountType: a.accountType,
    accountNumber: a.accountNumber ?? a.accountIdentifier,
    holderName: a.holderName,
    document: a.holderDocumentType && a.holderDocumentNumber ? `${a.holderDocumentType}${a.holderDocumentNumber}` : null,
    phone: a.phone,
    email: a.email,
  }, methodCode)
}

export function isMobilePayment(methodCode?: string | null): boolean {
  return methodCode?.toUpperCase() === MOBILE_PAYMENT_METHOD
}

/** "J-12.345.678-9" → "J123456789": the form banks accept (no spaces, dots or hyphens). */
export function normalizeDocument(document?: string | null): string {
  return (document ?? '').replace(/[\s.\-]/g, '').toUpperCase()
}

/** "0105 Mercantil": bank code and name, as the bank apps list them. */
export function bankCodeAndName(account: Pick<CopyableAccount, 'bankCode' | 'bankName'>): string {
  return [account.bankCode, account.bankName].filter(Boolean).join(' ')
}

/** Bolívares as the bank apps expect them: two decimals, decimal comma, no thousands separator ("1234,56"). */
export function formatBolivares(amount: number): string {
  return (Math.round(amount * 100) / 100).toFixed(2).replace('.', ',')
}

/**
 * Pago Móvil, one item per line, in the order the banks support: phone, cédula or RIF, bank code + name, and the
 * amount in bolívares only when it is known.
 */
export function buildMobilePaymentCopy(account: CopyableAccount, amountVes?: number | null): string {
  const lines = [(account.phone ?? '').trim(), normalizeDocument(account.document), bankCodeAndName(account)]
  if (amountVes !== null && amountVes !== undefined && Number.isFinite(amountVes) && amountVes > 0) {
    lines.push(formatBolivares(amountVes))
  }
  return lines.join('\n')
}

export interface CopyLabels {
  bank: string
  accountType: string
  accountNumber: string
  holderName: string
  document: string
  phone: string
  email: string
}

/** Every value the account has, one `label: value` per line (empty ones are left out). */
export function buildGenericCopy(account: CopyableAccount, labels: CopyLabels): string {
  const rows: [string, string | null | undefined][] = [
    [labels.bank, bankCodeAndName(account)],
    [labels.accountType, account.accountType],
    [labels.accountNumber, account.accountNumber],
    [labels.holderName, account.holderName],
    [labels.document, account.document],
    [labels.phone, account.phone],
    [labels.email, account.email],
  ]
  return rows.filter(([, value]) => value && value.trim()).map(([label, value]) => `${label}: ${value}`).join('\n')
}
