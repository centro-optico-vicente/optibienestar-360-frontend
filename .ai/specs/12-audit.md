# 12 — Auditoría (soporte frontend)

> Backend: [`optibienestar-360-backend/.ai/specs/16-audit.md`](https://github.com/fenix-core/optibienestar-360-backend/blob/main/.ai/specs/16-audit.md) (en paralelo, aún en implementación). Relacionado: [`08-tables.md`](08-tables.md), [`09-permissions.md`](09-permissions.md), [`04-api-client.md`](04-api-client.md).

## Contexto

El backend está agregando 3 logs de auditoría (login, cambios de datos por entidad, generación de reportes) más config granular por entidad (`audit_entity_config`) y overrides globales (`system_configs.data_change_audit_mode` / `report_audit_mode` / `login_audit_enabled`). Este documento cubre el soporte de frontend: pantallas admin para ver los logs, gestionar la config, y un modal de historial (timeline) de cambios reusable desde cualquier pantalla de detalle.

**Nota de coordinación**: el backend está en desarrollo en paralelo — los endpoints/DTOs exactos pueden cambiar. Las pantallas se construyen contra el contrato descrito en `16-audit.md` §Endpoints admin, pero antes de integrar cada pantalla hay que confirmar que el endpoint correspondiente ya existe y devuelve la forma esperada.

## Permisos (spec 09)

Nuevos permisos granulares por dominio (ver backend §Permisos): `<DOMAIN>_AUDIT_VIEW`, `<DOMAIN>_AUDIT_RESTORE` (futuro, sin UI aún), `<DOMAIN>_REPORT_GENERATE`, más `REPORT_SHARE` (futuro). Se consumen igual que cualquier otro permiso: `can('ALLY_AUDIT_VIEW')` desde `usePermissions()`, gate de botón/ruta con `middleware: 'can'` + `permission: 'ALLY_AUDIT_VIEW'` en `definePageMeta`. No se necesita ninguna extensión al composable — son strings nuevas en el mismo catálogo.

## Pantallas nuevas

### 1. `pages/dashboard/audit/config.vue` — config de auditoría (admin)

Dos secciones, mismo patrón que `scheduled-jobs/index.vue` (switch por fila, `PATCH` de un solo campo, permiso `AUDIT_MANAGE_CONFIG`):

- **Por entidad** (`audit_entity_config`): tabla con `entity_key`/`display_name` y switches `enabled`/`audit_create`/`audit_update`/`audit_delete`/`audit_report`/`capture_before_after`. Cada switch dispara `useAuditConfig().updateEntity(entityKey, { field: value })`.
- **Overrides globales** (`system_configs`): 3 controles simples — `data_change_audit_mode` y `report_audit_mode` como `USelect` (`PER_ENTITY`/`FORCE_ENABLED`/`FORCE_DISABLED`), `login_audit_enabled` como `USwitch`. Mismo composable de system config que ya exista para el resto de `system_configs` (si no existe uno genérico, crear `useSystemConfig()` con un único `PATCH /v1/admin/system-config`).

### 2. `pages/dashboard/audit/logins.vue` — bitácora de login (admin)

Tabla paginada (mismo patrón 0-based `page`/`size` + `q` + filtros) sobre `GET /v1/admin/audit/logins`: columnas `attempted_email`, `result`, `ip_address`, `user_agent`, `attempted_at`, `session_status`. Permiso `AUDIT_VIEW_LOGIN`. Sin modal de detalle — es de solo lectura, una fila = un intento.

### 3. `pages/dashboard/audit/reports.vue` — bitácora de reportes generados (admin)

Tabla paginada sobre `GET /v1/admin/audit/reports`: `report_type`, `entity_key`, `format`, `actor`, `generated_at`, botón de descarga (si `attached_file_id` no es null → `GET /v1/admin/audit/reports/{uuid}/download`). Permiso: visible si el usuario tiene *algún* `<DOMAIN>_REPORT_GENERATE`, o un permiso admin agregado si se prefiere una sola pantalla — a decidir cuando el backend defina el permiso exacto de "ver todos los reportes" (no está en la lista de §Permisos del backend, es una laguna a resolver junto con backend antes de implementar esta pantalla).

### 4. Componente `components/audit/AuditHistoryModal.vue` — timeline de cambios de un registro

Reusable desde cualquier pantalla de detalle (aliados, afiliados, planes, etc.), gateado por `<DOMAIN>_AUDIT_VIEW`:

- Botón "Ver historial" en la vista de detalle de la entidad (ej. `AllyDetail.vue`), visible solo si `can('ALLY_AUDIT_VIEW')`.
- Abre un modal que llama `GET /v1/admin/audit/data-changes?entityKey=ally&entityUuid=<uuid>` y renderiza los resultados con el componente **`Timeline` de Nuxt UI** (ya disponible, no hay que instalarlo) — un punto por fila (`action` CREATE/UPDATE/DELETE, `occurred_at`, actor).
- Cada punto, al expandir, muestra `before_json`/`after_json`. No existe ningún visor de JSON/diff en el repo hoy — se construye nuevo y simple: por entrega inicial, una vista **key-by-key** (no un diff visual de líneas): iterar las claves de `after_json` (o `before_json` si es DELETE) y resaltar solo las que cambiaron respecto a `before_json` (comparación plana, sin recursión profunda — la mayoría de las entidades son DTOs planos). Sin dependencias nuevas (nada de librerías de diff externas) salvo que el volumen de campos anidados lo justifique más adelante.
- Este componente es el único punto de integración pedido por entidad — agregar el botón a una pantalla de detalle existente es la única modificación por dominio, sin duplicar lógica de fetch/render.

## Composable nuevo

`composables/useAudit.ts` (o separar en `useAuditConfig`/`useAuditLogins`/`useAuditReports`/`useAuditDataChanges` si crecen mucho — empezar con uno solo y dividir si supera ~150 líneas, mismo criterio que el resto del repo): wrappers delgados sobre `useApi()` para los endpoints de §Pantallas, siguiendo la normalización `Page<T>`/`toItems()` ya usada en `useRoles.ts` para las respuestas paginadas y no paginadas.

## Fuera de alcance de este entregable

- Restaurar un registro a un punto del historial (`<DOMAIN>_AUDIT_RESTORE` existe como permiso pero sin UI — el backend tampoco lo implementa aún).
- Compartir reportes por enlace/correo (`REPORT_SHARE`, tabla `report_share`) — sin UI, backend tampoco lo implementa.
- Diff visual "por línea" tipo Git — la vista key-by-key plana es suficiente para el primer entregable.

## Verificación

- Con `ALLY_AUDIT_VIEW`: el botón "Ver historial" aparece en el detalle de un aliado y el modal carga el timeline. Sin el permiso, el botón no se renderiza.
- Config por entidad: togglear `enabled` en `audit/config.vue` dispara el `PATCH` correcto y refleja el estado tras recargar.
- Overrides globales: cambiar `data_change_audit_mode` a `FORCE_DISABLED` y verificar (coordinando con backend) que deja de auditarse cualquier entidad.
- Bitácoras de login/reportes: paginación y filtros funcionan igual que en pantallas existentes (`roles`, `scheduled-jobs`).
