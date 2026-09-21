import type { AuditEntityKey } from '~/utils/audit-entity-keys'
import { getCatalogDef } from '~/utils/catalog-registry'

/**
 * Resolves an audit log's `entityKey` to the record's own screen — used by the
 * "acceso rápido" quick-link pattern (see `CommonEntityLinkCell`) on
 * `security/data-changes/index.vue` and `security/reports/index.vue`.
 *
 * Catalog keys route through the generic catalog page with the `?edit=<uuid>`
 * deep-link (same mechanism as `catalogs/[resource].vue`'s own parent-FK
 * quick-link); non-catalog entities go straight to their `[uuid]` detail page.
 * `commission_tier`/`bonus_rule` have no standalone screen (they're tabs inside
 * `commission-rules/index.vue`, not deep-linkable today) — returns `null`.
 */

// entityKey → catalog registry key, only where they differ from a 1:1 rename.
const CATALOG_ENTITY_KEYS: Partial<Record<AuditEntityKey, string>> = {
  country: 'countries',
  state: 'states',
  city: 'cities',
  gender: 'genders',
  document_type: 'document-types',
  marital_status: 'marital-statuses',
  occupation: 'occupations',
  medical_specialty: 'medical-specialties',
  service_category: 'service-categories',
  ally_type: 'ally-types',
  promoter_type: 'promoter-types',
  promoter_rank: 'promoter-ranks',
}

// entityKey → { route builder, view permission } for non-catalog entities with their own [uuid] page.
const ENTITY_ROUTES: Partial<Record<AuditEntityKey, { path: (uuid: string) => string, permission: string }>> = {
  role: { path: uuid => `/dashboard/roles/${uuid}`, permission: 'ROLE_VIEW' },
  user: { path: uuid => `/dashboard/users/${uuid}`, permission: 'USER_VIEW_ALL' },
  plan: { path: uuid => `/dashboard/plans/${uuid}`, permission: 'PLAN_VIEW_ALL' },
  ally: { path: uuid => `/dashboard/allies/${uuid}`, permission: 'ALLY_VIEW_ALL' },
  member: { path: uuid => `/dashboard/members/${uuid}`, permission: 'MEMBER_VIEW_ALL' },
  payment: { path: uuid => `/dashboard/collections/${uuid}`, permission: 'PAYMENT_VIEW_ALL' },
  promoter: { path: uuid => `/dashboard/promoters/${uuid}`, permission: 'PROMOTER_VIEW_ALL' },
  scheduled_job: { path: uuid => `/dashboard/scheduled-jobs/${uuid}`, permission: 'JOB_VIEW_ALL' },
}

export interface AuditEntityLink {
  to: string
  /** View permission for the record's own screen (not the audit-history permission). */
  permission: string
}

export function resolveAuditEntityLink(entityKey: string, entityUuid: string): AuditEntityLink | null {
  const key = entityKey as AuditEntityKey

  const catalogKey = CATALOG_ENTITY_KEYS[key]
  if (catalogKey) {
    const def = getCatalogDef(catalogKey)
    if (!def) return null
    return { to: `/dashboard/catalogs/${def.key}?edit=${entityUuid}`, permission: def.viewPermission }
  }

  const route = ENTITY_ROUTES[key]
  if (!route) return null
  return { to: route.path(entityUuid), permission: route.permission }
}
