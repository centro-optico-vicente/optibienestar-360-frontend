import type { PromotionDiscountFields } from '~/types/promotions'

/**
 * Text of a promotion discount (hub ADR 0038, phase 1): "10%" for a
 * percentage, the formatted amount ("5,00 US$") for a fixed one. Prefers the
 * server's `_Display` values (ADR 0014); `money` formats the raw amount with
 * its currency code when no display value came along.
 */
export function promotionDiscountText(
  p: PromotionDiscountFields,
  money: (amount: number, currencyCode: string) => string,
): string {
  if (p.discountType === 'FLAT') {
    if (p.discountAmount_Display) return p.discountAmount_Display
    if (p.discountAmount === null || p.discountAmount === undefined || p.discountAmount === '') return '—'
    return money(Number(p.discountAmount), p.discountCurrency_Code || 'USD')
  }
  if (p.discountPct_Display) return p.discountPct_Display
  if (p.discountPct === null || p.discountPct === undefined || p.discountPct === '') return '—'
  return `${Number(p.discountPct)}%`
}
