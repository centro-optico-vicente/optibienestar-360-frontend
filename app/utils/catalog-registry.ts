import type { CatalogDef } from '~/types/catalogs'

// Declarative registry of the manageable catalogs. A single dynamic page
// (pages/dashboard/catalogs/[resource].vue) is built from these definitions,
// avoiding one page per entity.
//
// Patterns/maxes taken from the OpenAPI (/v3/api-docs). `code`/`isoCode` and the FKs
// (countryUuid, stateUuid) are immutable: set only on create (onlyCreate).
//
// `label`/`labelSingular`/field labels/`regexMsg` are the Spanish fallback; the
// `*Key` variants are resolved to i18n where consumed (the [resource] page and the nav).

const CODE_40 = /^[A-Z_]{1,40}$/
const codeMsg = (n: number) => `Mayúsculas/guion bajo, máx. ${n}`

export const CATALOGS: CatalogDef[] = [
  {
    key: 'countries',
    basePath: '/v1/admin/catalogs/countries',
    permission: 'CATALOG_COUNTRY_WRITE',
    label: 'Países',
    labelSingular: 'País',
    labelKey: 'catalogs.registry.countries.label',
    labelSingularKey: 'catalogs.registry.countries.labelSingular',
    icon: 'i-lucide-globe',
    codeField: 'isoCode',
    fields: [
      { name: 'isoCode', label: 'Código ISO', labelKey: 'catalogs.fields.isoCode', type: 'text', required: true, onlyCreate: true, regex: /^[A-Z]{2}$/, regexMsg: 'Dos letras mayúsculas (ISO 3166-1, p.ej. VE)', regexMsgKey: 'catalogs.validation.isoCode', max: 2, placeholder: 'VE' },
      { name: 'name', label: 'Nombre', labelKey: 'catalogs.fields.name', type: 'text', required: true, max: 100 },
    ],
  },
  {
    key: 'states',
    basePath: '/v1/admin/catalogs/states',
    permission: 'CATALOG_STATE_WRITE',
    label: 'Estados / Departamentos',
    labelSingular: 'Estado',
    labelKey: 'catalogs.registry.states.label',
    labelSingularKey: 'catalogs.registry.states.labelSingular',
    icon: 'i-lucide-map',
    codeField: 'code',
    parentDisplayField: 'countryIsoCode',
    fields: [
      { name: 'countryUuid', label: 'País', labelKey: 'catalogs.fields.country', type: 'parent', required: true, onlyCreate: true, parentKey: 'countries' },
      { name: 'code', label: 'Código', labelKey: 'catalogs.fields.code', type: 'text', required: true, onlyCreate: true, max: 10, placeholder: 'MIR' },
      { name: 'name', label: 'Nombre', labelKey: 'catalogs.fields.name', type: 'text', required: true, max: 100 },
    ],
  },
  {
    key: 'cities',
    basePath: '/v1/admin/catalogs/cities',
    permission: 'CATALOG_CITY_WRITE',
    label: 'Ciudades',
    labelSingular: 'Ciudad',
    labelKey: 'catalogs.registry.cities.label',
    labelSingularKey: 'catalogs.registry.cities.labelSingular',
    icon: 'i-lucide-building-2',
    parentDisplayField: 'stateCode',
    listFilter: { param: 'stateUuid', field: 'stateUuid' },
    fields: [
      { name: 'stateUuid', label: 'Estado', labelKey: 'catalogs.fields.state', type: 'parent', required: true, onlyCreate: true, parentKey: 'states' },
      { name: 'name', label: 'Nombre', labelKey: 'catalogs.fields.name', type: 'text', required: true, max: 120 },
    ],
  },
  {
    key: 'genders',
    basePath: '/v1/admin/catalogs/genders',
    permission: 'CATALOG_GENDER_WRITE',
    label: 'Géneros',
    labelSingular: 'Género',
    labelKey: 'catalogs.registry.genders.label',
    labelSingularKey: 'catalogs.registry.genders.labelSingular',
    icon: 'i-lucide-venus-mars',
    codeField: 'code',
    fields: [
      { name: 'code', label: 'Código', labelKey: 'catalogs.fields.code', type: 'text', required: true, onlyCreate: true, regex: /^[A-Z]$/, regexMsg: 'Una letra mayúscula (p.ej. M, F)', regexMsgKey: 'catalogs.validation.genderCode', max: 1, placeholder: 'M' },
      { name: 'name', label: 'Nombre', labelKey: 'catalogs.fields.name', type: 'text', required: true, max: 20 },
    ],
  },
  {
    key: 'document-types',
    basePath: '/v1/admin/catalogs/document-types',
    permission: 'CATALOG_DOCUMENT_TYPE_WRITE',
    label: 'Tipos de documento',
    labelSingular: 'Tipo de documento',
    labelKey: 'catalogs.registry.document-types.label',
    labelSingularKey: 'catalogs.registry.document-types.labelSingular',
    icon: 'i-lucide-id-card',
    codeField: 'code',
    fields: [
      { name: 'code', label: 'Código', labelKey: 'catalogs.fields.code', type: 'text', required: true, onlyCreate: true, regex: /^[A-Z]{1,3}$/, regexMsg: '1 a 3 letras mayúsculas (p.ej. CC, CI)', regexMsgKey: 'catalogs.validation.documentTypeCode', max: 3, placeholder: 'CI' },
      { name: 'name', label: 'Nombre', labelKey: 'catalogs.fields.name', type: 'text', required: true, max: 60 },
      { name: 'description', label: 'Descripción', labelKey: 'catalogs.fields.description', type: 'textarea', max: 200 },
    ],
  },
  {
    key: 'marital-statuses',
    basePath: '/v1/admin/catalogs/marital-statuses',
    permission: 'CATALOG_MARITAL_STATUS_WRITE',
    label: 'Estados civiles',
    labelSingular: 'Estado civil',
    labelKey: 'catalogs.registry.marital-statuses.label',
    labelSingularKey: 'catalogs.registry.marital-statuses.labelSingular',
    icon: 'i-lucide-heart-handshake',
    codeField: 'code',
    fields: [
      { name: 'code', label: 'Código', labelKey: 'catalogs.fields.code', type: 'text', required: true, onlyCreate: true, regex: /^[A-Z_]{1,20}$/, regexMsg: codeMsg(20), regexMsgKey: 'catalogs.validation.codeMax', max: 20, placeholder: 'SOLTERO' },
      { name: 'name', label: 'Nombre', labelKey: 'catalogs.fields.name', type: 'text', required: true, max: 50 },
    ],
  },
  {
    key: 'occupations',
    basePath: '/v1/admin/catalogs/occupations',
    permission: 'CATALOG_OCCUPATION_WRITE',
    label: 'Ocupaciones',
    labelSingular: 'Ocupación',
    labelKey: 'catalogs.registry.occupations.label',
    labelSingularKey: 'catalogs.registry.occupations.labelSingular',
    icon: 'i-lucide-briefcase',
    fields: [
      { name: 'name', label: 'Nombre', labelKey: 'catalogs.fields.name', type: 'text', required: true, max: 100 },
      { name: 'description', label: 'Descripción', labelKey: 'catalogs.fields.description', type: 'textarea', max: 200 },
    ],
  },
  {
    key: 'medical-specialties',
    basePath: '/v1/admin/catalogs/medical-specialties',
    permission: 'CATALOG_MEDICAL_SPECIALTY_WRITE',
    label: 'Especialidades médicas',
    labelSingular: 'Especialidad médica',
    labelKey: 'catalogs.registry.medical-specialties.label',
    labelSingularKey: 'catalogs.registry.medical-specialties.labelSingular',
    icon: 'i-lucide-stethoscope',
    codeField: 'code',
    fields: [
      { name: 'code', label: 'Código', labelKey: 'catalogs.fields.code', type: 'text', required: true, onlyCreate: true, regex: CODE_40, regexMsg: codeMsg(40), regexMsgKey: 'catalogs.validation.codeMax', max: 40, placeholder: 'OFTALMOLOGIA' },
      { name: 'name', label: 'Nombre', labelKey: 'catalogs.fields.name', type: 'text', required: true, max: 100 },
      { name: 'description', label: 'Descripción', labelKey: 'catalogs.fields.description', type: 'textarea', max: 200 },
    ],
  },
  {
    key: 'service-categories',
    basePath: '/v1/admin/catalogs/service-categories',
    permission: 'CATALOG_SERVICE_CATEGORY_WRITE',
    label: 'Categorías de servicio',
    labelSingular: 'Categoría de servicio',
    labelKey: 'catalogs.registry.service-categories.label',
    labelSingularKey: 'catalogs.registry.service-categories.labelSingular',
    icon: 'i-lucide-layers',
    codeField: 'code',
    fields: [
      { name: 'code', label: 'Código', labelKey: 'catalogs.fields.code', type: 'text', required: true, onlyCreate: true, regex: CODE_40, regexMsg: codeMsg(40), regexMsgKey: 'catalogs.validation.codeMax', max: 40, placeholder: 'CONSULTA' },
      { name: 'name', label: 'Nombre', labelKey: 'catalogs.fields.name', type: 'text', required: true, max: 100 },
      { name: 'description', label: 'Descripción', labelKey: 'catalogs.fields.description', type: 'textarea', max: 200 },
    ],
  },
  {
    key: 'ally-types',
    basePath: '/v1/admin/catalogs/ally-types',
    permission: 'CATALOG_ALLY_TYPE_WRITE',
    label: 'Tipos de aliado',
    labelSingular: 'Tipo de aliado',
    labelKey: 'catalogs.registry.ally-types.label',
    labelSingularKey: 'catalogs.registry.ally-types.labelSingular',
    icon: 'i-lucide-handshake',
    codeField: 'code',
    fields: [
      { name: 'code', label: 'Código', labelKey: 'catalogs.fields.code', type: 'text', required: true, onlyCreate: true, regex: CODE_40, regexMsg: codeMsg(40), regexMsgKey: 'catalogs.validation.codeMax', max: 40, placeholder: 'OPTICA' },
      { name: 'name', label: 'Nombre', labelKey: 'catalogs.fields.name', type: 'text', required: true, max: 100 },
      { name: 'description', label: 'Descripción', labelKey: 'catalogs.fields.description', type: 'textarea', max: 200 },
    ],
  },
]

/** Finds a catalog definition by its route key. */
export function getCatalogDef(key: string): CatalogDef | undefined {
  return CATALOGS.find(c => c.key === key)
}
