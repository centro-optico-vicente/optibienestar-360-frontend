# Vista 3 — Aliados

> Vistas de directorio y gestión de aliados (clínicas, farmacias, ambulancias). Requiere el portal del propio aliado.
> Índice: [../checklist.md](../checklist.md) · Orden: [../checklist-vertical.md](../checklist-vertical.md)

## Bugs verificados — desfases de forma DTO

> Auditados el 2026-07-15 contra los records + mappers + tipos de retorno de los controllers del backend. **No son sospechas: cada uno está confirmado en la fuente.** Ver el patrón común en [`../dto-shape-mismatches.md`](../dto-shape-mismatches.md).
>
> **Causa raíz:** el backend tiene **dos proyecciones por recurso** (`AllyListItemDto` plano para listar / `AllyDetailDto` anidado para detalle) y el frontend las colapsó en **un único tipo escrito a mano** (`AllyDto`). Una sola mentira que se ramifica a tres páginas.
>
> **Por qué el typecheck no los caza:** el tipo es una afirmación a mano sobre el formato del cable, no algo generado. `a.allyType?.name` compila perfecto contra un tipo equivocado. Precedente ya corregido con el mismo diagnóstico: `AllyUserDto` anidado→plano ([PR #38](https://github.com/fenix-core/optibienestar-360-frontend/pull/38)).

- [x] [P0/C2] **Directorio público sin tipo, ciudad ni especialidades** — `GET /v1/public/allies` devuelve `Page<PublicAllyListItemDto>`, que es **plano** (`allyTypeName`, `cityName`) y **no trae `specialties`**; `composables/useAllies.ts:154` lo tipa `Page<PublicAllyDto>` (anidado + `specialties`). `pages/aliados/index.vue:235-248` lee `a.allyType?.name` → siempre cae al fallback genérico; `a.city?.name` → nunca renderiza; `a.specialties?.length` → el bloque de badges **no renderiza para ningún aliado**. **Es la vitrina pública, tráfico anónimo.** Fix: dividir `PublicAllyDto` en `PublicAllyListItemDto` + `PublicAllyDetailDto` espejando el cable. **Resuelto (#224):** `PublicAllyListItemDto` espeja el cable (`allyTypeNames`, `cityName`) y `pages/aliados/index.vue` lee esos campos planos.
- [x] [P1/C2] **Detalle público decapitado** — `GET /v1/public/allies/{uuid}` devuelve `PublicAllyDetailDto`: `allyTypeName`/`cityName` planos, `specialtyNames: List<String>` (no `specialties: CatalogRef[]`) y `services[].categoryName: String` (no `serviceCategory: CatalogRef`). `pages/aliados/[uuid].vue:85-97,147` lee las 4 formas viejas → tipo con fallback, ciudad nunca, bloque de especialidades nunca, y cada tarjeta de servicio sin su subtítulo de categoría. Los servicios sí llegan; solo les falta la cabecera. **Resuelto (#224):** `PublicAllyDetailDto` (`professionNames`, `services[].categoryName`) y `pages/aliados/[uuid].vue` lee las formas planas.
- [x] [P1/C1] **Tabla admin de aliados: columnas Tipo y Ciudad siempre "—"** — `GET /v1/admin/allies` devuelve `Page<AllyListItemDto>` (plano), tipado `Page<AllyDto>` en `useAllies.ts:39`. `pages/dashboard/allies/index.vue:401,406` lee `a.allyType?.name` / `a.city?.name`. **Ojo:** el `openEdit()` del mismo archivo (línea ~220) ya tiene un comentario que dice que la fila trae campos planos y por eso carga el detalle — alguien entendió el problema, arregló el formulario y dejó la tabla rota. El detalle (`AllyDetailDto`) **sí** es anidado, así que `dashboard/allies/[uuid].vue:714,741` está correcto: el bug es solo de lista. **Resuelto (#84, #195):** la tabla usa `AllyListItemDto` (`allyTypeNames`, `city_Display`).
- [x] [P2/C1] **`PublicAllyDto.email` es un campo fantasma** — `PublicAllyDetailDto` omite el email **a propósito** (su Javadoc: lo cosecharían los scrapers), así que el `v-if="ally.email"` de `pages/aliados/[uuid].vue:115` nunca renderiza — accidentalmente correcto. Quitar el campo del tipo. **NO** "arreglarlo" agregando el email al backend. **Resuelto (#224):** el tipo público ya no declara `email`.
- [x] [P2/C1] **`AllyDto.services` es campo muerto** — `AllyDetailDto` no inlinea servicios; `dashboard/allies/[uuid].vue` los carga con `listServices()` y nunca lee `ally.services`. Sin síntoma; limpiar al dividir el tipo. **Resuelto 2026-10-24:** campo quitado de `AllyDto`.

## Admin

- [ ] [P0/C3] Página `pages/admin/allies/index.vue` (tabla + filtros + búsqueda)
- [ ] [P0/C3] Página `pages/admin/allies/new.vue` + `[id].vue` (wizard multi-step)

## Portal aliado

- [ ] [P0/C3] Página `pages/allies/dashboard.vue` (vista del propio aliado)

## Catálogo de productos y servicios (hub ADR 0026)

> El backend reemplazó los "servicios del aliado" (`ally_services`) por un **catálogo maestro de productos** (`products`: `SERVICE`/`PRODUCT`, categoría, aliado dueño = exclusivo o null = general) y las **ofertas** del aliado (`ally_products`: precio, tarifa preferencial, precio final, exclusiones, revisión, publicación). La categoría `service-categories` pasó a `product-categories`. Las rutas viejas `/services` responden como alias deprecado, pero con otra forma JSON y otros permisos — el front se migró en `feature/products-model`.

- [x] [P0/C3] Maestro `pages/dashboard/products/index.vue` (`useProducts`, `types/products.ts`) — tabla con `q`, filtros tipo / categoría (`filter=productCategory.uuid==…`) / general-exclusivo; alta/edición en `ProductFormModal` (la edición carga `GET /{uuid}`); borrado lógico; detalle `ProductDetailModal` con imagen (subir → publicar/despublicar/eliminar) y pestaña **"Aliados que lo ofrecen"** (`GET /v1/admin/products/{uuid}/offers`). Permisos `PRODUCT_*`, auditoría `product`.
- [x] [P0/C2] Detalle de aliado: pestaña **"Productos y servicios"** paginada (`GET /v1/admin/allies/{uuid}/products` → `Page`), alta eligiendo un producto general (buscador sobre `/v1/admin/products?exclusive=false`) o "crear exclusivo"; los datos del ítem solo se editan si es exclusivo (`AllyProductFormModal`). Aprobar / rechazar / retirar en la fila (`/v1/admin/ally-products/{uuid}/approve|reject|remove`, `ALLY_PRODUCT_APPROVE`). Permisos `ALLY_PRODUCT_*`.
- [x] [P0/C2] Portal aliado `pages/allies/index.vue`: proponer un producto existente o uno nuevo exclusivo (`POST /v1/me/allies/products`). Sin `PRODUCT_VIEW_ALL` el buscador usa el catálogo público `/v1/public/products` (solo lo que algún aliado ya ofrece públicamente).
- [x] [P1/C1] Catálogo `product-categories` (registro + nav "Alianzas"); `/dashboard/catalogs/service-categories` redirige.
- [x] [P1/C2] "Aliados que lo ofrecen" usa `ally_Display` (backend #361); se quitó el `GET` por aliado.
- [x] [P1/C2] Portal aliado: el buscador usa `GET /v1/me/allies/products/offerable` (backend #361).
- [x] [P1/C2] Cola de revisión `pages/dashboard/ally-products/pending.vue` (`/v1/admin/ally-products/pending`, filtros aliado/categoría/q, aprobar/rechazar, historial) — hoja "Revisión de ofertas" en "Alianzas", `ALLY_PRODUCT_APPROVE`.
- [x] [P1/C2] Tres niveles de "aparece en público": aliado (`published`, directorio), oferta (`published`, switch en la fila y el form — ficha del aliado) y producto (`published`, "Visible en el catálogo general" — solo el catálogo general; columna + filtro RSQL `published==`).
- [x] [P0/C3] Catálogo público `/catalogo` ↔ `/en/catalog` (`pages/catalogo/index.vue`): búsqueda, chips de tipo, categoría por nombre, ciudad/estado y aliado en palabras, reflejados en la URL (`?q=&tipo=&categoria=&ciudad=&aliado=`), "Ver más".
- [x] [P0/C2] Comparación `/catalogo/{uuid}` (`pages/catalogo/[uuid].vue`): resumen "Desde $X · hasta Y%", ofertas por aliado (precio, tarifa, precio final, exclusiones, WhatsApp/teléfono, enlace al aliado), filtro de ciudad (`?ciudad=`), 404 amable.
- [x] [P1/C2] `/aliados`: filtros en palabras (q sobre nombre/RIF/nº/ciudad, ciudad o estado, rubro por nombre) en la URL; `/aliados/{uuid}` lee `products` (tipo, precio final, exclusiones), "Comparar con otros aliados" solo si `inCatalog`, y "Ver todo lo que ofrece en el catálogo" → `/catalogo?aliado=<nombre>`.

## Adicionales v2 — Flujo de Aprobación de Servicios

> **Nota (hub ADR 0026):** los "servicios" ahora son **ofertas de productos** — rutas `/v1/me/allies/products*` y `/v1/admin/ally-products/*`, permiso `ALLY_PRODUCT_APPROVE` (antes `ALLY_SERVICE_APPROVE`). Los ítems de abajo conservan la redacción original.
>
> Equivalente UI del [backend vertical-3 §Adicionales v2](https://github.com/fenix-core/optibienestar-360-backend/blob/main/.ai/checklists/vertical-3-aliados.md) (ítem PDF #6). Mapa: [`../scope-additions-v2.md`](../scope-additions-v2.md).

### Portal aliado

- [x] [v2] [P0/C2] Form "Proponer servicio" en `pages/allies/` → `POST /v1/allies/me/services` (hoy `POST /v1/me/allies/products`, producto existente o nuevo exclusivo) (categoría + nombre/desc/precio + `discount_pct` + requiere cita). El servicio entra en `PROPOSED`. Selector de aliado si el usuario pertenece a varios.
- [ ] [v2] [P0/C2] Listado de servicios propios del aliado con **badge de estado** (PROPOSED/IN_REVIEW/APPROVED/REJECTED/REMOVED) y, en REJECTED/REMOVED, el `review_reason`.
- [ ] [v2] [P0/C2] Acción "Retirar servicio" sobre un APPROVED (`DELETE /v1/allies/me/services/{uuid}` → transiciona a REMOVED). Solo OWNER/STAFF.
- [ ] [v2] [P0/C2] Vista de historial de revisión del servicio (`GET /v1/allies/me/services/{uuid}/log`) — log compartido admin↔aliado.

### Admin — cola de revisión

- [ ] [v2] [P0/C3] Página `pages/admin/ally-services/pending.vue` — cola de revisión (`GET /v1/admin/ally-services/pending`, filtrable por aliado/tipo).
- [x] [v2] [P0/C2] Acciones aprobar / rechazar / remover (`POST .../{uuid}/approve|reject|remove`) — reject/remove exigen `reason`. Botones gated por permiso `ALLY_PRODUCT_APPROVE` (antes `ALLY_SERVICE_APPROVE`). _Hechas en la pestaña "Productos y servicios" del detalle de aliado; la cola global sigue pendiente._
- [ ] [v2] [P0/C2] Vista de historial de revisión admin (`GET /v1/admin/ally-services/{uuid}/log`) — mismo log que ve el aliado.
- [ ] [v2] [P0/C1] El directorio público (`pages` públicas) solo muestra servicios `APPROVED` (el backend ya filtra; el front no debe asumir otros estados visibles).

## Adicionales v3 — Fidelidad y cortesías de aliados

> Equivalente UI del [backend vertical-3 §Adicionales v3](https://github.com/fenix-core/optibienestar-360-backend/blob/main/.ai/checklists/vertical-3-aliados.md) (ítems D1/D2). Mapa: [`../scope-additions-v3.md`](../scope-additions-v3.md) · [ADR 0013](https://github.com/fenix-core/centro-optico-vicente/blob/main/.ai/decisions/0013-incentives-engine-v3.md).

- [ ] [v3] [P1/C2] Admin: CRUD de **programas de fidelidad** `pages/admin/loyalty-programs/` (`/v1/admin/loyalty-programs`, `ALLY_LOYALTY_MANAGE`) — métrica (consumo $ / nº compras), umbral ($100 / 50), premio parametrizable (servicio gratis / % descuento), aliado o global. _(El backend evalúa y emite vouchers.)_
- [ ] [v3] [P1/C2] Portal aliado (`pages/allies/`): otorgar **cortesía** a 1 persona de una membresía (`POST /v1/allies/me/courtesy-grants`, `ALLY_COURTESY_GRANT`) — p. ej. 1ª consulta gratis; + listado de cortesías/vouchers emitidos y su estado de canje. _(El validador reconoce el canje.)_
- [ ] [v3] [P1/C2] Afiliado: **"Mis vouchers de fidelidad"** (`GET /v1/me/loyalty-vouchers`, `LOYALTY_VIEW_OWN`) — vouchers ganados por consumo/compras, con premio y estado (pendiente/canjeado/vencido). _(Solo muestra; el canje ocurre en el aliado vía validador.)_

## Galerías de imágenes (hub ADR 0027)

> Reemplaza el logo de texto libre del aliado y el flujo de imagen de producto en dos pasos (`/image`, `/publish`, `/unpublish`, eliminados sin alias). Plan: [hub `plans/2026-10-26-media-items.md`](https://github.com/fenix-core/centro-optico-vicente/blob/main/.ai/plans/2026-10-26-media-items.md). Requiere el backend de media desplegado antes.

- [x] `MediaGalleryEditor.vue` reutilizable + `useMedia.ts` + `types/media.ts` (orden con arrastrar/flechas → `PUT /order`, principal, subir, URL https, texto alternativo, eliminar, `n / 10`, mensajes 403/422).
- [x] Permisos `ALLY_IMAGE_*`, `ALLY_PRODUCT_IMAGE_*` y `PRODUCT_IMAGE_UPDATE` en `types/permissions.ts`.
- [x] Admin: detalle del aliado, `ProductDetailModal` y `AllyProductFormModal` (edición de oferta, con la nota "se usan las del producto").
- [x] Portal del aliado (`pages/allies/index.vue`): galería del aliado y de la oferta recién propuesta (`/v1/me/...`); VIEWER en solo lectura.
- [x] Páginas públicas: `PublicImageGallery.vue` en `/aliados/{uuid}`, `/catalogo/{uuid}` y las ofertas de la comparativa (respaldo a `logoUrl`/`imageUrl`).
- [x] i18n `media.*` es/en.
- [x] Portal: listado de las ofertas propias (`GET /v1/me/allies/{allyUuid}/products`) con galería por oferta.
