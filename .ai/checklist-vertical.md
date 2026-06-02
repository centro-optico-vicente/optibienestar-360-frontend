# Plan de ejecución por vistas verticales — frontend

> Cada vista entrega páginas + componentes + composables/stores completos y navegables, contra los endpoints del backend del vertical equivalente.
>
> **Dashboard de progreso (conteos, %):** [`checklist.md`](checklist.md)
> **Fuente de verdad de checkboxes:** archivos `checklists/vertical-N-*.md`
>
> Numeración **alineada con el backend** ([backend `checklist-vertical.md`](https://github.com/fenix-core/optisalud-plus-backend/blob/main/.ai/checklist-vertical.md)): vertical-3 = Aliados en ambos repos, etc. Cada vista consume los endpoints del vertical homónimo del backend.

## Dependencias

```
FASE 1 (bootstrap Nuxt) ────────────────────────────► todas las vistas
1 (Auth + RBAC + layout) ───────────────────────────► todas las demás
2 (Catálogos) ──► 3 (Aliados), 4 (Afiliados)  [selects alimentados por catálogo]
3 (Aliados) ────► 7 (Validador)
4 (Afiliados) ──► 5 (Membresías)
5 (Membresías) ─► 6 (Pagos), 9 (Portal/Carnet)
6 (Pagos) ──────► 8 (Promotores/Comisiones), 9 (Portal/Carnet)
1–9 ────────────► 10 (Optimización / Reportes / QA)
```

> Catálogos (vertical-2) tiene **gestión propia** (`pages/dashboard/catalogs/`) y además se consume como selects alimentados por catálogo en los formularios de otras vistas (ver [ADR 0005](decisions/0005-catalog-backed-selects.md)).

## Vistas

| # | Vista | Archivo | Backend equivalente | Estado |
|---|---|---|---|---|
| 1 | Seguridad y Autenticación | [vertical-1-seguridad-y-autenticacion.md](checklists/vertical-1-seguridad-y-autenticacion.md) | vertical-1 | ✅ |
| 2 | Catálogos | [vertical-2-catalogos.md](checklists/vertical-2-catalogos.md) | vertical-2 | ✅ |
| 3 | Aliados | [vertical-3-aliados.md](checklists/vertical-3-aliados.md) | vertical-3 | 🔲 |
| 4 | Afiliados y Familia | [vertical-4-afiliados-y-familia.md](checklists/vertical-4-afiliados-y-familia.md) | vertical-4 | 🔲 |
| 5 | Planes y Membresías | [vertical-5-planes-y-membresias.md](checklists/vertical-5-planes-y-membresias.md) | vertical-5 | 🔲 |
| 6 | Pagos manuales | [vertical-6-pagos-manuales.md](checklists/vertical-6-pagos-manuales.md) | vertical-6 | 🔲 |
| 7 | Validador | [vertical-7-validador.md](checklists/vertical-7-validador.md) | vertical-7 | 🔲 |
| 8 | Promotores, Comisiones y Referidos | [vertical-8-promotores-comisiones-referidos.md](checklists/vertical-8-promotores-comisiones-referidos.md) | vertical-8 | 🔲 |
| 9 | Portal afiliado y Carnet digital | [vertical-9-notificaciones-y-carnet.md](checklists/vertical-9-notificaciones-y-carnet.md) | vertical-9 | 🔲 |
| 10 | Optimización, Reportes y QA | [vertical-10-optimizacion-reportes-hardening.md](checklists/vertical-10-optimizacion-reportes-hardening.md) | vertical-10 | 🔲 |
