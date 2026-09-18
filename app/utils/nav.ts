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

// Catálogos que viven en su vertical de negocio (Aliados, Finanzas) y por eso
// NO se repiten en Datos maestros. `currencies` se muda a Finanzas junto con
// Tasas de cambio (mismo dominio multi-moneda, ADR 0015) — hub plan
// payments-unification §"Reorganización de menú".
const CATALOGS_IN_VERTICALS = new Set<string>(['ally-types', 'service-categories', 'medical-specialties', 'promoter-types', 'promoter-ranks', 'banks', 'payment-categories', 'payment-methods', 'currencies'])

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
    requires: c.viewPermission,
  }))

export const MAIN_NAV: NavEntry[] = [
  { label: 'Panel', labelKey: 'nav.items.panel.label', to: '/dashboard', icon: 'i-lucide-layout-dashboard', exact: true },
  {
    key: 'afiliaciones',
    label: 'Afiliaciones',
    labelKey: 'nav.groups.afiliaciones.label',
    icon: 'i-lucide-users',
    description: 'Planes, membresías y afiliados del programa.',
    descriptionKey: 'nav.groups.afiliaciones.description',
    children: [
      { label: 'Planes', labelKey: 'nav.items.plans.label', to: '/dashboard/plans', icon: 'i-lucide-package', description: 'Planes de cobertura disponibles.', descriptionKey: 'nav.items.plans.description', requires: 'PLAN_VIEW_ALL' },
      { label: 'Membresías', labelKey: 'nav.items.memberships.label', to: '/dashboard/memberships', icon: 'i-lucide-badge-check', description: 'Estado y vigencia de las membresías.', descriptionKey: 'nav.items.memberships.description', requires: 'MEMBERSHIP_VIEW_ALL' },
      { label: 'Afiliados', labelKey: 'nav.items.members.label', to: '/dashboard/members', icon: 'i-lucide-users', description: 'Directorio y expedientes de afiliados.', descriptionKey: 'nav.items.members.description', requires: 'MEMBER_VIEW_ALL' },
      { label: 'Reporte de pagos', labelKey: 'nav.items.paymentsReport.label', to: '/dashboard/payments/report', icon: 'i-lucide-file-spreadsheet', description: 'Reporte de recaudación y pagos de afiliados.', descriptionKey: 'nav.items.paymentsReport.description', requires: ['PAYMENT_REPORT_GENERATE', 'REPORT_REPORT_GENERATE', 'PAYMENT_VIEW_ALL'] },
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
      { label: 'Tipos de aliado', labelKey: 'nav.items.allyTypes.label', to: '/dashboard/catalogs/ally-types', icon: 'i-lucide-tags', description: 'Clasificación de los aliados.', descriptionKey: 'nav.items.allyTypes.description', requires: 'ALLY_TYPE_VIEW_ALL' },
      { label: 'Categorías de servicio', labelKey: 'nav.items.serviceCategories.label', to: '/dashboard/catalogs/service-categories', icon: 'i-lucide-layers', description: 'Categorías de los servicios ofrecidos.', descriptionKey: 'nav.items.serviceCategories.description', requires: 'SERVICE_CATEGORY_VIEW_ALL' },
      { label: 'Especialidades médicas', labelKey: 'nav.items.medicalSpecialties.label', to: '/dashboard/catalogs/medical-specialties', icon: 'i-lucide-stethoscope', description: 'Especialidades médicas de los aliados.', descriptionKey: 'nav.items.medicalSpecialties.description', requires: 'MEDICAL_SPECIALTY_VIEW_ALL' },
      { label: 'Directorio de aliados', labelKey: 'nav.items.alliesDirectory.label', to: '/dashboard/allies', icon: 'i-lucide-handshake', description: 'Comercios y prestadores de la red.', descriptionKey: 'nav.items.alliesDirectory.description', requires: 'ALLY_VIEW_ALL' },
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
      { label: 'Tipos de promotor', labelKey: 'nav.items.promoterTypes.label', to: '/dashboard/catalogs/promoter-types', icon: 'i-lucide-badge-percent', description: 'Clasificación de los promotores.', descriptionKey: 'nav.items.promoterTypes.description', requires: 'PROMOTER_TYPE_VIEW_ALL' },
      { label: 'Cargos jerárquicos', labelKey: 'nav.items.promoterRanks.label', to: '/dashboard/catalogs/promoter-ranks', icon: 'i-lucide-network', description: 'Rangos de la jerarquía de promotores.', descriptionKey: 'nav.items.promoterRanks.description', requires: 'PROMOTER_RANK_VIEW_ALL' },
      { label: 'Promotores', labelKey: 'nav.items.promoters.label', to: '/dashboard/promoters', icon: 'i-lucide-megaphone', description: 'Equipo comercial y promotores.', descriptionKey: 'nav.items.promoters.description', requires: 'PROMOTER_VIEW_ALL' },
      { label: 'Organigrama de promotores', labelKey: 'nav.items.promoterHierarchy.label', to: '/dashboard/promoters/hierarchy', icon: 'i-lucide-git-fork', description: 'Jerarquía de supervisión y cargos.', descriptionKey: 'nav.items.promoterHierarchy.description', requires: 'PROMOTER_VIEW_ALL' },
      { label: 'Reglas de comisión', labelKey: 'nav.items.commissionRules.label', to: '/dashboard/commission-rules', icon: 'i-lucide-sliders-horizontal', description: 'Bandas de inscripción, bonos por escala y comisión de cobranza.', descriptionKey: 'nav.items.commissionRules.description', requires: ['COMMISSION_TIER_VIEW_ALL', 'BONUS_RULE_VIEW_ALL', 'COLLECTION_COMMISSION_TIER_VIEW_ALL'] },
      { label: 'Comisiones', labelKey: 'nav.items.commissions.label', to: '/dashboard/commissions', icon: 'i-lucide-percent', description: 'Liquidación y estado de comisiones.', descriptionKey: 'nav.items.commissions.description', requires: ['COMMISSION_VIEW_ALL', 'COMMISSION_VIEW_OWN'] },
      { label: 'Aprobación de comisiones', labelKey: 'nav.items.commissionApproval.label', to: '/dashboard/commissions/approval', icon: 'i-lucide-badge-check', description: 'Aprobar o rechazar comisiones calculadas antes de su pago.', descriptionKey: 'nav.items.commissionApproval.description', requires: 'COMMISSION_APPROVE' },
      { label: 'Reporte de comisiones', labelKey: 'nav.items.commissionsReport.label', to: '/dashboard/commissions/report', icon: 'i-lucide-file-text', description: 'Reporte general de comisiones devengadas.', descriptionKey: 'nav.items.commissionsReport.description', requires: ['COMMISSION_REPORT_GENERATE', 'REPORT_REPORT_GENERATE', 'COMMISSION_VIEW_ALL', 'COMMISSION_VIEW_OWN'] },
      { label: 'Reporte de pagos de comisiones', labelKey: 'nav.items.commissionPayoutsReport.label', to: '/dashboard/commissions/payouts-report', icon: 'i-lucide-file-check-2', description: 'Reporte de desembolsos y pagos realizados a promotores.', descriptionKey: 'nav.items.commissionPayoutsReport.description', requires: ['COMMISSION_REPORT_GENERATE', 'REPORT_REPORT_GENERATE', 'COMMISSION_VIEW_ALL', 'COMMISSION_VIEW_OWN'] },
    ],
  },
  {
    // Grupo Finanzas (hub plan payments-unification, §"Reorganización de
    // menú") — orden pedido: catálogos primero, vista maestra, luego
    // especializadas. Monedas (ex Datos maestros) y Tasas de cambio (ex
    // Sistema) se mudan aquí por ser el mismo dominio multi-moneda (ADR
    // 0015); "Pagos" (ex Afiliaciones) se relabelea a "Cobros generales"
    // (direction=IN explícito, mismo endpoint/pantalla de siempre).
    key: 'finanzas',
    label: 'Finanzas',
    labelKey: 'nav.groups.finanzas.label',
    icon: 'i-lucide-landmark',
    description: 'Monedas, bancos, catálogos de pago, movimientos y cobros/pagos del sistema.',
    descriptionKey: 'nav.groups.finanzas.description',
    children: [
      { label: 'Monedas', labelKey: 'nav.items.currencies.label', to: '/dashboard/catalogs/currencies', icon: 'i-lucide-coins', description: 'Catálogo de monedas (ADR 0015).', descriptionKey: 'nav.items.currencies.description', requires: 'CURRENCY_VIEW_ALL' },
      { label: 'Bancos', labelKey: 'nav.items.banks.label', to: '/dashboard/catalogs/banks', icon: 'i-lucide-landmark', description: 'Catálogo de bancos venezolanos (SUDEBAN).', descriptionKey: 'nav.items.banks.description', requires: 'BANK_VIEW_ALL' },
      { label: 'Tasas de cambio', labelKey: 'nav.items.exchangeRates.label', to: '/dashboard/settings/exchange-rates', icon: 'i-lucide-banknote', description: 'Historial de tasas BCV/API + carga manual (ADR 0015).', descriptionKey: 'nav.items.exchangeRates.description', requires: 'EXCHANGE_RATE_VIEW_ALL' },
      { label: 'Categorías de pago', labelKey: 'nav.items.paymentCategories.label', to: '/dashboard/catalogs/payment-categories', icon: 'i-lucide-tags', description: 'Motivos de cobro y pago (cuota, comisión, bono, etc.).', descriptionKey: 'nav.items.paymentCategories.description', requires: 'PAYMENT_CATEGORY_VIEW_ALL' },
      { label: 'Métodos de pago', labelKey: 'nav.items.paymentMethods.label', to: '/dashboard/catalogs/payment-methods', icon: 'i-lucide-credit-card', description: 'Formas de pago: efectivo, transferencia, Zelle, etc.', descriptionKey: 'nav.items.paymentMethods.description', requires: 'PAYMENT_METHOD_VIEW_ALL' },
      { label: 'Movimientos', labelKey: 'nav.items.paymentsMovements.label', to: '/dashboard/payments/movements', icon: 'i-lucide-arrow-left-right', description: 'Vista maestra de cobros y pagos, ambas direcciones.', descriptionKey: 'nav.items.paymentsMovements.description', requires: 'PAYMENT_VIEW_ALL' },
      { label: 'Cobros generales', labelKey: 'nav.items.payments.label', to: '/dashboard/payments', icon: 'i-lucide-credit-card', description: 'Registro y aprobación de cobros de membresía.', descriptionKey: 'nav.items.payments.description', requires: 'PAYMENT_VIEW_ALL' },
      // direction=OUT — commission payouts (CommissionPayoutService). Read-only
      // ledger, no create/approve here (those happen via the commission
      // period-close action).
      { label: 'Pagos generales', labelKey: 'nav.items.paymentsPayouts.label', to: '/dashboard/payments/payouts', icon: 'i-lucide-banknote', description: 'Pagos de comisión ejecutados a promotores.', descriptionKey: 'nav.items.paymentsPayouts.description', requires: 'PAYMENT_VIEW_ALL' },
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
      { label: 'Accesos y sesiones', labelKey: 'nav.items.auditSessions.label', to: '/dashboard/security/sessions', icon: 'i-lucide-log-in', description: 'Historial de inicios de sesión y sesiones activas.', descriptionKey: 'nav.items.auditSessions.description', requires: 'AUDIT_VIEW_LOGIN' },
      { label: 'Cambios de datos', labelKey: 'nav.items.auditDataChanges.label', to: '/dashboard/security/data-changes', icon: 'i-lucide-history', description: 'Historial global de cambios sobre cualquier registro.', descriptionKey: 'nav.items.auditDataChanges.description', requires: 'AUDIT_VIEW_ALL' },
      { label: 'Reportes generados', labelKey: 'nav.items.auditReports.label', to: '/dashboard/security/reports', icon: 'i-lucide-file-text', description: 'Historial global de reportes generados.', descriptionKey: 'nav.items.auditReports.description', requires: 'REPORT_AUDIT_VIEW_ALL' },
      { label: 'Ejecuciones programadas', labelKey: 'nav.items.auditJobRuns.label', to: '/dashboard/security/job-runs', icon: 'i-lucide-calendar-clock', description: 'Historial global de ejecuciones de tareas programadas.', descriptionKey: 'nav.items.auditJobRuns.description', requires: 'JOB_VIEW_ALL' },
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
      { label: 'Configuración del sistema', labelKey: 'nav.items.systemConfig.label', to: '/dashboard/system-config', icon: 'i-lucide-sliders', description: 'Parámetros globales del sistema como el pie de página de reportes.', descriptionKey: 'nav.items.systemConfig.description', requires: 'JOB_VIEW_ALL' },
      { label: 'Configuración de entidades', labelKey: 'nav.items.entityConfig.label', to: '/dashboard/entity-config', icon: 'i-lucide-database-zap', description: 'Auditoría y orden predeterminado por entidad (solo SYSTEM).', descriptionKey: 'nav.items.entityConfig.description', requires: 'ENTITY_CONFIG_VIEW' },
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
  {
    key: 'reportes',
    label: 'Reportes',
    labelKey: 'nav.groups.reportes.label',
    icon: 'i-lucide-bar-chart-3',
    description: 'Reportes generales del sistema.',
    descriptionKey: 'nav.groups.reportes.description',
    mosaicTo: '/dashboard/reports',
    children: [
      { label: 'Reporte de comisiones', labelKey: 'nav.items.commissionsReport.label', to: '/dashboard/commissions/report', icon: 'i-lucide-file-text', description: 'Reporte general de comisiones devengadas.', descriptionKey: 'nav.items.commissionsReport.description', requires: ['COMMISSION_REPORT_GENERATE', 'REPORT_REPORT_GENERATE', 'COMMISSION_VIEW_ALL', 'COMMISSION_VIEW_OWN'] },
      { label: 'Reporte de pagos de comisiones', labelKey: 'nav.items.commissionPayoutsReport.label', to: '/dashboard/commissions/payouts-report', icon: 'i-lucide-file-check-2', description: 'Reporte de desembolsos y pagos realizados a promotores.', descriptionKey: 'nav.items.commissionPayoutsReport.description', requires: ['COMMISSION_REPORT_GENERATE', 'REPORT_REPORT_GENERATE', 'COMMISSION_VIEW_ALL', 'COMMISSION_VIEW_OWN'] },
      { label: 'Reporte de pagos', labelKey: 'nav.items.paymentsReport.label', to: '/dashboard/payments/report', icon: 'i-lucide-file-spreadsheet', description: 'Reporte de recaudación y pagos de afiliados.', descriptionKey: 'nav.items.paymentsReport.description', requires: ['PAYMENT_REPORT_GENERATE', 'REPORT_REPORT_GENERATE', 'PAYMENT_VIEW_ALL'] },
      { label: 'Reportes generados', labelKey: 'nav.items.auditReports.label', to: '/dashboard/security/reports', icon: 'i-lucide-shield-alert', description: 'Historial global de reportes generados.', descriptionKey: 'nav.items.auditReports.description', requires: 'REPORT_AUDIT_VIEW_ALL' },
    ],
  },
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
      // Autoservicio (hub plan payments-unification, §"Pantallas requeridas") —
      // mismo endpoint/tabla que las pantallas de admin, filtrado por el
      // propio afiliado/promotor autenticado.
      { label: 'Mis pagos', labelKey: 'nav.items.myPayments.label', to: '/afiliado/payments', icon: 'i-lucide-receipt', description: 'Tu historial de pagos de membresía.', descriptionKey: 'nav.items.myPayments.description', requires: 'PAYMENT_VIEW_OWN' },
      { label: 'Cobros de mis afiliados', labelKey: 'nav.items.myNetworkCollections.label', to: '/promotor/collections', icon: 'i-lucide-users', description: 'Pagos de membresía de los afiliados de tu red.', descriptionKey: 'nav.items.myNetworkCollections.description', requires: 'PROMOTER_VIEW_OWN' },
      { label: 'Mis pagos de comisiones', labelKey: 'nav.items.myCommissionPayouts.label', to: '/promotor/payouts', icon: 'i-lucide-banknote', description: 'Pagos de comisión que te han sido liquidados.', descriptionKey: 'nav.items.myCommissionPayouts.description', requires: 'PROMOTER_VIEW_OWN' },
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
