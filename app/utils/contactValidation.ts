/**
 * Format checks for contact data typed by allies and members (#314, #318). Only the FORMAT: the backend keeps the
 * final word (centro-optico-vicente/optibienestar-360-backend#413).
 */

/**
 * A phone number: digits with the usual separators (`0414-1234567`, `+58 414 123 4567`, `(0251) 555.1234`) and
 * 10 to 15 digits in total — a Venezuelan number has 11 (with the leading 0) or 12 (with +58).
 */
export function isValidPhone(value: string): boolean {
  const v = value.trim()
  if (!/^\+?[\d\s().-]+$/.test(v)) return false
  const digits = v.replace(/\D/g, '').length
  return digits >= 10 && digits <= 15
}

/** A web address with scheme and a dotted host: `https://miempresa.com`, `http://www.sitio.com.ve/ruta`. */
export function isValidWebsite(value: string): boolean {
  return /^https?:\/\/[^\s/?#]+\.[^\s/?#]+(?:[/?#]\S*)?$/i.test(value.trim())
}

/**
 * Adds `https://` to an address typed without a scheme (`miempresa.com`, `www.miempresa.com`). Anything else — empty,
 * already with a scheme, or free text like "mi sitio web" — is returned trimmed and left to `isValidWebsite`.
 */
export function withWebScheme(value: string): string {
  const v = value.trim()
  if (!v || /^[a-z][a-z\d+.-]*:\/\//i.test(v)) return v
  return /^[^\s/?#]+\.[^\s/?#]+(?:[/?#]\S*)?$/.test(v) ? `https://${v}` : v
}

/** A foundation year: four digits, not before 1800 and not in the future. */
export function isValidFoundedYear(value: string, now = new Date()): boolean {
  if (!/^\d{4}$/.test(value.trim())) return false
  const year = Number(value)
  return year >= 1800 && year <= now.getFullYear()
}
