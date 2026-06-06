# Vista 11 — Internacionalización (i18n) y Localización

> Equivalente UI del [backend vertical-11](https://github.com/fenix-core/optisalud-plus-backend/blob/main/.ai/checklists/vertical-11-i18n.md).
> `@nuxtjs/i18n` + bundles `es.json` / `en.json` (sin variantes regionales — ResourceBundle/i18n hacen fallback `es-VE → es`). Locale efectivo **debe espejar el del backend**: el JWT trae claim `locale`, el backend localiza sus `ProblemDetail` por `Accept-Language` o por ese claim, y persiste la preferencia por usuario. El frontend deja de ser "español-only".
>
> Cross-cutting: paraleliza con cualquier vista; idealmente arranca tras vista-1 (Auth) porque la preferencia de locale viaja en el JWT y se cambia desde el portal.
>
> Specs: [`../specs/06-i18n.md`](../specs/06-i18n.md) · [ADR 0010](../decisions/0010-localization-venezuela.md) (espejo del hub) · Índice: [../checklist.md](../checklist.md) · Orden: [../checklist-vertical.md](../checklist-vertical.md)

## Fase 1 — Bootstrap @nuxtjs/i18n (foundation)

- [ ] [P1/C1] `@nuxtjs/i18n` instalado y registrado en `nuxt.config.ts` (ya listado en [fase-1](fase-1-bootstrap-frontend-nuxt.md)). Config: `defaultLocale: 'es'`, `strategy: 'no_prefix'` (no prefijar URLs — app SPA tras login), `lazy: true`, `langDir: 'locales/'`.
- [ ] [P1/C2] **Bilingüe desde el día 1** (el backend ya soporta `en`): `locales: [{code:'es',name:'Español',file:'es.json'}, {code:'en',name:'English',file:'en.json'}]`. Actualizar [`specs/06-i18n.md`](../specs/06-i18n.md) que hoy declara "audiencia 100% hispanohablante / inglés futuro" — el inglés deja de ser futuro porque el backend ya devuelve payloads localizados en `en`.
- [ ] [P1/C1] `i18n/locales/es.json` poblado (fuente de verdad de UI) + `en.json` con las **mismas keys**. Estructura por dominio (`common`, `auth`, `members`, `memberships`, `payments`, `validator`, `errors`, …) — ya esbozada en el spec.
- [ ] [P1/C1] `composables/useFormatters.ts` — `formatCurrency` (`VES`/`USD` vía `Intl.NumberFormat('es-VE')`), `formatDate`, `formatRelative` ancladas a `es-VE` / `America/Caracas` ([ADR 0010](../decisions/0010-localization-venezuela.md)). Formato NO se ata al locale de UI (las cifras siguen en convención VE aunque la UI esté en inglés).

## Fase 2 — Sincronización de locale con el backend

- [ ] [P1/C2] **Leer locale del usuario**: al hidratar la sesión (`/v1/me`), tomar `user.locale` y `setLocale()` de i18n. El backend devuelve `locale` en el `UserDto` (ver backend vertical-11 Fase 4) — la preferencia persistida gana sobre el default del navegador.
- [ ] [P1/C2] **Cambiar locale mid-session** (Option C del backend): el selector de idioma hace `POST /v1/me/locale` con `{ locale }`, recibe un **access token nuevo** (`AccessTokenResponse`) con el claim `locale` actualizado, lo guarda y reemite requests con él. El refresh token NO rota (preferencia no es evento de seguridad). Tras el swap, `setLocale()` en el cliente.
- [ ] [P1/C1] `<LocaleSwitcher>` en el header del layout autenticado (`es` / `en`). Sin auth (login, recuperar contraseña) usa el locale local sin persistir (no hay JWT todavía).
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
