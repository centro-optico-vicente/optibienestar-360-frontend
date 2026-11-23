// Types for corporate contracts (backend V38/V79: AdminCorporateContractController `/v1/admin/corporate-contracts`),
// aligned with CorporateContractDto / CorporateContractCreateRequest / CorporateContractUpdateRequest.
// The plan DisplayRef arrives flattened as `plan_Uuid` + `plan_Display` (+ `plan_Code`) (hub ADR 0014).

export const PAYER_MODES = ['INSTITUTION_BULK', 'INDIVIDUAL_PAYER'] as const
export type PayerMode = typeof PAYER_MODES[number]

export interface CorporateContractDto {
  uuid: string
  plan_Uuid?: string | null
  plan_Display?: string | null
  plan_Code?: string | null
  institutionName: string
  /** RIF of the institution. */
  institutionTaxId: string
  contactUserUuid: string | null
  payerMode: PayerMode
  payerMode_Display?: string | null
  expectedMemberCount: number | null
  actualMemberCount: number
  active: boolean
  active_Display?: string | null
  status?: string | null
  status_Display?: string | null
  createdAt: string
  createdAt_Display?: string | null
  updatedAt?: string | null
  updatedAt_Display?: string | null
}

/** `POST` — the plan must be a CORPORATIVO plan (`corporate_contract.plan.not_corporate`, checked server-side). */
export interface CorporateContractCreateRequest {
  planUuid: string
  institutionName: string
  institutionTaxId: string
  contactUserUuid?: string | null
  payerMode: PayerMode
  expectedMemberCount?: number | null
}

/** `PUT /{uuid}` — PATCH-style: `null`/absent = leave unchanged. */
export interface CorporateContractUpdateRequest {
  planUuid?: string | null
  institutionName?: string | null
  institutionTaxId?: string | null
  contactUserUuid?: string | null
  payerMode?: PayerMode | null
  expectedMemberCount?: number | null
  active?: boolean | null
}
