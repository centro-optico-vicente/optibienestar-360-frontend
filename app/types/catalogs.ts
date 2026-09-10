import type { Permission } from '~/types/permissions'

// Types for the manageable catalogs (/v1/admin/catalogs/*).
// Lists return a page (`Page<CatalogItem>`); the composables
// (useCatalog/usePublicCatalog) unwrap it to `CatalogItem[]` via `toItems`.
//
// Every catalog shares { uuid, name, active }. Some add `code`
// (or `isoCode` for countries), `description`, and hierarchical dependencies
// (State → countryUuid/countryIsoCode, City → stateUuid/stateCode).

/**
 * Permissive shape covering all 10 catalogs.
 *
 * `active_Display` is the server-resolved, locale-aware label for `active`
 * (hub ADR 0014) — render it directly. The parent FK now follows the FK
 * triple: `State` carries `country_Uuid`/`country_Display`/`country_Code`
 * (the ISO), `City` carries `state_Uuid`/`state_Display`/`state_Code`.
 */
export interface CatalogItem {
  uuid: string
  name: string
  active: boolean
  active_Display?: string | null
  code?: string
  isoCode?: string
  description?: string
  locale?: string
  country_Uuid?: string | null
  country_Display?: string | null
  country_Code?: string | null
  state_Uuid?: string | null
  state_Display?: string | null
  state_Code?: string | null
  // `promoter-ranks` (V101) — hierarchy_level is the immutable ordering key,
  // max_subordinates optional (no cap when absent).
  hierarchyLevel?: number
  maxSubordinates?: number | null
  // `promoter-types` (V103) — whether a sale by this type cascades a
  // hierarchy override up the supervisor chain (default true).
  generatesHierarchyOverride?: boolean
}

/** An editable field of a catalog form. */
export interface CatalogField {
  /** Key in the form state and in the request body. */
  name: string
  /** Default text (es). Fallback when there is no `labelKey`. */
  label: string
  /** i18n key for the label; resolved on the page. */
  labelKey?: string
  type: 'text' | 'textarea' | 'parent' | 'number' | 'checkbox'
  required?: boolean
  /** Validation pattern (e.g. uppercase code). Only applies to text/textarea. */
  regex?: RegExp
  regexMsg?: string
  /** i18n key for the validation message; resolved on the page (receives `{ n: max }`). */
  regexMsgKey?: string
  max?: number
  /** type === 'number' only: minimum accepted value. */
  min?: number
  placeholder?: string
  /** Immutable on edit (code/isoCode and FKs are only set on create). */
  onlyCreate?: boolean
  /** When type === 'parent': key of the parent catalog in the registry. */
  parentKey?: string
  /** type === 'checkbox' only: value on create when the admin leaves it untouched. */
  defaultChecked?: boolean
}

/** Declarative definition of a catalog. */
export interface CatalogDef {
  /** Route segment and unique key, e.g. 'countries'. */
  key: string
  /** Resource base path, e.g. '/v1/admin/catalogs/countries'. */
  basePath: string
  /**
   * Granular per-action permissions (V78) — one per CRUD action, so a role
   * can have read-only access to one catalog and full CRUD on another.
   * `viewPermission` drives the nav gate and the `catalog-access` middleware;
   * the other three gate the create/edit/delete buttons on the page.
   */
  viewPermission: Permission
  createPermission: Permission
  updatePermission: Permission
  deletePermission: Permission
  label: string
  labelSingular: string
  /** i18n keys for the labels; resolved on the page (and in the nav via `useNav`). */
  labelKey?: string
  labelSingularKey?: string
  icon: string
  /** Form fields, in order. */
  fields: CatalogField[]
  /** Field acting as the "code" shown in the table ('code' | 'isoCode'). */
  codeField?: 'code' | 'isoCode'
  /** Denormalized parent field shown in the table (e.g. 'stateCode'); also the sort key sent to the backend. */
  parentDisplayField?: keyof CatalogItem
  /** Human-readable counterpart of `parentDisplayField` (e.g. 'state_Display') shown in the cell instead of the raw code, when available. */
  parentDisplayLabelField?: keyof CatalogItem
  /** Parent filter in the list: { param: query param name, field: FK field }. */
  listFilter?: { param: string, field: string }
  /** Backend `@Auditable(entity = ...)` key, if this catalog has change auditing. */
  auditEntityKey?: string
  /** Granular audit-view permission for this catalog's domain (e.g. 'ALLY_RECORD_AUDIT_VIEW'); AUDIT_VIEW_ALL always overrides. */
  auditPermission?: Permission
  /** Granular report-audit-view permission for this catalog's domain (e.g. 'ALLY_REPORT_AUDIT_VIEW'); REPORT_AUDIT_VIEW_ALL always overrides. */
  auditReportPermission?: Permission
}
