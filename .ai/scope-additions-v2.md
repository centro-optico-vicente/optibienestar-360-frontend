# Scope Additions v2 (frontend) — Vistas de los adicionales post-arranque

> **Espejo UI** del mapa canónico del backend: [optisalud-plus-backend `.ai/scope-additions-v2.md`](https://github.com/fenix-core/optisalud-plus-backend/blob/main/.ai/scope-additions-v2.md).
> **Fuente formal:** PDF "Informe de Avances y Solicitud de Continuidad v1" (mesas técnicas, mayo–junio 2026) + flyer comercial "OPTIBIENESTAR 360" (jun 2026).
>
> Las decisiones de negocio, schema, permisos y endpoints son **fuente de verdad del backend**. Este doc mapea cada ítem PDF a la **vista frontend** que lo consume. Bullets `[v2]` en cada vista referencian este doc.

## Numeración

- **v1** — alcance original (bullets sin tag en cada vista).
- **v2** — adicionales actuales (este doc). Bullets marcados `[v2]`.
- **v3** — reservado para futuras mesas técnicas (`scope-additions-v3.md` + tag `[v3]`).

## Mapeo: ítem PDF → vista frontend que lo consume

| # | Ítem PDF | Vista frontend | Endpoints backend que consume |
|---|---|---|---|
| 1 | Subsidios y Exoneraciones (+ Motor de Solvencia) | 🆕 [vista-12](checklists/vertical-12-subsidios-y-exoneraciones.md) + cross-ref [vista-5](checklists/vertical-5-planes-y-membresias.md) | `/v1/admin/subsidies*`, `/v1/me/subsidies`, `/v1/admin/payments/{uuid}/discount` |
| 2 | Descuentos por Referidos + Cobranza Delegada + Enlace Permanente | [vista-8](checklists/vertical-8-promotores-comisiones-referidos.md) | `/v1/admin/referral-programs`, `/v1/me/referral-rewards*`, `/v1/promoter/me/contacts*`, `/v1/promoter/me/collection-score` |
| 3 | Planes Corporativos y Masivos | [vista-5](checklists/vertical-5-planes-y-membresias.md) | `/v1/admin/corporate-contracts*` |
| 4 | Módulo de Promotores y Asesores | [vista-8](checklists/vertical-8-promotores-comisiones-referidos.md) | `/v1/promoter/me`, `/v1/admin/members/{uuid}/assign-promoter` |
| 5 | Motor de Comisiones + Premiaciones | [vista-8](checklists/vertical-8-promotores-comisiones-referidos.md) | `/v1/admin/leaderboard`, config `commission_tiers` |
| 6 | Flujo de Aprobación Aliados | [vista-3](checklists/vertical-3-aliados.md) | `/v1/aliado/services*`, `/v1/admin/ally-services/*` |
| 7 | Inclusión/Modificación de Beneficiarios | [vista-4](checklists/vertical-4-afiliados-y-familia.md) + [vista-5](checklists/vertical-5-planes-y-membresias.md) | `/v1/admin/members/{uuid}/beneficiaries*` |

## Adicional cross-cutting fuera del PDF: i18n bilingüe

> No es un ítem del PDF v2 pero entró al backend en paralelo (vertical-11) y obliga al frontend a sincronizar.

| Cambio backend | Vista frontend | Impacto UI |
|---|---|---|
| Bilingüe es/en + claim `locale` en JWT + `ProblemDetail` localizado + `POST /v1/me/locale` | 🆕 [vista-11](checklists/vertical-11-i18n.md) | `en.json`, `<LocaleSwitcher>`, `Accept-Language` en el API client, sync de preferencia con `/v1/me`, campo `locale` en form admin de usuarios |

## Notas de equivalencia (qué NO replica el frontend)

- **Migraciones / permisos / schema** son del backend — el frontend solo **gate-ea por permiso** (`SUBSIDY_APPROVE`, `ALLOWS_DISCOUNT`, `ALLY_SERVICE_APPROVE`, `MEMBER_ASSIGN_PROMOTER`) y **consume** los endpoints.
- **Cálculos de solvencia, comisiones, cobros y subsidios** los hace el backend; el frontend los **muestra** (badges, líneas de recibo, totales), no los recomputa.
- **Mensajes de error de negocio** vienen ya localizados en el `ProblemDetail`; el frontend no duplica ese catálogo (ver [vista-11](checklists/vertical-11-i18n.md)).

## TBDs heredados del backend (capturar con cliente)

| TBD | Vista | Pregunta |
|---|---|---|
| Plan Familiar — max beneficiaries | [vista-5](checklists/vertical-5-planes-y-membresias.md) | ¿Tope familiar = 3 incluidos + 2 extra, o tope duro 5? |
| Plan Corporativo — "$5/persona" | [vista-5](checklists/vertical-5-planes-y-membresias.md) | ¿$5 es mensualidad, inscripción, o ambas? |
| Plan Corporativo — `payer_mode` default | [vista-5](checklists/vertical-5-planes-y-membresias.md) | ¿Por contrato o mixto dentro del contrato? |
| Naming "1+/2+/3+ (Premium)" | [vista-5](checklists/vertical-5-planes-y-membresias.md) | ¿Alias del set actual, `tier` ortogonal, o reemplazo? Afecta labels de UI |
| Subsidios — alcance | [vista-12](checklists/vertical-12-subsidios-y-exoneraciones.md) | ¿Solo 100% o también parciales (X%)? |
| Subsidios — notificación | [vista-12](checklists/vertical-12-subsidios-y-exoneraciones.md) | ¿Se notifica al titular al otorgar/revocar? |
