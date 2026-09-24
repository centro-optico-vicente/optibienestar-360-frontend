/**
 * Canonical `entityKey` strings used across the app when opening `AuditModal` or
 * calling `useAudit().listDataChanges`/`listReports` with an `entityKey` filter.
 * Sourced from actual usages (grep `entity-key=` in app/pages and `auditEntityKey`
 * in `~/utils/catalog-registry`) — not invented variants. Keep in sync if a new
 * screen wires up `AuditModal` with a different key.
 */
export const AUDIT_ENTITY_KEYS = [
  'role',
  'user',
  'plan',
  'ally',
  'ally_type',
  'member',
  'payment',
  'promoter',
  'scheduled_job',
  'commission_tier',
  'bonus_rule',
  'country',
  'state',
  'city',
  'gender',
  'document_type',
  'marital_status',
  'occupation',
  'profession',
  'service_category',
  'promoter_type',
  'promoter_rank',
] as const

export type AuditEntityKey = typeof AUDIT_ENTITY_KEYS[number]

/**
 * Granular permission codes (backend `AuditEntityAccess` — see
 * `optibienestar-360-backend` `feature/catalog-and-login-audit-permissions`) that
 * grant access to a single entityKey's audit trail, on top of the blanket
 * `AUDIT_VIEW_ALL`/`REPORT_AUDIT_VIEW_ALL` authorities. Keys with no entry here
 * (`scheduled_job`) have no granular permission yet — only the blanket
 * authorities unlock them. Not currently consumed by `AuditEntityKeyMultiSelect`
 * (the pages that render it are already gated at page level by `AUDIT_VIEW_ALL`/
 * `REPORT_AUDIT_VIEW_ALL`), kept here as the authoritative reference so a future
 * per-option filter doesn't have to re-derive the map from backend source.
 */
export const AUDIT_ENTITY_PERMISSIONS: Partial<Record<AuditEntityKey, { viewPermission: string, viewReportPermission: string }>> = {
  user: { viewPermission: 'USER_RECORD_AUDIT_VIEW', viewReportPermission: 'USER_REPORT_AUDIT_VIEW' },
  role: { viewPermission: 'ROLE_RECORD_AUDIT_VIEW', viewReportPermission: 'ROLE_REPORT_AUDIT_VIEW' },
  member: { viewPermission: 'MEMBER_RECORD_AUDIT_VIEW', viewReportPermission: 'MEMBER_REPORT_AUDIT_VIEW' },
  ally: { viewPermission: 'ALLY_RECORD_AUDIT_VIEW', viewReportPermission: 'ALLY_REPORT_AUDIT_VIEW' },
  ally_type: { viewPermission: 'ALLY_RECORD_AUDIT_VIEW', viewReportPermission: 'ALLY_REPORT_AUDIT_VIEW' },
  plan: { viewPermission: 'PLAN_RECORD_AUDIT_VIEW', viewReportPermission: 'PLAN_REPORT_AUDIT_VIEW' },
  payment: { viewPermission: 'PAYMENT_RECORD_AUDIT_VIEW', viewReportPermission: 'PAYMENT_REPORT_AUDIT_VIEW' },
  promoter: { viewPermission: 'PROMOTER_RECORD_AUDIT_VIEW', viewReportPermission: 'PROMOTER_REPORT_AUDIT_VIEW' },
  commission_tier: { viewPermission: 'COMMISSION_RECORD_AUDIT_VIEW', viewReportPermission: 'COMMISSION_REPORT_AUDIT_VIEW' },
  bonus_rule: { viewPermission: 'COMMISSION_RECORD_AUDIT_VIEW', viewReportPermission: 'COMMISSION_REPORT_AUDIT_VIEW' },
  country: { viewPermission: 'COUNTRY_RECORD_AUDIT_VIEW', viewReportPermission: 'COUNTRY_REPORT_AUDIT_VIEW' },
  state: { viewPermission: 'STATE_RECORD_AUDIT_VIEW', viewReportPermission: 'STATE_REPORT_AUDIT_VIEW' },
  city: { viewPermission: 'CITY_RECORD_AUDIT_VIEW', viewReportPermission: 'CITY_REPORT_AUDIT_VIEW' },
  gender: { viewPermission: 'GENDER_RECORD_AUDIT_VIEW', viewReportPermission: 'GENDER_REPORT_AUDIT_VIEW' },
  document_type: { viewPermission: 'DOCUMENT_TYPE_RECORD_AUDIT_VIEW', viewReportPermission: 'DOCUMENT_TYPE_REPORT_AUDIT_VIEW' },
  marital_status: { viewPermission: 'MARITAL_STATUS_RECORD_AUDIT_VIEW', viewReportPermission: 'MARITAL_STATUS_REPORT_AUDIT_VIEW' },
  occupation: { viewPermission: 'OCCUPATION_RECORD_AUDIT_VIEW', viewReportPermission: 'OCCUPATION_REPORT_AUDIT_VIEW' },
  profession: { viewPermission: 'PROFESSION_RECORD_AUDIT_VIEW', viewReportPermission: 'PROFESSION_REPORT_AUDIT_VIEW' },
  service_category: { viewPermission: 'SERVICE_CATEGORY_RECORD_AUDIT_VIEW', viewReportPermission: 'SERVICE_CATEGORY_REPORT_AUDIT_VIEW' },
  promoter_type: { viewPermission: 'PROMOTER_TYPE_RECORD_AUDIT_VIEW', viewReportPermission: 'PROMOTER_TYPE_REPORT_AUDIT_VIEW' },
  promoter_rank: { viewPermission: 'PROMOTER_RANK_RECORD_AUDIT_VIEW', viewReportPermission: 'PROMOTER_RANK_REPORT_AUDIT_VIEW' },
}
