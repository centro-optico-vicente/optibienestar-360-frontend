import type { PaymentLineRequest } from '~/types/payments'

/** One editable extra line row — mirrors {@link PaymentLineRequest} as strings, form-friendly. */
export interface EditablePaymentLine {
  paymentMethodUuid: string
  bankUuid: string
  amount: string
  identification: string
  bankAccountType: string
  bankAccountCode: string
  bankAccountIdentifier: string
  phone: string
  email: string
  referenceNumber: string
}

function emptyLine(): EditablePaymentLine {
  return {
    paymentMethodUuid: '',
    bankUuid: '',
    amount: '',
    identification: '',
    bankAccountType: '',
    bankAccountCode: '',
    bankAccountIdentifier: '',
    phone: '',
    email: '',
    referenceNumber: '',
  }
}

/**
 * Shared state for the "additional payment lines" editor used by
 * `PaymentFormModal` / `MyPaymentFormModal` / `DownlinePaymentFormModal`
 * (V117 lines feature, hub plan ".ai/plans/2026-09-17-payments-unification-plan.md")
 * — a single payment can be split across several method/amount blocks
 * (e.g. $60 cash + $40 transfer for a $100 payment).
 *
 * Additive design: each form's own primary fields stay the flat "first
 * line" it already had (unchanged UX/validation for the common single-method
 * case); this composable only manages the EXTRA lines stacked on top of it.
 * Same add/remove-row shape as `useJsonKeyValueEditor` /
 * `system-config/index.vue`'s repeatable rows.
 */
export function usePaymentLinesEditor() {
  const lines = ref<EditablePaymentLine[]>([])

  function addLine() {
    lines.value.push(emptyLine())
  }

  function removeLine(index: number) {
    lines.value.splice(index, 1)
  }

  function reset() {
    lines.value = []
  }

  /** Sum of the extra lines' amounts (invalid/empty amounts count as 0). */
  const totalFromLines = computed(() =>
    lines.value.reduce((sum, line) => sum + (Number(line.amount) || 0), 0),
  )

  /** Extra lines ready for the wire — rows missing a method or amount are dropped. */
  function toRequests(): PaymentLineRequest[] {
    return lines.value
      .filter(line => line.paymentMethodUuid && line.amount.trim())
      .map(line => ({
        paymentMethodUuid: line.paymentMethodUuid,
        bankUuid: line.bankUuid || undefined,
        amount: line.amount.trim(),
        identification: line.identification || undefined,
        bankAccountType: line.bankAccountType || undefined,
        bankAccountCode: line.bankAccountCode || undefined,
        bankAccountIdentifier: line.bankAccountIdentifier || undefined,
        phone: line.phone || undefined,
        email: line.email || undefined,
        referenceNumber: line.referenceNumber || undefined,
      }))
  }

  return { lines, addLine, removeLine, reset, totalFromLines, toRequests }
}
