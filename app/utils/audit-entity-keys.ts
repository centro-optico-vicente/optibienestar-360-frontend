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
] as const

export type AuditEntityKey = typeof AUDIT_ENTITY_KEYS[number]
