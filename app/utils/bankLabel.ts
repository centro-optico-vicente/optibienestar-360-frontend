// How a bank is named in every selector: its SUDEBAN code and COMMERCIAL short name
// ("0105 — Mercantil"), the name bank apps and Pago Móvil use. The legal name
// ("Mercantil Banco, C.A. Banco Universal") is only a fallback when no short name exists.
export function bankOptionLabel(bank: { code?: string | null, name: string, shortName?: string | null }): string {
  const name = bank.shortName || bank.name
  return bank.code ? `${bank.code} — ${name}` : name
}
