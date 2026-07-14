# Vista 11 — Internacionalización (i18n) y Localización

> Equivalente UI del [backend vertical-11](https://github.com/fenix-core/optisalud-plus-backend/blob/main/.ai/checklists/vertical-11-i18n.md).
> `@nuxtjs/i18n` + bundles `es.json` / `en.json` (sin variantes regionales — ResourceBundle/i18n hacen fallback `es-VE → es`). Locale efectivo **debe espejar el del backend**: el JWT trae claim `locale`, el backend localiza sus `ProblemDetail` por `Accept-Language` o por ese claim, y persiste la preferencia por usuario. El frontend deja de ser "español-only".
>
> Cross-cutting: paraleliza con cualquier vista; idealmente arranca tras vista-1 (Auth) porque la preferencia de locale viaja en el JWT y se cambia desde el portal.
>
> Specs: [`../specs/06-i18n.md`](../specs/06-i18n.md) · [ADR 0010](../decisions/0010-localization-venezuela.md) (espejo del hub) · Índice: [../checklist.md](../checklist.md) · Orden: [../checklist-vertical.md](../checklist-vertical.md)

## Fase 1 — Bootstrap @nuxtjs/i18n (foundation)

- [x] [P1/C1] `@nuxtjs/i18n` instalado y registrado en `nuxt.config.ts` (ya listado en [fase-1](fase-1-bootstrap-frontend-nuxt.md)). Config: `defaultLocale: 'es'`, `strategy: 'no_prefix'` (no prefijar URLs — app SPA tras login), `lazy: true`, `langDir: 'locales/'`. — 2026-07-13
- [x] [P1/C2] **Bilingüe desde el día 1** (el backend ya soporta `en`): `locales: [{code:'es',name:'Español',file:'es.json'}, {code:'en',name:'English',file:'en.json'}]`. Actualizada [`specs/06-i18n.md`](../specs/06-i18n.md): el inglés deja de ser futuro (config bilingüe, reglas y sección "estado actual"). — 2026-07-13
- [ ] [P1/C1] `i18n/locales/es.json` poblado (fuente de verdad de UI) + `en.json` con las **mismas keys**. Estructura por dominio (`common`, `auth`, `members`, `memberships`, `payments`, `validator`, `errors`, …) — ya esbozada en el spec. **Parcial 2026-07-13:** poblados `common`, `validation`, `auth`, `security`, `nav`, `layout`, `landing`, `errors` (270 keys, paridad es/en verificada); el resto de dominios (members, memberships, payments, catalogs, allies, plans…) se puebla al retrofit de cada vertical.
- [x] [P1/C1] `composables/useFormatters.ts` — `formatCurrency` (`VES`/`USD` vía `Intl.NumberFormat('es-VE')`), `formatDate`, `formatRelative` ancladas a `es-VE` / `America/Caracas` ([ADR 0010](../decisions/0010-localization-venezuela.md)). Formato NO se ata al locale de UI (las cifras siguen en convención VE aunque la UI esté en inglés). — 2026-07-13

## Fase 1b — Retrofit de verticales ya construidos (español-only → `$t`)

> Todo el frontend entregado hasta hoy se construyó con textos en español **hardcodeados** (labels, placeholders, `help`, títulos/descripciones de toasts, encabezados de tabla, estados vacíos, badges y mensajes de validación zod). Tras la foundation (Fase 1), extraer los strings de cada vertical ya construido a keys `$t` de su dominio en `es.json` + `en.json` (mismas keys). Los `ProblemDetail` del backend ya llegan localizados — no re-traducir mensajes de negocio; solo textos UI-only. Moneda/fecha vía `useFormatters`. Un checkbox por vertical:

- [x] [P1/C2] **Auth + seguridad** (`auth`, `security`) — `pages/login.vue`, `recover-password.vue`, `reset-password.vue`, `dashboard/change-password.vue`, `dashboard/users/`, `dashboard/roles/` + `useAuth`/`useUsers`/`useRoles`. Ver [vertical-1](vertical-1-seguridad-y-autenticacion.md). — 2026-07-13. Las 6 páginas migradas a `$t`/`useI18n` (labels, placeholders, títulos/descripciones de modales y toasts, encabezados de tabla, estados vacíos, tooltips, badges de estado y mensajes de validación zod). Los composables `useAuth`/`useUsers`/`useRoles` no tenían strings UI (solo lógica API; errores vienen del `ProblemDetail`). `lastLoginAt` ahora vía `useFormatters`. Pendiente Fase 3: mapa de fallback de errores en `useApi.ts` (`FALLBACK`, mensaje 423).
- [x] [P1/C2] **Catálogos / datos maestros** (`catalogs`) — `dashboard/catalogs/` + `useCatalog`/`useDocumentTypes` + `utils/catalog-registry`. Ver [vertical-2](vertical-2-catalogos.md). — 2026-07-14. Registro data-driven (`catalog-registry.ts`) con `labelKey`/`labelSingularKey` por catálogo y `labelKey`/`regexMsgKey` por campo (labels es como fallback); `[resource].vue` resuelve vía helpers (`catLabel`/`catLabelSingular`/`fieldLabel`/`fieldRegexMsg`) y migra todo el UI (headers, filtros, modales, toasts, badges de estado, validación zod reusando `validation.maxChars`/`required`). `catalogs/index.vue` usa `visibleGroup` para el mosaico. **Bonus:** `nav.ts` catalogChildren ahora mapea `labelKey` → los hijos de "Datos maestros" del menú quedan bilingües (lo que quedó pendiente en el vertical layout/nav). `useCatalog`/`useDocumentTypes`/`usePublicCatalog` no tenían strings UI (solo API). 326 keys, paridad es/en.
- [ ] [P1/C2] **Aliados** (`allies`) — `dashboard/allies/`, `aliados/` (público), portal `aliado/` + `useAllies`. Ver [vertical-3](vertical-3-aliados.md).
- [ ] [P1/C2] **Afiliados y familia** (`members`) — `dashboard/members/`, portal `afiliado/` (carnet + beneficiarios) + `useMembers`. Ver [vertical-4](vertical-4-afiliados-y-familia.md).
- [ ] [P1/C2] **Planes** (`plans`) — `dashboard/plans/` + `PlanFormModal` + `usePlans`. Ver [vertical-5](vertical-5-planes-y-membresias.md).
- [ ] [P1/C2] **Pagos manuales** (`payments`) — `dashboard/payments/` (cola + detalle), `PaymentFormModal`, `PaymentReviewModal`, `MyPaymentsCard` + `usePayments`. Ver [vertical-6](vertical-6-pagos-manuales.md).
- [x] [P1/C1] **Layout / navegación / shell** (`common`, `nav`, `layout`, `landing`, `errors`) — sidebar/acordeón, `utils/nav.ts` (labels + descriptions), mosaicos por grupo, `pages/403.vue`, títulos `useSeoMeta` y `pages/index.vue`. — 2026-07-13. El menú data-driven (`nav.ts`) lleva `labelKey`/`descriptionKey` opcionales; `useNav` resuelve label/descripción a i18n en el origen (`visibleNav`/`visibleGroup`) para que `AppNavItem`/`NavMosaic` pinten texto ya traducido. Migrados: `layouts/{dashboard,auth,default}.vue`, `AppNavItem`, `NavMosaic`, `pages/dashboard/modulo/[group].vue`, `pages/403.vue`, `pages/index.vue` (landing pública completa). Los hijos de catálogo (derivados de `catalog-registry`) siguen con `label` literal → se traducen en el vertical Catálogos. **Diferido:** `pages/dashboard/index.vue` es un mockup con datos placeholder (KPIs/actividad ficticios) — se i18n al reconstruirlo con datos reales.

> Verticales aún **no construidos** (membresías, promotores/comisiones, validador, reportes, subsidios) nacen bilingües con `$t` desde el inicio — no requieren retrofit, se les puebla su dominio al implementarlos.

## Fase 2 — Sincronización de locale con el backend

- [ ] [P1/C2] **Leer locale del usuario**: al hidratar la sesión (`/v1/me`), tomar `user.locale` y `setLocale()` de i18n. El backend devuelve `locale` en el `UserDto` (ver backend vertical-11 Fase 4) — la preferencia persistida gana sobre el default del navegador.
- [ ] [P1/C2] **Cambiar locale mid-session** (Option C del backend): el selector de idioma hace `POST /v1/me/locale` con `{ locale }`, recibe un **access token nuevo** (`AccessTokenResponse`) con el claim `locale` actualizado, lo guarda y reemite requests con él. El refresh token NO rota (preferencia no es evento de seguridad). Tras el swap, `setLocale()` en el cliente.
- [ ] [P1/C1] `<LocaleSwitcher>` ES/EN en el header del layout autenticado — **entry point del usuario para i18n, inicialmente español e inglés** (base para sumar locales luego). Sin auth (login, recuperar contraseña) usa el locale local sin persistir (no hay JWT todavía).
- [ ] [P1/C1] Persistir el locale elegido en `localStorage` como hint pre-login (para que la pantalla de login respete la última preferencia antes de tener JWT).

## Fase 3 — API client: Accept-Language + errores localizados

- [ ] [P1/C2] Interceptor del `$api`/`useApi` agrega header `Accept-Language: <locale activo>` en cada request. El backend resuelve locale híbrido (claim JWT > `Accept-Language` > `es-VE`); mandar el header cubre los endpoints públicos sin JWT (login, contacto, directorio).
- [ ] [P1/C2] **Consumir los `ProblemDetail` ya localizados del backend**: el handler de errores muestra `problem.detail`/`problem.title` tal cual los manda el backend (vienen traducidos según el locale). Solo se traducen en el cliente los textos UI-only (labels, botones, vacíos) vía `$t`. No duplicar el catálogo de mensajes de negocio del backend.
- [ ] [P2/C1] Mapa de fallback opcional `errors.byStatus.{400,401,403,404,409,422,500}` en los bundles para cuando la respuesta no traiga `ProblemDetail` (errores de red/timeout sin payload).

## Fase 4 — Locale en formularios admin

- [ ] [P2/C1] Formulario admin de usuarios (`pages/admin/users/`) — campo `locale` (select `es`/`en`) en create/update, matchea `AdminUpdateUserRequest.locale` del backend (`@Pattern ^(es|es-VE|en)$`). Permite que el admin fije el idioma de un usuario (afecta el idioma de sus emails y respuestas API).
- [ ] [P2/C1] Mostrar el `locale` del usuario en la vista de detalle/listado admin (columna o badge).

## Fase 5 — QA / cobertura

- [ ] [P2/C2] Lint/test que verifique **paridad de keys** entre `es.json` y `en.json` (falla CI si una key existe en uno y no en el otro).
- [ ] [P2/C2] Guard anti-hardcode: regla (eslint o script) que detecte strings visibles fuera de `$t()` en `.vue` (al menos en `pages/` y `components/`).
- [ ] [P2/C2] Test e2e/unit: cambiar idioma vía `<LocaleSwitcher>` → request siguiente lleva `Accept-Language` nuevo y el `ProblemDetail` simulado llega en ese idioma.

## Notas de equivalencia con el backend

- El backend NO crea variantes `_es_VE`: el frontend tampoco (`es.json` cubre `es` y `es-VE`).
- El email siempre va en el idioma del **destinatario** (lo resuelve el backend); el frontend no decide idioma de email.
- El claim `locale` es la fuente cross-stack: front lo lee del `/v1/me`, lo cambia vía `/v1/me/locale`, lo manda como `Accept-Language`. Mantener los 3 alineados.
