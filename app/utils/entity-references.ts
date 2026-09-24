import { getCatalogDef } from '~/utils/catalog-registry'

/**
 * Single source of truth for "where does this FK's quick-link button go, and
 * what permission does it require" — consumed by `CommonEntityReferenceSelect`
 * via its `entity` prop. Adding an entity here once means every select that
 * references it gets a correct, up-to-date link; a route change only touches
 * this file instead of every form/filter that references that entity.
 *
 * Mirrors `resolveAuditEntityLink` (`~/utils/audit-entity-link.ts`), which solves
 * the same "entityKey → {to, permission}" problem for the audit-log quick-links —
 * kept separate because that one resolves an `AuditEntityKey` reported by the
 * backend, while this one is keyed by what a given form field references.
 */
export type EntityReferenceKey =
  | 'user'
  | 'member'
  | 'promoter'
  | 'ally'
  | 'plan'
  | 'payment'
  | 'role'
  | 'scheduled_job'
  | 'country'
  | 'state'
  | 'city'
  | 'gender'
  | 'marital_status'
  | 'occupation'
  | 'profession'
  | 'service_category'
  | 'ally_type'
  | 'promoter_type'
  | 'promoter_rank'
  | 'document_type'
  | 'campaign'
  | 'currency'

interface EntityReferenceDef {
  /** Builds the target route from the select's current value (usually a uuid). */
  to: (value: string) => string
  /** Permission required to view that target screen. */
  permission: string
}

// entityKey → catalog registry key, for entities managed through the generic
// catalog page (`/dashboard/catalogs/[resource]`), deep-linked via `?edit=<uuid>`.
const CATALOG_ENTITY_KEYS: Partial<Record<EntityReferenceKey, string>> = {
  country: 'countries',
  state: 'states',
  city: 'cities',
  gender: 'genders',
  marital_status: 'marital-statuses',
  occupation: 'occupations',
  profession: 'professions',
  service_category: 'service-categories',
  ally_type: 'ally-types',
  promoter_type: 'promoter-types',
  promoter_rank: 'promoter-ranks',
  currency: 'currencies',
}

// Entities with their own standalone [uuid] detail screen, plus catalog-backed
// entities whose select value isn't a deep-linkable uuid (document_type's value
// is its `code`, so it can only link to the catalog's list page).
const ENTITY_ROUTES: Partial<Record<EntityReferenceKey, EntityReferenceDef>> = {
  role: {to: uuid => `/dashboard/roles/${uuid}`, permission: 'ROLE_VIEW' },
  user: { to: uuid => `/dashboard/users/${uuid}`, permission: 'USER_VIEW_ALL' },
  plan: { to: uuid => `/dashboard/plans/${uuid}`, permission: 'PLAN_VIEW_ALL' },
  ally: { to: uuid => `/dashboard/allies/${uuid}`, permission: 'ALLY_VIEW_ALL' },
  member: { to: uuid => `/dashboard/members/${uuid}`, permission: 'MEMBER_VIEW_ALL' },
  payment: { to: uuid => `/dashboard/collections/${uuid}`, permission: 'PAYMENT_VIEW_ALL' },
  promoter: { to: uuid => `/dashboard/promoters/${uuid}`, permission: 'PROMOTER_VIEW_ALL' },
  scheduled_job: { to: uuid => `/dashboard/scheduled-jobs/${uuid}`, permission: 'JOB_VIEW_ALL' },
  document_type: { to: () => '/dashboard/catalogs/document-types', permission: 'DOCUMENT_TYPE_VIEW_ALL' },
  campaign: { to: uuid => `/dashboard/campaigns/${uuid}`, permission: 'CAMPAIGN_VIEW_ALL' },
}

export interface EntityReferenceLink {
  to: string
  permission: string
}

export function resolveEntityReference(entityKey: EntityReferenceKey, value: string | undefined | null): EntityReferenceLink | null {
  if (!value) return null

  const catalogKey = CATALOG_ENTITY_KEYS[entityKey]
  if (catalogKey) {
    const def = getCatalogDef(catalogKey)
    if (!def) {
      return null
    }
    return {
      to: `/dashboard/catalogs/${def.key}?edit=${value}`,
      permission: def.viewPermission
    }
  }

  const route = ENTITY_ROUTES[entityKey]
  if (!route) {
    return null
  }
  return {
    to: route.to(value),
    permission: route.permission
  }
}
