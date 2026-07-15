// Catálogo de permisos sembrados en el backend (V6__seed_roles.sql y migraciones posteriores).
// Ver "Flujo de seguridad y permisos" → Matriz de roles × permisos.
// Úsalos como fuente de autocompletado/tipado en can(), v-can y definePageMeta.

export const PERMISSIONS = [
  // USERS
  'USER_CREATE',
  // Also covers assigning/revoking a user's roles — the PUT carries the roleIds.
  'USER_UPDATE',
  'USER_DELETE',
  'USER_VIEW_ALL',
  'USER_RESET_PASSWORD',
  // Role management — one key per action (V32).
  'ROLE_VIEW',
  'ROLE_CREATE',
  'ROLE_UPDATE',
  'ROLE_DELETE',
  // Assigning permissions to a role only (PUT /v1/admin/roles/{uuid}/permissions).
  'ROLE_PERMISSION_EDIT',

  // CATALOGS
  // Renamed from USER_CHANGE_ROLE in V32: despite that name it never guarded
  // user roles, only these catalog writes.
  'CATALOG_WRITE',

  // MEMBERS
  'MEMBER_CREATE',
  'MEMBER_UPDATE',
  'MEMBER_DELETE',
  'MEMBER_VIEW_ALL',
  'MEMBER_VIEW_OWN',
  'MEMBER_UPLOAD_DOCUMENT',
  'MEDICAL_RECORD_VIEW',
  'MEDICAL_RECORD_UPDATE',

  // ALLIES
  'ALLY_CREATE',
  'ALLY_UPDATE',
  'ALLY_DELETE',
  'ALLY_VIEW_ALL',
  'ALLY_VIEW_OWN',
  'ALLY_AGREEMENT_MANAGE',
  'ALLY_VALIDATE_MEMBER',
  'ALLY_REGISTER_USAGE',

  // PLANS
  'PLAN_CREATE',
  'PLAN_UPDATE',
  'PLAN_DELETE',
  'PLAN_VIEW_ALL',

  // MEMBERSHIPS
  'MEMBERSHIP_CREATE',
  'MEMBERSHIP_UPDATE',
  'MEMBERSHIP_CANCEL',
  'MEMBERSHIP_REACTIVATE',
  'MEMBERSHIP_VIEW_ALL',
  'MEMBERSHIP_VIEW_OWN',

  // PAYMENTS
  'PAYMENT_REGISTER',
  'PAYMENT_APPROVE',
  'PAYMENT_REJECT',
  'PAYMENT_VIEW_ALL',
  'PAYMENT_VIEW_OWN',

  // PROMOTERS
  'PROMOTER_CREATE',
  'PROMOTER_UPDATE',
  'PROMOTER_DELETE',
  'PROMOTER_VIEW_ALL',

  // COMMISSIONS
  'COMMISSION_VIEW_ALL',
  'COMMISSION_VIEW_OWN',
  'COMMISSION_PAYOUT',

  // REFERRALS
  'REFERRAL_CODE_CREATE',
  'REFERRAL_CODE_VIEW_ALL',
  'REFERRAL_CODE_VIEW_OWN',

  // REPORTS
  'REPORT_VIEW_DASHBOARD',
  'REPORT_EXPORT',
] as const

export type Permission = (typeof PERMISSIONS)[number]
