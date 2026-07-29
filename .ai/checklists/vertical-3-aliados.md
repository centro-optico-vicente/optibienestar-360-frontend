# Vista 3 — Aliados

> Vistas de directorio y gestión de aliados (clínicas, farmacias, ambulancias). Requiere el portal del propio aliado.
> Índice: [../checklist.md](../checklist.md) · Orden: [../checklist-vertical.md](../checklist-vertical.md)

## Bugs verificados — desfases de forma DTO

> Auditados el 2026-07-15 contra los records + mappers + tipos de retorno de los controllers del backend. **No son sospechas: cada uno está confirmado en la fuente.** Ver el patrón común en [`../dto-shape-mismatches.md`](../dto-shape-mismatches.md).
>
> **Causa raíz:** el backend tiene **dos proyecciones por recurso** (`AllyListItemDto` plano para listar / `AllyDetailDto` anidado para detalle) y el frontend las colapsó en **un único tipo escrito a mano** (`AllyDto`). Una sola mentira que se ramifica a tres páginas.
>
> **Por qué el typecheck no los caza:** el tipo es una afirmación a mano sobre el formato del cable, no algo generado. `a.allyType?.name` compila perfecto contra un tipo equivocado. Precedente ya corregido con el mismo diagnóstico: `AllyUserDto` anidado→plano ([PR #38](https://github.com/fenix-core/optibienestar-360-frontend/pull/38)).

- [ ] [P0/C2] **Directorio público sin tipo, ciudad ni especialidades** — `GET /v1/public/allies` devuelve `Page<PublicAllyListItemDto>`, que es **plano** (`allyTypeName`, `cityName`) y **no trae `specialties`**; `composables/useAllies.ts:154` lo tipa `Page<PublicAllyDto>` (anidado + `specialties`). `pages/aliados/index.vue:235-248` lee `a.allyType?.name` → siempre cae al fallback genérico; `a.city?.name` → nunca renderiza; `a.specialties?.length` → el bloque de badges **no renderiza para ningún aliado**. **Es la vitrina pública, tráfico anónimo.** Fix: dividir `PublicAllyDto` en `PublicAllyListItemDto` + `PublicAllyDetailDto` espejando el cable.
- [ ] [P1/C2] **Detalle público decapitado** — `GET /v1/public/allies/{uuid}` devuelve `PublicAllyDetailDto`: `allyTypeName`/`cityName` planos, `specialtyNames: List<String>` (no `specialties: CatalogRef[]`) y `services[].categoryName: String` (no `serviceCategory: CatalogRef`). `pages/aliados/[uuid].vue:85-97,147` lee las 4 formas viejas → tipo con fallback, ciudad nunca, bloque de especialidades nunca, y cada tarjeta de servicio sin su subtítulo de categoría. Los servicios sí llegan; solo les falta la cabecera.
- [ ] [P1/C1] **Tabla admin de aliados: columnas Tipo y Ciudad siempre "—"** — `GET /v1/admin/allies` devuelve `Page<AllyListItemDto>` (plano), tipado `Page<AllyDto>` en `useAllies.ts:39`. `pages/dashboard/allies/index.vue:401,406` lee `a.allyType?.name` / `a.city?.name`. **Ojo:** el `openEdit()` del mismo archivo (línea ~220) ya tiene un comentario que dice que la fila trae campos planos y por eso carga el detalle — alguien entendió el problema, arregló el formulario y dejó la tabla rota. El detalle (`AllyDetailDto`) **sí** es anidado, así que `dashboard/allies/[uuid].vue:714,741` está correcto: el bug es solo de lista.
- [ ] [P2/C1] **`PublicAllyDto.email` es un campo fantasma** — `PublicAllyDetailDto` omite el email **a propósito** (su Javadoc: lo cosecharían los scrapers), así que el `v-if="ally.email"` de `pages/aliados/[uuid].vue:115` nunca renderiza — accidentalmente correcto. Quitar el campo del tipo. **NO** "arreglarlo" agregando el email al backend.
- [ ] [P2/C1] **`AllyDto.services` es campo muerto** — `AllyDetailDto` no inlinea servicios; `dashboard/allies/[uuid].vue` los carga con `listServices()` y nunca lee `ally.services`. Sin síntoma; limpiar al dividir el tipo.

## Admin

- [ ] [P0/C3] Página `pages/admin/allies/index.vue` (tabla + filtros + búsqueda)
- [ ] [P0/C3] Página `pages/admin/allies/new.vue` + `[id].vue` (wizard multi-step)

## Portal aliado

- [ ] [P0/C3] Página `pages/aliado/dashboard.vue` (vista del propio aliado)

## Adicionales v2 — Flujo de Aprobación de Servicios

> Equivalente UI del [backend vertical-3 §Adicionales v2](https://github.com/fenix-core/optibienestar-360-backend/blob/main/.ai/checklists/vertical-3-aliados.md) (ítem PDF #6). Mapa: [`../scope-additions-v2.md`](../scope-additions-v2.md).

### Portal aliado

- [ ] [v2] [P0/C2] Form "Proponer servicio" en `pages/aliado/` → `POST /v1/aliado/services` (categoría + nombre/desc/precio + `discount_pct` + requiere cita). El servicio entra en `PROPOSED`. Selector de aliado si el usuario pertenece a varios.
- [ ] [v2] [P0/C2] Listado de servicios propios del aliado con **badge de estado** (PROPOSED/IN_REVIEW/APPROVED/REJECTED/REMOVED) y, en REJECTED/REMOVED, el `review_reason`.
- [ ] [v2] [P0/C2] Acción "Retirar servicio" sobre un APPROVED (`DELETE /v1/aliado/services/{uuid}` → transiciona a REMOVED). Solo OWNER/STAFF.
- [ ] [v2] [P0/C2] Vista de historial de revisión del servicio (`GET /v1/aliado/services/{uuid}/log`) — log compartido admin↔aliado.

### Admin — cola de revisión

- [ ] [v2] [P0/C3] Página `pages/admin/ally-services/pending.vue` — cola de revisión (`GET /v1/admin/ally-services/pending`, filtrable por aliado/tipo).
- [ ] [v2] [P0/C2] Acciones aprobar / rechazar / remover (`POST .../{uuid}/approve|reject|remove`) — reject/remove exigen `reason`. Botones gated por permiso `ALLY_SERVICE_APPROVE`.
- [ ] [v2] [P0/C2] Vista de historial de revisión admin (`GET /v1/admin/ally-services/{uuid}/log`) — mismo log que ve el aliado.
- [ ] [v2] [P0/C1] El directorio público (`pages` públicas) solo muestra servicios `APPROVED` (el backend ya filtra; el front no debe asumir otros estados visibles).

## Adicionales v3 — Fidelidad y cortesías de aliados

> Equivalente UI del [backend vertical-3 §Adicionales v3](https://github.com/fenix-core/optibienestar-360-backend/blob/main/.ai/checklists/vertical-3-aliados.md) (ítems D1/D2). Mapa: [`../scope-additions-v3.md`](../scope-additions-v3.md) · [ADR 0013](https://github.com/fenix-core/centro-optico-vicente/blob/main/.ai/decisions/0013-incentives-engine-v3.md).

- [ ] [v3] [P1/C2] Admin: CRUD de **programas de fidelidad** `pages/admin/loyalty-programs/` (`/v1/admin/loyalty-programs`, `ALLY_LOYALTY_MANAGE`) — métrica (consumo $ / nº compras), umbral ($100 / 50), premio parametrizable (servicio gratis / % descuento), aliado o global. _(El backend evalúa y emite vouchers.)_
- [ ] [v3] [P1/C2] Portal aliado (`pages/aliado/`): otorgar **cortesía** a 1 persona de una membresía (`POST /v1/aliado/courtesy-grants`, `ALLY_COURTESY_GRANT`) — p. ej. 1ª consulta gratis; + listado de cortesías/vouchers emitidos y su estado de canje. _(El validador reconoce el canje.)_
- [ ] [v3] [P1/C2] Afiliado: **"Mis vouchers de fidelidad"** (`GET /v1/me/loyalty-vouchers`, `LOYALTY_VIEW_OWN`) — vouchers ganados por consumo/compras, con premio y estado (pendiente/canjeado/vencido). _(Solo muestra; el canje ocurre en el aliado vía validador.)_
