import type { CatalogDef } from '~/types/catalogs'

// Registro declarativo de los catálogos administrables. Una sola página dinámica
// (pages/dashboard/catalogs/[resource].vue) se construye a partir de estas definiciones,
// evitando duplicar una página por entidad.
//
// Patrones/máximos tomados del OpenAPI (/v3/api-docs). El `code`/`isoCode` y las FKs
// (countryUuid, stateUuid) son inmutables: solo se fijan al crear (onlyCreate).

const CODE_40 = /^[A-Z_]{1,40}$/
const codeMsg = (n: number) => `Mayúsculas/guion bajo, máx. ${n}`

export const CATALOGS: CatalogDef[] = [
  {
    key: 'countries',
    basePath: '/v1/admin/catalogs/countries',
    label: 'Países',
    labelSingular: 'País',
    icon: 'i-lucide-globe',
    codeField: 'isoCode',
    fields: [
      { name: 'isoCode', label: 'Código ISO', type: 'text', required: true, onlyCreate: true, regex: /^[A-Z]{2}$/, regexMsg: 'Dos letras mayúsculas (ISO 3166-1, p.ej. VE)', max: 2, placeholder: 'VE' },
      { name: 'name', label: 'Nombre', type: 'text', required: true, max: 100 },
    ],
  },
  {
    key: 'states',
    basePath: '/v1/admin/catalogs/states',
    label: 'Estados / Departamentos',
    labelSingular: 'Estado',
    icon: 'i-lucide-map',
    codeField: 'code',
    parentDisplayField: 'countryIsoCode',
    fields: [
      { name: 'countryUuid', label: 'País', type: 'parent', required: true, onlyCreate: true, parentKey: 'countries' },
      { name: 'code', label: 'Código', type: 'text', required: true, onlyCreate: true, max: 10, placeholder: 'MIR' },
      { name: 'name', label: 'Nombre', type: 'text', required: true, max: 100 },
    ],
  },
  {
    key: 'cities',
    basePath: '/v1/admin/catalogs/cities',
    label: 'Ciudades',
    labelSingular: 'Ciudad',
    icon: 'i-lucide-building-2',
    parentDisplayField: 'stateCode',
    listFilter: { param: 'stateUuid', field: 'stateUuid' },
    fields: [
      { name: 'stateUuid', label: 'Estado', type: 'parent', required: true, onlyCreate: true, parentKey: 'states' },
      { name: 'name', label: 'Nombre', type: 'text', required: true, max: 120 },
    ],
  },
  {
    key: 'genders',
    basePath: '/v1/admin/catalogs/genders',
    label: 'Géneros',
    labelSingular: 'Género',
    icon: 'i-lucide-venus-mars',
    codeField: 'code',
    fields: [
      { name: 'code', label: 'Código', type: 'text', required: true, onlyCreate: true, regex: /^[A-Z]$/, regexMsg: 'Una letra mayúscula (p.ej. M, F)', max: 1, placeholder: 'M' },
      { name: 'name', label: 'Nombre', type: 'text', required: true, max: 20 },
    ],
  },
  {
    key: 'document-types',
    basePath: '/v1/admin/catalogs/document-types',
    label: 'Tipos de documento',
    labelSingular: 'Tipo de documento',
    icon: 'i-lucide-id-card',
    codeField: 'code',
    fields: [
      { name: 'code', label: 'Código', type: 'text', required: true, onlyCreate: true, regex: /^[A-Z]{1,3}$/, regexMsg: '1 a 3 letras mayúsculas (p.ej. CC, CI)', max: 3, placeholder: 'CI' },
      { name: 'name', label: 'Nombre', type: 'text', required: true, max: 60 },
      { name: 'description', label: 'Descripción', type: 'textarea', max: 200 },
    ],
  },
  {
    key: 'marital-statuses',
    basePath: '/v1/admin/catalogs/marital-statuses',
    label: 'Estados civiles',
    labelSingular: 'Estado civil',
    icon: 'i-lucide-heart-handshake',
    codeField: 'code',
    fields: [
      { name: 'code', label: 'Código', type: 'text', required: true, onlyCreate: true, regex: /^[A-Z_]{1,20}$/, regexMsg: codeMsg(20), max: 20, placeholder: 'SOLTERO' },
      { name: 'name', label: 'Nombre', type: 'text', required: true, max: 50 },
    ],
  },
  {
    key: 'occupations',
    basePath: '/v1/admin/catalogs/occupations',
    label: 'Ocupaciones',
    labelSingular: 'Ocupación',
    icon: 'i-lucide-briefcase',
    fields: [
      { name: 'name', label: 'Nombre', type: 'text', required: true, max: 100 },
      { name: 'description', label: 'Descripción', type: 'textarea', max: 200 },
    ],
  },
  {
    key: 'medical-specialties',
    basePath: '/v1/admin/catalogs/medical-specialties',
    label: 'Especialidades médicas',
    labelSingular: 'Especialidad médica',
    icon: 'i-lucide-stethoscope',
    codeField: 'code',
    fields: [
      { name: 'code', label: 'Código', type: 'text', required: true, onlyCreate: true, regex: CODE_40, regexMsg: codeMsg(40), max: 40, placeholder: 'OFTALMOLOGIA' },
      { name: 'name', label: 'Nombre', type: 'text', required: true, max: 100 },
      { name: 'description', label: 'Descripción', type: 'textarea', max: 200 },
    ],
  },
  {
    key: 'service-categories',
    basePath: '/v1/admin/catalogs/service-categories',
    label: 'Categorías de servicio',
    labelSingular: 'Categoría de servicio',
    icon: 'i-lucide-layers',
    codeField: 'code',
    fields: [
      { name: 'code', label: 'Código', type: 'text', required: true, onlyCreate: true, regex: CODE_40, regexMsg: codeMsg(40), max: 40, placeholder: 'CONSULTA' },
      { name: 'name', label: 'Nombre', type: 'text', required: true, max: 100 },
      { name: 'description', label: 'Descripción', type: 'textarea', max: 200 },
    ],
  },
  {
    key: 'ally-types',
    basePath: '/v1/admin/catalogs/ally-types',
    label: 'Tipos de aliado',
    labelSingular: 'Tipo de aliado',
    icon: 'i-lucide-handshake',
    codeField: 'code',
    fields: [
      { name: 'code', label: 'Código', type: 'text', required: true, onlyCreate: true, regex: CODE_40, regexMsg: codeMsg(40), max: 40, placeholder: 'OPTICA' },
      { name: 'name', label: 'Nombre', type: 'text', required: true, max: 100 },
      { name: 'description', label: 'Descripción', type: 'textarea', max: 200 },
    ],
  },
]

/** Busca la definición de un catálogo por su clave de ruta. */
export function getCatalogDef(key: string): CatalogDef | undefined {
  return CATALOGS.find(c => c.key === key)
}
