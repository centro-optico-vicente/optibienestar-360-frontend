# Vista 2 — Catálogos

> Gestión de datos maestros (países, estados, ciudades, géneros, tipos de documento, especialidades…). Los catálogos también se consumen como selects en formularios de otras vistas ([ADR 0005](../decisions/0005-catalog-backed-selects.md)).
> Índice: [../checklist.md](../checklist.md) · Orden: [../checklist-vertical.md](../checklist-vertical.md)

## Admin

- [x] [P0/C3] Registro declarativo de catálogos `utils/catalog-registry.ts` (campos, labels y endpoint por catálogo) — 2026-05
- [x] [P0/C2] Página índice `pages/dashboard/catalogs/index.vue` (lista de catálogos disponibles) — 2026-05
- [x] [P0/C3] Página genérica `pages/dashboard/catalogs/[resource].vue` (CRUD por catálogo, protegida por roles `SYSTEM`/`ADMINISTRADOR`) — 2026-05
