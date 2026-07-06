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
  label: string
  to: string
  icon: string
  /** Subtítulo de la tarjeta en el mosaico (por defecto "Gestionar"). */
  description?: string
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
  icon: string
  /** Subtítulo de la página de mosaico del grupo. */
  description?: string
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
    to: `/dashboard/catalogs/${c.key}`,
    icon: c.icon,
    roles: ['SYSTEM', 'ADMINISTRADOR'],
  }))

export const MAIN_NAV: NavEntry[] = [
  { label: 'Panel', to: '/dashboard', icon: 'i-lucide-layout-dashboard', exact: true },
  {
    key: 'afiliaciones',
    label: 'Afiliaciones',
    icon: 'i-lucide-users',
    description: 'Planes, membresías, afiliados y pagos del programa.',
    children: [
      { label: 'Planes', to: '/dashboard/plans', icon: 'i-lucide-package', description: 'Planes de cobertura disponibles.', requires: 'PLAN_VIEW_ALL' },
      { label: 'Membresías', to: '/dashboard/memberships', icon: 'i-lucide-badge-check', description: 'Estado y vigencia de las membresías.', requires: 'MEMBERSHIP_VIEW_ALL' },
      { label: 'Afiliados', to: '/dashboard/members', icon: 'i-lucide-users', description: 'Directorio y expedientes de afiliados.', requires: 'MEMBER_VIEW_ALL' },
      { label: 'Pagos', to: '/dashboard/payments', icon: 'i-lucide-credit-card', description: 'Registro y aprobación de pagos.', requires: 'PAYMENT_VIEW_ALL' },
    ],
  },
  {
    key: 'aliados',
    label: 'Aliados',
    icon: 'i-lucide-handshake',
    description: 'Red de aliados prestadores, su clasificación y servicios.',
    children: [
      { label: 'Tipos de aliado', to: '/dashboard/catalogs/ally-types', icon: 'i-lucide-tags', description: 'Clasificación de los aliados.', roles: ['SYSTEM', 'ADMINISTRADOR'] },
      { label: 'Directorio de aliados', to: '/dashboard/allies', icon: 'i-lucide-handshake', description: 'Comercios y prestadores de la red.', requires: 'ALLY_VIEW_ALL' },
      { label: 'Categorías de servicio', to: '/dashboard/catalogs/service-categories', icon: 'i-lucide-layers', description: 'Categorías de los servicios ofrecidos.', roles: ['SYSTEM', 'ADMINISTRADOR'] },
      { label: 'Especialidades médicas', to: '/dashboard/catalogs/medical-specialties', icon: 'i-lucide-stethoscope', description: 'Especialidades médicas de los aliados.', roles: ['SYSTEM', 'ADMINISTRADOR'] },
    ],
  },
  {
    key: 'comercial',
    label: 'Comercial',
    icon: 'i-lucide-megaphone',
    description: 'Promotores del programa y sus comisiones.',
    children: [
      { label: 'Promotores', to: '/dashboard/promoters', icon: 'i-lucide-megaphone', description: 'Equipo comercial y promotores.', requires: 'PROMOTER_VIEW_ALL' },
      { label: 'Comisiones', to: '/dashboard/commissions', icon: 'i-lucide-percent', description: 'Liquidación y estado de comisiones.', requires: ['COMMISSION_VIEW_ALL', 'COMMISSION_VIEW_OWN'] },
    ],
  },
  {
    key: 'seguridad',
    label: 'Seguridad',
    icon: 'i-lucide-shield-check',
    description: 'Control de acceso por roles y usuarios del sistema.',
    children: [
      { label: 'Roles', to: '/dashboard/roles', icon: 'i-lucide-shield-check', description: 'Roles y permisos asignables.', requires: 'USER_CHANGE_ROLE' },
      { label: 'Usuarios', to: '/dashboard/users', icon: 'i-lucide-shield-user', description: 'Cuentas y accesos al sistema.', requires: 'USER_VIEW_ALL' },
    ],
  },
  {
    key: 'datos-maestros',
    label: 'Datos maestros',
    icon: 'i-lucide-database',
    description: 'Datos maestros del sistema: países, estados, ciudades, tipos de documento, géneros y más.',
    mosaicTo: '/dashboard/catalogs',
    children: catalogChildren,
  },
  { label: 'Reportes', to: '/dashboard/reports', icon: 'i-lucide-bar-chart-3', requires: 'REPORT_VIEW_DASHBOARD' },
  {
    key: 'mis-portales',
    label: 'Mis portales',
    icon: 'i-lucide-id-card',
    description: 'Accesos a tus portales personales.',
    children: [
      { label: 'Mi carnet', to: '/afiliado', icon: 'i-lucide-id-card', description: 'Tu carnet de afiliado.', requires: 'MEMBER_VIEW_OWN' },
      { label: 'Mi empresa aliada', to: '/aliado', icon: 'i-lucide-building-2', description: 'Panel de tu empresa aliada.', roles: ['ALIADO'] },
    ],
  },
]

export const OTHER_NAV: NavLeaf[] = [
  { label: 'Cambiar contraseña', to: '/dashboard/change-password', icon: 'i-lucide-key-round' },
]

/** Destino del botón mosaico de un grupo. */
export function mosaicTarget(group: NavGroup): string {
  return group.mosaicTo ?? `/dashboard/modulo/${group.key}`
}
