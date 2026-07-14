// Types for the manageable catalogs (/v1/admin/catalogs/*).
// Lists return a page (`Page<CatalogItem>`); the composables
// (useCatalog/usePublicCatalog) unwrap it to `CatalogItem[]` via `toItems`.
//
// Every catalog shares { uuid, name, active }. Some add `code`
// (or `isoCode` for countries), `description`, and hierarchical dependencies
// (State → countryUuid/countryIsoCode, City → stateUuid/stateCode).

/** Permissive shape covering all 10 catalogs. */
export interface CatalogItem {
  uuid: string
  name: string
  active: boolean
  code?: string
  isoCode?: string
  description?: string
  locale?: string
  countryUuid?: string
  countryIsoCode?: string
  stateUuid?: string
  stateCode?: string
}

/** An editable field of a catalog form. */
export interface CatalogField {
  /** Key in the form state and in the request body. */
  name: string
  /** Default text (es). Fallback when there is no `labelKey`. */
  label: string
  /** i18n key for the label; resolved on the page. */
  labelKey?: string
  type: 'text' | 'textarea' | 'parent'
  required?: boolean
  /** Validation pattern (e.g. uppercase code). */
  regex?: RegExp
  regexMsg?: string
  /** i18n key for the validation message; resolved on the page (receives `{ n: max }`). */
  regexMsgKey?: string
  max?: number
  placeholder?: string
  /** Immutable on edit (code/isoCode and FKs are only set on create). */
  onlyCreate?: boolean
  /** When type === 'parent': key of the parent catalog in the registry. */
  parentKey?: string
}

/** Declarative definition of a catalog. */
export interface CatalogDef {
  /** Route segment and unique key, e.g. 'countries'. */
  key: string
  /** Resource base path, e.g. '/v1/admin/catalogs/countries'. */
  basePath: string
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
  /** Denormalized parent field shown in the table (e.g. 'stateCode'). */
  parentDisplayField?: keyof CatalogItem
  /** Parent filter in the list: { param: query param name, field: FK field }. */
  listFilter?: { param: string, field: keyof CatalogItem }
}
