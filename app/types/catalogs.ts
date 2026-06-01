// Tipos de los catálogos administrables (/v1/admin/catalogs/*).
// Los listados admin devuelven ARRAYS planos (no paginados).
//
// Todos los catálogos comparten { uuid, name, active }. Algunos añaden `code`
// (o `isoCode` en países), `description`, y dependencias jerárquicas
// (State → countryUuid/countryIsoCode, City → stateUuid/stateCode).

/** Forma permisiva que cubre los 10 catálogos. */
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

/** Un campo editable del formulario de un catálogo. */
export interface CatalogField {
  /** Clave en el form state y en el body del request. */
  name: string
  label: string
  type: 'text' | 'textarea' | 'parent'
  required?: boolean
  /** Patrón de validación (p.ej. código en mayúsculas). */
  regex?: RegExp
  regexMsg?: string
  max?: number
  placeholder?: string
  /** Inmutable en edición (code/isoCode y FKs solo se fijan al crear). */
  onlyCreate?: boolean
  /** Si type === 'parent': clave del catálogo padre en el registro. */
  parentKey?: string
}

/** Definición declarativa de un catálogo. */
export interface CatalogDef {
  /** Segmento de ruta y clave única, p.ej. 'countries'. */
  key: string
  /** Ruta base del recurso, p.ej. '/v1/admin/catalogs/countries'. */
  basePath: string
  label: string
  labelSingular: string
  icon: string
  /** Campos del formulario, en orden. */
  fields: CatalogField[]
  /** Campo que actúa como "código" para mostrarlo en la tabla ('code' | 'isoCode'). */
  codeField?: 'code' | 'isoCode'
  /** Campo denormalizado del padre a mostrar en la tabla (p.ej. 'stateCode'). */
  parentDisplayField?: keyof CatalogItem
  /** Filtro por padre en el listado: { param: nombre del query param, field: campo FK }. */
  listFilter?: { param: string, field: keyof CatalogItem }
}
