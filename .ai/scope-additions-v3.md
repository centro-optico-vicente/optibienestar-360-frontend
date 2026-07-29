# Scope Additions v3 (frontend) — Vistas del motor de incentivos

> **Espejo UI** del mapa canónico del backend: [optibienestar-360-backend `.ai/scope-additions-v3.md`](https://github.com/fenix-core/optibienestar-360-backend/blob/main/.ai/scope-additions-v3.md).
> **Decisión congelada:** [ADR 0013 — Motor de Incentivos v3](https://github.com/fenix-core/centro-optico-vicente/blob/main/.ai/decisions/0013-incentives-engine-v3.md) (hub).
>
> Las decisiones de negocio, schema, permisos y endpoints son **fuente de verdad del backend**. Este doc mapea cada ítem del esquema a la **vista frontend** que lo consume. Bullets `[v3]` en cada vista referencian este doc.

## Numeración

- **v1** — alcance original (bullets sin tag en cada vista).
- **v2** — adicionales mayo–junio 2026 ([`scope-additions-v2.md`](scope-additions-v2.md), bullets `[v2]`).
- **v3** — este doc (mesa jul 2026). Bullets marcados `[v3]`. **Sin vista nueva** — todo entra en vistas existentes.
- **v4** — reservado (`scope-additions-v4.md` + tag `[v4]`).

## Mapeo: ítem del esquema → vista frontend que lo consume

| # | Ítem del esquema | Vista frontend | Endpoints/config backend que consume |
|---|---|---|---|
| A | Escala de comisión (25/30/35%) + bono por escala | [vista-8](checklists/vertical-8-promotores-comisiones-referidos.md) | config `commission_tiers` + `commission_bonus_rules` |
| B | Comisión de cobranza por días + día de corte | [vista-8](checklists/vertical-8-promotores-comisiones-referidos.md) | config `collection_commission_tiers`, `memberships.billing_start_day` |
| C | Referido-prosumidor → salto de mensualidad | [vista-8](checklists/vertical-8-promotores-comisiones-referidos.md) (afiliado) + cross-ref [vista-12](checklists/vertical-12-subsidios-y-exoneraciones.md) | `/v1/me/referrals`, subsidios auto-otorgados (`/v1/me/subsidies`) |
| D1 | Fidelidad aliado (voucher por consumo/compras) | [vista-3](checklists/vertical-3-aliados.md) | `/v1/admin/loyalty-programs`, `/v1/me/loyalty-vouchers` |
| D2 | Cortesía de aliado (regalo validable) | [vista-3](checklists/vertical-3-aliados.md) (portal aliado) | `/v1/aliado/courtesy-grants` |

## Notas de equivalencia (qué NO replica el frontend)

- **Migraciones / permisos / schema / motores** (re-rating, evaluadores, jobs) son del backend — el frontend solo **gate-ea por permiso** (`COMMISSION_TIER_MANAGE`, `ALLY_LOYALTY_MANAGE`, `ALLY_COURTESY_GRANT`, `LOYALTY_VIEW_OWN`) y **consume** los endpoints.
- **Cálculos de comisión, cobranza, subsidio y fidelidad** los hace el backend; el frontend los **muestra** (progreso hacia meta, badges de voucher, líneas de comisión), no los recomputa.

## TBDs heredados del backend (capturar con cliente)

| TBD | Vista | Pregunta |
|---|---|---|
| Tope de meses de subsidio por referido | [vista-8](checklists/vertical-8-promotores-comisiones-referidos.md) | ¿Máximo de meses ganables por período? (afecta el badge de progreso) |
| Caducidad del voucher de fidelidad | [vista-3](checklists/vertical-3-aliados.md) | ¿El voucher expira? (afecta el estado mostrado) |
| Alcance de la cortesía | [vista-3](checklists/vertical-3-aliados.md) | ¿Titular o cualquier beneficiario? (selector en el form del aliado) |
