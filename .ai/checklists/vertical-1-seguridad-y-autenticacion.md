# Vista 1 — Seguridad y Autenticación

> Login, recuperación de contraseña, gestión de usuarios, **roles y permisos (RBAC editable)** en UI. Requerido antes de cualquier otro módulo.
> Índice: [../checklist.md](../checklist.md) · Orden: [../checklist-vertical.md](../checklist-vertical.md)

## Autenticación

- [x] [P0/C2] Página `pages/login.vue` funcional con form + manejo errores — 2026-05
- [x] [P0/C2] Páginas `pages/recover-password.vue` + `pages/reset-password.vue` — 2026-05

## Usuarios

- [x] [P0/C3] Gestión de usuarios `pages/dashboard/users/index.vue` (listado + filtros + alta/edición + **asignación de rol**) — 2026-05-31

## Roles y permisos (RBAC)

- [x] [P0/C3] Gestión de roles `pages/dashboard/roles/index.vue` (CRUD de roles + matriz de permisos por dominio, protegida por `USER_CHANGE_ROLE`) — 2026-05-31

## Política de seguridad

- [x] [P1/C2] Pantalla `pages/dashboard/security/policy/index.vue` (menú Seguridad → «Política de seguridad») para ver/editar la política de acceso vía `GET`/`PUT /v1/admin/security-policy` (backend V191). Composable `useSecurityPolicy()` + tipos `types/securityPolicy.ts` alineados 1:1 con `SecurityPolicyDto`/`SecurityPolicyUpdateRequest`. Gate: `SECURITY_POLICY_VIEW` para entrar (middleware `can` + `requires` en `nav.ts`), `SECURITY_POLICY_UPDATE` para editar (sin él, inputs deshabilitados y sin botón Guardar). Mínimos: intentos/bloqueo/sesiones ≥ 1, vigencia/historial ≥ 0; **historial = 0 permite repetir la contraseña**, vigencia = 0 sin fecha de expiración; sesiones simultáneas se guarda pero aún no se aplica (lo dice el hint). Textos es/en en `securityPolicy.*` y `nav.items.securityPolicy` — 2026-10-24

## RBAC en UI

- [x] [P0/C2] Composable `usePermissions()` + directiva `v-can` + middleware `can` — 2026-05
- [x] [P0/C2] Layout `dashboard.vue` con navegación condicional por rol — 2026-05
