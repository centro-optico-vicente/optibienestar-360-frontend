import type { DiscountType } from '~/types/allies'

/**
 * Client-side mirror of the backend `AllyProduct.getFinalPrice()` /
 * `getEffectiveDiscountPct()` (V210, hub ADR 0031 §8), only to preview the
 * form while typing. The saved offer always shows the server's numbers.
 */
export interface DiscountPreview {
  finalPrice: number | null
  /** The discount as a percentage, whatever its type. */
  effectivePct: number | null
  /** FLAT amount above the price (the backend answers 422). */
  exceedsPrice: boolean
}

function toNumber(value?: string | number | null): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

const round2 = (n: number) => Math.round(n * 100) / 100

export function previewDiscount(
  price: string | number | null | undefined,
  type: DiscountType,
  pct: string | number | null | undefined,
  amount: string | number | null | undefined,
): DiscountPreview {
  const p = toNumber(price)
  if (type === 'FLAT') {
    const a = toNumber(amount)
    if (p === null) return { finalPrice: null, effectivePct: null, exceedsPrice: false }
    if (a === null) return { finalPrice: round2(p), effectivePct: null, exceedsPrice: false }
    return {
      finalPrice: round2(Math.max(p - a, 0)),
      effectivePct: p > 0 ? round2((a / p) * 100) : null,
      exceedsPrice: a > p,
    }
  }
  const d = toNumber(pct)
  return {
    finalPrice: p === null ? null : round2(p * (1 - (d ?? 0) / 100)),
    effectivePct: d,
    exceedsPrice: false,
  }
}

/** Request fields for the chosen type: only the matching value travels. */
export function discountRequestFields(type: DiscountType, pct: string, amount: string) {
  return type === 'FLAT'
    ? { discountType: 'FLAT' as const, discountAmount: amount || undefined }
    : { discountType: 'PERCENTAGE' as const, discountPct: pct || undefined }
}

/** The discount fields every offer DTO carries (admin and public). */
export interface OfferDiscountLike {
  discountType?: DiscountType | string | null
  discountPct?: number | string | null
  discountAmount?: number | string | null
  effectiveDiscountPct?: number | string | null
}

/**
 * The percentage to show on badges ("20 % off"): the stored one for a
 * percentage offer, the server-computed equivalent for a fixed amount.
 */
export function offerDiscountPct(o: OfferDiscountLike): number | string | null {
  const value = o.effectiveDiscountPct ?? o.discountPct
  return value === '' || value === undefined ? null : value
}

/**
 * Table cell text: "10%" for a percentage, "$5,00 (12,5%)" for a fixed
 * amount (formatted with the page's own money helper), or `empty`.
 */
export function offerDiscountText(o: OfferDiscountLike, money: (v?: number | string | null) => string, empty: string): string {
  if (o.discountType === 'FLAT' && o.discountAmount != null && o.discountAmount !== '') {
    const pct = o.effectiveDiscountPct
    return pct != null && pct !== '' ? `${money(o.discountAmount)} (${pct}%)` : money(o.discountAmount)
  }
  return o.discountPct != null && o.discountPct !== '' ? `${o.discountPct}%` : empty
}
