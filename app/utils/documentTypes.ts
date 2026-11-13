// Document type codes the backend accepts (persons.tax_document_type CHECK and friends).
// Person forms only take V/E; fiscal/holder/signatory fields take all five.
export const DOCUMENT_TYPE_CODES = ['V', 'E', 'J', 'G', 'P'] as const
export const PERSON_DOCUMENT_TYPE_CODES = ['V', 'E'] as const

export type DocumentTypeCode = (typeof DOCUMENT_TYPE_CODES)[number]

/**
 * Items for a document type select that is NOT fed by `/v1/admin/catalogs/document-types/options`
 * (public pages have no access to it). Same label as the backend: `<code> — <name>`
 * ("V — Cédula de identidad venezolana"), never the bare code (spec 07-forms, "Código en selects").
 *
 * @example
 * const { t } = useI18n()
 * const docTypes = documentTypeItems(t)            // V, E
 * const taxDocTypes = documentTypeItems(t, DOCUMENT_TYPE_CODES)
 */
export function documentTypeItems<C extends string = DocumentTypeCode>(
  t: (key: string) => string,
  codes: readonly C[] = PERSON_DOCUMENT_TYPE_CODES as unknown as readonly C[],
): { label: string, value: C }[] {
  return codes.map(code => ({ label: `${code} — ${t(`common.documentTypes.${code}`)}`, value: code }))
}
