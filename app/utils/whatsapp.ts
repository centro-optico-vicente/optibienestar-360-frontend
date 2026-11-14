/**
 * WhatsApp click-to-chat links (`wa.me`, free — hub ADR 0004: no WhatsApp Business API).
 */

/** Venezuela's country code: local numbers (`0414-1234567`) are written without it. */
const DEFAULT_COUNTRY_CODE = '58'

/**
 * The international digits `wa.me` expects, or `null` when the value has no usable number.
 * `0414-1234567` → `584141234567`, `414 1234567` → `584141234567`, `+58 414…` / `58414…` stay as they are.
 */
export function whatsappPhone(raw?: string | null): string | null {
  const digits = (raw ?? '').replace(/\D/g, '')
  if (digits.length < 7) return null
  if (digits.length === 11 && digits.startsWith('0')) return DEFAULT_COUNTRY_CODE + digits.slice(1)
  if (digits.length === 10 && !digits.startsWith('0')) return DEFAULT_COUNTRY_CODE + digits
  return digits.replace(/^0+/, '')
}

/** A `wa.me` link with the message ready. Without a phone, WhatsApp lets the person pick the contact. */
export function whatsappUrl(text: string, phone?: string | null): string {
  const number = whatsappPhone(phone)
  return `https://wa.me/${number ?? ''}?text=${encodeURIComponent(text)}`
}
