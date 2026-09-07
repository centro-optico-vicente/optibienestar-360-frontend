// Types for the single-row organization/company master (ADR 0015 §4),
// aligned with the backend (OrganizationDto). `officialCurrency`/
// `referenceCurrency` are FK refs serialized as the `_Uuid`/`_Display`/`_Code`
// flat triple (hub ADR 0014), same convention as `PaymentDto.plan`.

export interface OrganizationDto {
  uuid: string
  name: string
  legalName: string | null
  taxIdentifier: string | null
  logoKey: string | null
  officialCurrency_Uuid?: string | null
  officialCurrency_Display?: string | null
  /** The country's legal tender (VES) — facturación/reportes fiscales. */
  officialCurrency_Code?: string | null
  referenceCurrency_Uuid?: string | null
  referenceCurrency_Display?: string | null
  /** Pricing/quoting currency (USD per ADR 0008) — what plans/commissions/prizes are denominated in. */
  referenceCurrency_Code?: string | null
}

/** Body of PUT /v1/admin/organizations/me. `officialCurrencyUuid`/`referenceCurrencyUuid` omitted (undefined) leave the existing value unchanged. */
export interface OrganizationUpdateRequest {
  name: string
  legalName?: string
  taxIdentifier?: string
  logoKey?: string
  officialCurrencyUuid?: string
  referenceCurrencyUuid?: string
}
