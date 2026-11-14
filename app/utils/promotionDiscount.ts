import type { AllyBenefitValueFields, PromotionDiscountFields } from '~/types/promotions'

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

/**
 * Value of an ally benefit (hub ADR 0038, phase 3): `freeLabel` for FREE,
 * "15%" for a percentage, the formatted amount for a fixed one.
 */
export function allyBenefitValueText(
  b: AllyBenefitValueFields,
  money: (amount: number, currencyCode: string) => string,
  freeLabel: string,
): string {
  if (b.benefitType === 'FREE') return b.benefitType_Display || freeLabel
  if (b.benefitType === 'FLAT') {
    if (b.benefitAmount_Display) return b.benefitAmount_Display
    if (b.benefitAmount === null || b.benefitAmount === undefined || b.benefitAmount === '') return '—'
    return money(Number(b.benefitAmount), b.benefitCurrency_Code || 'USD')
  }
  if (b.benefitPct_Display) return b.benefitPct_Display
  if (b.benefitPct === null || b.benefitPct === undefined || b.benefitPct === '') return '—'
  return `${Number(b.benefitPct)}%`
}
