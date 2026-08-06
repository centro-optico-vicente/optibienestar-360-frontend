import type { Permission } from '~/types/permissions'
import type { UserRole } from '~/types/auth'
import { CATALOGS } from '~/utils/catalog-registry'

// Modelo declarativo del menú de dos niveles (módulo → vista), espejo de los
// permisos: cada hoja declara la llave/rol que exige. Una sola fuente de verdad
// que alimentan tanto el sidebar (acordeón) como las páginas de mosaico por grupo.
//
// - Hoja (NavLeaf): navega directo (Panel, Pagos, Reportes, y cada vista de un grupo).
// - Grupo (NavGroup): se expande/colapsa y ofrece un botón "mosaico" que abre una
//   página con sus vistas en tarjetas (patrón heredado de Catálogos).

/** Una vista navegable. Es también la tarjeta que se pinta en el mosaico. */
export interface NavLeaf {
  /** Default text (es). Fallback when there is no `labelKey`. */
  label: string
  /** i18n key for the label; resolved in `useNav`. Derived catalogs don't have one. */
  labelKey?: string
  to: string
  icon: string
  /** Subtítulo de la tarjeta en el mosaico (por defecto "Gestionar"). */
  description?: string
  /** i18n key for the description; resolved in `useNav`. */
  descriptionKey?: string
  /** Resalta solo con coincidencia exacta de ruta (p.ej. Panel → /dashboard). */
  exact?: boolean
  requires?: Permission | Permission[]
  roles?: UserRole[]
}

/** Un módulo/vertical: agrupa vistas bajo un encabezado colapsable. */
export interface NavGroup {
  /** Slug de ruta para la página de mosaico: /dashboard/modulo/{key}. */
  key: string
  label: string
  /** i18n key for the label; resolved in `useNav`. */
  labelKey?: string
  icon: string
  /** Subtítulo de la página de mosaico del grupo. */
  description?: string
  /** i18n key for the description; resolved in `useNav`. */
  descriptionKey?: string
  /** Sobrescribe el destino del botón mosaico (Datos maestros → /dashboard/catalogs). */
  mosaicTo?: string
  children: NavLeaf[]
}

export type NavEntry = NavLeaf | NavGroup

/** Discrimina grupo vs hoja por la presencia de `children`. */
export function isNavGroup(entry: NavEntry): entry is NavGroup {
  return 'children' in entry
}

// Catálogos que viven en su vertical de negocio (Aliados) y por eso NO se repiten
// en Datos maestros.
const CATALOGS_IN_VERTICALS = new Set<string>(['ally-types', 'service-categories', 'medical-specialties'])

// El resto de catálogos alimenta "Datos maestros": derivados del registro, así el
// grupo y su mosaico quedan siempre sincronizados con lo que existe en el sistema.
const catalogChildren: NavLeaf[] = CATALOGS
  .filter(c => !CATALOGS_IN_VERTICALS.has(c.key))
  .map(c => ({
    label: c.label,
    labelKey: c.labelKey,
    to: `/dashboard/catalogs/${c.key}`,
    icon: c.icon,
    // Gated by the catalog's own write key (V33) instead of a hardcoded role
    // list, so a role granted a single catalog sees only that one.
    requires: c.permission,
  }))

export const MAIN_NAV: NavEntry[] = [
  { label: 'Panel', labelKey: 'nav.items.panel.label', to: '/dashboard', icon: 'i-lucide-layout-dashboard', exact: true },
  {
    key: 'afiliaciones',
    label: 'Afiliaciones',
    labelKey: 'nav.groups.afiliaciones.label',
    icon: 'i-lucide-users',
    description: 'Planes, membresías, afiliados y pagos del programa.',
    descriptionKey: 'nav.groups.afiliaciones.description',
    children: [
      { label: 'Planes', labelKey: 'nav.items.plans.label', to: '/dashboard/plans', icon: 'i-lucide-package', description: 'Planes de cobertura disponibles.', descriptionKey: 'nav.items.plans.description', requires: 'PLAN_VIEW_ALL' },
      { label: 'Membresías', labelKey: 'nav.items.memberships.label', to: '/dashboard/memberships', icon: 'i-lucide-badge-check', description: 'Estado y vigencia de las membresías.', descriptionKey: 'nav.items.memberships.description', requires: 'MEMBERSHIP_VIEW_ALL' },
      { label: 'Afiliados', labelKey: 'nav.items.members.label', to: '/dashboard/members', icon: 'i-lucide-users', description: 'Directorio y expedientes de afiliados.', descriptionKey: 'nav.items.members.description', requires: 'MEMBER_VIEW_ALL' },
      { label: 'Pagos', labelKey: 'nav.items.payments.label', to: '/dashboard/payments', icon: 'i-lucide-credit-card', description: 'Registro y aprobación de pagos.', descriptionKey: 'nav.items.payments.description', requires: 'PAYMENT_VIEW_ALL' },
    ],
  },
  {
    key: 'aliados',
    label: 'Aliados',
    labelKey: 'nav.groups.aliados.label',
    icon: 'i-lucide-handshake',
    description: 'Red de aliados prestadores, su clasificación y servicios.',
    descriptionKey: 'nav.groups.aliados.description',
    children: [
      { label: 'Tipos de aliado', labelKey: 'nav.items.allyTypes.label', to: '/dashboard/catalogs/ally-types', icon: 'i-lucide-tags', description: 'Clasificación de los aliados.', descriptionKey: 'nav.items.allyTypes.description', requires: 'CATALOG_ALLY_TYPE_WRITE' },
      { label: 'Directorio de aliados', labelKey: 'nav.items.alliesDirectory.label', to: '/dashboard/allies', icon: 'i-lucide-handshake', description: 'Comercios y prestadores de la red.', descriptionKey: 'nav.items.alliesDirectory.description', requires: 'ALLY_VIEW_ALL' },
      { label: 'Categorías de servicio', labelKey: 'nav.items.serviceCategories.label', to: '/dashboard/catalogs/service-categories', icon: 'i-lucide-layers', description: 'Categorías de los servicios ofrecidos.', descriptionKey: 'nav.items.serviceCategories.description', requires: 'CATALOG_SERVICE_CATEGORY_WRITE' },
      { label: 'Especialidades médicas', labelKey: 'nav.items.medicalSpecialties.label', to: '/dashboard/catalogs/medical-specialties', icon: 'i-lucide-stethoscope', description: 'Especialidades médicas de los aliados.', descriptionKey: 'nav.items.medicalSpecialties.description', requires: 'CATALOG_MEDICAL_SPECIALTY_WRITE' },
    ],
  },
  {
    key: 'comercial',
    label: 'Comercial',
    labelKey: 'nav.groups.comercial.label',
    icon: 'i-lucide-megaphone',
    description: 'Promotores del programa y sus comisiones.',
    descriptionKey: 'nav.groups.comercial.description',
    children: [
      { label: 'Promotores', labelKey: 'nav.items.promoters.label', to: '/dashboard/promoters', icon: 'i-lucide-megaphone', description: 'Equipo comercial y promotores.', descriptionKey: 'nav.items.promoters.description', requires: 'PROMOTER_VIEW_ALL' },
      { label: 'Tipos de promotor', labelKey: 'nav.items.promoterTypes.label', to: '/dashboard/catalogs/promoter-types', icon: 'i-lucide-badge-percent', description: 'Clasificación de los promotores.', descriptionKey: 'nav.items.promoterTypes.description', requires: 'CATALOG_PROMOTER_TYPE_WRITE' },
      { label: 'Comisiones', labelKey: 'nav.items.commissions.label', to: '/dashboard/commissions', icon: 'i-lucide-percent', description: 'Liquidación y estado de comisiones.', descriptionKey: 'nav.items.commissions.description', requires: ['COMMISSION_VIEW_ALL', 'COMMISSION_VIEW_OWN'] },
    ],
  },
  {
    key: 'seguridad',
    label: 'Seguridad',
    labelKey: 'nav.groups.seguridad.label',
    icon: 'i-lucide-shield-check',
    description: 'Control de acceso por roles y usuarios del sistema.',
    descriptionKey: 'nav.groups.seguridad.description',
    children: [
      { label: 'Roles', labelKey: 'nav.items.roles.label', to: '/dashboard/roles', icon: 'i-lucide-shield-check', description: 'Roles y permisos asignables.', descriptionKey: 'nav.items.roles.description', requires: 'ROLE_VIEW' },
      { label: 'Usuarios', labelKey: 'nav.items.users.label', to: '/dashboard/users', icon: 'i-lucide-shield-user', description: 'Cuentas y accesos al sistema.', descriptionKey: 'nav.items.users.description', requires: 'USER_VIEW_ALL' },
    ],
  },
  {
    key: 'sistema',
    label: 'Sistema',
    labelKey: 'nav.groups.sistema.label',
    icon: 'i-lucide-server-cog',
    description: 'Configuración y operación interna del sistema.',
    descriptionKey: 'nav.groups.sistema.description',
    children: [
      { label: 'Trabajos programados', labelKey: 'nav.items.scheduledJobs.label', to: '/dashboard/scheduled-jobs', icon: 'i-lucide-timer', description: 'Tareas automáticas del sistema y su historial de ejecución.', descriptionKey: 'nav.items.scheduledJobs.description', requires: 'JOB_VIEW_ALL' },
    ],
  },
  {
    key: 'datos-maestros',
    label: 'Datos maestros',
    labelKey: 'nav.groups.datosMaestros.label',
    icon: 'i-lucide-database',
    description: 'Datos maestros del sistema: países, estados, ciudades, tipos de documento, géneros y más.',
    descriptionKey: 'nav.groups.datosMaestros.description',
    mosaicTo: '/dashboard/catalogs',
    children: catalogChildren,
  },
  { label: 'Reportes', labelKey: 'nav.items.reports.label', to: '/dashboard/reports', icon: 'i-lucide-bar-chart-3', requires: 'REPORT_VIEW_DASHBOARD' },
  {
    key: 'mis-portales',
    label: 'Mis portales',
    labelKey: 'nav.groups.misPortales.label',
    icon: 'i-lucide-id-card',
    description: 'Accesos a tus portales personales.',
    descriptionKey: 'nav.groups.misPortales.description',
    children: [
      { label: 'Mi carnet', labelKey: 'nav.items.myCard.label', to: '/afiliado', icon: 'i-lucide-id-card', description: 'Tu carnet de afiliado.', descriptionKey: 'nav.items.myCard.description', requires: 'MEMBER_VIEW_OWN' },
      { label: 'Mi empresa aliada', labelKey: 'nav.items.myAllyCompany.label', to: '/aliado', icon: 'i-lucide-building-2', description: 'Panel de tu empresa aliada.', descriptionKey: 'nav.items.myAllyCompany.description', roles: ['ALIADO'] },
      { label: 'Validador', labelKey: 'nav.items.validator.label', to: '/aliado/validator', icon: 'i-lucide-scan-line', description: 'Valida la solvencia de un afiliado.', descriptionKey: 'nav.items.validator.description', requires: 'ALLY_VALIDATE_MEMBER' },
      { label: 'Consumos', labelKey: 'nav.items.usageHistory.label', to: '/aliado/history', icon: 'i-lucide-clipboard-list', description: 'Beneficios registrados en tu aliado.', descriptionKey: 'nav.items.usageHistory.description', requires: 'ALLY_VIEW_OWN' },
    ],
  },
]

export const OTHER_NAV: NavLeaf[] = [
  { label: 'Cambiar contraseña', labelKey: 'nav.other.changePassword', to: '/dashboard/change-password', icon: 'i-lucide-key-round' },
]

/** Destino del botón mosaico de un grupo. */
export function mosaicTarget(group: NavGroup): string {
  return group.mosaicTo ?? `/dashboard/modulo/${group.key}`
}
